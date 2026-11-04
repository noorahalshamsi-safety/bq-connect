const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const c=require("../../deploy/managed/config.cjs"),schema=require("../../deploy/managed/schema.cjs");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-managed-config-"));
const key=crypto.randomBytes(48).toString("hex"),backup=crypto.randomBytes(32).toString("hex");
const env={REPL_ID:"invented-managed-app",DATABASE_URL:"postgresql://invented:invented@helium/heliumdb",BQ_MANAGED_SESSION_KEY:key,BQ_MANAGED_BACKUP_KEY:backup};
const base={kind:"BQ_REPLIT_MANAGED_V1",environment:"development",appFingerprint:c.sha(env.REPL_ID),endpointFingerprint:c.endpoint(env,"development").identity,
  dataset:`staging-synthetic-${crypto.randomUUID()}`,bucket:"invented-isolated-bucket",mockStorage:true,productionBucketFingerprint:c.sha("invented-live-bucket"),
  keys:{session:c.sha(key),backup:c.sha(backup)},schemaFingerprint:"a".repeat(64),releaseFingerprint:schema.releaseFingerprint,permissionsFingerprint:"b".repeat(64)};
const results=[];
function test(name,fn){try{fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",code:e.code||e.message});}}
const verify=(m=base,e=env)=>c.verify({env:e,manifest:m,approvalRoot:root});
const rejected=(m,e,code)=>assert.throws(()=>verify(m,e),{code});
test("Helium internal transport and bounded pool",()=>{const p=verify(),o=c.poolOptions(p);assert.equal(o.ssl,false);assert.equal(o.max,4);assert(Object.isFrozen(p));assert(!JSON.stringify(p).includes("postgresql://"));});
test("Forged proofs cannot construct a connection",()=>assert.throws(()=>c.poolOptions(Object.freeze({verifiedManaged:true})),{code:"managed_verified_proof_required"}));
test("Development manifest cannot run in deployment",()=>rejected(base,{...env,REPLIT_DEPLOYMENT:"1"},"managed_environment_mismatch"));
test("Workspace REPLIT_ENVIRONMENT is not deployment identity",()=>assert(verify(base,{...env,REPLIT_ENVIRONMENT:"production"})));
test("Different app is refused",()=>rejected(base,{...env,REPL_ID:"other"},"managed_app_identity_mismatch"));
test("Different database is refused",()=>rejected(base,{...env,DATABASE_URL:"postgresql://invented:invented@helium/other"},"managed_database_identity_mismatch"));
test("External development endpoint is refused",()=>rejected(base,{...env,DATABASE_URL:"postgresql://invented:invented@example.invalid/db"},"managed_development_endpoint_refused"));
test("Missing keys cannot regenerate",()=>rejected(base,{...env,BQ_MANAGED_SESSION_KEY:undefined},"managed_key_identity_mismatch"));
test("Changed key fails identity",()=>rejected(base,{...env,BQ_MANAGED_BACKUP_KEY:"f".repeat(64)},"managed_key_identity_mismatch"));
test("Production bucket cannot be used for development",()=>rejected({...base,productionBucketFingerprint:c.sha(base.bucket)},env,"managed_development_storage_refused"));
test("Unreviewed connection options refused",()=>rejected(base,{...env,DATABASE_URL:env.DATABASE_URL+"?options=unreviewed"},"managed_connection_option_unreviewed"));
test("Managed schema contains no custom roles/functions/triggers/grants",()=>{assert(!/\b(CREATE ROLE|CREATE FUNCTION|CREATE TRIGGER|GRANT)\b/i.test(schema.statements.join("\n")));assert(!schema.statements.join("\n").includes("DEFERRABLE INITIALLY DEFERRED"));});
const penv={...env,REPLIT_DEPLOYMENT:"1",DATABASE_URL:"postgresql://invented:invented@production.invalid/db?sslmode=require"};
const pm={...base,bucket:"invented-live-bucket",environment:"production",dataset:`managed-production-${crypto.randomUUID()}`,mockStorage:false,
  endpointFingerprint:c.endpoint(penv,"production").identity,developmentEndpointFingerprint:base.endpointFingerprint,
  permissionApproval:"reviewed-managed-runtime-capabilities",approval:"invented-approval",release:Object.fromEntries(["source","backup","reconciliation","custody","rollback","frozenGeneration"].map(n=>[n,"c".repeat(64)]))};
fs.writeFileSync(path.join(root,"production-approvals.json"),JSON.stringify({approvals:[]}));
test("Production cannot inherit development approval",()=>rejected(pm,penv,"managed_production_approval_missing"));
test("Production evidence is mandatory",()=>rejected({...pm,release:{}},penv,"managed_cutover_evidence_missing"));
test("Production cannot adopt the development bucket",()=>rejected({...pm,bucket:base.bucket},penv,"managed_production_bucket_mismatch"));
test("TLS downgrade is refused",()=>rejected(pm,{...penv,DATABASE_URL:penv.DATABASE_URL.replace("require","disable")},"managed_tls_downgrade_refused"));
fs.writeFileSync(path.join(root,"production-approvals.json"),JSON.stringify({approvals:[{id:pm.approval,operation:"managed-production-activate",binding:c.sha(c.canonical(pm)),approvedBy:"invented test reviewer",expires:"2099-01-01T00:00:00Z"}]}));
test("Reviewed production configuration forces certificate and hostname validation",()=>{const o=c.poolOptions(verify(pm,penv));assert.equal(o.ssl.rejectUnauthorized,true);assert.equal(o.ssl.servername,"production.invalid");assert.equal(o.ssl.minVersion,"TLSv1.2");assert(!o.connectionString.includes("sslmode"));assert(o.enableChannelBinding);});
test("Modified production manifest invalidates approval",()=>rejected({...pm,permissionApproval:"reviewed-managed-runtime-capabilities",schemaFingerprint:"e".repeat(64)},penv,"managed_production_approval_missing"));
test("Runtime path options cannot override verified authority fields",()=>{const p=c.verify({env:penv,manifest:pm,approvalRoot:root,paths:{profile:"development",dataset:"wrong",verifiedManaged:false}});assert.equal(p.profile,"production");assert.equal(p.dataset,pm.dataset);assert.equal(p.verifiedManaged,true);});
test("Empty ledger check still retains strict legacy migration validation",()=>assert.throws(()=>require("../../deploy/staging/migrate.cjs").check(new Map([["unknown","0"]]))));
fs.rmSync(root,{recursive:true,force:true});
console.log(JSON.stringify({suite:"managed-config",pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,results}));
if(results.some(r=>r.status!=="PASS"))process.exitCode=1;
