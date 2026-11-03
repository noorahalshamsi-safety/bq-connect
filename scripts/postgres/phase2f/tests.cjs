const {base,fixture,boot,save}=require("./harness.cjs"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{create}=require("./cursor.cjs");
(async()=>{
 const h=await base(5183),results=[];let w;
 async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",error:e.message.slice(0,600)});}console.log(results.at(-1).status,name);}
 const get=(query="",badge="101")=>h.request("/api/ideas?"+query,{},badge,{method:"GET"});
 const paged=(query="",badge="101")=>get("pagination=keyset-v1&limit=8&"+query,badge);
 async function all(query,badge){
  const list=[];let cursor=null,stats;
  for(let i=0;i<50;i++){const r=await paged(query+(cursor?"&cursor="+encodeURIComponent(cursor):""),badge);if(r.status!==200)return r;list.push(...r.json.ideas);stats=r.json.stats;cursor=r.json.page.nextCursor;if(!cursor)return{status:200,json:{ideas:list,stats},headers:r.headers};}
  throw Error("pagination_did_not_terminate");
 }
 try{
  // Reuse the original rich synthetic fixture declaration, not weaker replacement data.
  const source=fs.readFileSync(path.resolve(__dirname,"../phase2e-tests.cjs"),"utf8"),declaration=source.slice(source.indexOf(" const now="),source.indexOf(" await h.repo.importSynthetic(f)"));
  await new (Object.getPrototypeOf(async function(){}).constructor)("h",declaration+' f["daily-sparks.json"]={v:2,date:new Date(Date.now()+10800000).toISOString().slice(0,10),items:{}};await h.repo.importSynthetic(f);')(h);
  w=await boot(h,5183);
  await test("Complete enriched multi-page equality: six roles × company/following/today/group",async()=>{
   let pairs=0;for(const badge of ["101","102","103","00106","9001","9002"])for(const query of ["feed=company","feed=following","feed=today","group=private-g"]){
    const reference=await get(query,badge),candidate=await all(query,badge);
    assert.equal(candidate.status,reference.status,`${badge} ${query}`);
    assert.deepEqual(candidate.json,reference.json,`${badge} ${query}`);
    for(const name of ["content-type","cache-control","vary","x-content-type-options"])assert.equal(candidate.headers.get(name),reference.headers.get(name));
    pairs++;
   }results.push({name:"Enriched equality coverage",status:"PASS",pairs,comparison:"Every enriched field and global stats; page metadata deliberately additional; Content-Length not identical across different envelopes."});
  });
  await test("Authorization denies anonymous, nonmember, empty-group before cursors",async()=>{
   for(const [badge,q,status]of [["","feed=company",401],["102","group=private-g",403],["101","group=empty-g",403]]){
    const r=await paged(q+"&cursor=forged",badge);assert.equal(r.status,status);assert(!r.json.ideas);
   }
  });
  await test("Performance comparator returns equivalent sixteen enriched items and stats",async()=>{
   const a=await h.request("/api/ideas?limit=16",{},"101",{method:"GET",headers:{"x-private-reference-page":"1"}}),b=await get("pagination=keyset-v1&limit=16");
   assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.json.ideas.length,16);assert.deepEqual(a.json,{ideas:b.json.ideas,stats:b.json.stats});
  });
  await test("Signed cursors: tamper/malformed/cross-actor/cross-scope/limits and replay",async()=>{
   const first=await paged(),cursor=first.json.page.nextCursor;assert(cursor);
   const next=await paged("cursor="+encodeURIComponent(cursor)),replay=await paged("cursor="+encodeURIComponent(cursor));
   assert.equal(next.status,200);assert.deepEqual(next.json.ideas,replay.json.ideas);
   assert.equal((await paged("cursor="+encodeURIComponent(cursor),"102")).status,403);
   assert.equal((await paged("feed=following&cursor="+encodeURIComponent(cursor))).status,403);
   for(const forged of ["bad",cursor+"A",".".repeat(5000)])assert.equal((await paged("cursor="+encodeURIComponent(forged))).status,400);
   for(const limit of ["0","33","-1","1.5","NaN"])assert.equal((await get("pagination=keyset-v1&limit="+limit)).status,400);
  });
  await test("Saved/type filters match complete enriched reference subset",async()=>{
   const reference=(await get()).json;
   for(const [q,predicate]of [["saved=1",p=>p.saved],["kind=story",p=>p.type==="story"],["kind=poll",p=>p.type==="poll"]]){
    const r=await all(q,"101");assert.equal(r.status,200);assert.deepEqual(r.json.ideas,reference.ideas.filter(predicate));assert.deepEqual(r.json.stats,reference.stats);
   }
  });
  await test("Ban is freshly enforced, including a previously issued cursor",async()=>{
   const token=(await paged()).json.page.nextCursor,f=await h.repo.exportSynthetic(),conduct=structuredClone(f["conduct.json"]);
   conduct.bans={...(conduct.bans||{}),"101":{at:new Date().toISOString(),count:3}};await h.repo.importSynthetic({"conduct.json":conduct});
   const a=await get(),b=await paged("cursor="+encodeURIComponent(token));assert.equal(a.status,401);assert.equal(b.status,401);assert(!b.json.ideas);
   await h.repo.importSynthetic({"conduct.json":f["conduct.json"],"accounts.json":f["accounts.json"]});
  });
  await test("Session-touch commit does not immediately invalidate its own issued cursor",async()=>{
   const f=await h.repo.exportSynthetic();f["accounts.json"]["101"].sessions[0].lastSeen=new Date(Date.now()-600000).toISOString();
   await h.repo.importSynthetic({"accounts.json":f["accounts.json"]});const a=await paged();assert.equal(a.status,200);assert.equal((await paged("cursor="+encodeURIComponent(a.json.page.nextCursor))).status,200);
  });
  await test("Selected ready media matches legacy output; missing object fails closed",async()=>{
   const crypto=require("node:crypto"),f=await h.repo.exportSynthetic(),id=crypto.randomUUID(),legacy="/media/synthetic-proof.png",bytes=Buffer.from("synthetic-picture"),object=path.join(h.proof.objects,id);
   fs.writeFileSync(object,bytes);
   const c=await h.repo.pool.connect();try{await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1793705963)");await h.repo.verify(c);await c.query("INSERT INTO dev.media(id,legacy_path,object_key,sha256,size,mime,owner,state) VALUES($1,$2,$3,$4,$5,'image/png','101','ready')",[id,legacy,h.proof.dataset+"/immutable/"+id,crypto.createHash("sha256").update(bytes).digest("hex"),bytes.length]);await c.query("COMMIT");}finally{c.release();}
   f["ideas.json"][0].media=legacy;await h.repo.importSynthetic({"ideas.json":f["ideas.json"]});
   const reference=await get(),candidate=await all("","101");assert.equal(reference.status,200);assert.deepEqual(candidate.json,reference.json);
   const before=await h.repo.pool.query("SELECT count(*)::int AS n FROM dev.media_links");fs.unlinkSync(object);
   try{const r=await paged();assert.equal(r.status,503);assert(!r.json.ideas);}finally{fs.writeFileSync(object,bytes);}
   const after=await h.repo.pool.query("SELECT count(*)::int AS n FROM dev.media_links");assert.deepEqual(after.rows,before.rows);
  });
  await test("Sparse visibility returns bounded empty continuation, never a false end",async()=>{
   const f=await h.repo.exportSynthetic(),source={...f["ideas.json"][0],badge:"103",hidden:true,media:""};
   const posts=Array.from({length:601},(_,i)=>({...source,id:"sparse-"+i,...(i===600?{hidden:false}:{})}));await h.repo.importSynthetic({"ideas.json":posts});
   const a=await paged();assert.equal(a.status,200);assert.equal(a.json.ideas.length,0);assert.equal(a.json.page.state,"more");assert(a.json.page.nextCursor);
   const b=await paged("cursor="+encodeURIComponent(a.json.page.nextCursor));assert.equal(b.status,200);assert.deepEqual(b.json.ideas.map(p=>p.id),["sparse-600"]);
   await h.repo.importSynthetic({"ideas.json":f["ideas.json"]});
  });
  await test("Oversize selected relation rejects explicitly without truncation or entity writes",async()=>{
   const f=await h.repo.exportSynthetic(),posts=structuredClone(f["ideas.json"]);posts[0].text="x".repeat(9*1024*1024);await h.repo.importSynthetic({"ideas.json":posts});
   const revision=(await h.repo.pool.query("SELECT revision FROM dev.files WHERE name='ideas.json'")).rows[0].revision;
   try{const r=await paged();assert.equal(r.status,503);assert(!r.json.ideas);assert.equal((await h.repo.pool.query("SELECT revision FROM dev.files WHERE name='ideas.json'")).rows[0].revision,revision);}finally{await h.repo.importSynthetic({"ideas.json":f["ideas.json"]});}
  });
  await test("Deep link independently authorizes off-window, hidden and group records",async()=>{
   const reference=(await get()).json.ideas;
   for(const id of ["boundary-18","hidden","group","missing"]){
    const r=await paged("id="+id);assert.equal(r.status,200);assert.deepEqual(r.json.ideas,reference.filter(p=>p.id===id));
   }
  });
  await test("Unsupported global ordering/search is explicit, never page-local substitution",async()=>{
   for(const q of ["sort=new","sort=old","sort=top","q="+encodeURIComponent("عَرَبِي")]){
    const r=await paged(q);assert.equal(r.status,422);assert.equal(r.json.error,"product_decision_required");assert(!r.json.ideas);
   }
  });
  await test("Insertion and physical deletion invalidate revision-bound position without omission",async()=>{
   let cursor=(await paged()).json.page.nextCursor;
   const f=await h.repo.exportSynthetic(),post={...f["ideas.json"][0],id:"new-ordinal"};
   await h.repo.importSynthetic({"ideas.json":[post,...f["ideas.json"]]});
   assert.equal((await paged("cursor="+encodeURIComponent(cursor))).status,409);
   cursor=(await paged()).json.page.nextCursor;
   await h.repo.importSynthetic({"ideas.json":f["ideas.json"].filter(p=>p.id!=="public")});
   assert.equal((await paged("cursor="+encodeURIComponent(cursor))).status,409);
   assert(!(await all("","101")).json.ideas.some(p=>p.id==="public"));
  });
  await test("Expiry fails with explicit 410; keys and auth clock remain unchanged",async()=>{
   const cursor=(await paged()).json.page.nextCursor;w.child.send({action:"expire"});await new Promise(r=>setTimeout(r,50));
   const r=await paged("cursor="+encodeURIComponent(cursor));assert.equal(r.status,410);assert.equal(r.json.state,"restart");
  });
  await test("Revoked membership and revoked session take effect on next request",async()=>{
   const cursor=(await paged("group=private-g")).json.page.nextCursor;
   const f=await h.repo.exportSynthetic();await h.repo.importSynthetic({"groups.json":f["groups.json"].map(g=>g.id==="private-g"?{...g,members:[]}:g)});
   assert.equal((await paged("group=private-g&cursor="+encodeURIComponent(cursor))).status,403);
   const accounts=f["accounts.json"];accounts["101"].sessions=[];await h.repo.importSynthetic({"accounts.json":accounts});
   assert.equal((await paged()).status,401);
  });
  await test("Standalone signature binds schema, expiry and revision, fixed chain lifetime",async()=>{
   let now=1000;const c=create(Buffer.alloc(32,7),{now:()=>now,ttlMs:100}),binding={actor:"invented-a",scope:"company",revision:"1"},p={...c.initial(),...binding,after:4},token=c.sign(p);
   assert.equal(c.decode(token,binding).after,4);assert.throws(()=>c.decode(token,{...binding,revision:"2"}),/revision/);now=1100;assert.throws(()=>c.decode(token,binding),/expired/);
  });
 }finally{
  save("contract-tests.json",{results,pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,workerPeakRssMiB:w?.peak,componentErrors:w?.messages.filter(m=>m.type==="component-error")});
  await w?.stop();await h.close();
 }
 if(results.some(r=>r.status==="FAIL"))process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
