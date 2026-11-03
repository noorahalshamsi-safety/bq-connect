const {harness,diagnostic,save,ok}=require("./phase2e-support.cjs"),candidate=require("./phase2e-candidate.cjs"),assert=require("node:assert/strict");
(async()=>{
 const h=await harness(5170),results=[];let w;
 async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",error:e.message.slice(0,500)});}console.log(results.at(-1).status,name);}
 const now=Date.now(),base=(id,x={})=>({id,number:7,badge:"101",name:"Invented stored author",department:"Engineering",position:"Engineer",type:"post",title:"عربي English",text:"Synthetic only",createdAt:new Date(now-3600000).toISOString(),comments:[],ratings:[],reposts:[],poll:[],...x});
 const posts=[
 base("public"),base("hidden",{hidden:true}),base("reported",{reports:[{badge:"102",at:new Date(now).toISOString()}]}),
 base("group",{groupId:"private-g"}),base("expired",{type:"story",expiresAt:new Date(now-86400000).toISOString()}),
 base("invalid-expiry",{type:"story",expiresAt:"invalid"}),base("live-story",{type:"story",expiresAt:new Date(now+86400000).toISOString()}),
 base("legacy-tombstone",{deleted:true,legacyExtension:{retain:["عربي",null,0]}}),
 base("unknown-identity",{badge:"not-in-directory",name:"Invented missing identity"}),
 base("leading-zero",{badge:"00106",department:"Operations"}),base("department-replies",{replies:"department"}),
 base("no-replies",{replies:"none"}),base("poll",{type:"poll",poll:[{text:"نعم",votes:["101",101,"00106"]},{text:"No",votes:null}]}),
 base("nested",{comments:[{id:"c1",badge:"102",name:"Invented",text:"Parent",createdAt:new Date(now-2000).toISOString(),likes:["101"]},{id:"c2",badge:"103",text:"Reply",replyTo:"c1",createdAt:new Date(now-1000).toISOString(),likes:[],nestedLegacy:{x:null}}]}),
 base("engagement",{ratings:[{badge:"102",vote:"like"},{badge:"103",stars:1},{badge:"unknown",stars:5}],reposts:[{badge:"102",createdAt:new Date(now).toISOString()}]}),
 base("media",{media:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",gallery:["data:image/png;base64,AA==","not-media"]}),
 base("announcement",{type:"announcement",pinned:true,acks:["101","102"]}),
 base("event",{type:"event",eventAt:new Date(now+86400000).toISOString(),attendees:["101","103"]}),
 base("status",{type:"idea",status:"review",number:"0x10",statusLog:[{status:"review",badge:"102",name:"Invented",at:new Date(now).toISOString()}]}),
 base("older",{createdAt:new Date(now-3*86400000).toISOString(),number:"bad"}),
 ...Array.from({length:19},(_,i)=>base("boundary-"+i,{badge:i%2?"103":"101",department:i%2?"Operations":"Engineering",number:i,createdAt:new Date(now).toISOString()})),
 ];
 const f=structuredClone(h.fixture.files);
 f["ideas.json"]=posts;f["groups.json"]=[{id:"private-g",members:["101","103"],name:"Invented group"},{id:"empty-g",members:[]}];
 f["follows.json"]={"101":{people:["103"],departments:["Operations"]},"102":{people:["00106"],departments:[]}};
 f["bookmarks.json"]={"101":["engagement","poll"],"102":["public"]};f["views.json"]={"public":["invented-viewer"]};
 await h.repo.importSynthetic(f);await candidate.prepare(h.repo);
 async function transaction(fn){const t=await h.repo.begin([]);try{return await fn(t.client);}finally{await t.client.query("ROLLBACK");t.client.release();}}
 try{
  w=await diagnostic(h,5170);
  await test("Exact reference/native full semantics and HTTP headers for six identities × four scopes",async()=>{
   let pairs=0;
   for(const badge of ["101","102","103","00106","9001","9002"])for(const query of ["feed=company","feed=following","feed=today","group=private-g"]){
    const a=await h.request("/api/ideas?"+query,{},badge,{method:"GET"}),b=await h.request("/api/ideas?"+query,{},badge,{method:"GET",headers:{"x-private-feed-component":"1"}});
    assert.equal(b.status,a.status);assert.deepEqual(b.json,a.json);
    for(const key of ["content-type","content-length","content-encoding","cache-control","vary","x-content-type-options"])assert.equal(b.headers.get(key),a.headers.get(key),key);pairs++;
   }results.push({name:"Response comparison coverage",status:"PASS",pairs,comparison:"Deep JSON equality and six relevant HTTP headers; not count-only"});
  });
  await test("Original visibility: owner sees hidden, admin has no hidden bypass, reporter excluded",async()=>{
   const get=async b=>(await h.request("/api/ideas",{},b,{method:"GET",headers:{"x-private-feed-component":"1"}})).json.ideas.map(p=>p.id);
   assert((await get("101")).includes("hidden"));assert(!(await get("9001")).includes("hidden"));assert(!(await get("102")).includes("reported"));
   assert(!(await get("101")).includes("expired"));assert((await get("101")).includes("legacy-tombstone"));
  });
  await test("Anonymous and nonmember requests cannot leak posts, including an empty group",async()=>{
   for(const [badge,q,status]of [["","feed=company",401],["102","group=private-g",403],["101","group=empty-g",403]]){
    const r=await h.request("/api/ideas?"+q,{},badge,{method:"GET",headers:{"x-private-feed-component":"1"}});assert.equal(r.status,status);assert(!r.json.ideas);
   }
  });
  await test("Gzip and Arabic/English legacy payloads preserve exact response semantics",async()=>{
   const opts={method:"GET",headers:{"accept-encoding":"gzip"}},a=await h.request("/api/ideas",{},"101",opts),b=await h.request("/api/ideas",{},"101",{...opts,headers:{...opts.headers,"x-private-feed-component":"1"}});
   assert.deepEqual(b.json,a.json);assert.equal(b.headers.get("content-encoding"),a.headers.get("content-encoding"));assert.equal(b.headers.get("content-length"),a.headers.get("content-length"));
  });
  await test("One-record pages preserve ordinal ties, nested relations and unknown scalar fields",()=>transaction(async c=>{
   const all=[];let cursor=null;
   do{const p=await candidate.page(c,{limit:1,cursor,scopeKey:"trusted-all",accept:()=>true});assert(Object.isFrozen(p)&&Object.isFrozen(p.items));all.push(...p.items);cursor=p.cursor;}while(cursor);
   assert.deepEqual(all,posts);
  }));
  let savedCursor;
  await test("Cursor scope mismatch and malformed limits fail closed",()=>transaction(async c=>{
   const first=await candidate.page(c,{limit:16,scopeKey:"A",accept:()=>true});savedCursor=first.cursor;
   await assert.rejects(candidate.page(c,{cursor:first.cursor,scopeKey:"B",accept:()=>true}),/cursor_restart_required/);
   await assert.rejects(candidate.page(c,{limit:0,scopeKey:"A",accept:()=>true}),/invalid_page_limit/);
   await assert.rejects(candidate.page(c,{}),/trusted_reference_policy_required/);
  }));
  await test("Concurrent insertion invalidates ordinal cursor rather than skipping or duplicating posts",async()=>{
   await h.repo.importSynthetic({"ideas.json":[base("new-concurrent"),...posts]});
   await transaction(c=>assert.rejects(candidate.page(c,{cursor:savedCursor,scopeKey:"A",accept:()=>true}),/cursor_restart_required/));
  });
  await test("Physical deletion invalidates cursor and deleted post never returns",async()=>{
   const first=await transaction(c=>candidate.page(c,{scopeKey:"A",accept:()=>true}));
   await h.repo.importSynthetic({"ideas.json":posts.filter(p=>p.id!=="public")});
   await transaction(c=>assert.rejects(candidate.page(c,{cursor:first.cursor,scopeKey:"A",accept:()=>true}),/cursor_restart_required/));
   const r=await h.request("/api/ideas",{},"101",{method:"GET",headers:{"x-private-feed-component":"1"}});assert(!r.json.ideas.some(p=>p.id==="public"));
  });
  await test("Oversized relation and sparse visibility scans reject explicitly, never truncate",()=>transaction(async c=>{
   await assert.rejects(candidate.page(c,{scopeKey:"A",accept:()=>true,maxNodes:1}),/component_budget/);
   await assert.rejects(candidate.page(c,{scopeKey:"A",accept:()=>true,maxBytes:1}),/component_budget/);
   await assert.rejects(candidate.page(c,{scopeKey:"A",accept:()=>false,maxScanned:1}),/component_scan_budget/);
  }));
  await test("Zero and one records terminate without phantom posts",async()=>{
   for(const list of [[],[base("single")]]){
    await h.repo.importSynthetic({"ideas.json":list});
    await transaction(async c=>{const p=await candidate.page(c,{scopeKey:"A",accept:()=>true});assert.deepEqual(p.items,list);assert(p.done);});
   }
  });
  await test("Read component leaves account, media and all entity revisions unchanged",async()=>{
   const before=await h.repo.exportSynthetic(),revs=await h.repo.pool.query("SELECT name,revision FROM dev.files ORDER BY name");
   await transaction(c=>candidate.page(c,{scopeKey:"A",accept:()=>true}));
   assert.deepEqual(await h.repo.exportSynthetic(),before);assert.deepEqual((await h.repo.pool.query("SELECT name,revision FROM dev.files ORDER BY name")).rows,revs.rows);
  });
 }finally{if(w)await h.stop(w.child);await h.close();save("feed-parity.json",{totals:results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),results,note:"Private exhaustive component assembly runs inside full reference hydration for semantic comparison only. It is not a memory-optimized HTTP integration."});process.exitCode=results.some(r=>r.status==="FAIL")?1:0;}
})();
