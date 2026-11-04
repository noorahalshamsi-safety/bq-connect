// Isolated synthetic control/provider tests; no database connections or live SDK.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),assert=require("node:assert/strict"),http=require("node:http"),{EventEmitter}=require("node:events");
const cfg=require("../../deploy/managed/config.cjs"),S=require("../../migration/minimal/source.cjs"),I=require("../../migration/minimal/import.cjs");
const delivery=require("../../development/postgres/minimal-delivery.cjs"),{launch}=require("../../deploy/managed/minimal-bootstrap.cjs");
const {ImmutableStore}=require("../../deploy/staging/object-store.cjs"),{FileStorage}=require("../forensics/file-storage.cjs");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-forensics-minimal-guards-")),results=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Tests intentionally close and rebind the same public port. Do not reuse an
// undici keep-alive socket belonging to the previous synthetic listener.
const freshFetch=(url,options={})=>fetch(url,{...options,headers:{...options.headers,Connection:"close"}});
const key="f".repeat(96),backup="e".repeat(64),h="a".repeat(64),auditKey=Buffer.alloc(32,17);
const raw={"accounts.json":JSON.stringify(Object.fromEntries(Array.from({length:8},(_,i)=>[String(i+1),{hash:"b".repeat(128),salt:"c".repeat(32),ver:1,kdf:2}]))),
  "employees.json":JSON.stringify(Array.from({length:6311},(_,i)=>({badge:String(i+1),name:"Invented Fixture Only"}))),"session.key":key,"backup.key":backup};
for(const n of S.supporting)raw[n]="{}";
const source=S.prepare(raw,{bucketFingerprint:cfg.sha("invented-source"),auditKey});
const env={REPL_ID:"invented-app",REPLIT_DEPLOYMENT:"1",DATABASE_URL:"postgresql://invented:invented@db.invalid/bq?sslmode=require",BQ_MANAGED_SESSION_KEY:key,BQ_MANAGED_BACKUP_KEY:backup};
const manifest={kind:"BQ_REPLIT_MANAGED_V1",environment:"production",dataset:"managed-production-"+crypto.randomUUID(),appFingerprint:cfg.sha(env.REPL_ID),
  endpointFingerprint:cfg.endpoint(env,"production").identity,developmentEndpointFingerprint:cfg.sha("invented-development"),
  schemaFingerprint:h,releaseFingerprint:h,permissionsFingerprint:h,keys:{session:cfg.sha(key),backup:cfg.sha(backup)},
  bucket:"invented-target",productionBucketFingerprint:cfg.sha("invented-target"),mockStorage:false,
  permissionApproval:"reviewed-managed-runtime-capabilities",approval:"invented-only",
  release:Object.fromEntries(["source","backup","reconciliation","custody","rollback","frozenGeneration"].map(k=>[k,h])),
  minimal:{policy:"employees-accounts-only-v1",sourceBucket:"invented-source",sourceBucketFingerprint:source.bucketFingerprint,
    sourceFingerprint:source.fingerprint,membership:source.membership,employees:6311,accounts:8,freezeEvidence:h}};
fs.writeFileSync(path.join(root,"production-approvals.json"),JSON.stringify({approvals:[{id:manifest.approval,operation:"managed-production-activate",
  binding:cfg.sha(cfg.canonical(manifest)),approvedBy:"invented fixture",expires:new Date(Date.now()+600000).toISOString()}]}));
fs.writeFileSync(path.join(root,"approvals.json"),'{"approvals":[]}');
const proof=cfg.verify({env,manifest,approvalRoot:root});
async function test(name,fn){await fn();results.push({name,status:"PASS"});console.log("PASS "+name);}
let bootstrap;
(async()=>{
  try{
    await test("Production import needs its separate exact execution approval",()=>assert.throws(()=>I.authorize(proof,manifest,source,{approvalRoot:root}),/minimal_execution_approval_required/));
    await test("A valid activation proof cannot authorize a different manifest",()=>assert.throws(()=>I.authorize(proof,{...manifest,approval:"other"},source,{approvalRoot:root}),/minimal_verified_manifest_required/));
    await test("Freeze evidence must describe the same approved generation",()=>assert.throws(()=>I.policy({...manifest,minimal:{...manifest.minimal,freezeEvidence:"b".repeat(64)}},source),/minimal_policy_or_custody_mismatch/));
    await test("Source bucket cannot become the destination write bucket",()=>assert.throws(()=>I.policy({...manifest,bucket:"invented-source"},source),/minimal_policy_or_custody_mismatch/));
    await test("A forged import permit is rejected before the first SQL query",()=>assert.rejects(I.apply({client:{query:()=>{throw Error("SQL must not run");}},source,proof,permit:{}}),/minimal_execution_approval_required/));
    await test("Exact synthetic production approval issues a permit without connecting",()=>{
      fs.writeFileSync(path.join(root,"approvals.json"),JSON.stringify({approvals:[{operation:"minimal-employee-account-import",
        binding:cfg.sha(cfg.canonical({manifest,source:source.fingerprint})),approvedBy:"invented fixture",expires:new Date(Date.now()+600000).toISOString()}]}));
      assert.ok(Object.isFrozen(I.authorize(proof,manifest,source,{approvalRoot:root})));
    });
    await test("Production media keys require issued proof and remain checksum-verified",async()=>{
      const store=new ImmutableStore(new FileStorage(path.join(root,"mock-media")),{dataset:proof.dataset,managedProof:proof});
      const bytes=Buffer.from("invented new media only"),id=crypto.randomUUID(),r=await store.put(id,bytes);
      assert.deepEqual(await store.read(r.key,r.sha),bytes);
      await assert.rejects(store.read(r.key.replace(proof.dataset,"managed-production-"+crypto.randomUUID()),r.sha),/object_key_invalid/);
    });
    await test("A forged media proof never opens the production namespace",()=>assert.throws(()=>new ImmutableStore({},{dataset:proof.dataset,managedProof:{...proof}}),/managed_verified_proof_required/));
    await test("Source reader detects changes and exposes no write method",async()=>{
      const times={};const client={exists:async()=>({ok:true,value:true}),downloadAsText:async name=>{const n=name.slice(5);times[n]=(times[n]||0)+1;return {ok:true,value:times[n]>1&&n==="accounts.json"?raw[n]+" ":raw[n]};}};
      await assert.rejects(S.read({client,bucketFingerprint:source.bucketFingerprint,auditKey}),/minimal_source_changed_during_read/);
    });
    await test("Unsupported SMS destinations fail before any transport",()=>assert.throws(()=>delivery.validate({host:"invented.invalid",path:"/v1",method:"POST",body:"",headers:{}}),/sms_delivery_binding_invalid/));
    function transport(status){return (opts,callback)=>{assert.equal(opts.rejectUnauthorized,true);assert.equal(opts.minVersion,"TLSv1.2");const req=new EventEmitter();req.setTimeout=()=>req;req.end=()=>{const res=new EventEmitter();res.statusCode=status;res.resume=()=>{};callback(res);queueMicrotask(()=>res.emit("end"));};return req;};}
    const sms={host:"api.taqnyat.sa",path:"/v1/messages",method:"POST",headers:{"Content-Type":"application/json"},body:"{\"invented\":true}"};
    await test("SMS provider success uses strict TLS transport without reading bodies",()=>delivery.sendSms(sms,transport(201)));
    await test("Provider rejection is not marked successful",()=>assert.rejects(delivery.sendSms(sms,transport(503)),/sms_delivery_failed/));
    let enabled=false,attempts=0;
    const originalPort=process.env.PORT,originalHost=process.env.HOST;
    bootstrap=await launch({port:5131,retryMs:100,startRuntime:async()=>{
      attempts++;if(!enabled)throw Error("invented unapproved destination");
      const server=http.createServer((req,res)=>{let body="";req.on("data",b=>body+=b);req.on("end",()=>{res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({fixture:true,body,key:req.headers["idempotency-key"]}));});});
      await new Promise(r=>server.listen(Number(process.env.PORT),"127.0.0.1",r));return {close:()=>new Promise(r=>server.close(r))};
    }});
    await test("Maintenance keeps login closed and liveness open before approval",async()=>{
      const rootResponse=await freshFetch("http://127.0.0.1:5131/");assert.equal(rootResponse.status,200);assert.equal((await rootResponse.json()).ready,false);
      assert.equal((await freshFetch("http://127.0.0.1:5131/health/live")).status,200);
      for(let i=0;i<5;i++){assert.equal((await freshFetch("http://127.0.0.1:5131/api/login")).status,503);await sleep(75);}assert.ok(attempts>1);
    });
    await test("Only verified runtime startup switches the maintenance listener",async()=>{
      enabled=true;const end=Date.now()+3000;let r;
      do{await sleep(50);r=await freshFetch("http://127.0.0.1:5131/health/ready");}while(r.status!==200&&Date.now()<end);
      assert.equal(r.status,200);assert.equal((await r.json()).fixture,true);
    });
    await test("Cutover proxy preserves POST bytes and idempotency identity",async()=>{
      const r=await freshFetch("http://127.0.0.1:5131/api/invented",{method:"POST",headers:{"Idempotency-Key":"invented-retry-key"},body:"invented-exact-body"});
      const data=await r.json();assert.equal(data.body,"invented-exact-body");assert.equal(data.key,"invented-retry-key");
    });
    await bootstrap.close();bootstrap=null;
    await test("Published migration runner cannot import through a workspace/development flag",async()=>{
      const runner=require("../../deploy/managed/minimal-import-runner.cjs");
      assert.equal(runner.requested({REPLIT_DEPLOYMENT:"1"}),false);
      assert.equal(runner.requested({REPLIT_DEPLOYMENT:"0",BQ_MINIMAL_OPERATION:"owner-approved-import-once"}),false);
      bootstrap=await runner.run({env:{REPLIT_DEPLOYMENT:"0",BQ_MINIMAL_OPERATION:"owner-approved-import-once"},port:5131,
        executeImport:async()=>{throw Error("must not execute");}});
      assert.equal((await freshFetch("http://127.0.0.1:5131/")).status,200);
      assert.equal((await freshFetch("http://127.0.0.1:5131/health/ready")).status,503);await bootstrap.close();bootstrap=null;
    });
    await test("One-time runner stays in maintenance after import success or failure, without retry",async()=>{
      const file=path.join(root,"invented-manifest.json");fs.writeFileSync(file,JSON.stringify(manifest));
      for(const fail of [false,true]){
        let calls=0;bootstrap=await require("../../deploy/managed/minimal-import-runner.cjs").run({
          env:{REPLIT_DEPLOYMENT:"1",BQ_MINIMAL_OPERATION:"owner-approved-import-once",BQ_MANAGED_MANIFEST_FILE:file},port:5131,
          executeImport:async()=>{calls++;if(fail)throw Object.assign(Error("invented"),{code:"minimal_invented_failure"});return {employees:6311,accounts:8,replayed:false};}});
        await sleep(100);assert.equal(calls,1);assert.equal((await freshFetch("http://127.0.0.1:5131/api/login")).status,503);
        assert.equal((await freshFetch("http://127.0.0.1:5131/health/ready")).status,503);await bootstrap.close();bootstrap=null;
      }
    });
    await test("Approval binding preparation refuses missing protected audit key before source reads",()=>
      assert.rejects(require("./minimal-bindings.cjs").bindings({configFile:"not-read",auditHex:""}),/minimal_protected_audit_key_required/));
    await test("Approval preparation emits only fingerprints and aggregates, not records or keys",async()=>{
      const file=path.join(root,"designated.replit");fs.writeFileSync(file,'[objectStorage]\ndefaultBucketID = "invented-source"\n');
      const client={exists:async()=>({ok:true,value:true}),downloadAsText:async name=>({ok:true,value:raw[name.slice(5)]})};
      const output=await require("./minimal-bindings.cjs").bindings({configFile:file,client,auditHex:auditKey.toString("hex")});
      assert.equal(output.minimal.sourceFingerprint,source.fingerprint);assert.equal(output.observations.counts.employees,6311);
      assert.equal(output.keys.session,cfg.sha(key));assert.equal(output.observations.executionAuthorized,false);
      const text=JSON.stringify(output);assert.equal(text.includes(key),false);assert.equal(text.includes(backup),false);
      assert.doesNotMatch(text,/"hash":|"salt":|"sessionKey":|"backupKey":|"employees":\[/);
    });
    if(originalPort===undefined)delete process.env.PORT;else process.env.PORT=originalPort;
    if(originalHost===undefined)delete process.env.HOST;else process.env.HOST=originalHost;
    console.log(JSON.stringify({suite:"minimal-cutover-guards",pass:results.length,fail:0,provider:"mock only",productionTouched:false}));
  }catch(e){console.error(JSON.stringify({failed:e.code||e.message,assertion:e.message,results}));process.exitCode=1;}
  finally{if(bootstrap)await bootstrap.close();fs.rmSync(root,{recursive:true,force:true});}
})();
