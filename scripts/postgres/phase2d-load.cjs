const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {harness,ok}=require("./harness.cjs"),{worker,output}=require("./phase2d-forensics.cjs"),{usage}=require("./phase2c-support.cjs");
const codec=require("../../development/postgres/codec.cjs"),mode=process.argv[2];
if(!["before","after"].includes(mode))throw Error("Use before or after");
const limits={workerRssMiB:384,controllerRssMiB:512,fixtureWallMs:65000,totalWallMs:230000,burstDeadlineMs:18000};
const old=fs.readFileSync(path.join(__dirname,"phase2c-load.cjs"),"utf8"),start=old.indexOf("async function seed("),end=old.indexOf("\n(async()=>",start);
const seed=Function("codec","crypto","limits","usage",`return (${old.slice(start,end).trim()});`)(codec,crypto,limits,usage);
const snapshot=path.join(output,mode+"-sources.json");
fs.writeFileSync(snapshot,JSON.stringify(Object.fromEntries(["repository","runtime"].map(n=>[n,fs.readFileSync(path.resolve(__dirname,`../../development/postgres/${n}.cjs`),"utf8")]))));
function summary(a){const s=[...a].sort((a,b)=>a-b);return {samples:a.length,p50:a.length?s[Math.floor((s.length-1)*.5)]:null,p95:a.length?s[Math.floor((s.length-1)*.95)]:null};}
(async()=>{
 const results=[],at=Date.now();
 for(const posts of [5000,10000,20000]){
  if(Date.now()-at>limits.totalWallMs){results.push({posts,status:"NOT COMPLETED",reason:"total controller deadline"});continue;}
  const h=await harness(5162);let w,child,monitor;const row={employees:1000,posts,bursts:[],memory:[],status:"RUNNING"},begun=Date.now();let reason="";
  try{
   const badges=await seed(h,1000,posts);
   const stats=await h.repo.pool.query("SELECT count(*)::int AS rows,coalesce(sum(pg_column_size(p)),0)::bigint::text AS stored_bytes FROM dev.posts p");
   row.postSql=stats.rows[0];const backend=(await h.repo.pool.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
   const postmaster=Number(fs.readFileSync(`/proc/${backend}/stat`,"utf8").split(" ")[3]);row.postgres={postmasterPid:postmaster,postmaster:usage(postmaster),controllerBackend:usage(backend),note:"Individual PostgreSQL process RSS; shared buffers can be counted in multiple processes, not a total."};
   w=await worker(h,5162,false,snapshot,(c,messages)=>{
    child=c;c.on("message",m=>{if(m.type==="memory"){row.memory.push(m);if(row.memory.length>1800)row.memory.shift();}});
    monitor=setInterval(()=>{
     const u=usage(c.pid);row.peakRssMiB=Math.max(row.peakRssMiB||0,u.rssMiB);
     if(u.rssMiB>limits.workerRssMiB||usage(process.pid).rssMiB>limits.controllerRssMiB||Date.now()-begun>limits.fixtureWallMs){reason=u.rssMiB>limits.workerRssMiB?"worker RSS guard":usage(process.pid).rssMiB>limits.controllerRssMiB?"controller RSS guard":"fixture deadline";c.kill("SIGKILL");}
    },50);
   });
   const session=await h.request("/api/session",{},"101");ok(session);const pid=session.json.person.pid;
   for(const concurrency of [10,25,50]){
    if(reason)throw Error(reason);const begin=performance.now();
    const replies=await Promise.all(Array.from({length:concurrency},async(_,i)=>{
     const b=performance.now();try{const r=await h.social("person",{pid},badges[i%badges.length],{timeout:limits.burstDeadlineMs});return{status:r.status,cause:r.json.error||null,ms:performance.now()-b};}
     catch(e){return{status:0,cause:reason||"transport failure/timeout",ms:performance.now()-b};}
    }));
    const good=replies.filter(r=>r.status===200),rejected=replies.filter(r=>r.status===503&&["queue_busy","ingress_busy"].includes(r.cause));
    row.bursts.push({concurrency,attempted:replies.length,successes:good.length,rejected:rejected.length,otherFailures:replies.length-good.length-rejected.length,successfulLatencyMs:summary(good.map(r=>r.ms)),successfulThroughput:good.length/((performance.now()-begin)/1000),totalCompletionThroughput:replies.length/((performance.now()-begin)/1000),outcomes:replies});
    if(reason||replies.some(r=>r.status===0))throw Error(reason||"request transport failure");
   }
   const feed=await h.request("/api/ideas",{},"101",{method:"GET",timeout:18000});ok(feed);row.feed={status:feed.status,posts:feed.json.ideas.length,decodedBytes:feed.bytes.length};
   await w.call("gc");row.gcBefore=w.messages.filter(m=>m.stage==="explicit-gc").at(-1);
   for(let i=0;i<20;i++)ok(await h.social("person",{pid}));
   await w.call("gc");row.gcAfter=w.messages.filter(m=>m.stage==="explicit-gc").at(-1);
   row.repeatedHeapDeltaBytes=row.gcAfter.heapUsed-row.gcBefore.heapUsed;
   row.status="COMPLETED";
  }catch(e){row.status="NOT COMPLETED";row.reason=reason||e.message;}
  finally{
   clearInterval(monitor);
   try{row.timings=JSON.parse(fs.readFileSync(path.join(h.root,"request-timings.json")));}catch{}
   row.peakHeapMiB=Math.max(0,...row.memory.map(m=>m.heapUsed/1048576));row.peakExternalMiB=Math.max(0,...row.memory.map(m=>m.external/1048576));row.peakArrayBuffersMiB=Math.max(0,...row.memory.map(m=>m.arrayBuffers/1048576));
   if(child)await h.stop(child);await h.close();results.push(row);fs.writeFileSync(path.join(output,`load-${mode}.json`),JSON.stringify({mode,limits,results},null,2));console.log(mode,posts,row.status,row.reason||"",row.peakRssMiB);
  }
 }
})();
