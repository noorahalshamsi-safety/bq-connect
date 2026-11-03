const {harness,sleep,ok}=require("./harness.cjs"),{worker,output}=require("./phase2d-forensics.cjs"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
(async()=>{
 const h=await harness(5163),results=[];let w;
 async function boot(){w=await worker(h,5163);return w;}
 async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",error:e.message.slice(0,400)});}console.log(results.at(-1).status,name);}
 async function due(){const f=await h.repo.exportSynthetic();await h.repo.importSynthetic({"backup.json":{...f["backup.json"],enabled:true,intervalHours:24},"backup-status.json":{...f["backup-status.json"],lastAt:"1970-01-01T00:00:00.000Z"}});}
 const backups=async()=>Number((await h.repo.pool.query("SELECT count(*) AS n FROM dev.backups")).rows[0].n);
 async function held(tag){for(let i=0;i<150;i++){const e=w.messages.find(m=>m.type==="job-held"&&m.tag===tag);if(e)return e;await sleep(30);}throw Error("Hold checkpoint not reached");}
 const release=()=>w.child.send({action:"release"});
 try{
  await boot();
  await due();
  await test("All five real timer callbacks commit with attestation and advisory lock",async()=>{
   for(const timer of w.ready.timers){const r=await w.call("job",timer.id);assert(r.value.committed);assert(!r.events.some(e=>e.type==="job-error"));assert(r.events.some(e=>e.type==="job-start"&&e.advisory_locks===1));}assert.equal(await backups(),1);
  });
  await test("Duplicate trigger coalesces; repeated due-check creates no duplicate archive",async()=>{
   await due();const n=await backups(),first=w.call("job",4,{fault:{mode:"hold",tag:"duplicate"}});await held("duplicate");
   const second=await w.call("job",4);assert(second.value.skipped);release();assert((await first).value.committed);
   assert((await w.call("job",4)).value.committed);assert.equal(await backups(),n+1);
  });
  await test("Failure after archive SQL rolls back all entities; retry succeeds once",async()=>{
   await due();const before=await h.repo.exportSynthetic(),n=await backups();
   const failed=await w.call("job",4,{fault:{mode:"after"}});assert.equal(failed.value.committed,false);
   assert.equal(await backups(),n);assert.deepEqual(await h.repo.exportSynthetic(),before);
   assert((await w.call("job",4)).value.committed);assert.equal(await backups(),n+1);
  });
  await test("Crash during callback rolls back; process restart safely retries",async()=>{
   await due();const before=await h.repo.exportSynthetic(),n=await backups();
   const pending=w.call("job",4,{fault:{mode:"hold",tag:"crash"}});pending.catch(()=>{});await held("crash");await h.stop(w.child);await pending.catch(()=>{});
   assert.equal(await backups(),n);assert.deepEqual(await h.repo.exportSynthetic(),before);
   await boot();assert((await w.call("job",4)).value.committed);assert.equal(await backups(),n+1);
  });
  await test("PostgreSQL disconnection refuses commit and next job recovers",async()=>{
   await due();const n=await backups(),pending=w.call("job",4,{fault:{mode:"hold",tag:"disconnect"}}),event=await held("disconnect");
   await h.repo.pool.query("SELECT pg_terminate_backend($1)",[event.backendPid]);await sleep(80);release();
   assert.equal((await pending).value.committed,false);assert.equal(await backups(),n);
   assert((await w.call("job",4)).value.committed);assert.equal(await backups(),n+1);
  });
  await test("Concurrent job, HTTP update and existing account writer lose no updates",async()=>{
   await due();const f=await h.repo.exportSynthetic(),accounts=structuredClone(f["accounts.json"]);accounts["102"].inventedMarker=crypto.randomUUID();
   const job=w.call("job",4,{fault:{mode:"hold",tag:"concurrent"}});await held("concurrent");
   const account=h.repo.importSynthetic({"accounts.json":accounts}),http=h.social("profile",{bio:"Invented concurrent update"});release();
   assert((await job).value.committed);await account;ok(await http);
   const after=await h.repo.exportSynthetic();assert.deepEqual(after["accounts.json"],accounts);assert.equal(after["profiles.json"]["101"].bio,"Invented concurrent update");
  });
  await test("Due event reminder sends one real notification across duplicate triggers",async()=>{
   const f=await h.repo.exportSynthetic(),id=crypto.randomUUID();
   await h.repo.importSynthetic({"ideas.json":[...f["ideas.json"],{id,badge:"101",type:"event",title:"Invented event",text:"Invented reminder",createdAt:new Date().toISOString(),eventAt:new Date(Date.now()+600000).toISOString(),attendees:["102"],comments:[],ratings:[]}]});
   assert((await w.call("job",3)).value.committed);
   const first=await h.repo.exportSynthetic(),notes=first["notifications.json"].filter(n=>n.ideaId===id);assert.equal(notes.length,1);
   assert((await w.call("job",3)).value.committed);
   const second=await h.repo.exportSynthetic();assert.deepEqual(second["notifications.json"],first["notifications.json"]);assert.equal(second["ideas.json"].find(p=>p.id===id).reminded,true);
  });
  await test("Daily content regenerates once without duplicate posts or cards",async()=>{
   const before=await h.repo.exportSynthetic();await h.repo.importSynthetic({"daily-sparks.json":{v:0,date:"1900-01-01",items:{}}});
   assert((await w.call("job",2)).value.committed);const first=await h.repo.exportSynthetic();assert.equal(first["daily-sparks.json"].v,2);assert(Object.keys(first["daily-sparks.json"].items).length);
   assert((await w.call("job",2)).value.committed);const second=await h.repo.exportSynthetic();
   assert.deepEqual(second["daily-sparks.json"],first["daily-sparks.json"]);assert.deepEqual(second["ideas.json"],before["ideas.json"]);
  });
  await test("Unmapped entity write fails closed with no account/post changes",async()=>{
   const before=await h.repo.exportSynthetic(),r=await w.call("job",4,{fault:{mode:"unauthorized"}});
   assert.equal(r.value.committed,false);assert.deepEqual(await h.repo.exportSynthetic(),before);
  });
  await test("Shutdown waits for active transaction; no incomplete commit acknowledgement",async()=>{
   await due();const n=await backups(),pending=w.call("job",4,{fault:{mode:"hold",tag:"shutdown"}});await held("shutdown");
   let closed=false;const closing=w.call("shutdown").then(r=>{closed=true;return r;});await sleep(150);assert.equal(closed,false);assert.equal(await backups(),n);
   release();assert((await pending).value.committed);await closing;assert.equal(await backups(),n+1);await h.stop(w.child);await boot();
  });
  await test("Uninterruptible callback deadline retires worker; no partial archive commits",async()=>{
   await due();const n=await backups(),pending=w.call("job",4,{fault:{mode:"hold",tag:"deadline"},timeout:28000});pending.catch(()=>{});await held("deadline");
   const result=await pending;assert.equal(result.value.committed,false);
   for(let i=0;i<40&&w.child.exitCode===null;i++)await sleep(50);assert.equal(w.child.exitCode,1);assert.equal(await backups(),n);
   await boot();assert((await w.call("job",4)).value.committed);assert.equal(await backups(),n+1);
  });
 }finally{if(w)await h.stop(w.child);await h.close();fs.writeFileSync(path.join(output,"targeted-tests.json"),JSON.stringify({totals:results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),results},null,2));process.exitCode=results.some(r=>r.status==="FAIL")?1:0;}
})();
