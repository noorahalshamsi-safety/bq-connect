// Runtime-only configuration. DATABASE_URL is consumed, never printed or persisted.
const crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const issued=new WeakMap(),HEX=/^[0-9a-f]{64}$/;
function fail(code){throw Object.assign(Error(code),{code});}
function endpoint(env,profile){
  if(!env.DATABASE_URL)fail("managed_connection_missing");
  let url;try{url=new URL(env.DATABASE_URL);}catch{fail("managed_connection_invalid");}
  if(!["postgres:","postgresql:"].includes(url.protocol)||!url.hostname||!url.pathname.slice(1))fail("managed_connection_invalid");
  if(profile==="development"&&url.hostname!=="helium")fail("managed_development_endpoint_refused");
  if(profile==="production"&&["helium","localhost","127.0.0.1","::1"].includes(url.hostname))fail("managed_production_endpoint_refused");
  for(const key of url.searchParams.keys())if(!["sslmode","channel_binding"].includes(key))fail("managed_connection_option_unreviewed");
  if(profile==="production"&&["disable","no-verify","allow","prefer"].includes(url.searchParams.get("sslmode")))fail("managed_tls_downgrade_refused");
  url.searchParams.delete("sslmode");url.searchParams.delete("channel_binding");
  return {url,identity:sha(canonical([env.REPL_ID,url.hostname,url.port||"5432",url.pathname,url.username]))};
}
function verify({env=process.env,manifest,paths={},approvalRoot=__dirname}={}){
  if(!manifest||manifest.kind!=="BQ_REPLIT_MANAGED_V1")fail("managed_manifest_required");
  const profile=manifest.environment;
  if(!["development","production"].includes(profile))fail("managed_environment_invalid");
  if(!env.REPL_ID||sha(env.REPL_ID)!==manifest.appFingerprint)fail("managed_app_identity_mismatch");
  if(env.REPLIT_DEPLOYMENT&&!["0","1"].includes(env.REPLIT_DEPLOYMENT))fail("managed_deployment_marker_invalid");
  if((env.REPLIT_DEPLOYMENT==="1")!==(profile==="production"))fail("managed_environment_mismatch");
  const e=endpoint(env,profile);
  if(e.identity!==manifest.endpointFingerprint)fail("managed_database_identity_mismatch");
  const prefix=profile==="development"?"staging-synthetic":"managed-production";
  if(!new RegExp(`^${prefix}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`).test(manifest.dataset||""))fail("managed_dataset_identity_invalid");
  for(const name of ["schemaFingerprint","releaseFingerprint","permissionsFingerprint"])if(!HEX.test(manifest[name]||""))fail("managed_contract_missing");
  const sessionKey=env.BQ_MANAGED_SESSION_KEY,backupKey=env.BQ_MANAGED_BACKUP_KEY;
  if(!/^[0-9a-f]{96}$/.test(sessionKey||"")||!/^[0-9a-f]{64}$/.test(backupKey||"")||
    sha(sessionKey)!==manifest.keys?.session||sha(backupKey)!==manifest.keys?.backup)fail("managed_key_identity_mismatch");
  if(!/^[a-zA-Z0-9_-]{3,128}$/.test(manifest.bucket||""))fail("managed_bucket_required");
  if(profile==="development"&&(!manifest.mockStorage||!manifest.productionBucketFingerprint||
    sha(manifest.bucket)===manifest.productionBucketFingerprint))fail("managed_development_storage_refused");
  if(profile==="production"){
    if(sha(manifest.bucket)!==manifest.productionBucketFingerprint)fail("managed_production_bucket_mismatch");
    if(manifest.mockStorage||!HEX.test(manifest.developmentEndpointFingerprint||"")||
      e.identity===manifest.developmentEndpointFingerprint||manifest.permissionApproval!=="reviewed-managed-runtime-capabilities")fail("managed_production_binding_incomplete");
    for(const name of ["source","backup","reconciliation","custody","rollback","frozenGeneration"])if(!HEX.test(manifest.release?.[name]||""))fail("managed_cutover_evidence_missing");
    const approvals=JSON.parse(fs.readFileSync(path.join(approvalRoot,"production-approvals.json"),"utf8")).approvals;
    if(!approvals.some(a=>a.id===manifest.approval&&a.operation==="managed-production-activate"&&a.binding===sha(canonical(manifest))&&
      typeof a.approvedBy==="string"&&a.approvedBy.length&&Number.isFinite(Date.parse(a.expires))&&Date.parse(a.expires)>Date.now()))fail("managed_production_approval_missing");
  }
  const seal=sha(canonical([manifest.dataset,manifest.keys.session,manifest.keys.backup]));
  const proof=Object.freeze({verifiedManaged:true,profile,dataset:manifest.dataset,seal,sessionKey,backupKey,bucket:manifest.bucket,
    schemaFingerprint:manifest.schemaFingerprint,releaseFingerprint:manifest.releaseFingerprint,
    permissionsFingerprint:manifest.permissionsFingerprint,endpointFingerprint:e.identity,
    root:paths.root,app:paths.app,objects:paths.objects});
  // Explicit SSL overrides URL sslmode without allowing node-postgres to replace
  // the verification object. Helium is internal/plaintext; published TLS is strict.
  issued.set(proof,{connectionString:e.url.toString(),ssl:profile==="development"?false:
    {rejectUnauthorized:true,servername:e.url.hostname,minVersion:"TLSv1.2"},enableChannelBinding:profile==="production",
    max:Math.min(6,Math.max(1,Number(env.BQ_MANAGED_POOL_MAX)||4)),connectionTimeoutMillis:5000,idleTimeoutMillis:10000,
    statement_timeout:20000,lock_timeout:12000,application_name:`bq-managed-${profile}`});
  return proof;
}
function assertProof(proof){if(!issued.has(proof)||!Object.isFrozen(proof))fail("managed_verified_proof_required");}
function poolOptions(proof){assertProof(proof);return {...issued.get(proof)};}
async function permissions(client){
  const row=(await client.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,
    has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
    has_schema_privilege(current_user,'dev','CREATE') AS schema_create,
    EXISTS(SELECT 1 FROM pg_roles p WHERE p.rolname<>current_user AND (p.rolsuper OR p.rolcreaterole OR p.rolbypassrls) AND pg_has_role(current_user,p.oid,'MEMBER')) AS elevated_membership
    FROM pg_roles WHERE rolname=current_user`)).rows[0];
  return {capabilities:row,fingerprint:sha(canonical(row))};
}
async function verifyDatabase(client,proof){
  assertProof(proof);
  if(proof.profile==="production"&&(!client.connection.stream.encrypted||!client.connection.stream.authorized))fail("managed_verified_tls_required");
  const p=await permissions(client);
  if(p.fingerprint!==proof.permissionsFingerprint)fail("managed_permissions_changed");
  return p;
}
module.exports={verify,poolOptions,assertProof,endpoint,permissions,verifyDatabase,sha,canonical,fail};
