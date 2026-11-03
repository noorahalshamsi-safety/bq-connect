const {harness,ok,sleep}=require("./harness.cjs");
const {code}=require("../../development/postgres/fixtures.cjs");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const destination=path.resolve(__dirname,"../../generated-artifacts/phase2b");
const results=[];let h,child,post,media,story,pids={};
async function run(id,feature,fn){
 const start=h.requests.length;
 try{const evidence=await fn();results.push({id,feature,status:"PASS",requests:h.requests.slice(start),evidence:evidence||"HTTP contract and persisted-state assertions passed"});}
 catch(e){results.push({id,feature,status:"FAIL",requests:h.requests.slice(start),evidence:e.message.slice(0,600)});}
 console.log(id,results.at(-1).status,feature,results.at(-1).status==="FAIL"?results.at(-1).evidence.split("\n")[0]:"");
}
const files=()=>h.repo.exportSynthetic();
const idea=id=>files().then(f=>f["ideas.json"].find(x=>x.id===id));
const create=async(type="post",badge="101",extra={})=>{const r=await h.request("/api/ideas",{type,text:"Invented Phase 2B content",...extra},badge);ok(r,201);return r.json.idea;};
(async()=>{
 try{
 h=await harness(5138);child=await h.boot();
 for(const badge of ["101","102","103","104","9001","9002"]){const r=await h.request("/api/session",{},badge);ok(r);pids[badge]=r.json.person.pid;}
 post=await create();
 await run("B01","Terms, spark, search, department and profile metadata",async()=>{
   ok(await h.request("/api/terms"));assert((await files())["accounts.json"]["101"].terms);
   ok(await h.request("/api/spark",{},"101",{method:"GET"}));ok(await h.request("/api/spark",{},null,{method:"GET"}),401);
   const search=await h.social("search",{q:"Synthetic"});ok(search);assert(search.json.people.length);
   const dept=await h.social("department",{department:"Engineering"});ok(dept);assert(JSON.stringify(dept.json).includes("Engineering"));
   ok(await h.social("profile-meta"));
 });
 await run("B02","Authorized dashboard/export and lower-role denial",async()=>{
   for(const action of ["dashboard","export"]){const r=await h.social(action,{kind:"ideas"},"9001");ok(r);assert(Object.keys(r.json).length);ok(await h.social(action,{},"101"),403);}
 });
 await run("B03","Admin spark set and clear persist through employee GET",async()=>{
   ok(await h.social("admin-spark",{op:"set",ar:"نص مصطنع",en:"Invented spark"},"9001"));
   const r=await h.request("/api/spark",{},"101",{method:"GET"});ok(r);assert(JSON.stringify(r.json).includes("Invented spark"));
   ok(await h.social("admin-spark",{op:"clear"},"9001"));assert.equal((await files())["daily-sparks.json"].override,null);
   ok(await h.social("admin-spark",{op:"set",ar:"Unauthorized"},"101"),403);
 });
 await run("B04","Email change: password gate, OTP gate, persistence",async()=>{
   ok(await h.request("/api/email",{op:"send",email:"phase2b101@example.invalid",password:"wrong"}),400);
   ok(await h.request("/api/email",{op:"send",email:"phase2b101@example.invalid",password:h.fixture.credentials.password}));
   const mail=(await h.repo.fixtureEvents("mail")).find(r=>r.payload.to==="phase2b101@example.invalid");assert(mail);
   const otp=mail.payload.text.match(/\b\d{6}\b/)?.[0];assert(otp);
   ok(await h.request("/api/email",{op:"confirm",code:"000000"}),400);
   ok(await h.request("/api/email",{op:"confirm",code:otp}));
   assert.equal((await files())["accounts.json"]["101"].email,"phase2b101@example.invalid");
 });
 await run("B05","2FA management and sensitive response replay restrictions",async()=>{
   const status=await h.request("/api/2fa");ok(status);assert(status.json.status.enabled);
   const key=crypto.randomUUID(),body={op:"recovery",password:h.fixture.credentials.password,code:code(h.fixture.credentials.totpKeys["101"])};
   const r=await h.request("/api/2fa",body,"101",{key});ok(r);assert(r.json.recovery.length);
   const rows=await h.repo.pool.query("SELECT policy,octet_length(body) AS bytes FROM dev.requests WHERE request_key=$1",[key]);
   assert.equal(rows.rows[0].policy,"no-response");assert.equal(rows.rows[0].bytes,0);
   ok(await h.request("/api/2fa",body,"101",{key}),409);
 });
 await run("B06","Encrypted replay, expiry, body conflict and revoked access",async()=>{
   const key=crypto.randomUUID(),body={type:"post",text:"Encrypted replay sentinel"};
   const first=await h.request("/api/ideas",body,"101",{key});ok(first,201);
   const cached=await h.repo.pool.query("SELECT * FROM dev.requests WHERE request_key=$1",[key]);assert(!cached.rows[0].body.includes(Buffer.from(body.text)));
   const replay=await h.request("/api/ideas",body,"101",{key});ok(replay,201);assert.equal(replay.json.idea.id,first.json.idea.id);
   ok(await h.request("/api/ideas",{...body,text:"Different input"},"101",{key}),409);
   await h.repo.pool.query("UPDATE dev.requests SET expires_at=clock_timestamp()-interval '1 second' WHERE request_key=$1",[key]);
   ok(await h.request("/api/ideas",body,"101",{key}),409);
   assert.equal((await files())["ideas.json"].filter(p=>p.text===body.text).length,1);
 });
 await run("B07","SQL injection, account enumeration response and CSRF defenses",async()=>{
   const before=await files();
   const a=await h.request("/api/login",{badge:"101",password:"wrong"},null),b=await h.request("/api/login",{badge:"999999",password:"wrong"},null);
   ok(a,401);ok(b,401);assert.deepEqual(a.json,b.json);
   const injection=await h.social("search",{q:"'; DROP TABLE dev.accounts;--"});ok(injection);
   ok(await h.request("/api/ideas",{type:"post",text:"Cross-origin must not commit"},"101",{headers:{Origin:"https://attacker.invalid"}}),403);
   assert.equal(Object.keys((await files())["accounts.json"]).length,Object.keys(before["accounts.json"]).length);
   assert(!(await files())["ideas.json"].some(p=>p.text==="Cross-origin must not commit"));
 });
 await run("B08","Object ownership and profile impersonation attempts",async()=>{
   ok(await h.request(`/api/ideas/${post.id}`,{text:"Horizontal attack"},"102",{method:"PATCH"}),403);
   ok(await h.request(`/api/ideas/${post.id}`,{},"102",{method:"DELETE"}),403);
   ok(await h.social("profile",{badge:"102",pid:pids["102"],bio:"Only own profile changes"}));
   const f=await files();assert.equal(f["profiles.json"]["101"].bio,"Only own profile changes");assert.notEqual(f["profiles.json"]["102"]?.bio,"Only own profile changes");
   assert.equal((await idea(post.id)).badge,"101");
 });
 await run("B09","Content reporting and every moderator decision",async()=>{
   ok(await h.request(`/api/ideas/${post.id}/report`,{reason:"other"},"104"));
   assert((await idea(post.id)).reports.length);
   for(const decision of ["hide","restore","dismiss"]){ok(await h.social("mod-action",{id:post.id,decision},"102"));assert.equal(Boolean((await idea(post.id)).hidden),decision==="hide");}
   ok(await h.social("mod-action",{id:post.id,decision:"hide"},"101"),403);
 });
 await run("B10","Administrator comment/rating/post mutations and denials",async()=>{
   ok(await h.request(`/api/ideas/${post.id}/comments`,{text:"Outside reply scope"},"104"),404);
   const r=await h.request(`/api/ideas/${post.id}/comments`,{text:"Comment for admin removal"},"102");ok(r,201);const cid=r.json.idea.comments.at(-1).id;
   ok(await h.social("admin-delete-comment",{id:post.id,commentId:cid},"101"),403);
   ok(await h.social("admin-delete-comment",{id:post.id,commentId:cid},"9001"));assert(!(await idea(post.id)).comments.some(c=>c.id===cid));
   ok(await h.request(`/api/ideas/${post.id}/rating`,{vote:"like"},"102"));
   ok(await h.social("admin-remove-like",{id:post.id,pid:pids["102"]},"9001"));assert(!(await idea(post.id)).ratings.some(r=>r.badge==="102"));
   ok(await h.social("admin-post",{id:post.id},"9001"));
   const gone=await create();ok(await h.social("admin-delete-post",{id:gone.id},"9001"));assert.equal(await idea(gone.id),undefined);
 });
 await run("B11","Join approve/reject and unauthorized approval",async()=>{
   for(const [badge,decision]of [["120","approve"],["121","reject"]]){
     ok(await h.request("/api/join",{badge,name:"Synthetic Join Person",department:"Engineering",position:"Engineer",code:"1234",mobile:"512345678"},null));
     const row=(await files())["join-requests.json"].find(x=>x.badge===badge);assert(row);
     ok(await h.social("admin-join",{id:row.id,decision},"101"),403);
     ok(await h.social("admin-join",{id:row.id,decision},"9001"));
     const f=await files();assert(!f["join-requests.json"].some(x=>x.id===row.id));assert.equal(f["employees.json"].some(x=>x.badge===badge),decision==="approve");
   }
 });
 await run("B12","Groups: join, retry, leave and department-group protection",async()=>{
   const r=await h.social("create-group",{name:"Invented Phase2B group"});ok(r,201);const groupId=r.json.group.id,key=crypto.randomUUID();
   const joined=await h.social("join-group",{groupId},"104",{key});ok(joined);assert.equal(joined.json.joined,true);
   ok(await h.social("join-group",{groupId},"104",{key}));assert((await files())["groups.json"].find(g=>g.id===groupId).members.includes("104"));
   const leave=await h.social("join-group",{groupId},"104");ok(leave);assert.equal(leave.json.joined,false);
   const dept=(await files())["groups.json"].find(g=>g.kind==="department");assert(dept);
   ok(await h.social("join-group",{groupId:dept.id},"104"),403);
 });
 await run("B13","Complete image lifecycle, Range/HEAD and upload safety",async()=>{
   const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64");
   ok(await h.request("/api/media",{},null,{raw:png,headers:{"Content-Type":"image/png"}}),401);
   const unsafe=await h.request("/api/media",{},"101",{raw:Buffer.from("<svg onload='alert(1)'></svg>"),headers:{"Content-Type":"image/svg+xml"}});assert([400,415].includes(unsafe.status));
   const pair=await Promise.all([h.request("/api/media",{},"101",{raw:png,headers:{"Content-Type":"image/png"}}),h.request("/api/media",{},"101",{raw:png,headers:{"Content-Type":"image/png"}})]);
   pair.forEach(r=>ok(r,201));assert.notEqual(pair[0].json.url,pair[1].json.url);media=pair[0].json.url;
   const bytes=await h.request(media,{},null,{method:"GET"});ok(bytes);
   const rows=await h.repo.pool.query("SELECT sha256,state FROM dev.media WHERE legacy_path=$1",[media]);assert.equal(rows.rows[0].state,"ready");assert.equal(rows.rows[0].sha256,crypto.createHash("sha256").update(bytes.bytes).digest("hex"));
   const head=await h.request(media,{},null,{method:"HEAD"});ok(head);assert.equal(head.bytes.length,0);assert.equal(Number(head.headers.get("content-length")),bytes.bytes.length);
   const range=await h.request(media,{},null,{method:"GET",headers:{Range:"bytes=0-15"}});ok(range,206);assert.equal(range.bytes.length,16);
   story=await create("story","101",{media});
 });
 await run("B14","Highlights ownership, update and delete",async()=>{
   const save=await h.social("highlight-save",{title:"Invented",storyIds:[story.id]});ok(save);
   const id=(await files())["highlights.json"]["101"][0].id;
   ok(await h.social("highlight-save",{id,title:"Changed",storyIds:[story.id]}));
   ok(await h.social("highlight-save",{id,title:"Unauthorized",storyIds:[story.id]},"104"),400);
   ok(await h.social("highlight-delete",{id},"104"));assert((await files())["highlights.json"]["101"].some(x=>x.id===id),"Other actor deleted owner's highlight");
   ok(await h.social("highlight-delete",{id}));assert(!(await files())["highlights.json"]["101"].some(x=>x.id===id));
 });
 await run("B15","Stored markup, JSON response escaping and source preservation",async()=>{
   const text="<img src=x onerror=window.phase2bXss=1> Invented";
   const r=await create("post","101",{text});const saved=await idea(r.id);assert(saved.text);
   const list=await h.request("/api/ideas",{},"101",{method:"GET"});ok(list);assert.match(list.headers.get("content-type"),/application\/json/);
   return "Data stored/read as JSON; executable browser rendering assessed separately, not inferred from this HTTP result.";
 });
 for(const [id,point]of [["B16","before_commit"],["B17","during_commit"],["B18","unknown_commit"],["B19","after_commit_drop"]])
 await run(id,`Actual transaction fault: ${point}`,async()=>{
   const key=crypto.randomUUID(),text=`Fault sentinel ${point}`,body={type:"post",text};
   await h.repo.pool.query("INSERT INTO dev.test_faults VALUES($1,$2)",[key,point]);
   let r;try{r=await h.request("/api/ideas",body,"101",{key});}catch(e){if(point!=="after_commit_drop")throw e;}
   if(point!=="after_commit_drop")ok(r,503);else assert(!r,"Response was not actually dropped");
   const count=(await files())["ideas.json"].filter(p=>p.text===text).length;
   assert.equal(count,["unknown_commit","after_commit_drop"].includes(point)?1:0);
   await h.repo.pool.query("DELETE FROM dev.test_faults WHERE request_key=$1",[key]);
   const retry=await h.request("/api/ideas",body,"101",{key});ok(retry,201);
   assert.equal((await files())["ideas.json"].filter(p=>p.text===text).length,1);
   return point==="during_commit"?"Deferred foreign-key violation raised by actual PostgreSQL COMMIT; subsequent HTTP retry persisted once":point==="unknown_commit"?"Driver socket paused during COMMIT, independent server witness, socket destroyed before client completion; retry reconciled once":"HTTP and authoritative row count verified";
 });
 await run("B20","Ciphertext controls, expiry/redaction and no secret JSON leakage",async()=>{
   const controls=await h.repo.pool.query("SELECT value FROM dev.runtime_state");assert(controls.rows.every(r=>r.value.sealed));
   const rows=await h.repo.pool.query("SELECT payload FROM dev.outbox");assert(rows.rows.every(r=>r.payload.sealed||r.payload.redacted));
   await h.repo.pool.query("UPDATE dev.outbox SET created_at=clock_timestamp()-interval '6 minutes' WHERE delivered_at IS NOT NULL");
   await h.repo.drainFixtureOutbox();
   const old=await h.repo.pool.query("SELECT payload FROM dev.outbox WHERE created_at<clock_timestamp()-interval '5 minutes' AND delivered_at IS NOT NULL");
   assert(old.rows.every(r=>r.payload.redacted));
   ok(await h.request("/api/session"));
 });
 await run("B21","Malformed SQL account object fails closed and does not regenerate",async()=>{
   const saved=(await h.repo.pool.query("SELECT attrs FROM dev.accounts WHERE entry_key='101'")).rows[0].attrs;
   await h.repo.pool.query("UPDATE dev.accounts SET attrs='{}'::jsonb WHERE entry_key='101'");
   try{ok(await h.request("/health/ready",{},null,{method:"GET"}),503);}
   finally{await h.repo.pool.query("UPDATE dev.accounts SET attrs=$1::jsonb WHERE entry_key='101'",[JSON.stringify(saved)]);}
   ok(await h.request("/api/session"));
 });
 await run("B22","Real model HTTP translation, content-addressed edits and concurrency",async()=>{
   const t=await h.boot(5139,true);
   try{
     const a=await h.request("/api/translate",{from:"ar",to:"en",text:"صباح الخير. المشروع جاهز."},"101",{port:5139});ok(a);assert.match(a.json.text,/ready/i);
     const b=await h.request("/api/translate",{from:"en",to:"ar",text:"The project is ready."},"101",{port:5139});ok(b);assert.match(b.json.text,/جاهز/);
     const edited=await h.request("/api/translate",{from:"en",to:"ar",text:"The project has been delayed."},"101",{port:5139});ok(edited);assert.notEqual(edited.json.text,b.json.text);
     const pair=await Promise.all([h.request("/api/translate",{from:"en",to:"ar",text:"Thank you."},"101",{port:5139}),h.request("/api/translate",{from:"ar",to:"en",text:"شكرا لك."},"101",{port:5139})]);pair.forEach(r=>ok(r));
     ok(await h.request("/api/translate",{from:"ar",to:"en",text:"نص مصطنع"},null,{port:5139}),401);
     assert.equal((await idea(post.id)).text,"Invented Phase 2B content");
   }finally{await h.stop(t);}
 });
 await run("B23","Admin grants/revokes, unlock, session revoke and 2FA reset",async()=>{
   const pid=pids["104"];
   for(const op of ["admin-on","admin-off","unlock"]){
     ok(await h.social("admin-user",{pid,op},"101"),403);
     ok(await h.social("admin-user",{pid,op},"9001"));
     if(op!=="unlock")assert.equal((await files())["moderators.json"].badges.includes("104"),op==="admin-on");
   }
   const f=await files();f["conduct.json"].bans["104"]={at:new Date().toISOString(),count:5};await h.repo.importSynthetic({"conduct.json":f["conduct.json"]});
   ok(await h.social("admin-unban",{pid},"9001"));assert(!(await files())["conduct.json"].bans["104"]);
   ok(await h.social("admin-user",{pid,op:"unban"},"9001"));
   const sessions=await h.social("admin-sessions",{pid},"9001");ok(sessions);assert(sessions.json.sessions.length);
   ok(await h.social("admin-sessions",{pid,revoke:sessions.json.sessions[0].id},"9001"));
   ok(await h.request("/api/session",{},"104"),401);
   ok(await h.social("admin-user",{pid,op:"revoke"},"9001"));
   ok(await h.social("admin-user",{pid,op:"reset-2fa"},"9001"));
   const account=(await files())["accounts.json"]["104"];assert(!account.totp?.on);assert(Date.parse(account.reopenUntil)>Date.now());
   ok(await h.social("admin-user",{pid:pids["9001"],op:"reset-2fa"},"9001"),400);
 });
 await run("B24","Cross-process rate limit and account version changes",async()=>{
   const t=await h.boot(5140);
   try{
     const attempts=[];for(let i=0;i<18;i++)attempts.push(await h.request("/api/login",{badge:"102",password:"wrong"},null,{port:i%2?5140:5138,ip:"192.0.2.99"}));
     assert(attempts.some(r=>r.status===429),"No shared rate limit was reached");
     const body={current:h.fixture.credentials.password,next:"Phase2bChanged!Pass2026"};
     const replies=await Promise.all([h.request("/api/password",body,"103"),h.request("/api/password",body,"103",{port:5140})]);
     assert.equal(replies.filter(r=>r.status===200).length,1);
     ok(await h.request("/api/session",{},"103",{port:5140}),401);
   }finally{await h.stop(t);}
 });
 await run("B25","Pool exhaustion and lock timeout are bounded",async()=>{
   const held=await Promise.all(Array.from({length:4},()=>h.repo.pool.connect()));const start=performance.now();
   try{await assert.rejects(()=>h.repo.pool.connect());assert(performance.now()-start<5000);}
   finally{held.forEach(c=>c.release());}
   const c=await h.repo.pool.connect();await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1793705963)");
   try{ok(await h.request("/health/ready",{},null,{method:"GET"}),503);}
   finally{await c.query("ROLLBACK");c.release();}
   const burst=await Promise.all(Array.from({length:64},()=>h.request("/health/ready",{},null,{method:"GET"})));
   assert(burst.some(r=>r.status===503),"Admission limit did not reject excess HTTP work");
   assert(burst.every(r=>[200,503].includes(r.status)));
   const a=await h.repo.pool.connect(),b=await h.repo.pool.connect();
   try{
     await a.query("BEGIN");await b.query("BEGIN");
     await a.query("UPDATE dev.authority SET epoch=epoch WHERE singleton");
     await b.query("UPDATE dev.files SET revision=revision WHERE name='accounts.json'");
     const outcomes=await Promise.allSettled([a.query("UPDATE dev.files SET revision=revision WHERE name='accounts.json'"),b.query("UPDATE dev.authority SET epoch=epoch WHERE singleton")]);
     assert(outcomes.some(r=>r.status==="rejected"&&r.reason.code==="40P01"));
   }finally{await a.query("ROLLBACK");await b.query("ROLLBACK");a.release();b.release();}
   ok(await h.request("/health/ready",{},null,{method:"GET"}));
 });
 await run("B26","Acknowledgement crash and transactional worker restart",async()=>{
   const r=await create("post","101",{text:"Acknowledged before crash"});
   await h.stop(child);child=await h.boot();
   const list=await h.request("/api/ideas",{},"101",{method:"GET"});ok(list);assert(JSON.stringify(list.json).includes(r.id));
   const pending=await h.repo.pool.query("SELECT id FROM dev.outbox WHERE delivered_at IS NULL");
   await sleep(1200);
   for(const row of pending.rows)assert((await h.repo.pool.query("SELECT delivered_at FROM dev.outbox WHERE id=$1",[row.id])).rows[0].delivered_at);
   return "Synthetic receipts only; no actual email/SMS/browser-push delivery claimed.";
 });
 await run("B27","Handler deadline retires worker without reusing an async scope",async()=>{
   const key=crypto.randomUUID();await h.repo.pool.query("INSERT INTO dev.test_faults VALUES($1,'handler_timeout')",[key]);
   ok(await h.request("/api/ideas",{type:"post",text:"Deadline must not persist"},"101",{key,timeout:32000}),503);
   await sleep(400);assert.notEqual(child.exitCode,null,"Timed-out worker was reused");
   await h.repo.pool.query("DELETE FROM dev.test_faults WHERE request_key=$1",[key]);
   child=await h.boot();ok(await h.request("/health/ready",{},null,{method:"GET"}));
   assert(!(await files())["ideas.json"].some(x=>x.text==="Deadline must not persist"));
 });
 }catch(e){results.push({id:"HARNESS",feature:"Setup",status:"FAIL",evidence:e.message});}
 finally{
   const requests=h?.requests||[];if(h)await h.close();
   fs.mkdirSync(destination,{recursive:true});
   fs.writeFileSync(path.join(destination,"hardening-app.log"),(h?.logs||[]).join(""));
   const report={at:new Date().toISOString(),scope:"Invented local PostgreSQL only",totals:{PASS:results.filter(r=>r.status==="PASS").length,FAIL:results.filter(r=>r.status==="FAIL").length},results,requests};
   fs.writeFileSync(path.join(destination,"hardening-results.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report.totals));process.exitCode=report.totals.FAIL?1:0;
 }
})();
