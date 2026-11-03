const {base,boot,save}=require("./harness.cjs"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),{usage}=require("../phase2c-support.cjs");
const filename=path.resolve(__dirname,"../phase2c-load.cjs"),source=fs.readFileSync(filename,"utf8"),start=source.indexOf("async function seed("),end=source.indexOf("(async()=>",start),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
m._compile(source.slice(0,end).replace("const mode=process.argv[2];",'const mode="native";')+"\nmodule.exports=seed;",filename);
const seed=m.exports;
const percentile=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]:null;
(async()=>{
 const results=process.argv[2]&&fs.existsSync(path.resolve(__dirname,"../../../generated-artifacts/phase2f/enriched-http-benchmark.json"))?JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../../generated-artifacts/phase2f/enriched-http-benchmark.json"))).results.filter(r=>!(r.mode===process.argv[2]&&(!process.argv[3]||r.posts===Number(process.argv[3])))):[];
 for(const mode of process.argv[2]?[process.argv[2]]:["native","reference-page"])for(const size of process.argv[3]?[Number(process.argv[3])]:[5000,10000,20000]){
  const h=await base(5185);let w;const row={mode,posts:size,employees:1000,capWorkerMiB:384,capControllerMiB:512,product:"Fully enriched HTTP page with exact raw global stats, selected interactions, auth/rate commit and media checks",trials:[]};
  try{
   // Start with the small owned fixture. This worker never hydrates the large post graph.
   w=await boot(h,5185);await seed(h,1000,size);
   const badges=Object.keys(h.fixture.credentials.tokens).slice(0,50);if(badges.length<50)throw Error("fifty_synthetic_sessions_required");
   row.cohort="Distinct synthetic session per concurrent request, up to fifty";
   for(const concurrency of [1,10,25,50]){
    const requests=await Promise.all(Array.from({length:concurrency},async(_,index)=>{
     const at=performance.now();try{const r=await h.request("/api/ideas?"+(mode==="native"?"pagination=keyset-v1&":"")+"limit=16",{},badges[index],{method:"GET",timeout:25000,headers:mode==="reference-page"?{"x-private-reference-page":"1"}:{}});return{status:r.status,ms:performance.now()-at,bytes:r.bytes.length,items:r.json.ideas?.length,error:r.json.error};}catch(e){return{status:0,ms:performance.now()-at,error:e.name};}
    }));
    const successes=requests.filter(r=>r.status===200),rejections=requests.filter(r=>r.status===503&&["queue_busy","ingress_busy"].includes(r.error)),errors=requests.filter(r=>r.status!==200&&!rejections.includes(r));
    row.trials.push({concurrency,distinctSessions:concurrency,success:successes.length,rejected:rejections.length,errors:errors.length,p50Ms:percentile(successes.map(r=>r.ms),.5),p95Ms:percentile(successes.map(r=>r.ms),.95),responseBytes:successes.map(r=>r.bytes),items:successes.map(r=>r.items),failureDetails:errors});
    if(w.reason||errors.length)break;
   }
   const timingFile=path.join(h.root,"request-timings.json");
   if(fs.existsSync(timingFile)){const t=JSON.parse(fs.readFileSync(timingFile)).filter(t=>t.label);row.sql={samples:t.length,queries:[...new Set(t.map(r=>r.queryCount))],hydrationQueries:[...new Set(t.map(r=>r.loadQueries))],p95TransactionMs:percentile(t.map(r=>r.totalTxMs),.95),p95QueueWaitMs:percentile(t.map(r=>r.queueWaitMs),.95),feedNodes:[...new Set(t.map(r=>r.feedNodes))]};}
   if(w.child.connected)w.child.send({action:"metrics"});await new Promise(r=>setTimeout(r,50));row.memory=w.messages.filter(m=>m.type==="memory").at(-1);row.workerPeakRssMiB=w.peak;row.controllerRssMiB=usage(process.pid).rssMiB;row.guard=w.reason||"not hit";row.poolLimit=4;row.serialization="Original global advisory lock, HTTP max32 queue /8 ingress retained";row.browserMemory="NOT MEASURED: HTTP benchmark";
  }catch(e){row.error=e.message;}
  finally{await w?.stop();await h.close();results.push(row);save("enriched-http-benchmark.json",{results});console.log(JSON.stringify(row));}
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
