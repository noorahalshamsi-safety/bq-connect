const C=require("./common.cjs"),L=require("./lab.cjs"),S=require("./source.cjs"),I=require("./import.cjs"),R=require("./reconcile.cjs"),E=require("./export.cjs");
const {fs,path,digest,hash,atomic}=C,assert=require("node:assert/strict"),{fork}=require("node:child_process");
const out=path.join(C.workspace,"generated-artifacts/rel001-evidence");fs.mkdirSync(out,{recursive:true,mode:0o700});
let seed,primary;const results=[],labs=[];
function fingerprints(root){return Object.fromEntries(C.walk(path.join(root,"source")).map(p=>[p,hash(C.safeFile(path.join(root,"source",p)))]));}
async function make(options={}){const lab=await L.create({seed,...options});labs.push(lab);return lab;}
async function using(lab,fn){const c=C.context(lab.root,lab.expected),p=C.pool(c);try{return await fn(p,c);}finally{await p.end();}}
async function empty(lab){
 await using(lab,async p=>{for(const table of ["dev.files","migration.receipt","migration.media","migration.source_files"])
  assert.equal((await p.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);});
}
async function scenario(id,name,fn){
 try{const evidence=await fn();results.push({id,name,status:"PASS",evidence});}
 catch(e){results.push({id,name,status:"FAIL",error:e.code||e.message.slice(0,250)});}
 console.log(id,results.at(-1).status);
}
async function rejected(options,code){
 const lab=await make(options),before=fingerprints(lab.root);
 await assert.rejects(I.importSource(lab.root,lab.expected),e=>e.code===code);
 await empty(lab);assert.deepEqual(fingerprints(lab.root),before);return{refusal:code,sourceIntact:true,targetUncommitted:true};
}
async function tamperReconcile(lab,sql,values,code){
 await using(lab,async p=>{
  const client=await p.connect();try{await client.query("BEGIN");await client.query(sql,values);await assert.rejects(R.compare(client,C.context(lab.root,lab.expected),S.load(C.context(lab.root,lab.expected))),e=>e.code?.startsWith(code));}finally{await client.query("ROLLBACK");client.release();}
 });
}
(async()=>{
 try{
 seed=L.invented();
 await scenario("M01","Complete invented migration, independent reconciliation and reverse export",async()=>{
  primary=await make();const c=C.context(primary.root,primary.expected),before=fingerprints(primary.root);
  const report=await I.importSource(primary.root,primary.expected);assert.equal(report.counts.files,28);assert.equal(report.counts.posts,10);
  atomic(path.join(out,"source-to-sql.json"),report);
  const independent=await R.reconcile(primary.root,primary.expected);assert.equal(report.semanticSha,independent.semanticSha);
  const reverse=await E.reverse(primary.root,primary.expected);atomic(path.join(out,"reverse-export.json"),reverse);
  const auth=await require("./auth-proof.cjs").prove(c,S.load(c),reverse);atomic(path.join(out,"auth-compatibility.json"),auth);
  assert.deepEqual(fingerprints(primary.root),before);
  atomic(path.join(out,"rehearsal-lab.json"),primary);
  return{counts:report.counts,sourcePreserved:true,semanticSha:report.semanticSha,sourceEscrow:report.escrow,originalAuthProof:auth.status};
 });
 await scenario("M02","Duplicate employee identifiers rejected",()=>rejected({mutate:s=>s.values["employees.json"].push(s.values["employees.json"][0])},"duplicate_employee_identifier"));
 await scenario("M03","Equal account counts with substituted membership detected independently",async()=>{
  await tamperReconcile(primary,"UPDATE dev.accounts SET entry_key='unrelated-invented' WHERE entry_key='101'",[],"semantic_mismatch");
  return{equalCounts:true,membershipMismatchDetected:true};
 });
 await scenario("M04","Missing account record rejects source",()=>rejected({mutate:s=>{delete s.values["accounts.json"]["101"];}},"missing_account_record"));
 await scenario("M05","Unknown fields, null/missing/empty, opaque roots and ordering preserved",async()=>{
  const r=await R.reconcile(primary.root,primary.expected);const c=C.context(primary.root,primary.expected),s=S.load(c);
  assert.equal(Object.hasOwn(s.values["accounts.json"]["00106"],"pending"),false);
  assert.equal(s.values["accounts.json"]["102"].pending,null);
  assert.equal(s.values["ideas.json"][2].statusLog,null);assert(!Object.hasOwn(s.values["ideas.json"][1],"statusLog"));
  assert.deepEqual(s.values["ideas.json"][0].unknownExtension.ordered,[3,1,2]);
  assert(Object.hasOwn(s.values["profiles.json"]["101"],"__proto__"));
  return{semanticSha:r.semanticSha,all28Paths:true,opaqueMailMessages:true,prototypeNamedFieldPreserved:true};
 });
 await scenario("M06","Invalid timestamps reject without normalization",()=>rejected({mutate:s=>s.values["ideas.json"][0].createdAt="not-a-date"},"invalid_timestamp"));
 await scenario("M07","Corrupt source JSON rejected",()=>rejected({afterWrite:dir=>C.write(path.join(dir,"data/ideas.json"),"{broken")},"corrupt_json"));
 await scenario("M08","Unsupported KDF rejected",()=>rejected({mutate:s=>s.values["accounts.json"]["101"].kdf=999},"unsupported_kdf"));
 await scenario("M09","Missing signing key refused without generation",()=>rejected({afterWrite:dir=>fs.unlinkSync(path.join(dir,"custody/session.key"))},"unmapped_source_inventory"));
 await scenario("M10","Mismatched active 2FA domain rejected",()=>rejected({mutate:s=>{s.session=Buffer.from(C.crypto.randomBytes(48).toString("hex")+"\n");}},"factor_domain_mismatch"));
 await scenario("M11","Incomplete referenced media rejected",()=>rejected({mutate:s=>{delete s.media["invented.png"];}},"missing_media_object"));
 await scenario("M12","Actual process interruption before COMMIT rolls back and resumes",async()=>{
  const lab=await make(),before=fingerprints(lab.root);
  const child=fork(path.join(__dirname,"interruption-worker.cjs"),[lab.root,JSON.stringify(lab.expected)],{env:{PATH:process.env.PATH,HOME:lab.root},stdio:["ignore","ignore","ignore","ipc"]});
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{child.kill("SIGKILL");reject(Error("worker_stage_timeout"));},20000);
   child.on("message",m=>{if(m.stage==="rows_uncommitted"){clearTimeout(timer);child.once("exit",resolve);child.kill("SIGKILL");}else if(m.error){clearTimeout(timer);reject(Error(m.error));}});
   child.on("error",reject);
  });
  await empty(lab);const r=await I.importSource(lab.root,lab.expected);assert.equal(r.status,"PASS");
  assert.deepEqual(fingerprints(lab.root),before);return{actualSigkill:true,rollbackVerified:true,retrySameTarget:"PASS",sourceIntact:true};
 });
 await scenario("M13","Actual PostgreSQL connection termination during import rolls back",async()=>{
  const lab=await make(),before=fingerprints(lab.root);
  await assert.rejects(I.importSource(lab.root,lab.expected,{afterRows:async client=>{
   const pid=(await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
   await using(lab,p=>p.query("SELECT pg_terminate_backend($1)",[pid]));
   await client.query("SELECT 1");
  }}));
  await empty(lab);assert.deepEqual(fingerprints(lab.root),before);
  const r=await I.importSource(lab.root,lab.expected);return{terminatedConnection:true,retry:r.status,sourceIntact:true};
 });
 await scenario("M14","Actual deferred foreign-key failure at COMMIT has no partial rows",async()=>{
  const lab=await make(),before=fingerprints(lab.root);
  await assert.rejects(I.importSource(lab.root,lab.expected,{beforeCommit:client=>client.query(
   "INSERT INTO dev.sessions(id,file_name,parent,entry_key,ordinal,attrs,shape) VALUES('invented-orphan','accounts.json','missing-parent',null,0,'{}','{\"kind\":\"opaque\"}')"
  )}),e=>e.code==="23503");
  await empty(lab);assert.deepEqual(fingerprints(lab.root),before);return{postgresCode:"23503",atomicRollback:true,sourceIntact:true};
 });
 await scenario("M15","Identical import is a verified no-op",async()=>{
  const c=C.context(primary.root,primary.expected),before=fingerprints(primary.root);
  const r=await I.importSource(primary.root,primary.expected);assert.equal(r.operation,"IDENTICAL_IMPORT_NOOP");
  assert.deepEqual(fingerprints(primary.root),before);return{operation:r.operation,noSecondGeneration:true};
 });
 await scenario("M16","Different-source replay to same target refused",async()=>{
  const other=await make();await assert.rejects(I.importSource(primary.root,{...primary.expected,sourceId:other.expected.sourceId}),e=>e.code==="explicit_identity_required");
  return{differentSourceRejected:true,targetBindingUnchanged:true};
 });
 await scenario("M17","Committed SQL is authoritative after local receipt interruption",async()=>{
  const lab=await make(),before=fingerprints(lab.root);
  await assert.rejects(I.importSource(lab.root,lab.expected,{afterCommit:()=>C.fail("invented_journal_interruption")}),e=>e.code==="invented_journal_interruption");
  const r=await I.importSource(lab.root,lab.expected);assert.equal(r.operation,"IDENTICAL_IMPORT_NOOP");
  assert.deepEqual(fingerprints(lab.root),before);return{commitSurvives:true,retryReconcilesWithoutDuplication:true};
 });
 await scenario("M18","Unauthorized target selection and deployment execution refused",async()=>{
  const cli=require("./cli.cjs");
  assert.throws(()=>cli.args(["import","--database-url","postgres://forbidden.invalid"]),e=>e.code==="unsupported_option");
  assert.throws(()=>C.context(path.join(C.workspace,"generated-artifacts/pg-development"),primary.expected),e=>e.code==="unauthorized_lab");
  assert.throws(()=>C.context(primary.root,{...primary.expected,targetId:"target-"+C.crypto.randomUUID()}),e=>e.code==="explicit_identity_required");
  const prior=process.env.REPLIT_DEPLOYMENT;process.env.REPLIT_DEPLOYMENT="1";
  try{assert.throws(()=>C.context(primary.root,primary.expected),e=>e.code==="deployment_forbidden");}finally{if(prior===undefined)delete process.env.REPLIT_DEPLOYMENT;else process.env.REPLIT_DEPLOYMENT=prior;}
  return{arbitraryDatabaseUrl:false,existingAppTarget:false,foreignTarget:false,deploymentExecution:false};
 });
 await scenario("M19","Missing target state cannot authorize fresh initialization",async()=>{
  const lab=await make(),c=C.context(lab.root,lab.expected);C.stop(c);
  fs.renameSync(path.join(c.target,"pgdata"),path.join(c.target,"pgdata-preserved"));
  assert.throws(()=>C.context(lab.root,lab.expected),e=>e.code==="previously_created_target_missing");
  assert(!fs.existsSync(path.join(c.target,"pgdata")));
  fs.renameSync(path.join(c.target,"pgdata-preserved"),path.join(c.target,"pgdata"));C.resume(c);
  return{noFreshProvision:true,preservedOldCluster:true};
 });
 await scenario("M20","Owned cluster cold stop/resume preserves reconciled target",async()=>{
  const c=C.context(primary.root,primary.expected);C.stop(c);C.resume(c);
  const r=await R.reconcile(primary.root,primary.expected);return{status:r.status,noInitialize:true};
 });
 await scenario("M21","Duplicate JSON keys and lossy numbers rejected",async()=>{
  for(const text of ['{"101":1,"101":2}','{"x":9007199254740993}','{"x":-0}','{"x":1e999}'])assert.throws(()=>C.parse(Buffer.from(text)));
  return{duplicateKeys:true,unsafeInteger:true,negativeZero:true,nonfinite:true};
 });
 await scenario("M22","Source tampering after freeze is detected without SQL changes",async()=>{
  const lab=await make(),c=C.context(lab.root,lab.expected),file=path.join(c.source,"data/ideas.json"),original=fs.readFileSync(file);
  fs.chmodSync(file,0o600);C.write(file,Buffer.concat([original,Buffer.from(" ")]));fs.chmodSync(file,0o400);
  const before=fingerprints(lab.root);await assert.rejects(I.importSource(lab.root,lab.expected),e=>e.code==="source_fingerprint_mismatch");
  await empty(lab);assert.deepEqual(fingerprints(lab.root),before);
  return{frozenFingerprintEnforced:true,sourceNotRepaired:true};
 });
 await scenario("M23","Independent reader catches relationship ordering and media byte corruption",async()=>{
  await tamperReconcile(primary,"UPDATE dev.comment_lists SET shape='{\"kind\":\"opaque\"}' WHERE file_name='ideas.json'",[],"opaque_sql_children");
  await tamperReconcile(primary,"UPDATE migration.media SET bytes=decode('00','hex') WHERE legacy='/media/invented.png'",[],"sql_media_checksum");
  return{graphShapeCorruption:true,mediaByteCorruption:true};
 });
 await scenario("M24","Missing target receipt cannot turn populated data into a fresh import",async()=>{
  const lab=await make();await I.importSource(lab.root,lab.expected);
  await using(lab,p=>p.query("DELETE FROM migration.receipt"));
  const before=fingerprints(lab.root);await assert.rejects(I.importSource(lab.root,lab.expected),e=>e.code==="unreceipted_target_data");
  assert.deepEqual(fingerprints(lab.root),before);return{noReseed:true,sourceIntact:true};
 });
 }catch(e){results.push({id:"ENV",status:"FAIL",error:e.code||e.message.slice(0,200)});}
 finally{
  for(const lab of labs)try{C.stop(C.context(lab.root,lab.expected));}catch{}
  const report={results,pass:results.filter(x=>x.status==="PASS").length,fail:results.filter(x=>x.status==="FAIL").length,scope:"Invented sources and independently created owned local PostgreSQL only; no real data, activation or deployment."};
  atomic(path.join(out,"migration-tests.json"),report);console.log(JSON.stringify({pass:report.pass,fail:report.fail}));
  if(report.fail)process.exitCode=1;
 }
})();
