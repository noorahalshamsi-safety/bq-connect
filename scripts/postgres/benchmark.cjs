const {harness,ok,sleep}=require("./harness.cjs");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),http=require("node:http");
const destination=path.resolve(__dirname,"../../generated-artifacts/phase2b");
const label=process.argv[2];if(!["before","after"].includes(label))throw Error("Use before or after");
const stats=a=>({samples:a.length,meanMs:a.reduce((s,x)=>s+x,0)/a.length,p50Ms:[...a].sort((a,b)=>a-b)[Math.floor(a.length*.5)],p95Ms:[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*.95))],maxMs:Math.max(...a)});
(async()=>{
 const h=await harness(5128),result={label,at:new Date().toISOString(),scope:"private invented-data cluster",datasets:[],plans:[],limitations:["Single local host; not a hosted capacity claim","Other workspace processes can affect CPU timings","Pool/advisory waits measured separately from end-to-end timings"]};
 try {
  await h.boot();
  let times=[];for(let i=0;i<8;i++){const t=performance.now();ok(await h.request("/",{},null,{method:"GET"}));times.push(performance.now()-t);}
  result.static=stats(times);
  const post=await h.request("/api/ideas",{type:"post",text:"Benchmark seed"});ok(post,201);
  const template=(await h.repo.exportSynthetic())["ideas.json"].find(x=>x.id===post.json.idea.id);
  for(const size of [1,100,500]){
    await h.repo.importSynthetic({"ideas.json":Array.from({length:size},(_,i)=>({...structuredClone(template),id:crypto.randomUUID(),text:`Invented benchmark ${i}`}))});
    times=[];for(let i=0;i<8;i++){const t=performance.now();ok(await h.request("/api/ideas",{},"101",{method:"GET"}));times.push(performance.now()-t);}
    const at=performance.now();const parallel=await Promise.all(Array.from({length:12},()=>h.social("search",{q:"Synthetic"})));parallel.forEach(r=>ok(r));
    result.datasets.push({posts:size,feed:stats(times),concurrent12TotalMs:performance.now()-at,concurrent12Statuses:parallel.map(r=>r.status)});
  }
  for(const sql of ["SELECT id,file_name,parent,entry_key,ordinal,attrs,shape FROM dev.posts","SELECT * FROM dev.accounts WHERE entry_key=$1"]){
    const p=await h.repo.pool.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+sql,sql.includes("$1")?["101"]:[]);
    result.plans.push({sql,plan:p.rows[0]["QUERY PLAN"]});
  }
  const body=JSON.stringify({action:"profile-meta",token:h.fixture.credentials.tokens["101"]});
  let finishSlow;
  const slow=new Promise((resolve,reject)=>{
    const q=http.request({host:"127.0.0.1",port:h.port,path:"/api/social",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body),"Idempotency-Key":crypto.randomUUID()}},r=>{r.resume();r.on("end",()=>resolve(r.statusCode));});
    q.on("error",reject);q.write(body.slice(0,2));finishSlow=()=>q.end(body.slice(2));
  });
  await sleep(150);const at=performance.now();const ready=h.request("/health/ready",{},null,{method:"GET"});setTimeout(finishSlow,600);
  ok(await ready);result.slowBody={readinessWaitMs:performance.now()-at,delayedBodyStatus:await slow,clientDelayMs:600};
  // Actual connection wait: occupy all four adapter-equivalent pool slots.
  const held=await Promise.all(Array.from({length:4},()=>h.repo.pool.connect()));
  const begin=performance.now(),waiting=h.repo.pool.connect();setTimeout(()=>held.forEach(c=>c.release()),200);
  (await waiting).release();result.pool={max:h.repo.pool.options.max,waitMs:performance.now()-begin};
  const blocker=await h.repo.pool.connect();await blocker.query("BEGIN");await blocker.query("SELECT pg_advisory_xact_lock(1793705963)");
  const started=performance.now(),blocked=h.request("/health/ready",{},null,{method:"GET"});
  setTimeout(()=>blocker.query("ROLLBACK").finally(()=>blocker.release()),200);ok(await blocked);
  result.advisoryWaitMs=performance.now()-started;
  const timingFile=path.join(h.root,"request-timings.json");
  if(fs.existsSync(timingFile))result.transactions=JSON.parse(fs.readFileSync(timingFile));
  result.requests=h.requests;
 }catch(e){result.error=e.message;process.exitCode=1;}
 finally{await h.close();fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,`performance-${label}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({label,error:result.error,static:result.static,slowBody:result.slowBody,datasets:result.datasets.map(x=>({posts:x.posts,p95:x.feed.p95Ms}))}));}
})();
