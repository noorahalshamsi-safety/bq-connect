// ACTUAL Replit development PostgreSQL, invented records, filesystem media mock.
// Never uses the original app's data/, bucket, SESSION_SECRET or production DB.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {spawn}=require("node:child_process"),{Client}=require("pg");
const cfg=require("../../deploy/managed/config.cjs"),schema=require("../../deploy/managed/schema.cjs");
const {prepare}=require("../../deploy/managed/development.cjs"),{FileStorage}=require("../forensics/file-storage.cjs");
const {ImmutableStore}=require("../../deploy/staging/object-store.cjs"),{vault}=require("../../development/postgres/sealed.cjs");
const {readSql}=require("../migration/rel001/reconcile.cjs"),{code}=require("../../development/postgres/fixtures.cjs");
const root=path.resolve(__dirname,"../../generated-artifacts/managed-development"),port=5134;
const results=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",code:e.code||e.message.slice(0,160)});}console.log(JSON.stringify(results.at(-1)));}
let worker,lab,client,store,storageDir,token,postId,mediaUrl;
function launch(){
  const child=spawn(process.execPath,["scripts/managed/test-child.cjs",root],{cwd:path.resolve(__dirname,"../.."),env:{
    PATH:process.env.PATH,HOME:root,LANG:"C.UTF-8",REPL_ID:process.env.REPL_ID,DATABASE_URL:process.env.DATABASE_URL,
    BQ_MANAGED_MANIFEST_FILE:path.join(root,"manifest.json"),BQ_MANAGED_SESSION_KEY:lab.keys.sessionKey,
    BQ_MANAGED_BACKUP_KEY:lab.keys.backupKey,BQ_MANAGED_MOCK_DIRECTORY:storageDir,PORT:String(port),BQ_MANAGED_POOL_MAX:"3"
  },stdio:["ignore","pipe","pipe"]});
  child.output="";child.stdout.on("data",d=>child.output+=d);child.stderr.on("data",d=>child.output+=d);
  child.done=new Promise(r=>child.once("exit",r));return child;
}
async function stop(){if(worker&&worker.exitCode===null&&!worker.signalCode){worker.kill("SIGTERM");await worker.done;}}
async function ready(){
  for(let i=0;i<160;i++){
    if(worker.exitCode!==null)throw Error("managed_worker_startup_refused");
    try{if((await fetch(`http://127.0.0.1:${port}/health/ready`,{signal:AbortSignal.timeout(2000)})).status===200)return;}catch{}
    await sleep(150);
  }throw Error("managed_worker_readiness_timeout");
}
let ip=1;
async function req(url,body={},opts={}){
  const method=opts.method||"POST",headers={"x-forwarded-for":`192.0.2.${1+ip++%240}`,...(token?{"x-session":token}:{}),...opts.headers};
  if(method!=="GET"){headers["Idempotency-Key"]=opts.key||crypto.randomUUID();if(!opts.bytes)headers["Content-Type"]="application/json";}
  const r=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers,body:method==="GET"?undefined:opts.bytes||JSON.stringify({...body,...(token?{token}:{})}),signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await r.arrayBuffer());let json;try{json=JSON.parse(bytes);}catch{}
  return {status:r.status,json,bytes};
}
const ok=(r,status=200)=>assert.equal(r.status,status,`unexpected HTTP ${r.status}`);
async function graph(){return (await readSql(client)).values;}
const authVault=()=>vault({sessionKey:lab.keys.sessionKey,dataset:lab.manifest.dataset});
async function messages(topic){return (await client.query("SELECT id,payload FROM dev.outbox WHERE topic=$1 ORDER BY created_at DESC",[topic])).rows.filter(r=>r.payload?.sealed).map(r=>authVault().decode(r.payload,`outbox:${r.id}`));}
function fromBase32(text){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",bits=[...text].map(c=>alphabet.indexOf(c).toString(2).padStart(5,"0")).join("");return Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))).toString("hex");}
(async()=>{
  try{
    lab=await prepare({root,productionBucketFingerprint:"ce11c603901c2550295d04cf9a5898200348ff8d29086744a88ee73d8f8716ec"});
    storageDir=fs.mkdtempSync(path.join(os.tmpdir(),"bq-forensics-managed-"));fs.chmodSync(storageDir,0o700);
    fs.writeFileSync(path.join(root,"mock-directory.json"),JSON.stringify(storageDir),{mode:0o600});
    store=new ImmutableStore(new FileStorage(storageDir),{dataset:lab.manifest.dataset});
    await store.createControl("provision-intent.json",{dataset:lab.manifest.dataset});
    await store.createControl("provision-receipt.json",JSON.parse(fs.readFileSync(path.join(root,"receipt.json"))));
    const endpoint=cfg.endpoint(process.env,"development");
    client=new Client({connectionString:endpoint.url.toString(),ssl:false,application_name:"bq-managed-validation"});await client.connect();
    worker=launch();await ready();
    await test("Actual Helium connection, 117-table contract and independent 28-file reconstruction",async()=>{
      assert.equal((await schema.requireSchema(client,lab.manifest)).tables,117);assert.equal(Object.keys(await graph()).length,28);
      const r=(await client.query("SELECT current_database() AS db,current_setting('ssl') AS ssl")).rows[0];assert.equal(r.db,"heliumdb");assert.equal(r.ssl,"off");
    });
    await test("Managed credentials truthfully expose owner privilege, not least privilege",()=>{assert(lab.capabilities.rolsuper);assert(lab.capabilities.schema_create);});
    await test("Password plus existing TOTP format authenticates",async()=>{
      const l=await req("/api/login",{badge:"101",password:lab.credentials.password});ok(l);assert(l.json.needTotp);
      const r=await req("/api/login-2fa",{ticket:l.json.ticket,code:code(lab.credentials.totpKeys["101"])});ok(r);assert(r.json.token);token=r.json.token;
    });
    await test("Registration, SMS fixture, TOTP enrollment and email fixture confirmation",async()=>{
      const body={badge:"107",code:lab.credentials.check,mobile:lab.credentials.mobile,password:`Register-${crypto.randomBytes(10).toString("hex")}-Aa1!`};
      ok(await req("/api/register",body));const sms=(await messages("sms"))[0],otp=(new URLSearchParams(sms.body).get("Body")||sms.body).match(/\b\d{6}\b/)[0];
      const reg=await req("/api/register",{...body,otp});ok(reg);
      const setup=await req("/api/login-2fa",{op:"setup",ticket:reg.json.ticket});ok(setup);
      const enrolled=await req("/api/login-2fa",{op:"enroll",ticket:reg.json.ticket,code:code(fromBase32(setup.json.secret))});ok(enrolled);
      ok(await req("/api/login-2fa",{op:"email",ticket:enrolled.json.ticket,email:"managed107@example.invalid"}));
      const mail=(await messages("mail")).find(m=>m.to==="managed107@example.invalid");
      const done=await req("/api/login-2fa",{op:"email-confirm",ticket:enrolled.json.ticket,code:mail.text.match(/\b\d{6}\b/)[0]});ok(done);assert(done.json.token);
    });
    await test("Text post commits before success",async()=>{const r=await req("/api/ideas",{type:"post",text:"Actual managed development post"});ok(r,201);postId=r.json.idea.id;assert((await graph())["ideas.json"].some(p=>p.id===postId));});
    await test("Comments and reactions persist with immediate foreign keys",async()=>{ok(await req(`/api/ideas/${postId}/comments`,{text:"Managed comment"}),201);ok(await req(`/api/ideas/${postId}/rating`,{vote:"like"}));const p=(await graph())["ideas.json"].find(p=>p.id===postId);assert(p.comments.length);});
    await test("Post edit/delete preserve other content and commit durably",async()=>{
      const made=await req("/api/ideas",{type:"post",text:"Managed disposable post"});ok(made,201);const id=made.json.idea.id;
      ok(await req(`/api/ideas/${id}`,{text:"Managed edited post"},{method:"PATCH"}));
      assert.equal((await graph())["ideas.json"].find(p=>p.id===id).text,"Managed edited post");
      ok(await req(`/api/ideas/${id}`,{},{method:"DELETE"}));
      assert(!(await graph())["ideas.json"].some(p=>p.id===id));assert((await graph())["ideas.json"].some(p=>p.id===postId));
    });
    await test("Immutable media upload, read-back and ready attachment",async()=>{
      const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64");
      const r=await req("/api/media",{},{bytes:png,headers:{"Content-Type":"image/png"}});ok(r,201);mediaUrl=r.json.url;
      ok(await req("/api/ideas",{type:"post",text:"Managed image post",media:mediaUrl}),201);
      const get=await req(mediaUrl,{},{method:"GET"});ok(get);assert(get.bytes.equals(png));
      const row=(await client.query("SELECT * FROM dev.media WHERE legacy_path=$1",[mediaUrl])).rows[0];assert.equal(row.state,"ready");assert.equal(cfg.sha(png),row.sha256);assert((await store.read(row.object_key,row.sha256)).equals(png));
    });
    await test("Duplicate success is one durable write; changed payload conflicts",async()=>{
      const key=crypto.randomUUID(),body={type:"post",text:"Managed exactly-once request"};
      const a=await req("/api/ideas",body,{key}),b=await req("/api/ideas",body,{key});ok(a,201);ok(b,201);assert.equal(a.json.idea.id,b.json.idea.id);
      ok(await req("/api/ideas",{...body,text:"changed"},{key}),409);assert.equal((await graph())["ideas.json"].filter(p=>p.text===body.text).length,1);
    });
    await test("Pool stays bounded under concurrent authenticated reads",async()=>{await Promise.all(Array.from({length:6},()=>req("/api/session")));assert(Number((await client.query("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name='bq-managed-development'")).rows[0].n)<=3);});
    await test("Client connectivity loss fails readiness and writes closed, then reconnects",async()=>{
      const marker=path.join(root,"inject-client-outage");fs.writeFileSync(marker,"test only",{mode:0o600});
      try{
        assert((await req("/health/ready",{},{method:"GET"})).status>=500);
        assert((await req("/api/ideas",{type:"post",text:"Must not commit during injected loss"})).status>=500);
        ok(await req("/health/live",{},{method:"GET"}));
      }finally{fs.unlinkSync(marker);}
      await ready();ok(await req("/api/session"));
      assert(!(await graph())["ideas.json"].some(p=>p.text==="Must not commit during injected loss"));
    });
    await test("Forged session cannot write",async()=>{
      const original=token;token="invented-forged-session";
      try{assert([401,403].includes((await req("/api/ideas",{type:"post",text:"Forged session post"})).status));}finally{token=original;}
      assert(!(await graph())["ideas.json"].some(p=>p.text==="Forged session post"));
    });
    await test("Immediate foreign key rejects orphan graph data",async()=>{
      await client.query("BEGIN");try{await assert.rejects(client.query("INSERT INTO dev.sessions(id,file_name,parent,ordinal,attrs,shape) VALUES('invented-orphan','accounts.json','missing',0,'{}','{}')"),e=>e.code==="23503");}finally{await client.query("ROLLBACK");}
    });
    await test("Schema-only publish equivalent: empty ledger uses exact structure contract",async()=>{
      await client.query("BEGIN");try{await client.query("DELETE FROM dev.schema_migrations");assert.equal((await schema.requireSchema(client,lab.manifest)).ledger,"structural-contract");}finally{await client.query("ROLLBACK");}
    });
    await test("Migration checksum drift is rejected",async()=>{
      await client.query("BEGIN");try{await client.query("UPDATE dev.schema_migrations SET checksum='invalid' WHERE version='0001_base'");await assert.rejects(schema.requireSchema(client,lab.manifest),/migration_checksum_mismatch/);}finally{await client.query("ROLLBACK");}
    });
    await test("Lost schema is refused, without startup repair",async()=>{
      await client.query("BEGIN");try{await client.query("ALTER SCHEMA dev RENAME TO managed_missing_probe");await assert.rejects(schema.requireSchema(client,lab.manifest),/managed_schema_missing/);}finally{await client.query("ROLLBACK");}
    });
    await test("Changed SQL authority refuses requests",async()=>{
      const original=(await client.query("SELECT seal FROM dev.authority")).rows[0].seal;
      try{await client.query("UPDATE dev.authority SET seal='invented-invalid'");assert((await req("/api/session")).status>=500);}
      finally{await client.query("UPDATE dev.authority SET seal=$1",[original]);}
      ok(await req("/api/session"));
    });
    await test("Fresh runtime/cache preserves sessions, accounts, posts and bucket bytes",async()=>{
      await stop();worker=launch();await ready();ok(await req("/api/session"));ok(await req(mediaUrl,{},{method:"GET"}));
      assert((await graph())["accounts.json"]["107"].hash);assert((await graph())["ideas.json"].some(p=>p.id===postId));
    });
    await test("Runtime source never calls setup, DDL or fallback",()=>{
      const source=fs.readFileSync(path.resolve(__dirname,"../../deploy/managed/runtime.cjs"),"utf8");
      assert(!/prepare\(|\.initialize\(|\.hardenControls\(|query\(\s*["'`](CREATE|ALTER|DROP|TRUNCATE)/i.test(source));
      assert(!source.includes("deploy/staging/seed"));
      assert(!fs.existsSync(path.join(root,"runtime-ddl-detected")));
    });
    await test("Previous setup evidence prohibits re-seeding even if SQL is unavailable",async()=>assert.rejects(prepare({root,productionBucketFingerprint:lab.manifest.productionBucketFingerprint}),/managed_development_evidence_exists/));
    fs.writeFileSync(path.join(root,"validation.json"),JSON.stringify({provider:"ACTUAL Replit development Helium",results,capabilities:lab.capabilities},null,2),{mode:0o600});
  }catch(e){results.push({name:"environment",status:"FAIL",code:e.code||e.message.slice(0,160)});}
  finally{
    await stop();await client?.end().catch(()=>{});
    const report={provider:"ACTUAL Replit DEVELOPMENT (not production)",pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,results};
    console.log(JSON.stringify(report));if(report.fail)process.exitCode=1;
  }
})();
