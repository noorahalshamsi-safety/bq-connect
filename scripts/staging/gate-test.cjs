// Staging activation gate: one accepted invented binding, then every single
// deviation must refuse. Runs in a private temp root; no provider is contacted.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const gate=require("../../deploy/staging/gate.cjs");
const workspace=path.resolve(__dirname,"../..");
const hex=n=>crypto.randomBytes(n).toString("hex");
const results=[];
function check(id,name,fn){try{results.push({id,name,result:"PASS",detail:fn()});}catch(e){results.push({id,name,result:"FAIL",detail:e.message});}}
function expect(code,fn){try{fn();}catch(e){if(e.message===code)return code;throw Error(`expected ${code}, got ${e.message}`);}throw Error(`expected ${code}, gate accepted`);}

const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-staging-gate-"));
try{
  fs.mkdirSync(path.join(root,"deploy","staging"),{recursive:true});
  const writeReplit=bucket=>fs.writeFileSync(path.join(root,".replit"),`[objectStorage]\ndefaultBucketID = "${bucket}"\n`);
  writeReplit("invented-staging-bucket");
  const productionReplId="invented-production-repl",productionOrigin="https://production.invalid";
  const production={replIdSha256:gate.sha(productionReplId),originSha256:gate.sha(productionOrigin),bucketSha256s:[gate.sha("invented-production-bucket")],databaseHostSha256s:[gate.sha("prod-db.invalid")]};
  fs.writeFileSync(path.join(root,"deploy","staging","production-identity.json"),JSON.stringify(production));
  const sessionKey=hex(48),backupKey=hex(32),ca="-----BEGIN CERTIFICATE-----\ninvented\n-----END CERTIFICATE-----\n";
  const manifest={kind:"BQ_STAGING_SYNTHETIC",dataset:`staging-synthetic-${crypto.randomUUID()}`,
    app:{replId:"invented-staging-repl",origin:"https://staging.invalid"},
    database:{host:"staging-db.invalid",port:5432,name:"bq_staging_rehearsal",caSha256:gate.sha(ca)},
    bucket:"invented-staging-bucket",keys:{session:gate.sha(sessionKey),backup:gate.sha(backupKey)},approval:"STG-INVENTED-001"};
  const approval={id:"STG-INVENTED-001",operations:["staging-migrate","staging-activate"],approvedBy:"invented reviewer",
    approvedAt:"2026-11-04T00:00:00Z",expires:"2099-01-01T00:00:00Z",binding:gate.binding(manifest)};
  const writeApprovals=list=>fs.writeFileSync(path.join(root,"deploy","staging","approvals.json"),JSON.stringify({approvals:list}));
  writeApprovals([approval]);
  const baseEnv={REPL_ID:manifest.app.replId,BQ_STAGING_MANIFEST:JSON.stringify(manifest),BQ_STAGING_SESSION_KEY:sessionKey,BQ_STAGING_BACKUP_KEY:backupKey,BQ_STAGING_DB_CA:ca,REPLIT_DEPLOYMENT:"1"};
  const attempt=(changes={},operation="staging-activate",m=manifest)=>{
    const env={...baseEnv,BQ_STAGING_MANIFEST:JSON.stringify(m),...changes};
    for(const [k,v] of Object.entries(env))if(v===undefined)delete env[k];
    return gate.verify({operation,env,root});
  };
  const variant=(edit)=>{const m=JSON.parse(JSON.stringify(manifest));edit(m);return m;};

  check("G01","Exact approved binding is accepted inside a deployment",()=>{
    const p=attempt();
    if(!p.verifiedStaging||p.database.ssl.rejectUnauthorized!==true||p.dataset!==manifest.dataset)throw Error("incomplete proof");
    return `proof for ${p.operation}; TLS verification required`;});
  check("G02","Committed repository state refuses every operation",()=>expect("production_identity_unrecorded",()=>gate.verify({operation:"staging-activate",env:baseEnv,root:workspace})));
  const refusals=[
    ["G03","Missing manifest","staging_manifest_missing",()=>attempt({BQ_STAGING_MANIFEST:undefined})],
    ["G04","Production-style identity kind","staging_identity_required",()=>attempt({},undefined,variant(m=>m.kind="BQ_SYNTHETIC_ONLY"))],
    ["G05","Non-synthetic dataset id","synthetic_dataset_required",()=>attempt({},undefined,variant(m=>m.dataset="employees-2026"))],
    ["G06","Process is not the approved staging app","staging_app_identity_mismatch",()=>attempt({REPL_ID:"some-other-repl"})],
    ["G07","Production app identity","production_identity_refused",()=>attempt({REPL_ID:productionReplId},undefined,variant(m=>m.app.replId=productionReplId))],
    ["G08","Production origin","production_identity_refused",()=>attempt({},undefined,variant(m=>m.app.origin=productionOrigin))],
    ["G09","Recorded production bucket","production_bucket_refused",()=>attempt({},undefined,variant(m=>m.bucket="invented-production-bucket"))],
    ["G10","Recorded production database host","production_database_refused",()=>attempt({},undefined,variant(m=>m.database.host="prod-db.invalid"))],
    ["G11","Database name outside staging namespace","staging_database_binding_required",()=>attempt({},undefined,variant(m=>m.database.name="bq_production"))],
    ["G12","Production provider secret present","production_secret_present",()=>attempt({SMTP_PASS:"x"})],
    ["G13","Session key differs from approved fingerprint","staging_key_fingerprint_mismatch",()=>attempt({BQ_STAGING_SESSION_KEY:hex(48)})],
    ["G14","Backup key missing","staging_keys_required",()=>attempt({BQ_STAGING_BACKUP_KEY:undefined})],
    ["G15","Database CA differs from approved fingerprint","staging_database_ca_mismatch",()=>attempt({BQ_STAGING_DB_CA:"-----BEGIN CERTIFICATE-----\nother\n-----END CERTIFICATE-----\n"})],
    ["G16","Operation not in approval scope","staging_approval_scope_refused",()=>attempt({},"staging-backup")],
    ["G17","Unknown operation","staging_operation_unknown",()=>attempt({},"production-activate")],
    ["G18","Approval for a different binding (changed database port)","staging_approval_binding_mismatch",()=>attempt({},undefined,variant(m=>m.database.port=5433))],
  ];
  for(const [id,name,code,fn] of refusals)check(id,`Refuses: ${name}`,()=>expect(code,fn));
  check("G19","Refuses: expired approval",()=>{writeApprovals([{...approval,expires:"2020-01-01T00:00:00Z"}]);try{return expect("staging_approval_expired",()=>attempt());}finally{writeApprovals([approval]);}});
  check("G20","Refuses: approval without a named approver",()=>{writeApprovals([{...approval,approvedBy:""}]);try{return expect("staging_approval_scope_refused",()=>attempt());}finally{writeApprovals([approval]);}});
  check("G21","Refuses: legacy employee data directory present",()=>{
    fs.mkdirSync(path.join(root,"data"));fs.writeFileSync(path.join(root,"data","accounts.json"),"{}");
    try{return expect("employee_dataset_present",()=>attempt());}finally{fs.rmSync(path.join(root,"data"),{recursive:true});}});
  check("G23","Refuses: Repl still configured with the inherited production bucket",()=>{
    writeReplit("invented-production-bucket");
    try{return expect("staging_bucket_binding_mismatch",()=>attempt());}finally{writeReplit("invented-staging-bucket");}});
  check("G24","Refuses: production bucket fingerprints not recorded",()=>{
    const file=path.join(root,"deploy","staging","production-identity.json");
    fs.writeFileSync(file,JSON.stringify({...production,bucketSha256s:[]}));
    try{return expect("production_identity_unrecorded",()=>attempt());}finally{fs.writeFileSync(file,JSON.stringify(production));}});
  check("G25","Accepts a staging Repl whose configured bucket is the approved one, and one with none configured",()=>{
    attempt();fs.rmSync(path.join(root,".replit"));
    try{attempt();return "both accepted";}finally{writeReplit("invented-staging-bucket");}});
  check("G22","Development fence still refuses inside a deployment",()=>{
    const saved=process.env.REPLIT_DEPLOYMENT;process.env.REPLIT_DEPLOYMENT="1";
    try{return expect("production_activation_forbidden",()=>require("../../development/postgres/isolation.cjs").prepare());}
    finally{if(saved===undefined)delete process.env.REPLIT_DEPLOYMENT;else process.env.REPLIT_DEPLOYMENT=saved;}});
}finally{fs.rmSync(root,{recursive:true,force:true});}
for(const r of results)console.log(`${r.id} ${r.result.padEnd(4)} ${r.name} — ${r.detail}`);
const failed=results.filter(r=>r.result!=="PASS").length;
console.log(`staging-gate: ${results.length-failed}/${results.length} PASS`);
process.exit(failed?1:0);
