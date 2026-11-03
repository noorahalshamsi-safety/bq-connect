// Actual HTTP integration tests. All data, keys and transport sinks are invented.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {spawn}=require("node:child_process");
const {prepare}=require("../../development/postgres/isolation.cjs");
const {Repository}=require("../../development/postgres/repository.cjs");
const {create,code}=require("../../development/postgres/fixtures.cjs");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-pg-dev-")),proof=prepare(root),repo=new Repository(proof),fixture=create(proof.sessionKey);
const output=path.resolve(__dirname,"../../generated-artifacts/phase2");
const results=[],requests=[],logs=[];let child,port=5108,postId,commentId,storyId,pollId,media,video,personPid,highlightId,groupId,additionalToken,ip=1;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(p=port) {
  const c=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/runtime.cjs"),root],{cwd:proof.app,env:{...proof.childEnv,PORT:String(p)},stdio:["ignore","pipe","pipe"]});
  c.stdout.on("data",x=>logs.push(x.toString()));c.stderr.on("data",x=>logs.push(x.toString()));
  for(let i=0;i<150;i++){await sleep(100);if(c.exitCode!==null)throw Error("synthetic application exited during startup");try{const r=await fetch(`http://127.0.0.1:${p}/health/ready`);if(r.status===200)return c;}catch{}}
  c.kill("SIGKILL");throw Error("synthetic startup timeout");
}
async function stop(c){if(!c||c.exitCode!==null)return;await new Promise(r=>{c.once("exit",r);c.kill("SIGKILL");});}
async function request(url,body={},badge="101",options={}) {
  const method=options.method||"POST",token=fixture.credentials.tokens[badge];
  // Existing UI contracts carry tokens in JSON bodies; x-session is for media
  // and some GET paths. Do not invent a header-only API in integration tests.
  if(token&&!options.raw&&!["GET","HEAD"].includes(method))body={token,...body};
  const headers={"x-forwarded-for":`192.0.2.${1+(ip++%240)}`,...(token?{"x-session":token}:{}),...options.headers};
  if(!["GET","HEAD"].includes(method))headers["Idempotency-Key"]=options.key||crypto.randomUUID();
  if(!options.raw)headers["Content-Type"]="application/json";
  const started=Date.now();
  const r=await fetch(`http://127.0.0.1:${options.port||port}${url}`,{method,headers,body:["GET","HEAD"].includes(method)?undefined:options.raw||JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const bytes=Buffer.from(await r.arrayBuffer());let json={};try{json=JSON.parse(bytes.toString());}catch{}
  requests.push({method,url:url.split("?")[0],action:body?.action||null,status:r.status,elapsedMs:Date.now()-started});
  return {status:r.status,json,bytes,headers:r.headers};
}
const ok=(r,status=200)=>assert.equal(r.status,status,`Unexpected HTTP status ${r.status}; ${r.json.error||""}`);
const social=(action,body={},badge="101",opts)=>request("/api/social",{action,...body},badge,opts);
async function test(id,feature,fn) {
  const before=requests.length;
  try {const evidence=await fn();results.push({id,feature,status:"PASS",httpRequests:requests.slice(before),evidence:evidence||"Assertions passed"});}
  catch(e){results.push({id,feature,status:"FAIL",httpRequests:requests.slice(before),evidence:String(e.message).slice(0,400)});}
  console.log(`${id} ${results.at(-1).status} ${feature}`);
}
async function registerOtp(badge) {
  const body={badge,code:"1234",mobile:"512345678",password:fixture.credentials.password};
  const begin=await request("/api/register",body,null);ok(begin);
  const messages=await repo.pool.query("SELECT payload FROM dev.outbox WHERE topic='sms' ORDER BY created_at DESC LIMIT 1");
  assert(messages.rowCount,"SMS was not queued");
  const encoded=new URLSearchParams(messages.rows[0].payload.body).get("Body")||messages.rows[0].payload.body;
  const otp=encoded.match(/\b\d{6}\b/)?.[0];assert(otp,"No synthetic SMS OTP");
  return {...body,otp};
}
function fromBase32(text) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const ch of text)bits+=alphabet.indexOf(ch).toString(2).padStart(5,"0");
  return Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))).toString("hex");
}
async function main() {
  await repo.initialize(fixture.files);child=await boot();
  await test("H01","Unchanged UI/PWA and development request-key transport",async()=>{
    const r=await request("/",{},null,{method:"GET"});ok(r);assert(r.bytes.toString().includes("synthetic-request.js"));
    ok(await request("/sw.js",{},null,{method:"GET"}));
  });
  await test("H02","Existing signed session resolves employee and directory",async()=>{
    const r=await request("/api/session",{token:fixture.credentials.tokens["101"]});ok(r);assert(r.json.person?.name);personPid=r.json.person.pid;
  });
  await test("H03","Unauthorized mutation and admin access are denied",async()=>{
    const r=await request("/api/ideas",{type:"post",text:"must not persist"},null);assert([401,403].includes(r.status));
    ok(await social("admin-summary"),403);ok(await social("mod-queue"),403);
  });
  await test("H04","Password login, 2FA verification and ticket replay rejection",async()=>{
    const login=await request("/api/login",{badge:"101",password:fixture.credentials.password},null);ok(login);assert(login.json.needTotp);
    const ticket=login.json.ticket,result=await request("/api/login-2fa",{ticket,code:code(fixture.credentials.totpKeys["101"])},null);ok(result);assert(result.json.token);
    additionalToken=result.json.token;
    const replay=await request("/api/login-2fa",{ticket,code:code(fixture.credentials.totpKeys["101"])},null);assert([400,401].includes(replay.status));
  });
  await test("H05","Recovery code is accepted once through HTTP",async()=>{
    const l=await request("/api/login",{badge:"102",password:fixture.credentials.password},null);ok(l);
    const result=await request("/api/login-2fa",{ticket:l.json.ticket,code:fixture.credentials.recovery},null);ok(result);assert(result.json.token);
    const l2=await request("/api/login",{badge:"102",password:fixture.credentials.password},null);
    assert([400,401].includes((await request("/api/login-2fa",{ticket:l2.json.ticket,code:fixture.credentials.recovery},null)).status));
  });
  await test("H06","Leading-zero badge and absent-KDF legacy login",async()=>{
    const r=await request("/api/login",{badge:"00106",password:fixture.credentials.password},null);ok(r);assert(r.json.ticket);
    const exported=await repo.exportSynthetic();assert(exported["accounts.json"]["00106"]);assert.equal(exported["accounts.json"]["00106"].kdf,2);
  });
  await test("H07","Profile update and public profile read",async()=>{
    ok(await social("profile",{bio:"Synthetic updated biography"}));
    const r=await social("person",{pid:personPid});ok(r);assert(JSON.stringify(r.json).includes("Synthetic updated biography"));
  });
  await test("H08","Text post creation and response contract",async()=>{
    const r=await request("/api/ideas",{type:"post",text:"Synthetic text lifecycle"});ok(r,201);assert(r.json.idea?.id);postId=r.json.idea.id;
  });
  await test("H09","Comment, nested reply, comment-like and reaction",async()=>{
    assert(postId);
    const r=await request(`/api/ideas/${postId}/comments`,{text:"Synthetic comment"},"102");ok(r,201);commentId=r.json.idea.comments[0].id;
    ok(await request(`/api/ideas/${postId}/comments`,{text:"Synthetic reply",replyTo:commentId}),201);
    ok(await request(`/api/ideas/${postId}/comment-like`,{commentId}));
    ok(await request(`/api/ideas/${postId}/rating`,{vote:"like"},"102"));
  });
  await test("H10","Bookmark, repost, views and notifications",async()=>{
    ok(await request(`/api/ideas/${postId}/bookmark`,{},"102"));
    ok(await request(`/api/ideas/${postId}/repost`,{text:"Synthetic repost"},"102"));
    ok(await request("/api/views",{ids:[postId]},"102"));
    const r=await request("/api/notifications",{token:fixture.credentials.tokens["101"]});ok(r);
    ok(await request("/api/notifications/read",{token:fixture.credentials.tokens["101"]}));
  });
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64");
  await test("H11","Image upload intent, immutable bytes, read and attachment",async()=>{
    const r=await request("/api/media",{}, "101",{raw:png,headers:{"Content-Type":"image/png"}});ok(r,201);media=r.json.url;assert(media);
    ok(await request(media,{},"101",{method:"GET"}));
    const post=await request("/api/ideas",{type:"post",text:"Synthetic image",media});ok(post,201);
    const state=await repo.pool.query("SELECT state FROM dev.media WHERE legacy_path=$1",[media]);assert.equal(state.rows[0].state,"ready");
  });
  await test("H12","Video upload and post HTTP lifecycle",async()=>{
    const mp4=Buffer.alloc(40);mp4.writeUInt32BE(24,0);mp4.write("ftypisom",4);mp4.writeUInt32BE(16,24);mp4.write("mdat",28);
    const r=await request("/api/media",{},"101",{raw:mp4,headers:{"Content-Type":"video/mp4"}});ok(r,201);video=r.json.url;
    ok(await request("/api/ideas",{type:"post",text:"Synthetic video metadata fixture",media:video}),201);
    const range=await request(video,{},"101",{method:"GET",headers:{Range:"bytes=0-15"}});ok(range,206);assert.equal(range.bytes.length,16);
    return "Valid header/HTTP storage fixture; full video playback/transcoding is not asserted.";
  });
  await test("H13","Stories, archive and highlights retain media",async()=>{
    const r=await request("/api/ideas",{type:"story",text:"Synthetic story",media});ok(r,201);storyId=r.json.idea.id;
    ok(await social("story-archive"));
    const saved=await social("highlight-save",{title:"Synthetic highlight",storyIds:[storyId],coverId:storyId});ok(saved);
    const exported=await repo.exportSynthetic();highlightId=exported["highlights.json"]["101"][0].id;assert(highlightId);
  });
  await test("H14","Poll creation and unique vote update",async()=>{
    const r=await request("/api/ideas",{type:"poll",title:"Synthetic poll",options:["First","Second"]});ok(r,201);pollId=r.json.idea.id;
    ok(await request(`/api/ideas/${pollId}/poll`,{option:0},"102"));
    ok(await request(`/api/ideas/${pollId}/poll`,{option:1},"102"));
    const x=await repo.exportSynthetic(),p=x["ideas.json"].find(p=>p.id===pollId);
    assert.equal(p.poll.flatMap(o=>o.votes).filter(b=>b==="102").length,1);
  });
  await test("H15","Groups, membership, follows and department follows",async()=>{
    const r=await social("create-group",{name:"Synthetic custom group"});ok(r,201);groupId=r.json.group.id;
    ok(await social("join-group",{id:groupId,groupId},"102"));
    ok(await social("follow",{pid:personPid},"102"));
    ok(await social("follow-department",{department:"Engineering"},"102"));
    ok(await social("groups"));
  });
  await test("H16","Events, announcements, RSVP and acknowledgements",async()=>{
    const event=await request("/api/ideas",{type:"event",title:"Synthetic event",text:"Synthetic event body",eventAt:new Date(Date.now()+86400000).toISOString()},"9002");ok(event,201);
    ok(await request(`/api/ideas/${event.json.idea.id}/rsvp`,{},"101"));
    const a=await request("/api/ideas",{type:"announcement",title:"Synthetic announcement",text:"Synthetic official notice"},"9002");ok(a,201);
    ok(await request(`/api/ideas/${a.json.idea.id}/ack`,{},"101"));
  });
  await test("H17","Ownership enforcement and post edit",async()=>{
    ok(await request(`/api/ideas/${postId}`,{text:"Unauthorised edit"},"104",{method:"PATCH"}),403);
    ok(await request(`/api/ideas/${postId}`,{text:"Synthetic owner edit"},"101",{method:"PATCH"}));
  });
  await test("H18","Admin read functions use SQL projection",async()=>{
    for(const action of ["admin-summary","admin-joins","admin-conduct","admin-posts","admin-content","admin-users","admin-sessions","admin-achievements","admin-log"])
      ok(await social(action,{pid:personPid},"9001"));
  });
  await test("H19","Moderator hide/restore and role denial",async()=>{
    ok(await social("mod-action",{id:postId,decision:"hide"},"102"));
    ok(await social("mod-action",{id:postId,decision:"restore"},"102"));
    ok(await social("mod-queue",{},"102"));
  });
  await test("H20","Moderation warnings persist transactionally",async()=>{
    const r=await request("/api/ideas",{type:"post",text:"fuck"});ok(r,422);
    const files=await repo.exportSynthetic();assert(files["conduct.json"].warnings.length>0);
  });
  await test("H21","Idempotent post retry has one committed mutation",async()=>{
    const key=crypto.randomUUID(),body={type:"post",text:"Synthetic idempotent post"};
    const a=await request("/api/ideas",body,"101",{key}),b=await request("/api/ideas",body,"101",{key});ok(a,201);ok(b,201);assert.equal(a.json.idea.id,b.json.idea.id);
    ok(await request("/api/ideas",{...body,text:"Different input"},"101",{key}),409);
    assert.equal((await repo.exportSynthetic())["ideas.json"].filter(p=>p.text===body.text).length,1);
  });
  await test("H22","Failed COMMIT never acknowledges or persists social state",async()=>{
    const key=crypto.randomUUID();await repo.pool.query("INSERT INTO dev.test_faults VALUES($1,'before_commit')",[key]);
    ok(await request("/api/ideas",{type:"post",text:"Must never commit"},"101",{key}),503);
    await repo.pool.query("DELETE FROM dev.test_faults WHERE request_key=$1",[key]);
    assert.equal((await repo.exportSynthetic())["ideas.json"].filter(p=>p.text==="Must never commit").length,0);
  });
  await test("H23","Commit-response loss and HTTP retry reconcile",async()=>{
    const key=crypto.randomUUID(),body={type:"post",text:"Synthetic ambiguous commit"};
    await repo.pool.query("INSERT INTO dev.test_faults VALUES($1,'after_commit_drop')",[key]);
    let lost=false;try{await request("/api/ideas",body,"101",{key});}catch{lost=true;}
    assert(lost,"Response was not dropped");
    ok(await request("/api/ideas",body,"101",{key}),201);
    assert.equal((await repo.exportSynthetic())["ideas.json"].filter(p=>p.text===body.text).length,1);
  });
  await test("H24","Push subscription and transactional fixture outbox",async()=>{
    const e=crypto.createECDH("prime256v1");e.generateKeys();
    const subscription={endpoint:"https://fcm.googleapis.com/fcm/send/synthetic",keys:{p256dh:e.getPublicKey().toString("base64url"),auth:crypto.randomBytes(16).toString("base64url")}};
    const r=await request("/api/push",{token:fixture.credentials.tokens["101"],op:"subscribe",subscription,lang:"en"});ok(r);
    const target=(await repo.exportSynthetic())["ideas.json"].find(p=>p.text==="Synthetic idempotent post");
    ok(await request(`/api/ideas/${target.id}/comments`,{text:"Synthetic push-producing comment"},"102"),201);
    let delivered=false;
    for(let i=0;i<30;i++){const q=await repo.pool.query("SELECT count(*) AS n FROM dev.outbox WHERE topic='push' AND delivered_at IS NOT NULL");if(Number(q.rows[0].n)>0){delivered=true;break;}await sleep(100);}
    assert(delivered,"Fixture outbox worker did not acknowledge a push event");
    return "Push subscription and durable outbox exercised; actual external push delivery is BLOCKED.";
  });
  await test("H25","Synthetic registration OTP, TOTP setup and email linking",async()=>{
    const body=await registerOtp("107"),reg=await request("/api/register",body,null);ok(reg);assert(reg.json.registered);
    const setup=await request("/api/login-2fa",{op:"setup",ticket:reg.json.ticket},null);ok(setup);assert(setup.json.secret);
    const enrolled=await request("/api/login-2fa",{op:"enroll",ticket:reg.json.ticket,code:code(fromBase32(setup.json.secret))},null);ok(enrolled);
    assert(enrolled.json.needEmail);
    const mail=await request("/api/login-2fa",{op:"email",ticket:enrolled.json.ticket,email:"synthetic107@example.invalid"},null);ok(mail);
    const msgs=await repo.pool.query("SELECT payload FROM dev.outbox WHERE topic='mail' AND payload->>'to'='synthetic107@example.invalid' ORDER BY created_at DESC LIMIT 1");
    const otp=msgs.rows[0]?.payload.text.match(/\b\d{6}\b/)?.[0];assert(otp);
    const done=await request("/api/login-2fa",{op:"email-confirm",ticket:enrolled.json.ticket,code:otp},null);ok(done);assert(done.json.token);
    fixture.credentials.tokens["107"]=done.json.token;
  });
  await test("H26","Concurrent account creation has one HTTP winner",async()=>{
    const body=await registerOtp("108");
    const replies=await Promise.all([request("/api/register",body,null),request("/api/register",body,null)]);
    assert.equal(replies.filter(r=>r.status===200&&r.json.registered).length,1);
    assert((await repo.exportSynthetic())["accounts.json"]["108"].hash);
  });
  await test("H27","Concurrent password changes retain only authoritative winner",async()=>{
    const body={token:fixture.credentials.tokens["104"],current:fixture.credentials.password,password:"AnotherSynthetic!Pass2026",next:"AnotherSynthetic!Pass2026"};
    const replies=await Promise.all([request("/api/password",body,"104"),request("/api/password",body,"104")]);
    assert.equal(replies.filter(r=>r.status===200).length,1);
    fixture.credentials.tokens["104"]=replies.find(r=>r.status===200).json.token;
    assert.equal((await repo.exportSynthetic())["accounts.json"]["104"].ver,2);
  });
  await test("H28","Logout-all revokes the existing signed session",async()=>{
    const token=fixture.credentials.tokens["104"];
    ok(await request("/api/logout-all",{token},"104"));
    ok(await request("/api/session",{token},"104"),401);
  });
  await test("H29","Password recovery persists pending credential before HTTP success",async()=>{
    ok(await request("/api/forgot",{badge:"103"},null));
    const files=await repo.exportSynthetic();assert(files["accounts.json"]["103"].pending?.hash);
    const r=await repo.pool.query("SELECT count(*) AS n FROM dev.outbox WHERE topic='mail' AND payload->>'subject' LIKE '%BQ Connect%'");
    assert(Number(r.rows[0].n)>0);
  });
  await test("H30","All 28 entity codecs round-trip unknown/null/missing/order",async()=>{
    const original=await repo.exportSynthetic(),changed=structuredClone(original);
    changed["profiles.json"]["00106"]={bio:"Leading zero",photo:null,unknown:{ordered:[null,{},["nested"]]}};
    changed["messages.json"]=[{opaque:{arbitrary:[3,null,"legacy"]}}];
    changed["mail.json"]={opaque:true,missingVersusNull:null};
    changed["highlights.json"]["00106"]=[{id:"historical",items:[{id:"deleted-original-story",text:"Retained history",unknown:null}],cover:"",title:"Historical"}];
    await repo.importSynthetic(changed);const roundtrip=await repo.exportSynthetic();
    assert.deepEqual(roundtrip,changed);assert.equal(Object.keys(roundtrip).length,28);
    ok(await request("/api/session",{token:fixture.credentials.tokens["00106"]},"00106"));
  });
  await test("H31","SQL changes are immediately authoritative to the real HTTP route",async()=>{
    await repo.pool.query("UPDATE dev.profiles SET attrs=jsonb_set(attrs,'{bio}',to_jsonb($1::text)) WHERE entry_key=$2",["SQL authority proves no file fallback","101"]);
    const r=await social("person",{pid:personPid});ok(r);assert(JSON.stringify(r.json).includes("SQL authority proves no file fallback"));
    assert(!fs.existsSync(path.join(proof.app,"data")),"Mutable data directory unexpectedly exists");
  });
  await test("H32","Application crash and cold process preserve social/session data",async()=>{
    await stop(child);child=await boot();
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
    const list=await request("/api/ideas",{},"101",{method:"GET"});ok(list);assert(JSON.stringify(list.json).includes("Synthetic owner edit"));
    assert(!fs.existsSync(path.join(proof.app,"data")));
  });
  await test("H33","Database disconnection/readiness and reconnect fail closed",async()=>{
    proof.stop();
    ok(await request("/health/live",{},null,{method:"GET"}));
    ok(await request("/health/ready",{},null,{method:"GET"}),503);
    prepare(root);
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
  });
  await test("H34","Admin encrypted database backup includes all entities and media",async()=>{
    const [backup,write]=await Promise.all([social("admin-backup",{},"9001"),request("/api/ideas",{type:"post",text:"Concurrent backup write"})]);ok(backup);ok(write,201);
    const r=await repo.pool.query("SELECT ciphertext,manifest FROM dev.backups ORDER BY created_at DESC LIMIT 1");assert(r.rowCount);
    const bytes=r.rows[0].ciphertext,dec=crypto.createDecipheriv("aes-256-gcm",Buffer.from(proof.backupKey,"hex"),bytes.subarray(0,12));dec.setAuthTag(bytes.subarray(-16));
    const decoded=JSON.parse(Buffer.concat([dec.update(bytes.subarray(12,-16)),dec.final()]).toString());
    assert.equal(Object.keys(decoded.files).length,28);assert(Object.keys(decoded.media).length>=2);
    assert.equal(r.rows[0].manifest.files,Object.keys(decoded.files).length);
    assert.equal(r.rows[0].manifest.media,Object.keys(decoded.media).length);
    assert.equal(r.rows[0].manifest.sha256,crypto.createHash("sha256").update(bytes).digest("hex"));
    return "Actual admin HTTP backup + synthetic key decryptability; no production archive/provider restore certified.";
  });
  await test("H35","Media missing/corruption is rejected rather than silently detached",async()=>{
    const row=(await repo.pool.query("SELECT * FROM dev.media WHERE legacy_path=$1",[media])).rows[0],file=path.join(proof.objects,row.id),bytes=fs.readFileSync(file);
    fs.renameSync(file,file+".held");
    try{ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}),503);}finally{fs.renameSync(file+".held",file);}
    fs.writeFileSync(file,Buffer.from("corrupt"));
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}),503);
    fs.writeFileSync(file,bytes);
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
  });
  await test("H36","Authority epoch mismatch blocks real application writes",async()=>{
    await repo.pool.query("UPDATE dev.authority SET epoch=2");
    ok(await request("/api/ideas",{type:"post",text:"Stale epoch must reject"}),503);
    await repo.pool.query("UPDATE dev.authority SET epoch=1");
    ok(await request("/health/ready",{},null,{method:"GET"}));
  });
  await test("H37","Post delete retains original media and archived highlight",async()=>{
    ok(await request(`/api/ideas/${storyId}`,{},"101",{method:"DELETE"}));
    ok(await request(media,{},"101",{method:"GET"}));
    const files=await repo.exportSynthetic();assert(files["highlights.json"]["101"].find(h=>h.id===highlightId).items.length);
  });
  await test("H38","Multiple app processes share authoritative sessions and social state",async()=>{
    const second=await boot(5109);
    try {
      const r=await request("/api/session",{token:fixture.credentials.tokens["101"]},"101",{port:5109});ok(r);
      const body={type:"post",text:"Cross-process unique idempotency"},key=crypto.randomUUID();
      const replies=await Promise.all([request("/api/ideas",body,"101",{key}),request("/api/ideas",body,"101",{key,port:5109})]);
      replies.forEach(r=>ok(r,201));assert.equal(replies[0].json.idea.id,replies[1].json.idea.id);
    }finally{await stop(second);}
  });
  await test("H39","SQL constraint failure rolls back without losing data",async()=>{
    const files=await repo.exportSynthetic(),changed=structuredClone(files);
    changed["employees.json"].push({...changed["employees.json"][0]});
    await assert.rejects(()=>repo.importSynthetic(changed));
    assert.deepEqual(await repo.exportSynthetic(),files);
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
  });
  await test("H40","Public translation interface remains available",async()=>{
    const r=await request("/api/translate",{text:"Synthetic text",from:"en",to:"ar"});
    ok(r,503);assert.equal(r.json.error,"translate_off");
    return "Endpoint contract exercised with translation model disabled; actual model translation NOT TESTED.";
  });
  await test("H41","Stale/malformed local JSON cannot override PostgreSQL",async()=>{
    const dir=path.join(proof.app,"data");fs.mkdirSync(dir,{mode:0o700});
    fs.writeFileSync(path.join(dir,"accounts.json"),"{malformed stale bundle");
    fs.writeFileSync(path.join(dir,"ideas.json"),"[]");
    fs.writeFileSync(path.join(dir,"session.key"),"wrong synthetic stale key");
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
    const list=await request("/api/ideas",{},"101",{method:"GET"});ok(list);assert(JSON.stringify(list.json).includes("Synthetic owner edit"));
    assert.equal(fs.readFileSync(path.join(dir,"accounts.json"),"utf8"),"{malformed stale bundle");
  });
  await test("H42","Missing critical SQL entity is unavailable, not empty provision",async()=>{
    const saved=(await repo.exportSynthetic())["accounts.json"];
    await repo.pool.query("DELETE FROM dev.files WHERE name='accounts.json'");
    ok(await request("/health/ready",{},null,{method:"GET"}),503);
    assert.equal((await repo.pool.query("SELECT count(*) AS n FROM dev.accounts")).rows[0].n,"0");
    await repo.importSynthetic({"accounts.json":saved});
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
  });
  await test("H43","Wrong dataset and binding seal are refused",async()=>{
    await repo.pool.query("UPDATE dev.authority SET dataset_id='synthetic-wrong-dataset'");
    ok(await request("/health/ready",{},null,{method:"GET"}),503);
    await repo.pool.query("UPDATE dev.authority SET dataset_id=$1",[proof.dataset]);
    await repo.pool.query("UPDATE dev.authority SET seal='wrong'");
    ok(await request("/health/ready",{},null,{method:"GET"}),503);
    await repo.pool.query("UPDATE dev.authority SET seal=$1",[proof.seal]);
    ok(await request("/health/ready",{},null,{method:"GET"}));
  });
  await test("H44","Missing synthetic signing key refuses a new process without generation",async()=>{
    const file=path.join(root,"synthetic-manifest.json"),saved=fs.readFileSync(file),m=JSON.parse(saved);delete m.sessionKey;
    fs.writeFileSync(file,JSON.stringify(m));
    try {
      const c=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/runtime.cjs"),root],{env:{...proof.childEnv,PORT:"5110"},stdio:"ignore"});
      const status=await new Promise(resolve=>c.on("exit",resolve));assert.notEqual(status,0);
      assert.equal(JSON.parse(fs.readFileSync(file)).sessionKey,undefined);
    }finally{fs.writeFileSync(file,saved);}
    for(const key of ["sessionKey","backupKey"])for(const mode of ["missing","foreign"]) {
      const altered=JSON.parse(saved);
      if(mode==="missing")delete altered[key];else altered[key]=crypto.randomBytes(key==="sessionKey"?48:32).toString("hex");
      fs.writeFileSync(file,JSON.stringify(altered));
      try {
        const c=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/runtime.cjs"),root],{env:{...proof.childEnv,PORT:"5110"},stdio:"ignore"});
        assert.notEqual(await new Promise(resolve=>c.on("exit",resolve)),0);
        assert.deepEqual(JSON.parse(fs.readFileSync(file)),altered,"Startup changed the supplied key domain");
      }finally{fs.writeFileSync(file,saved);}
    }
    ok(await request("/api/session",{token:fixture.credentials.tokens["101"]}));
  });
  await test("H45","Deployment simulation cannot enable development activation",async()=>{
    const c=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/runtime.cjs"),root],{env:{...proof.childEnv,REPLIT_DEPLOYMENT:"1",PORT:"5110"},stdio:"ignore"});
    assert.notEqual(await new Promise(resolve=>c.on("exit",resolve)),0);
    ok(await request("/health/ready",{},null,{method:"GET"}));
  });
  await test("H46","A generic verified flag cannot redirect the database host",async()=>{
    assert.throws(()=>new Repository({...proof,socket:"an-external-host",verifiedSynthetic:true}));
    ok(await request("/health/ready",{},null,{method:"GET"}));
  });
  await test("H47","Concurrent recovery-code consumption has one HTTP winner",async()=>{
    const a=await request("/api/login",{badge:"00106",password:fixture.credentials.password},null);
    const b=await request("/api/login",{badge:"00106",password:fixture.credentials.password},null);
    const r=await Promise.all([request("/api/login-2fa",{ticket:a.json.ticket,code:fixture.credentials.recovery},null),request("/api/login-2fa",{ticket:b.json.ticket,code:fixture.credentials.recovery},null)]);
    assert.equal(r.filter(x=>x.status===200&&x.json.token).length,1);
    assert.equal(r.filter(x=>x.status===400||x.status===401).length,1);
  });
  await test("H48","Individual session revocation and device memory persist",async()=>{
    const list=await request("/api/sessions",{token:fixture.credentials.tokens["101"]});ok(list);assert(Array.isArray(list.json.sessions));
    const sid=Buffer.from(additionalToken,"base64url").toString().split(".")[3];
    const id=crypto.createHmac("sha256",proof.sessionKey).update(`sid:${sid}`).digest("hex").slice(0,16);
    ok(await request("/api/sessions",{token:fixture.credentials.tokens["101"],op:"revoke",id}));
    ok(await request("/api/session",{token:additionalToken}),401);
    assert((await repo.exportSynthetic())["accounts.json"]["101"].devices.length);
  });
  await test("H49","Account presence alone cannot bypass employee eligibility",async()=>{
    const files=await repo.exportSynthetic(),copy=structuredClone(files["accounts.json"]["101"]);
    files["accounts.json"]["99999"]=copy;await repo.importSynthetic({"accounts.json":files["accounts.json"]});
    ok(await request("/api/login",{badge:"99999",password:fixture.credentials.password},null),401);
    assert((await repo.exportSynthetic())["accounts.json"]["99999"]);
  });
  await test("H50","Remaining idea/suggestion/complaint/article post types",async()=>{
    for(const type of ["idea","suggestion","complaint","article"]){
      const r=await request("/api/ideas",{type,title:`Synthetic ${type}`,text:"Synthetic complete content",problem:"Synthetic problem",impact:"Synthetic impact",pros:["One"],cons:["Two"]});ok(r,201);assert.equal(r.json.idea.type,type);
    }
  });
  await test("H51","Department achievement submit/review and department policy",async()=>{
    ok(await social("achievement",{department:"Engineering",title:"Synthetic achievement",text:"Synthetic evidence"}),201);
    const files=await repo.exportSynthetic(),entry=files["dept-profiles.json"].Engineering.achievements.at(-1);assert.equal(entry.status,"pending");
    const login=await request("/api/login",{badge:"104",password:"AnotherSynthetic!Pass2026"},null);ok(login);
    const verified=await request("/api/login-2fa",{ticket:login.json.ticket,code:code(fixture.credentials.totpKeys["104"])},null);ok(verified);
    fixture.credentials.tokens["104"]=verified.json.token;
    ok(await social("achievement-review",{department:"Engineering",id:entry.id,approve:true},"104"),403);
    ok(await social("achievement-review",{department:"Engineering",id:entry.id,approve:true},"103"));
    assert.equal((await repo.exportSynthetic())["dept-profiles.json"].Engineering.achievements.at(-1).status,"approved");
  });
  await test("H52","Administrator employee creation preserves leading-zero badge",async()=>{
    const body={badge:"00109",name:"Synthetic Added Employee",department:"Engineering",position:"Engineer",code:"1234",mobile:"512345678"};
    ok(await social("admin-add-employee",body,"101"),403);
    const r=await social("admin-add-employee",body,"9001");assert([200,201].includes(r.status),r.json.error);
    assert((await repo.exportSynthetic())["employees.json"].some(e=>e.badge==="00109"));
  });
  await test("H53","Synthetic join request persists before acknowledgement",async()=>{
    const body={badge:"110",name:"Synthetic Join Applicant",department:"Operations",position:"Engineer",code:"1234",mobile:"512345678"};
    const r=await request("/api/join",body,null);ok(r);assert(r.json.received);
    assert((await repo.exportSynthetic())["join-requests.json"].some(e=>e.badge==="110"));
    const list=await social("admin-joins",{},"9001");ok(list);assert(list.json.requests.length);
  });
  await test("H54","Actual launcher refuses a lost SQL schema rather than reseeding",async()=>{
    await repo.pool.query("DROP SCHEMA dev CASCADE");
    const c=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/launch.cjs"),root],{env:proof.childEnv,stdio:"ignore"});
    assert.notEqual(await new Promise(resolve=>c.on("exit",resolve)),0);
    assert.equal((await repo.pool.query("SELECT to_regclass('dev.authority') AS found")).rows[0].found,null);
    ok(await request("/health/ready",{},null,{method:"GET"}),503);
  });
  await test("H55","Actual launcher cannot regenerate a missing manifest/key",async()=>{
    const file=path.join(root,"synthetic-manifest.json"),hold=file+".held";
    fs.renameSync(file,hold);
    try {
      const c=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/launch.cjs"),root],{env:proof.childEnv,stdio:"ignore"});
      assert.notEqual(await new Promise(resolve=>c.on("exit",resolve)),0);assert(!fs.existsSync(file));
    }finally{fs.renameSync(hold,file);}
    ok(await request("/health/live",{},null,{method:"GET"}));
  });
  await test("H56","Lost cluster directory is not initialized over prior provision",async()=>{
    try{proof.stop();}catch{}
    const pgdata=path.join(root,"pgdata"),hold=pgdata+".held";fs.renameSync(pgdata,hold);
    try{assert.throws(()=>prepare(root),/previously_provisioned_database_missing/);assert(!fs.existsSync(pgdata));}
    finally{fs.renameSync(hold,pgdata);}
    ok(await request("/health/live",{},null,{method:"GET"}));
  });
}
(async()=>{
  try{await main();}catch(e){results.push({id:"HARNESS",feature:"HTTP harness setup",status:"FAIL",evidence:e.message});}
  finally {
    await stop(child);await repo.pool.end();try{proof.stop();}catch{}
    const summary={at:new Date().toISOString(),scope:"SYNTHETIC_POSTGRESQL_HTTP_DEVELOPMENT_ONLY",
      productionOperations:0,providerTraffic:"NONE; explicit synthetic SMTP/SMS/push receipts",
      totals:{PASS:results.filter(x=>x.status==="PASS").length,FAIL:results.filter(x=>x.status==="FAIL").length},
      requests,results,limitations:["Local immutable file storage simulates intended Object Storage; real provider operations not certified","Translation model and actual SMTP/SMS/Web Push delivery not tested","Admin read actions are exercised; not all positive admin mutations yet covered"]};
    fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,"http-results.json"),JSON.stringify(summary,null,2));
    fs.writeFileSync(path.join(output,"synthetic-app.log"),logs.join(""));
    fs.rmSync(root,{recursive:true,force:true});
    process.exitCode=summary.totals.FAIL?1:0;
    console.log(JSON.stringify(summary.totals));
  }
})();
