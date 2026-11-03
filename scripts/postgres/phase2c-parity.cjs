const {harness,reference,ok,save}=require("./phase2c-support.cjs");
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const results=[];
(async()=>{
 const h=await harness(5150);let ref;
 async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",error:e.message.slice(0,500)});}console.log(results.at(-1).status,name);}
 try{
   await h.boot();ref=await reference(h,5151);
   const people={};for(const b of ["101","102","104","00106","9001","9002"]){const r=await h.request("/api/session",{},b);ok(r);people[b]=r.json.person.pid;}
   async function parity(pid,badge="101"){
     const a=await h.social("person",{pid},badge),b=await h.social("person",{pid},badge,{port:5151});
     assert.equal(a.status,b.status);assert.deepEqual(a.json,b.json);assert.deepEqual(a.bytes,b.bytes);
     for(const header of ["content-type","cache-control","vary","content-encoding"])assert.equal(a.headers.get(header),b.headers.get(header));
     return a;
   }
   await test("Employee/system/leading-zero profiles and actor matrix",async()=>{
     for(const actor of ["101","102","104","00106","9001","9002"])for(const pid of Object.values(people))ok(await parity(pid,actor));
   });
   await test("Profile photo, bio and duplicate/numeric/null follower parity",async()=>{
     const f=await h.repo.exportSynthetic();
     f["profiles.json"]={"102":{bio:"Invented عربي <script>data only</script>",photo:"data:image/png;base64,aGVsbG8="},"101":{bio:null,photo:"not-an-avatar"}};
     f["follows.json"]={"101":{people:["102","102",106,null],departments:[]},"102":{people:["101","00106","00106"]},"104":{people:["102"]}};
     await h.repo.importSynthetic({"profiles.json":f["profiles.json"],"follows.json":f["follows.json"]});
     for(const b of ["101","102","00106","9002"])await parity(people[b]);
   });
   await test("Complex legacy follower coercion safely falls back",async()=>{
     const f=await h.repo.exportSynthetic();f["follows.json"]["104"].people.push([["102"]]);
     await h.repo.importSynthetic({"follows.json":f["follows.json"]});await parity(people["102"]);
     f["follows.json"]["104"].people.pop();await h.repo.importSynthetic({"follows.json":f["follows.json"]});
   });
   await test("Unknown, injection-shaped, empty and forged PID",async()=>{
     for(const pid of ["","unknown","' OR 1=1 --","../data/accounts.json",null])assert.equal((await parity(pid)).status,404);
     assert.equal((await parity(people["101"],null)).status,401);
   });
   await test("Unsupported employee shapes and nonnumeric domains use reference behavior",async()=>{
     const original=(await h.repo.exportSynthetic())["employees.json"];
     try{
       for(const value of [{},[null],[...original,{badge:"alpha",name:"Invented unusual badge"}]]){
         await h.repo.importSynthetic({"employees.json":value});await parity(people["9001"],"9001");
       }
     }finally{await h.repo.importSynthetic({"employees.json":original});}
   });
   await test("Ban, session revocation, factor loss and deleted employee fail closed",async()=>{
     const f=await h.repo.exportSynthetic();
     try{
       const conduct=structuredClone(f["conduct.json"]);conduct.bans["104"]={at:new Date().toISOString(),count:5};
       await h.repo.importSynthetic({"conduct.json":conduct});assert.equal((await parity(people["101"],"104")).status,401);
       await h.repo.importSynthetic({"conduct.json":f["conduct.json"]});
       const a=structuredClone(f["accounts.json"]);a["104"].ver++;await h.repo.importSynthetic({"accounts.json":a});assert.equal((await parity(people["101"],"104")).status,401);
       a["104"]=structuredClone(f["accounts.json"]["104"]);delete a["104"].totp;await h.repo.importSynthetic({"accounts.json":a});assert.equal((await parity(people["101"],"104")).status,401);
       await h.repo.importSynthetic({"accounts.json":f["accounts.json"],"employees.json":f["employees.json"].filter(p=>p.badge!=="104")});assert.equal((await parity(people["101"],"104")).status,401);
     }finally{await h.repo.importSynthetic({"accounts.json":f["accounts.json"],"employees.json":f["employees.json"],"conduct.json":f["conduct.json"]});}
   });
   await test("Cross-worker idempotency and profile-change replay fence",async()=>{
     const key=crypto.randomUUID(),body={action:"person",pid:people["102"]};
     const first=await h.request("/api/social",body,"101",{key});ok(first);
     const retry=await h.request("/api/social",body,"101",{key,port:5151});ok(retry);assert.deepEqual(first.json,retry.json);
     ok(await h.social("profile",{bio:"Changed after cached read"},"102"));
     ok(await h.request("/api/social",body,"101",{key}),409);
   });
   await test("Unchanged original session-touch writer preserves every account",async()=>{
     const f=await h.repo.exportSynthetic(),accounts=structuredClone(f["accounts.json"]);
     accounts["101"].sessions[0].lastSeen=new Date(Date.now()-6*60000).toISOString();
     await h.repo.importSynthetic({"accounts.json":accounts});ok(await h.social("person",{pid:people["102"]}));
     const after=(await h.repo.exportSynthetic())["accounts.json"];assert.deepEqual(Object.keys(after),Object.keys(accounts));
     assert(Date.parse(after["101"].sessions[0].lastSeen)>Date.parse(accounts["101"].sessions[0].lastSeen));
     for(const badge of Object.keys(after).filter(b=>b!=="101"))assert.deepEqual(after[badge],accounts[badge]);
   });
   await test("Native profile reads preserve existing media links and business state",async()=>{
     const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64");
     const uploaded=await h.request("/api/media",{},"101",{raw:png,headers:{"Content-Type":"image/png"}});ok(uploaded,201);
     ok(await h.request("/api/ideas",{type:"post",text:"Invented linked image",media:uploaded.json.url}),201);
     const before=await h.repo.pool.query("SELECT * FROM dev.media_links ORDER BY source_file,source_path");
     assert(before.rowCount>0);
     const f=await h.repo.exportSynthetic();await parity(people["102"]);
     const after=await h.repo.exportSynthetic();for(const file of Object.keys(f).filter(f=>f!=="accounts.json"))assert.deepEqual(after[file],f[file]);
     assert.deepEqual((await h.repo.pool.query("SELECT * FROM dev.media_links ORDER BY source_file,source_path")).rows,before.rows);
   });
 }catch(e){results.push({name:"setup",status:"FAIL",error:e.message});}
 finally{if(ref)await h.stop(ref);await h.close();save("native-parity.json",{totals:results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),results});process.exitCode=results.some(r=>r.status==="FAIL")?1:0;}
})();
