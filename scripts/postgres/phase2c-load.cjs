const {harness,reference,ok,save,usage,sleep}=require("./phase2c-support.cjs");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const codec=require("../../development/postgres/codec.cjs");
const mode=process.argv[2];if(!["baseline","native"].includes(mode))throw Error("Use baseline or native");
const quantile=(a,q)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor((a.length-1)*q))]:null;
const summary=a=>({samples:a.length,p50Ms:quantile(a,.5),p95Ms:quantile(a,.95),p99Ms:quantile(a,.99)});
const limits={workerRssMiB:384,controllerRssMiB:512,fixtureWallMs:40000,totalWallMs:240000,burstDeadlineMs:22000};
async function seed(h,employeeCount,postCount){
 const f=h.fixture.files,now=new Date().toISOString(),employees=structuredClone(f["employees.json"]);
 for(let i=employees.length;i<employeeCount;i++)employees.push({badge:String(20000+i),name:`Invented Employee ${i}`,department:i%2?"Engineering":"Operations",position:"Engineer"});
 const accounts=structuredClone(f["accounts.json"]),profiles={};
 for(const e of employees)profiles[e.badge]={bio:"Invented load fixture"};
 for(const e of employees.slice(0,50)){
   if(accounts[e.badge])continue;
   const a=structuredClone(accounts["101"]),sid=crypto.randomBytes(12).toString("base64url"),exp=Date.now()+86400000;
   a.sessions=[{sid,createdAt:now,lastSeen:now,exp:new Date(exp).toISOString()}];accounts[e.badge]=a;
   const payload=`${e.badge}.1.${exp}.${sid}`;
   h.fixture.credentials.tokens[e.badge]=Buffer.from(`${payload}.${crypto.createHmac("sha256",h.proof.sessionKey).update(`session:${payload}`).digest("hex")}`).toString("base64url");
 }
 await h.repo.importSynthetic({"employees.json":employees,"accounts.json":accounts,"profiles.json":profiles});
 // Private invented-data seeder, not an application writer. All FK checks stay
 // active; per-table parameterized batches bound memory and roundtrips.
 const c=await h.repo.pool.connect();
 try{
   await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1793705963)");await h.repo.verify(c);
   await c.query("DELETE FROM dev.post_root WHERE file_name='ideas.json'");
   await c.query("UPDATE dev.files SET revision=revision+1 WHERE name='ideas.json'");
   await c.query(`INSERT INTO dev.post_root(id,file_name,parent,entry_key,ordinal,attrs,shape) VALUES($1,'ideas.json',null,null,0,'null','{"kind":"array"}')`,[JSON.stringify(["ideas.json"])]);
   for(let start=0;start<postCount;start+=500){
     const posts=Array.from({length:Math.min(500,postCount-start)},(_,i)=>({id:`invented-${start+i}`,badge:"101",name:"Invented Author",department:"Engineering",position:"Engineer",type:"post",text:`Invented load post ${start+i}`,createdAt:now,comments:[],ratings:[],reposts:[],poll:[]}));
     const rows=codec.encode("ideas.json",posts).filter(r=>r.table!=="post_root");
     // Rebase ordinal-derived IDs so chunks cannot overwrite prior rows.
     const rebase=id=>{const parts=JSON.parse(id);if(typeof parts[1]==="number")parts[1]+=start;return JSON.stringify(parts);};
     for(const row of rows){row.id=rebase(row.id);row.parent=rebase(row.parent);if(row.table==="posts")row.ordinal+=start;}
     const groups=new Map();for(const row of rows){if(!groups.has(row.table))groups.set(row.table,[]);groups.get(row.table).push(row);}
     for(const [table,batch]of groups){
       if(!codec.tables.has(table))throw Error("Unexpected seed table");
       await c.query(`INSERT INTO dev.${table}(id,file_name,parent,entry_key,ordinal,attrs,shape)
         SELECT id,'ideas.json',parent,entry_key,ordinal,coalesce(attrs,'null'::jsonb),shape FROM jsonb_to_recordset($1::jsonb)
         AS x(id text,parent text,entry_key text,ordinal int,attrs jsonb,shape jsonb)`,[JSON.stringify(batch)]);
     }
     if(usage(process.pid).rssMiB>limits.controllerRssMiB)throw Error("controller_memory_limit_during_seed");
   }
   const count=await c.query("SELECT count(*)::int AS n FROM dev.posts");
   if(count.rows[0].n!==postCount)throw Error("Incomplete invented post seed");
   await c.query("COMMIT");
   for(const table of ["posts","profiles","employees","accounts"])await c.query(`ANALYZE dev.${table}`);
 }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
 return employees.slice(0,50).filter(e=>h.fixture.credentials.tokens[e.badge]).map(e=>e.badge);
}
(async()=>{
 const started=Date.now(),results=[];
 for(const employees of [100,500,1000])for(const posts of [5000,20000]){
   if(Date.now()-started>limits.totalWallMs){results.push({employees,posts,status:"NOT RUN",reason:"total wall safety budget"});continue;}
   const h=await harness(5152);let child,watch;const row={employees,posts,mode,bursts:[],status:"RUNNING"};
   const fixtureAt=Date.now();
   try{
     const badges=await seed(h,employees,posts);
     child=await reference(h,5152,mode==="native");
     const initial=usage(child.pid);let peak=initial.rssMiB,reason="";
     watch=setInterval(()=>{const u=usage(child.pid);peak=Math.max(peak,u.rssMiB);row.observedWorker={...u,peakRssMiB:peak,cpuSecondsDelta:u.cpuSeconds-initial.cpuSeconds};
       if(u.rssMiB>limits.workerRssMiB||usage(process.pid).rssMiB>limits.controllerRssMiB||Date.now()-fixtureAt>limits.fixtureWallMs){
         reason="isolated memory/wall safety limit";child.kill("SIGKILL");
       }
     },100);
     const session=await h.request("/api/session",{},"101");ok(session);const pid=session.json.person.pid;
     for(const concurrency of [10,25,50]){
       if(reason)throw Error(reason);
       const at=performance.now();
       const replies=await Promise.all(Array.from({length:concurrency},async(_,i)=>{
         const begin=performance.now();
         try{const r=await h.social("person",{pid},badges[i%badges.length],{timeout:limits.burstDeadlineMs});return {status:r.status,ms:performance.now()-begin};}
         catch{return {status:0,ms:performance.now()-begin};}
       }));
       const elapsed=performance.now()-at,success=replies.filter(r=>r.status===200);
       row.bursts.push({concurrency,...summary(success.map(r=>r.ms)),allRequestLatency:summary(replies.map(r=>r.ms)),successes:success.length,failures:replies.length-success.length,
         failureRate:(replies.length-success.length)/replies.length,successfulReadsPerSecond:success.length/(elapsed/1000),
         statuses:replies.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),wallMs:elapsed});
       if(reason||replies.some(r=>r.status===0))throw Error(reason||"burst deadline exceeded");
     }
     const at=performance.now(),feed=await h.request("/api/ideas",{},"101",{method:"GET",timeout:limits.burstDeadlineMs});
     row.feed={status:feed.status,ms:performance.now()-at,returnedPosts:feed.json.ideas?.length,responseBytes:feed.bytes.length,pagination:"Existing endpoint returns full list; no response-contract change."};
     // A bounded original writer sample, not a new write repository.
     const writeAt=performance.now(),write=await h.social("profile",{bio:"Invented load update"});row.write={status:write.status,ms:performance.now()-writeAt,operationsPerSecond:1000/(performance.now()-writeAt)};
     const timingFile=path.join(h.root,"request-timings.json"),timings=JSON.parse(fs.readFileSync(timingFile));
     row.transactions=timings;row.profileMetrics=Object.fromEntries(["queryCount","totalTxMs","advisoryWaitMs","poolWaitMs","loadMs","queueWaitMs","loadQueries"].map(key=>[key,summary(timings.filter(t=>t.action==="person").map(t=>t[key]).filter(Number.isFinite))]));
     row.worker={initialRssMiB:initial.rssMiB,peakRssMiB:peak,end:usage(child.pid),cpuSecondsDelta:usage(child.pid).cpuSeconds-initial.cpuSeconds,clockTicksPerSecond:100};
     row.plans=[];
     for(const sql of ["SELECT attrs FROM dev.profiles WHERE entry_key='101'","SELECT id FROM dev.person_follows WHERE attrs #>> '{}'='101'"])
       row.plans.push({sql,plan:(await h.repo.pool.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+sql)).rows[0]["QUERY PLAN"]});
     row.status=reason?"STOPPED":"COMPLETED";
   }catch(e){row.status="STOPPED";row.reason=e.message;if(child)row.workerEnd=usage(child.pid);}
   finally{
     clearInterval(watch);
     const timingFile=path.join(h.root,"request-timings.json");
     try{
       row.transactions=JSON.parse(fs.readFileSync(timingFile));
       row.profileMetrics=Object.fromEntries(["queryCount","totalTxMs","advisoryWaitMs","poolWaitMs","loadMs","queueWaitMs","loadQueries"].map(key=>[key,summary(row.transactions.filter(t=>t.action==="person").map(t=>t[key]).filter(Number.isFinite))]));
     }catch{}
     if(child)await h.stop(child);await h.close();results.push(row);save(`load-${mode}.json`,{mode,limits,results,notes:["One local host, no production capacity claim","One burst per concurrency; p99 from small samples is not a tail SLO","Pool/query timings cover primary request connection, not auxiliary media/outbox connections","CPU from Linux process ticks; RSS is per process, not total cgroup memory"]});console.log(mode,employees,posts,row.status,row.reason||"");
   }
 }
 save(`load-${mode}.json`,{mode,limits,results});
})();
