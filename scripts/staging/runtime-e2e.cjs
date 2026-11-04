// Local staging-equivalent end-to-end test. Runs the real staging worker
// (deploy/staging/runtime.cjs) inside a simulated deployment (REPLIT_DEPLOYMENT
// set) on a disposable TLS-only PostgreSQL as bq_app, with the filesystem App
// Storage stand-in and invented accounts. Stand-ins prove the wiring, not the
// hosted provider.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {Client}=require("pg");
const gate=require("../../deploy/staging/gate.cjs");
const {migrate,migrations}=require("../../deploy/staging/migrate.cjs");
const {seed}=require("../../deploy/staging/seed.cjs");
const {ImmutableStore}=require("../../deploy/staging/object-store.cjs");
const {supervise}=require("../../deploy/staging/start-staging.cjs");
const {preflight}=require("../../deploy/staging/preflight.cjs");
const {latest}=require("../../deploy/staging/fixture-outbox.cjs");
const {backup,restore}=require("../../deploy/staging/backup.cjs");
const {FileStorage}=require("../forensics/file-storage.cjs");
const {Repository}=require("../../development/postgres/repository.cjs");
const {vault}=require("../../development/postgres/sealed.cjs");
const {code}=require("../../development/postgres/fixtures.cjs");
const {createCluster}=require("./tls-cluster.cjs");
const {readSql}=require("../migration/rel001/reconcile.cjs");
const workspace=path.resolve(__dirname,"../.."),child=path.join(__dirname,"runtime-child.cjs");
const DB="bq_staging_e2e",PORT=5131,POOL=4;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hex=n=>crypto.randomBytes(n).toString("hex");
const results=[];
async function test(id,name,fn){
  try{results.push({id,name,result:"PASS",detail:String(await fn()??"assertions passed")});}
  catch(e){results.push({id,name,result:"FAIL",detail:String(e.message).slice(0,500)});}
  console.log(`${id} ${results.at(-1).result} ${name} — ${results.at(-1).detail}`);
}

const cluster=createCluster({prefix:"bq-staging-e2e-",port:55463,databases:[DB]});
const storageDir=fs.mkdtempSync(path.join(os.tmpdir(),"bq-forensics-staging-"));
const storage=new FileStorage(storageDir);
const groot=path.join(cluster.root,"repo");
fs.mkdirSync(path.join(groot,"deploy","staging"),{recursive:true});
const productionBucket="invented-production-bucket",productionRepl="invented-production-repl",productionOrigin="https://production.invalid";
const writeReplit=bucket=>fs.writeFileSync(path.join(groot,".replit"),`[objectStorage]\ndefaultBucketID = "${bucket}"\n`);
writeReplit("invented-staging-bucket");
fs.writeFileSync(path.join(groot,"deploy","staging","production-identity.json"),JSON.stringify({replIdSha256:gate.sha(productionRepl),originSha256:gate.sha(productionOrigin),bucketSha256s:[gate.sha(productionBucket)],databaseHostSha256s:[gate.sha("prod-db.invalid")]}));
const sessionKey=hex(48),backupKey=hex(32);
const manifest={kind:"BQ_STAGING_SYNTHETIC",dataset:`staging-synthetic-${crypto.randomUUID()}`,
  app:{replId:`invented-staging-repl-${hex(4)}`,origin:"https://staging.invalid"},
  database:{host:"localhost",port:cluster.port,name:DB,caSha256:gate.sha(cluster.ca())},
  bucket:"invented-staging-bucket",keys:{session:gate.sha(sessionKey),backup:gate.sha(backupKey)},approval:"STG-E2E-1"};
const approvals=[];
function approve(m,operations){
  approvals.splice(0,approvals.length,...approvals.filter(a=>a.id!==m.approval));
  approvals.push({id:m.approval,operations,approvedBy:"invented reviewer",approvedAt:"2026-11-04T00:00:00Z",expires:"2099-01-01T00:00:00Z",binding:gate.binding(m)});
  fs.writeFileSync(path.join(groot,"deploy","staging","approvals.json"),JSON.stringify({approvals}));
}
const variant=edit=>{const m=JSON.parse(JSON.stringify(manifest));edit(m);return m;};
const baseEnv={PATH:process.env.PATH,HOME:cluster.root,LANG:"C.UTF-8",REPLIT_DEPLOYMENT:"1",REPL_ID:manifest.app.replId,
  BQ_STAGING_MANIFEST:JSON.stringify(manifest),BQ_STAGING_SESSION_KEY:sessionKey,BQ_STAGING_BACKUP_KEY:backupKey,
  BQ_STAGING_DB_CA:cluster.ca(),BQ_STAGING_APP_PASSWORD:cluster.passwords.bq_app,BQ_STAGING_POOL_MAX:String(POOL),PORT:String(PORT)};
const envWith=(changes,m)=>{const env={...baseEnv,...(m?{BQ_STAGING_MANIFEST:JSON.stringify(m)}:{}),...changes};for(const [k,v] of Object.entries(env))if(v===undefined)delete env[k];return env;};

function worker(env=baseEnv,root=groot,bucketDir=storageDir){
  const c=spawn(process.execPath,[child,root,bucketDir],{env,stdio:["ignore","pipe","pipe"]});
  c.out="";c.stdout.on("data",d=>c.out+=d);c.stderr.on("data",d=>c.out+=d);
  c.exited=new Promise(r=>c.once("exit",(code,signal)=>r(code??signal)));
  return c;
}
const lastLine=text=>text.trim().split("\n").at(-1)||"";
async function ready(c,ms=60000){
  for(const end=Date.now()+ms;Date.now()<end;await sleep(150)){
    if(c&&c.exitCode!==null)throw Error(`worker exited ${c.exitCode}: ${lastLine(c.out)}`);
    try{if((await fetch(`http://127.0.0.1:${PORT}/health/ready`,{signal:AbortSignal.timeout(10000)})).status===200)return c;}catch{}
  }
  throw Error("staging worker not ready in time");
}
const info=c=>JSON.parse(c.out.split("\n").find(l=>l.startsWith('{"staging":"ready"')));
async function stop(c,signal="SIGTERM"){if(c.exitCode!==null||c.signalCode!==null)return c.exitCode;c.kill(signal);return c.exited;}
async function refused(env,expected,root){
  const c=worker(env,root);
  const outcome=await Promise.race([c.exited,sleep(60000).then(()=>"timeout")]);
  if(outcome==="timeout"){c.kill("SIGKILL");throw Error("worker did not refuse");}
  const seen=expected instanceof RegExp?c.out.match(expected)?.[0]:c.out.includes(expected)&&expected;
  if(outcome===0||!seen)throw Error(`expected ${expected}, got exit ${outcome}: ${lastLine(c.out)}`);
  return seen;
}
let ip=1;
async function request(url,body={},token,options={}){
  const method=options.method||"POST";
  if(token&&!["GET","HEAD"].includes(method))body={token,...body};
  const headers={"x-forwarded-for":`192.0.2.${1+(ip++%240)}`,...(token?{"x-session":token}:{}),...options.headers};
  if(!["GET","HEAD"].includes(method)){headers["Idempotency-Key"]=options.key||crypto.randomUUID();if(!options.raw)headers["Content-Type"]="application/json";}
  const r=await fetch(`http://127.0.0.1:${PORT}${url}`,{method,headers,body:["GET","HEAD"].includes(method)?undefined:options.raw||JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const bytes=Buffer.from(await r.arrayBuffer());let json={};try{json=JSON.parse(bytes.toString());}catch{}
  return {status:r.status,json,bytes,headers:r.headers};
}
const ok=(r,status=200)=>assert.equal(r.status,status,`HTTP ${r.status} ${r.json?.error||""}`);
const outboxVault=vault({sessionKey,dataset:manifest.dataset});
async function events(topic){
  const r=await cluster.query("SELECT id,payload FROM dev.outbox WHERE topic=$1 ORDER BY created_at DESC",[topic]);
  return r.rows.filter(x=>x.payload?.sealed).map(x=>outboxVault.decode(x.payload,`outbox:${x.id}`));
}
function fromBase32(text){
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";
  for(const ch of text)bits+=alphabet.indexOf(ch).toString(2).padStart(5,"0");
  return Buffer.from(bits.match(/.{8}/g).map(b=>parseInt(b,2))).toString("hex");
}
async function login(badge,password,totpHex){
  const l=await request("/api/login",{badge,password});ok(l);assert(l.json.needTotp,"2FA prompt missing");
  const r=await request("/api/login-2fa",{ticket:l.json.ticket,code:code(totpHex)});ok(r);assert(r.json.token);
  return r.json.token;
}
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()&&!e.isSymbolicLink()?walk(p):[{p,link:e.isSymbolicLink()}];});
}

(async()=>{
  let w,inspector,creds,tokens={},postId,mediaUrl,mediaRow,png;
  try{
    await cluster.provision();
    {const c=new Client(cluster.tls("bq_migrator"));await c.connect();try{await migrate(c);}finally{await c.end();}}
    // Evidence for "no startup DDL": every DDL command after migration is recorded.
    await cluster.query(`CREATE SCHEMA audit;CREATE TABLE audit.ddl(at timestamptz DEFAULT clock_timestamp(),role text,tag text);
      CREATE FUNCTION audit.log_ddl() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN INSERT INTO audit.ddl(role,tag) VALUES(session_user,tg_tag);END$$;
      CREATE EVENT TRIGGER audit_ddl ON ddl_command_start EXECUTE FUNCTION audit.log_ddl();`);
    approve(manifest,["staging-activate"]);

    await test("S01","Worker refuses to serve before provisioning",()=>refused(baseEnv,"staging_not_provisioned"));
    await test("S02","Seeding needs its own approved operation",()=>{
      try{gate.verify({operation:"staging-seed",env:baseEnv,root:groot});}catch(e){if(e.message==="staging_approval_scope_refused")return e.message;throw e;}
      throw Error("seed accepted without approval scope");
    });
    approve(manifest,["staging-seed","staging-activate"]);
    const store=new ImmutableStore(storage,{dataset:manifest.dataset}),credFile=path.join(cluster.root,"seed-credentials.json");
    await test("S03","One-time seed as bq_migrator: invented accounts, random credentials, receipt in bucket",async()=>{
      const proof=gate.verify({operation:"staging-seed",env:baseEnv,root:groot});
      const r=await seed({proof,store,password:cluster.passwords.bq_migrator,out:credFile});
      assert.equal(fs.statSync(credFile).mode&0o777,0o600);
      creds=JSON.parse(fs.readFileSync(credFile,"utf8"));
      assert(!creds.password.includes("SyntheticOnly"),"published fixture password reused");
      const a=(await cluster.query("SELECT dataset_id,mode FROM dev.authority")).rows[0];
      assert.equal(a.dataset_id,manifest.dataset);
      assert((await store.readControl("provision-receipt.json"))?.state==="committed");
      return `${r.accounts} invented accounts; credential file mode 600; authority ${a.mode}`;
    });
    await test("S04","Re-seeding is refused by the bucket receipt and, if that is lost, by the database",async()=>{
      const proof=gate.verify({operation:"staging-seed",env:baseEnv,root:groot}),out=path.join(cluster.root,"seed-again.json");
      await assert.rejects(seed({proof,store,password:cluster.passwords.bq_migrator,out}),/staging_previously_provisioned/);
      const control=path.join(storageDir,manifest.dataset,"control"),aside=`${control}.aside`;
      fs.renameSync(control,aside);
      try{await assert.rejects(seed({proof,store,password:cluster.passwords.bq_migrator,out}),/staging_authority_exists/);}
      finally{fs.rmSync(control,{recursive:true,force:true});fs.renameSync(aside,control);}
      return "staging_previously_provisioned; staging_authority_exists";
    });

    w=worker();
    await test("S05","Startup inside a deployment: gate, bq_app over verify-full TLS, schema check, ready",async()=>{
      await ready(w);
      const i=info(w);assert.equal(i.schema,migrations.at(-1).version);
      const ssl=(await cluster.query("SELECT a.usename,s.ssl,s.version FROM pg_stat_activity a JOIN pg_stat_ssl s ON s.pid=a.pid WHERE a.application_name='bq-staging-runtime'")).rows;
      assert(ssl.length&&ssl.every(r=>r.usename==="bq_app"&&r.ssl),"runtime connection not bq_app over TLS");
      return `schema ${i.schema}; ${ssl.length} connection(s) as bq_app, ${ssl[0].version}`;
    });
    {const gp=gate.verify({operation:"staging-activate",env:baseEnv,root:groot}),dir=fs.mkdtempSync(path.join(os.tmpdir(),"bq-staging-inspect-"));
      const proof=Object.freeze({...gp,root:dir,app:dir,objects:dir});
      inspector=new Repository(proof,{proof,password:cluster.passwords.bq_app,store,receipt:await store.readControl("provision-receipt.json"),max:1});}
    const exported=()=>inspector.exportSynthetic();

    await test("S06","Password and TOTP login on seeded invented accounts",async()=>{
      for(const badge of ["101","102","103"])tokens[badge]=await login(badge,creds.password,creds.totp[badge].hex);
      const s=await request("/api/session",{},tokens["101"]);ok(s);assert(s.json.person?.name);
      const wrong=await request("/api/login-2fa",{ticket:(await request("/api/login",{badge:"104",password:creds.password})).json.ticket,code:"000000"});
      assert([400,401].includes(wrong.status));
      return "3 logins; wrong TOTP refused";
    });
    await test("S07","Registration: SMS OTP, TOTP enrolment and email confirmation via the fixture outbox",async()=>{
      const body={badge:"107",code:creds.registrationCheck,mobile:creds.registrationMobile,password:`Reg-${hex(8)}-Aa1!`};
      ok(await request("/api/register",body));
      const sms=(await events("sms"))[0];assert(sms,"SMS not queued");
      const otp=(new URLSearchParams(sms.body).get("Body")||sms.body).match(/\b\d{6}\b/)?.[0];assert(otp);
      const reg=await request("/api/register",{...body,otp});ok(reg);assert(reg.json.registered);
      const setup=await request("/api/login-2fa",{op:"setup",ticket:reg.json.ticket});ok(setup);
      const enrolled=await request("/api/login-2fa",{op:"enroll",ticket:reg.json.ticket,code:code(fromBase32(setup.json.secret))});ok(enrolled);
      ok(await request("/api/login-2fa",{op:"email",ticket:enrolled.json.ticket,email:"synthetic107@example.invalid"}));
      const mail=(await events("mail")).find(m=>m.to==="synthetic107@example.invalid");
      const done=await request("/api/login-2fa",{op:"email-confirm",ticket:enrolled.json.ticket,code:mail.text.match(/\b\d{6}\b/)[0]});ok(done);assert(done.json.token);
      tokens["107"]=done.json.token;
      assert((await exported())["accounts.json"]["107"].hash);
      return "account 107 registered with TOTP and email";
    });
    await test("S25","Operator outbox tool shows the registration codes and no message bodies",async()=>{
      const rows=await latest({env:baseEnv,root:groot});
      assert(rows.some(r=>r.topic==="sms"&&/^\d{6}$/.test(r.code)));assert(rows.some(r=>r.to==="synthetic107@example.invalid"&&r.code));
      assert(rows.every(r=>Object.keys(r).join()==="at,topic,to,code"));
      return `${rows.length} recent fixture messages; codes only`;
    });
    await test("S08","Password change persists; the old password is refused",async()=>{
      const next=`Chg-${hex(8)}-Aa1!`;
      const r=await request("/api/password",{current:creds.password,password:next,next},tokens["103"]);ok(r);tokens["103"]=r.json.token;
      assert([400,401].includes((await request("/api/login",{badge:"103",password:creds.password})).status));
      ok(await request("/api/login",{badge:"103",password:next}));
      creds.password103=next;
      return `account version ${(await exported())["accounts.json"]["103"].ver}`;
    });
    png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64");
    await test("S09","Text and image posts; media stored in the bucket and verified before ready",async()=>{
      const t=await request("/api/ideas",{type:"post",text:"Staging synthetic text post"},tokens["101"]);ok(t,201);postId=t.json.idea.id;
      const u=await request("/api/media",{},tokens["101"],{raw:png,headers:{"Content-Type":"image/png"}});ok(u,201);mediaUrl=u.json.url;
      ok(await request("/api/ideas",{type:"post",text:"Staging synthetic image post",media:mediaUrl},tokens["101"]),201);
      mediaRow=(await cluster.query("SELECT id,object_key,sha256,state FROM dev.media WHERE legacy_path=$1",[mediaUrl])).rows[0];
      assert.equal(mediaRow.state,"ready");
      const object=fs.readFileSync(path.join(storageDir,mediaRow.object_key));
      assert.equal(crypto.createHash("sha256").update(object).digest("hex"),mediaRow.sha256);
      const g=await request(mediaUrl,{},tokens["101"],{method:"GET"});ok(g);assert(g.bytes.equals(png));
      const range=await request(mediaUrl,{},tokens["101"],{method:"GET",headers:{Range:"bytes=0-7"}});ok(range,206);assert.equal(range.bytes.length,8);
      return `bucket key ${mediaRow.object_key.split("/").slice(1,2)}/…; hash verified; GET and Range served`;
    });
    await test("S10","Comments, reply, comment-like, rating and bookmark persist",async()=>{
      const c=await request(`/api/ideas/${postId}/comments`,{text:"Staging synthetic comment"},tokens["102"]);ok(c,201);
      const commentId=c.json.idea.comments[0].id;
      ok(await request(`/api/ideas/${postId}/comments`,{text:"Staging synthetic reply",replyTo:commentId},tokens["101"]),201);
      ok(await request(`/api/ideas/${postId}/comment-like`,{commentId},tokens["101"]));
      ok(await request(`/api/ideas/${postId}/rating`,{vote:"like"},tokens["102"]));
      ok(await request(`/api/ideas/${postId}/bookmark`,{},tokens["102"]));
      const x=await exported(),post=x["ideas.json"].find(p=>p.id===postId);
      assert.equal(post.comments.length>=1,true);
      assert(JSON.stringify(x["bookmarks.json"]).includes(postId),"bookmark not persisted");
      return `comments ${JSON.stringify(post.comments).split('"id"').length-1} ids; bookmark persisted`;
    });
    await test("S11","Duplicate request returns the committed response once; changed body conflicts",async()=>{
      const key=crypto.randomUUID(),body={type:"post",text:"Staging idempotent post"};
      const a=await request("/api/ideas",body,tokens["101"],{key}),b=await request("/api/ideas",body,tokens["101"],{key});
      ok(a,201);ok(b,201);assert.equal(a.json.idea.id,b.json.idea.id);
      ok(await request("/api/ideas",{...body,text:"Different"},tokens["101"],{key}),409);
      assert.equal((await exported())["ideas.json"].filter(p=>p.text===body.text).length,1);
      return "one committed post; replay identical; conflict 409";
    });
    await test("S12","Connection pool stays within its bound under concurrent requests",async()=>{
      const replies=await Promise.all(Array.from({length:8},()=>request("/api/session",{},tokens["101"])));
      const n=Number((await cluster.query("SELECT count(*) AS n FROM pg_stat_activity WHERE application_name='bq-staging-runtime'")).rows[0].n);
      assert(n<=POOL,`pool opened ${n} connections`);
      return `${replies.filter(r=>r.status===200).length}/8 served; ${n} runtime connection(s) (bound ${POOL})`;
    });

    await test("S13","Graceful restart and cold start from database and bucket only; sessions persist",async()=>{
      const before=info(w).work;
      assert.equal(await stop(w),0);
      w=worker();await ready(w);
      const i=info(w);assert.notEqual(i.work,before);
      assert.equal(i.media.restored,Number((await cluster.query("SELECT count(*) AS n FROM dev.media WHERE state IN('ready','retained')")).rows[0].n));
      ok(await request("/api/session",{},tokens["101"]));ok(await request("/api/session",{},tokens["107"]));
      const g=await request(mediaUrl,{},tokens["102"],{method:"GET"});ok(g);assert(g.bytes.equals(png));
      assert((await exported())["ideas.json"].some(p=>p.id===postId));
      return `fresh work dir; restored ${i.media.restored} media object(s) from bucket; sessions and posts intact`;
    });
    await test("S14","No business data on local disk",()=>{
      const work=info(w).work,files=walk(work).filter(f=>!f.link).map(f=>path.relative(work,f.p));
      const json=files.filter(f=>f.endsWith(".json"));
      const unexpected=files.filter(f=>!/^app\/[a-z-]+\.js$/.test(f)&&!/^app\/public\/(index\.html|synthetic-request\.js)$/.test(f)&&!/^objects\/[0-9a-f-]{36}$/.test(f));
      assert.deepEqual(json,[]);assert.deepEqual(unexpected,[]);
      return `${files.length} regular files: copied sources, shell HTML and verified media cache only`;
    });
    await test("S24","Preflight confirms every binding and re-verifies all bucket media read-only",async()=>{
      const r=await preflight({env:baseEnv,root:groot,store,verifyMedia:true});
      assert.equal(r.database.role,"bq_app");assert.equal(r.mediaVerified,r.media);
      await assert.rejects(preflight({env:envWith({BQ_STAGING_MIGRATOR_PASSWORD:"present"}),root:groot,store}),/migrator_credential_present_at_runtime/);
      return `schema ${r.schema}; ${r.database.tls}; role ${r.database.role}; ${r.mediaVerified}/${r.media} media verified`;
    });
    await test("S26","Encrypted bq_backup dump restores into an empty scratch database that passes preflight",async()=>{
      const file=path.join(cluster.root,"staging.bqbackup"),RESTORE="bq_staging_restore";
      const recoveryStorage=fs.mkdtempSync(path.join(os.tmpdir(),"bq-forensics-recovery-"));
      fs.chmodSync(recoveryStorage,0o700);
      let recoveredWorker;
      const auditKey=crypto.randomBytes(32);
      const fingerprint=value=>crypto.createHmac("sha256",auditKey).update(gate.canonical(value)).digest("hex");
      async function completeSnapshot(database){
        const c=new Client(cluster.tls("bq_backup",{database}));await c.connect();
        try{
          await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
          const graph=await readSql(c),tables=Object.create(null);
          const names=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='dev' ORDER BY tablename")).rows;
          for(const {tablename} of names){
            assert(/^[a-z_][a-z0-9_]*$/.test(tablename));
            tables[tablename]=(await c.query(`SELECT to_jsonb(t)::text AS value FROM dev.${tablename} t ORDER BY 1`)).rows.map(r=>r.value);
          }
          return {files:Object.keys(graph.values).length,semantic:fingerprint(graph.values),allTables:fingerprint(tables),tables:names.length};
        }finally{await c.query("ROLLBACK").catch(()=>{});await c.end();}
      }
      approve(manifest,["staging-seed","staging-activate","staging-backup"]);
      assert.equal(await stop(w),0);
      try{
      const before=await preflight({env:baseEnv,root:groot,store});
      const completeBefore=await completeSnapshot(DB);
      fs.cpSync(storageDir,recoveryStorage,{recursive:true});
      const independentStore=new ImmutableStore(new FileStorage(recoveryStorage),{dataset:manifest.dataset});
      const b=await backup({proof:gate.verify({operation:"staging-backup",env:baseEnv,root:groot}),password:cluster.passwords.bq_backup,out:file});
      const raw=fs.readFileSync(file);
      assert(!raw.includes(Buffer.from("PGDMP"))&&!raw.includes(Buffer.from("schema_migrations")),"backup file is not encrypted");
      await assert.rejects(backup({proof:gate.verify({operation:"staging-activate",env:baseEnv,root:groot}),password:cluster.passwords.bq_backup,out:file+"2"}),/staging_backup_scope_required/);
      await cluster.query(`CREATE DATABASE ${RESTORE}`,[],"postgres");
      await cluster.query(fs.readFileSync(path.join(workspace,"deploy","staging","roles.sql"),"utf8"),[],RESTORE);
      const rm=variant(m=>{m.database.name=RESTORE;m.approval="STG-E2E-RESTORE";});
      approve(rm,["staging-migrate","staging-activate"]);
      const renv=envWith({},rm),proof=gate.verify({operation:"staging-migrate",env:renv,root:groot});
      await assert.rejects(restore({proof,password:"wrong",input:file}),/password authentication failed/);
      await restore({proof,password:cluster.passwords.bq_migrator,input:file});
      await assert.rejects(restore({proof,password:cluster.passwords.bq_migrator,input:file}),/restore_target_not_empty/);
      const other=hex(32),tampered=Object.freeze({...proof,backupKey:other});
      await assert.rejects(restore({proof:tampered,password:cluster.passwords.bq_migrator,input:file}),/backup_key_or_dataset_mismatch/);
      const after=await preflight({env:renv,root:groot,store,verifyMedia:true});
      assert.equal(after.state,before.state);assert.equal(after.database.role,"bq_app");assert.equal(after.mediaVerified,after.media);
      assert.deepEqual(await completeSnapshot(RESTORE),completeBefore);
      await independentStore.restore((await cluster.query("SELECT id,object_key,sha256 FROM dev.media WHERE state IN('ready','retained')",[],RESTORE)).rows,path.join(cluster.root,"independent-cache"));
      recoveredWorker=worker(renv,groot,recoveryStorage);await ready(recoveredWorker);
      ok(await request("/api/session",{},tokens["101"]));ok(await request("/api/session",{},tokens["107"]));
      const recovered=await request(mediaUrl,{},tokens["101"],{method:"GET"});ok(recovered);assert(recovered.bytes.equals(png));
      const accepted=await request("/api/ideas",{type:"post",text:"Accepted on restored current SQL authority"},tokens["101"]);ok(accepted,201);
      await stop(recoveredWorker);recoveredWorker=worker(renv,groot,recoveryStorage);await ready(recoveredWorker);
      const persisted=(await completeSnapshot(RESTORE)).semantic;
      assert.notEqual(persisted,completeBefore.semantic);
      const currentFiles=await (async()=>{const c=new Client(cluster.tls("bq_backup",{database:RESTORE}));await c.connect();try{return (await readSql(c)).values;}finally{await c.end();}})();
      assert(currentFiles["ideas.json"].some(p=>p.id===accepted.json.idea.id));
      return `${completeBefore.files} files and all ${completeBefore.tables} SQL tables exactly matched by independent keyed fingerprints; encrypted dump, separate media copy and original sessions recovered; accepted new write survived restart; overwrite/wrong key refused`;
      }finally{if(recoveredWorker)await stop(recoveredWorker);fs.rmSync(recoveryStorage,{recursive:true,force:true});w=worker();await ready(w);}
    });
    await test("S23","A cache file lost while running is refilled from the bucket before serving",async()=>{
      const cached=path.join(info(w).work,"objects",mediaRow.id);
      fs.rmSync(cached);
      const g=await request(mediaUrl,{},tokens["101"],{method:"GET"});ok(g);assert(g.bytes.equals(png));
      assert(fs.existsSync(cached));
      return "cache gap refilled with verified bucket bytes";
    });
    await test("S15","Corrupt or missing bucket media blocks startup; restored bytes recover",async()=>{
      await stop(w);
      const object=path.join(storageDir,mediaRow.object_key),good=fs.readFileSync(object);
      fs.writeFileSync(object,Buffer.from("tampered"));
      const corrupt=await refused(baseEnv,"object_corrupt");
      fs.rmSync(object);
      const missing=await refused(baseEnv,"object_missing");
      fs.writeFileSync(object,good);
      w=worker();await ready(w);
      return `${corrupt}; ${missing}; recovered after restore`;
    });
    await test("S16","Database outage: readiness fails closed and the worker recovers without restart",async()=>{
      const pid=w.pid;
      cluster.stop();
      try{
        let down=0;
        for(let i=0;i<40&&!down;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/health/ready`,{signal:AbortSignal.timeout(10000)});if(r.status===503)down=r.status;}catch{}await sleep(250);}
        assert.equal(down,503);
        ok(await request("/health/live",{},null,{method:"GET"}));
        const write=await request("/api/ideas",{type:"post",text:"Must not commit during outage"},tokens["101"]);assert.equal(write.status,503);
      }finally{cluster.start();}
      await ready(w,30000);assert.equal(w.pid,pid);assert.equal(w.exitCode,null);
      ok(await request("/api/ideas",{type:"post",text:"Staging post after recovery"},tokens["101"]),201);
      const x=await exported();
      assert(x["ideas.json"].some(p=>p.id===postId));
      assert(!x["ideas.json"].some(p=>p.text==="Must not commit during outage"));
      return "ready 503 during outage, live 200, write 503 and not committed; recovered in place";
    });
    await test("S17","Pending or edited migrations are refused at startup",async()=>{
      await stop(w);
      const last=migrations.at(-1);
      await cluster.query("DELETE FROM dev.schema_migrations WHERE version=$1",[last.version]);
      const pending=await refused(baseEnv,"schema_migration_pending");
      await cluster.query("INSERT INTO dev.schema_migrations(version,checksum) VALUES($1,$2)",[last.version,"0".repeat(64)]);
      const edited=await refused(baseEnv,"migration_checksum_mismatch");
      await cluster.query("UPDATE dev.schema_migrations SET checksum=$2 WHERE version=$1",[last.version,last.checksum]);
      return `${pending}; ${edited}`;
    });
    await test("S18","TLS and credential refusals: foreign CA, hostname mismatch, wrong password, migrator secret at runtime",async()=>{
      const foreign=variant(m=>{m.database.caSha256=gate.sha(cluster.foreignCa());m.approval="STG-E2E-CA";});approve(foreign,["staging-activate"]);
      const a=await refused(envWith({BQ_STAGING_DB_CA:cluster.foreignCa()},foreign),/UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_GET_ISSUER_CERT_LOCALLY/);
      const ipHost=variant(m=>{m.database.host="127.0.0.1";m.approval="STG-E2E-IP";});approve(ipHost,["staging-activate"]);
      const b=await refused(envWith({},ipHost),"ERR_TLS_CERT_ALTNAME_INVALID");
      const c=await refused(envWith({BQ_STAGING_APP_PASSWORD:"invented-wrong-password"}),"28P01");
      const d=await refused(envWith({BQ_STAGING_MIGRATOR_PASSWORD:"present"}),"migrator_credential_present_at_runtime");
      return [a,b,c,d].join("; ");
    });
    await test("S19","Gate refuses every production identity through the real worker entry",async()=>{
      const seen=[];
      seen.push(await refused(envWith({},variant(m=>{m.bucket=productionBucket;})),"production_bucket_refused"));
      writeReplit(productionBucket);
      try{seen.push(await refused(baseEnv,"staging_bucket_binding_mismatch"));}finally{writeReplit("invented-staging-bucket");}
      seen.push(await refused(envWith({REPL_ID:productionRepl},variant(m=>{m.app.replId=productionRepl;})),"production_identity_refused"));
      seen.push(await refused(envWith({},variant(m=>{m.app.origin=productionOrigin;})),"production_identity_refused"));
      seen.push(await refused(envWith({},variant(m=>{m.database.host="prod-db.invalid";})),"production_database_refused"));
      seen.push(await refused(envWith({SMTP_PASS:"invented"}),"production_secret_present"));
      seen.push(await refused(envWith({REPL_ID:"some-other-repl"}),"staging_app_identity_mismatch"));
      seen.push(await refused(envWith({},variant(m=>{m.approval="STG-UNKNOWN";})),"staging_approval_missing"));
      fs.mkdirSync(path.join(groot,"data"));fs.writeFileSync(path.join(groot,"data","accounts.json"),"{}");
      try{seen.push(await refused(baseEnv,"employee_dataset_present"));}finally{fs.rmSync(path.join(groot,"data"),{recursive:true});}
      seen.push(await refused(baseEnv,"production_identity_unrecorded",workspace));
      return seen.join("; ");
    });
    await test("S20","Supervisor restarts a crashed worker and gives up on persistent failure",async()=>{
      const quiet=[];
      const s=supervise({entry:child,args:[groot,storageDir],env:baseEnv,baseDelayMs:200,maxRestarts:3,log:m=>quiet.push(m)});
      await ready(null);const first=s.current().pid;
      s.current().kill("SIGKILL");
      for(let i=0;i<100&&(s.current().pid===first||s.current().exitCode!==null);i++)await sleep(100);
      await sleep(500);await ready(null);
      const second=s.current().pid;assert.notEqual(second,first);
      assert.equal(await s.stop(),0);
      const failures=[];
      const failing=supervise({entry:child,args:[groot,storageDir],env:envWith({BQ_STAGING_APP_PASSWORD:"invented-wrong-password"}),baseDelayMs:100,maxRestarts:2,log:m=>failures.push(m)});
      const code=await Promise.race([failing.done,sleep(60000).then(()=>"timeout")]);
      assert.equal(code,1);
      return `restarted after SIGKILL (new worker); persistent failure exited 1 after ${failures.filter(m=>/restart \d/.test(m)).length} restarts`;
    });
    await test("S21","Development and production fences are unchanged",async()=>{
      const dev=spawn(process.execPath,[path.join(workspace,"development","postgres","launch.cjs")],{env:{PATH:process.env.PATH,HOME:cluster.root,REPLIT_DEPLOYMENT:"1"},stdio:["ignore","pipe","pipe"]});
      let out="";dev.stdout.on("data",d=>out+=d);dev.stderr.on("data",d=>out+=d);
      const exit=await new Promise(r=>dev.once("exit",r));
      assert(exit!==0&&out.includes("production_activation_forbidden"));
      assert.throws(()=>require(path.join(workspace,"persistence-safety.js")).requireDurableBackend(),/durable_commit_provider_unavailable/);
      assert(fs.readFileSync(path.join(workspace,"auth.js"),"utf8").includes("if (process.env.REPLIT_DEPLOYMENT) safety.requireDurableBackend();"));
      assert(fs.readFileSync(path.join(workspace,"start.js"),"utf8").includes('throw safety.fault("deployment_storage_disabled")'));
      return "launcher production_activation_forbidden; JSON durable-commit fence and start.js fence present";
    });
    await test("S22","The staging runtime executed no DDL",async()=>{
      const rows=(await cluster.query("SELECT role,tag FROM audit.ddl")).rows;
      assert.deepEqual(rows,[]);
      return "0 DDL commands recorded after migration";
    });
  }catch(e){
    results.push({id:"SETUP",name:"Harness",result:"FAIL",detail:e.message});
    console.log(`SETUP FAIL ${e.message}`);if(w)console.log(lastLine(w.out));
  }finally{
    if(w)await stop(w,"SIGKILL");
    if(inspector)await inspector.pool.end().catch(()=>{});
    cluster.destroy();
    fs.rmSync(storageDir,{recursive:true,force:true});
  }
  const out=path.join(workspace,"generated-artifacts","staging");
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,"runtime-e2e.json"),JSON.stringify({scope:"local staging-equivalent stand-ins; not hosted certification",results},null,2));
  const pass=results.filter(r=>r.result==="PASS").length;
  console.log(`staging-runtime-e2e: ${pass}/${results.length} PASS`);
  process.exitCode=pass===results.length?0:1;
})();
