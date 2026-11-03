const {harness,seed,diagnostic,save,usage,sleep,ok}=require("./phase2e-support.cjs"),candidate=require("./phase2e-candidate.cjs"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{fork}=require("node:child_process");
const kind=process.argv[2];if(!["reference","component"].includes(kind))throw Error("reference or component");
const limits={workerRssMiB:384,controllerRssMiB:512,fixtureMs:65000},results=[];
const stats=a=>{const s=a.filter(Number.isFinite).sort((a,b)=>a-b),q=f=>s.length?s[Math.floor((s.length-1)*f)]:null;return{samples:s.length,p50:q(.5),p95:q(.95),p99:s.length>=100?q(.99):null};};
(async()=>{
 for(const posts of kind==="reference"?[5000,10000]:[5000,10000,20000]){
  const h=await harness(kind==="reference"?5171:5172),row={kind,posts,employees:1000,bursts:[],responses:[],memory:[],status:"RUNNING"},started=Date.now();let child,w,monitor,reason="",pending=new Map();
  try{
   await seed(h,posts);await candidate.prepare(h.repo);
   if(kind==="reference"){w=await diagnostic(h,5171);child=w.child;}
   else{
    child=fork(path.join(__dirname,"phase2e-component-worker.cjs"),[h.root],{env:h.proof.childEnv,stdio:["ignore","ignore","ignore","ipc"]});
    child.on("message",m=>{if(m.type==="result"){row.memory.push(m.memory);pending.get(m.request)?.(m);pending.delete(m.request);}});
   }
   monitor=setInterval(()=>{
    const rss=usage(child.pid).rssMiB;row.peakRssMiB=Math.max(row.peakRssMiB||0,rss);
    if(rss>384||usage(process.pid).rssMiB>512||Date.now()-started>limits.fixtureMs){reason=rss>384?"worker RSS guard":usage(process.pid).rssMiB>512?"controller RSS guard":"fixture deadline";child.kill("SIGKILL");}
   },40);
   const request=async()=>{
    if(reason)throw Error(reason);
    if(kind==="reference"){
     const at=performance.now(),r=await h.request("/api/ideas?feed=company",{},"101",{method:"GET",timeout:18000,headers:{"accept-encoding":"identity"}});
     const result={status:r.status===200?"SUCCESS":r.status===503&&["queue_busy","ingress_busy"].includes(r.json.error)?"REJECTED":"FAILED",code:r.json.error||null,ms:performance.now()-at,bytes:r.bytes.length,count:r.json.ideas?.length};
     if(result.status==="SUCCESS"&&result.count!==posts)throw Error("feed_count_mismatch");return result;
    }
    const request=crypto.randomUUID();return await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{pending.delete(request);reject(Error(reason||"component deadline"));},18000);
     pending.set(request,m=>{clearTimeout(timer);resolve(m);});child.send({request});
    });
   };
   for(let i=0;i<3;i++){const r=await request();row.responses.push(r);if(r.status==="FAILED")throw Error(r.code||"prerequisite_request_failed");}
   for(const concurrency of [10,25,50]){
    if(reason)throw Error(reason);
    const at=performance.now(),responses=await Promise.all(Array.from({length:concurrency},()=>request().catch(e=>({status:"FAILED",code:reason||e.message}))));
    const successes=responses.filter(r=>r.status==="SUCCESS"),rejections=responses.filter(r=>r.status==="REJECTED");
    row.bursts.push({concurrency,attempted:responses.length,successes:successes.length,rejected:rejections.length,failed:responses.length-successes.length-rejections.length,latencyMs:stats(successes.map(r=>r.ms)),successfulPerSecond:successes.length/((performance.now()-at)/1000),completionPerSecond:responses.length/((performance.now()-at)/1000),responses});
    if(reason||responses.some(r=>r.status==="FAILED"))throw Error(reason||"request_failure");
   }
   if(kind==="component"){
    row.consistent=new Set([...row.responses,...row.bursts.flatMap(b=>b.responses)].filter(r=>r.status==="SUCCESS").map(r=>r.digest)).size===1;
    if(!row.consistent)throw Error("component_inconsistent");
    row.plan=(await h.repo.pool.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM dev.posts WHERE file_name=$1 AND parent=$2 AND ordinal>$3 ORDER BY ordinal LIMIT 16`,["ideas.json",JSON.stringify(["ideas.json"]),-1])).rows[0]["QUERY PLAN"];
   }
   row.status="COMPLETED";
  }catch(e){row.status="NOT COMPLETED";row.reason=reason||e.message;}
  finally{
   clearInterval(monitor);for(const resolve of pending.values())resolve({status:"FAILED",code:reason||"worker stopped"});pending.clear();
   if(w){row.stages=w.messages.filter(m=>m.type==="memory");row.memory=row.stages;try{row.timings=JSON.parse(fs.readFileSync(path.join(h.root,"request-timings.json")));}catch{}}
   row.peakHeapMiB=Math.max(0,...row.memory.map(m=>m.heapUsed/1048576));row.peakExternalMiB=Math.max(0,...row.memory.map(m=>m.external/1048576));row.peakArrayBuffersMiB=Math.max(0,...row.memory.map(m=>m.arrayBuffers/1048576));
   if(child)await h.stop(child);await h.close();results.push(row);save("performance-"+kind+".json",{kind,limits,note:kind==="component"?"Direct read-only component calls; no HTTP admission/response renderer or full application bootstrap. Not an optimized public API.":"Original complete HTTP feed with diagnostic phase sampling; no forced GC.",results});console.log(kind,posts,row.status,row.reason||"",row.peakRssMiB);
  }
 }
})();
