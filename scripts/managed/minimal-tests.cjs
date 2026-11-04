const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict"),{spawn}=require("node:child_process");
const {prepare}=require("../../development/postgres/isolation.cjs"),{Repository}=require("../../development/postgres/repository.cjs");
const F=require("../../development/postgres/fixtures.cjs"),schema=require("../../deploy/managed/schema.cjs"),cfg=require("../../deploy/managed/config.cjs");
const S=require("../../migration/minimal/source.cjs"),I=require("../../migration/minimal/import.cjs");
const {execute}=require("../../migration/minimal/execute.cjs"),{ImmutableStore}=require("../../deploy/staging/object-store.cjs");
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-pg-dev-"));
const proof=prepare(root),repo=new Repository(proof),fixture=F.create(proof.sessionKey),auditKey=crypto.randomBytes(32),port=5134,logs=[];
const raw={},files=fixture.files;
files["accounts.json"]["105"]=S.clone(files["accounts.json"]["101"]);
files["accounts.json"]["105"].totp.on=false;
files["accounts.json"]["105"].totpSetup={key:files["accounts.json"]["101"].totp.key,exp:new Date(Date.now()+600000).toISOString()};
files["accounts.json"]["105"].unknownSecurityExtension={preserve:"invented-opaque"};
files["accounts.json"]["105"].email="";
files["accounts.json"]["9002"].email="";files["accounts.json"]["9002"].totp.on=false;
files["security.json"].announcer.email="";
files["smtp.json"]={host:"smtp.example.invalid",port:465,user:"fixture@example.invalid",pass:"invented-test-only"};
files["sms.json"]={provider:"taqnyat",token:"invented-test-only",sender:"Synthetic",enabled:true};
files["employees.json"].push(...Array.from({length:6303},(_,i)=>({badge:String(10000+i),name:"Synthetic Directory Employee",department:"Synthetic",position:"Synthetic",unknownEmployeeExtension:{preserve:i}})));
files["conduct.json"]={warnings:[{badge:"101",at:new Date().toISOString(),reason:"invented restriction"},{badge:"107",at:new Date().toISOString()}],bans:{"104":true,"107":true},resets:{}};
for(const name of [...S.required,...S.supporting])raw[name]=name==="session.key"?proof.sessionKey:name==="backup.key"?proof.backupKey:JSON.stringify(files[name]||{});
const options={bucketFingerprint:cfg.sha("invented-source-bucket"),auditKey,synthetic:true};
const source=S.prepare(raw,options),results=[];
let child;
async function test(name,fn){try{await fn();results.push({name,status:"PASS"});console.log("PASS "+name);}catch(e){results.push({name,status:"FAIL",code:e.code||e.message});throw e;}}
async function boot(){
  const firstLog=logs.length;
  child=spawn(process.execPath,[path.join(__dirname,"minimal-worker.cjs"),root],{cwd:proof.app,env:{...proof.childEnv,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
  child.stdout.on("data",d=>logs.push(d.toString()));child.stderr.on("data",d=>logs.push(d.toString()));
  for(let i=0;i<180;i++){if(child.exitCode!==null)throw Error("minimal_worker_exit");try{
    if(logs.slice(firstLog).some(x=>x.includes("MINIMAL_STORAGE_HTTPS_PASSTHROUGH_OK"))&&
      (await fetch(`http://127.0.0.1:${port}/health/ready`)).status===200)return;
  }catch{}await sleep(100);}
  throw Error("minimal_worker_not_ready");
}
async function stop(){if(child&&child.exitCode===null){const done=new Promise(r=>child.once("exit",r));child.kill("SIGTERM");await Promise.race([done,sleep(3000)]);if(child.exitCode===null){child.kill("SIGKILL");await done;}}}
async function request(url,body={},badge="101",extra={}){
  const token=fixture.credentials.tokens[badge],r=await fetch(`http://127.0.0.1:${port}${url}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID(),...(token?{"x-session":token}:{}),...extra},body:JSON.stringify({...(token?{token}:{}),...body}),signal:AbortSignal.timeout(30000)});
  let json;try{json=await r.json();}catch{json={};}return {status:r.status,json};
}
// Run in one sequential owner so clients/temporary fixture state are cleaned up
// even on the first failed assertion. No real DATABASE_URL is used.
async function run(){
  let c;
  try{
    c=await repo.pool.connect();
    for(const sql of schema.statements)await c.query(sql);
    for(const m of schema.migrations)await c.query("INSERT INTO dev.schema_migrations(version,checksum) VALUES($1,$2)",[m.version,m.checksum]);
    c.release();c=null;
    await test("Owner-sized source: 6311 employees, eight accounts and official identity dependencies",()=>{assert.equal(source.counts.employees,6311);assert.equal(source.counts.accounts,8);assert.equal(source.officialAccounts,2);assert.equal(source.activeFactors,6);assert.equal(source.pendingFactors,1);assert.equal(source.emailLinkedAccounts,6);assert.equal(Object.keys(S.access(source).files["accounts.json"]).length,8);});
    await test("Local three-account copy / count drift is refused",()=>{const r={...raw,"accounts.json":JSON.stringify(Object.fromEntries(Object.entries(files["accounts.json"]).slice(0,3)))};assert.throws(()=>S.prepare(r,options),/minimal_source_counts_changed/);});
    await test("Wrong signing key refuses original active/pending factors",()=>assert.throws(()=>S.prepare({...raw,"session.key":"f".repeat(96)},options),/minimal_factor_domain_invalid/));
    await test("Missing original keys cannot generate replacements",()=>assert.throws(()=>S.prepare({...raw,"backup.key":null},options),/minimal_original_keys_missing_or_invalid/));
    await test("Unlinked account IDs are refused without coercion",()=>{const a=S.clone(files["accounts.json"]);a["999999"]=a["101"];delete a["101"];assert.throws(()=>S.prepare({...raw,"accounts.json":JSON.stringify(a)},options),/minimal_account_relationship_invalid/);});
    await test("Unsupported KDF and duplicate employee identities fail closed",()=>{const a=S.clone(files["accounts.json"]);a["101"].kdf=99;assert.throws(()=>S.prepare({...raw,"accounts.json":JSON.stringify(a)},options),/minimal_credential_format_unsupported/);const e=S.clone(files["employees.json"]);e[1].badge=e[0].badge;assert.throws(()=>S.prepare({...raw,"employees.json":JSON.stringify(e)},options),/minimal_employee_identity_invalid/);});
    await test("A real-source capsule cannot reach Development SQL",async()=>{const real=S.prepare(raw,{...options,synthetic:false});await assert.rejects(I.apply({client:{query:()=>{throw Error("query_must_not_run");}},source:real,proof}),/minimal_real_source_in_development_forbidden/);});
    await test("Live execution outside a published process is refused",()=>assert.rejects(execute({env:{}}),/minimal_published_execution_required/));
    await test("Unverified production media namespace is refused",()=>assert.throws(()=>new ImmutableStore({},{dataset:"managed-production-"+crypto.randomUUID()}),/synthetic_dataset_required/));
    c=await repo.pool.connect();
    await test("Transaction failure leaves no accounts/employees/authority",async()=>{await assert.rejects(I.apply({client:c,source,proof,failBeforeCommit:true}),/minimal_injected_rollback/);assert.equal((await c.query("SELECT count(*)::int n FROM dev.accounts")).rows[0].n,0);assert.equal((await c.query("SELECT count(*)::int n FROM dev.authority")).rows[0].n,0);});
    await test("Wrong original target signing/backup keys are refused",()=>assert.rejects(I.apply({client:c,source,proof:{...proof,sessionKey:"e".repeat(96)}}),/minimal_original_key_continuity_required/));
    await test("Pre-existing synthetic destination data is never reset",async()=>{await c.query("INSERT INTO dev.runtime_state VALUES('invented-foreign','{}'::jsonb)");await assert.rejects(I.apply({client:c,source,proof}),/minimal_destination_not_empty/);await c.query("DELETE FROM dev.runtime_state WHERE name='invented-foreign'");});
    await test("Minimal import commits with independent SQL memberships and credentials reconciled",async()=>{const r=await I.apply({client:c,source,proof});assert.equal(r.counts.employees,6311);assert.equal(r.counts.accounts,8);assert.equal(r.replayed,false);});
    await test("Replay never rewrites accepted SQL account changes",async()=>{await c.query("UPDATE dev.accounts SET attrs=attrs||'{\"testAfterImport\":\"preserve\"}'::jsonb WHERE entry_key='101'");const r=await I.apply({client:c,source,proof});assert.equal(r.replayed,true);assert.equal((await c.query("SELECT attrs->>'testAfterImport' n FROM dev.accounts WHERE entry_key='101'")).rows[0].n,"preserve");});
    await test("Changed source cannot silently reimport even with the same counts",async()=>{const r=S.clone(files["accounts.json"]);r["101"].ver++;const changed=S.prepare({...raw,"accounts.json":JSON.stringify(r)},options);await assert.rejects(I.apply({client:c,source:changed,proof}),/minimal_previous_import_binding_mismatch/);});
    await test("Historical social content starts empty; account security and bans remain",async()=>{for(const t of ["posts","comments","groups","notifications","profiles","person_follows","push_subscriptions"]){assert.equal((await c.query(`SELECT count(*)::int n FROM dev.${t}`)).rows[0].n,0);}const d=await repo.load(c);assert.deepEqual(d.get("accounts.json").value["105"].unknownSecurityExtension,{preserve:"invented-opaque"});assert.deepEqual(d.get("conduct.json").value.bans,{"104":true});assert.equal(d.get("conduct.json").value.warnings.length,1);});
    c.release();c=null;
    fs.writeFileSync(path.join(root,"provision-receipt.json"),JSON.stringify({dataset:proof.dataset,seal:proof.seal,state:"committed"}),{mode:0o600});
    await test("Original SQL application boots and preserves non-SMS provider HTTPS transport",async()=>{
      await boot();const end=Date.now()+3000;while(Date.now()<end&&!logs.some(x=>x.includes("MINIMAL_STORAGE_HTTPS_PASSTHROUGH_OK")))await sleep(50);
      assert.ok(logs.some(x=>x.includes("MINIMAL_STORAGE_HTTPS_PASSTHROUGH_OK")));
    });
    await test("Password verification succeeds; wrong passwords and bans are refused",async()=>{assert.equal((await request("/api/login",{badge:"101",password:fixture.credentials.password},"")).json.needTotp,true);assert.equal((await request("/api/login",{badge:"101",password:"InventedWrongPassword!"},"")).status,401);assert.equal((await request("/api/login",{badge:"104",password:fixture.credentials.password},"")).status,403);});
    await test("Legacy KDF and leading-zero identity still authenticate",async()=>{const r=await request("/api/login",{badge:"00106",password:fixture.credentials.password},"");assert.equal(r.status,200);assert.equal(r.json.needTotp,true);});
    await test("Existing session, system administrator and moderator permissions remain compatible",async()=>{assert.equal((await request("/api/session")).status,200);assert.equal((await request("/api/social",{action:"admin-summary"},"9001")).status,200);assert.equal((await request("/api/social",{action:"admin-summary"},"102")).status,200);assert.equal((await request("/api/social",{action:"admin-summary"},"103")).status,403);});
    await test("Employee-directory search uses preserved SQL directory records",async()=>{const r=await request("/api/social",{action:"search",q:"Synthetic"});assert.equal(r.status,200);assert.ok(JSON.stringify(r.json).includes("Synthetic"));});
    await test("Original TOTP decrypts and produces a successful login",async()=>{const l=await request("/api/login",{badge:"102",password:fixture.credentials.password},"");const r=await request("/api/login-2fa",{ticket:l.json.ticket,code:F.code(fixture.credentials.totpKeys["102"])},"");assert.equal(r.status,200);assert.ok(r.json.token);});
    await test("Old unfinished challenge tickets are excluded without changing sessions or recovery codes",async()=>{
      const l=await request("/api/login",{badge:"103",password:fixture.credentials.password},"");
      const parts=Buffer.from(l.json.ticket,"base64url").toString().split("."),payload=parts.slice(0,-1).join(".");
      const old=Buffer.from(payload+"."+crypto.createHmac("sha256",proof.sessionKey).update(`ticket:2fa:${payload}`).digest("hex")).toString("base64url");
      assert.equal((await request("/api/login-2fa",{ticket:old,code:fixture.credentials.recovery},"")).status,401);
      const r=await request("/api/login-2fa",{ticket:l.json.ticket,code:fixture.credentials.recovery},"");
      assert.equal(r.status,200);assert.ok(r.json.token);assert.equal((await request("/api/session")).status,200);
    });
    await test("Original pending TOTP setup and the email-verification login workflow remain usable",async()=>{
      const l=await request("/api/login",{badge:"105",password:fixture.credentials.password},"");assert.equal(l.json.needSetup,true);
      const enrolled=await request("/api/login-2fa",{op:"enroll",ticket:l.json.ticket,code:F.code(fixture.credentials.totpKeys["101"])},"");
      assert.equal(enrolled.status,200);assert.equal(enrolled.json.needEmail,true);
      const started=await request("/api/login-2fa",{op:"email",ticket:enrolled.json.ticket,email:"fixture-105@example.invalid"},"");
      assert.equal(started.status,200);assert.equal(started.json.sent,true);
      let code;const end=Date.now()+15000;
      while(Date.now()<end&&!code){if(fs.existsSync(path.join(root,"invented-mail.jsonl")))for(const row of fs.readFileSync(path.join(root,"invented-mail.jsonl"),"utf8").trim().split("\n").map(JSON.parse)){
        if(row.to==="fixture-105@example.invalid")code=row.text.match(/\b\d{6}\b/)?.[0]||code;
      }if(!code)await sleep(200);}
      assert.ok(code);const confirmed=await request("/api/login-2fa",{op:"email-confirm",ticket:enrolled.json.ticket,code},"");
      assert.equal(confirmed.status,200);assert.ok(confirmed.json.token);
    });
    await test("New employee registration queues durable real-provider SMS, not a fixture delivery",async()=>{
      const r=await request("/api/register",{badge:"107",code:fixture.credentials.check,mobile:fixture.credentials.mobile,password:"InventedNewAccount!2026"},"");
      assert.equal(r.status,200,JSON.stringify(r.json));assert.equal(r.json.needOtp,true);
      const end=Date.now()+10000;while(Date.now()<end&&!fs.existsSync(path.join(root,"invented-sms.jsonl")))await sleep(200);
      assert.ok(fs.existsSync(path.join(root,"invented-sms.jsonl")));
      const rows=await repo.pool.query("SELECT fixture_receipt FROM dev.outbox WHERE topic='sms' AND delivered_at IS NOT NULL");
      assert.ok(rows.rows.some(x=>x.fixture_receipt.transport==="sms-outbox-v1"));
    });
    await test("Push is explicitly unconfigured, never replacement VAPID keys or fixture success",async()=>{const r=await request("/api/push");assert.equal(r.status,503);assert.equal(r.json.error,"not_enabled_in_existing_accounts_release");});
    await test("Durable mail is delivered only after commit, using non-fixture receipts",async()=>{const end=Date.now()+10000;while(Date.now()<end&&!fs.existsSync(path.join(root,"invented-mail.jsonl")))await sleep(200);assert.ok(fs.existsSync(path.join(root,"invented-mail.jsonl")));const r=await repo.pool.query("SELECT fixture_receipt FROM dev.outbox WHERE topic='mail' AND delivered_at IS NOT NULL");assert.ok(r.rows.length);assert.ok(r.rows.every(x=>x.fixture_receipt.transport==="smtp-outbox-v1"));});
    await test("A fresh worker preserves sessions, account membership and 6311 employees",async()=>{await stop();await boot();assert.equal((await request("/api/session")).status,200);assert.equal((await repo.pool.query("SELECT count(*)::int n FROM dev.accounts")).rows[0].n,8);assert.equal((await repo.pool.query("SELECT count(*)::int n FROM dev.employees")).rows[0].n,6311);});
    console.log(JSON.stringify({suite:"minimal-employee-account-migration",pass:results.length,fail:0,source:"invented-only",managedDevelopmentTouched:false,productionTouched:false}));
    if(process.argv.includes("--preview")){console.log("MINIMAL_PREVIEW_READY");await new Promise(r=>process.once("SIGTERM",r));}
  }catch(e){console.error(JSON.stringify({failed:e.code||e.message,assertion:e.message,results,workerDiagnostics:logs.slice(-3)}));process.exitCode=1;}
  finally{if(c)c.release();await stop();await repo.pool.end().catch(()=>{});try{proof.stop();}catch{}fs.rmSync(root,{recursive:true,force:true});}
}
run();
