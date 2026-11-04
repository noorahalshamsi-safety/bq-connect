// Read-only binding check for the staging Repl shell, run before publishing.
// Prints identities and counts only, never secrets; exits non-zero on refusal.
// `--verify-media` also reads back and hashes every referenced bucket object.
const {Client}=require("pg");
const gate=require("./gate.cjs"),{fromProof}=require("./object-store.cjs"),{requireCurrent}=require("./migrate.cjs");
async function preflight({env=process.env,root,store,verifyMedia=false}={}) {
  const proof=gate.verify({operation:"staging-activate",env,root});
  if(!env.BQ_STAGING_APP_PASSWORD)throw Error("app_credential_missing");
  if(env.BQ_STAGING_MIGRATOR_PASSWORD)throw Error("migrator_credential_present_at_runtime");
  store=store||fromProof(proof);
  const receipt=await store.readControl("provision-receipt.json");
  if(!receipt)throw Error("staging_not_provisioned");
  if(receipt.dataset!==proof.dataset||receipt.seal!==proof.seal||receipt.state!=="committed")throw Error("synthetic_provision_not_committed");
  const {ssl,...database}=proof.database;
  const c=new Client({...database,ssl:{...ssl},user:"bq_app",password:env.BQ_STAGING_APP_PASSWORD,connectionTimeoutMillis:5000,application_name:"bq-staging-preflight"});
  await c.connect();
  try{
    const schema=await requireCurrent(c);
    const tls=(await c.query("SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()")).rows[0];
    if(!tls?.ssl)throw Error("database_connection_not_encrypted");
    const role=(await c.query(`SELECT current_user AS name,r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls AS privileged,
      has_schema_privilege('dev','CREATE') OR has_database_privilege(current_database(),'CREATE') AS can_create
      FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
    if(role.name!=="bq_app"||role.privileged||role.can_create)throw Error("runtime_identity_not_restricted");
    const authority=(await c.query("SELECT dataset_id,seal FROM dev.authority")).rows[0];
    if(!authority||authority.dataset_id!==proof.dataset||authority.seal!==proof.seal)throw Error("synthetic_authority_refused");
    const media=(await c.query("SELECT object_key,sha256 FROM dev.media WHERE state IN('ready','retained') ORDER BY object_key")).rows;
    const files=(await c.query("SELECT name,revision FROM dev.files ORDER BY name")).rows;
    let verified=0;
    if(verifyMedia)for(const row of media){await store.read(row.object_key,row.sha256);verified++;}
    // Compared before/after republish and restore; derived from names and revisions only.
    const state=gate.sha(`${files.map(f=>`${f.name}:${f.revision}`).join(",")}|${media.map(m=>`${m.object_key}:${m.sha256}`).join(",")}`);
    return {dataset:proof.dataset,approval:proof.approval,bucket:proof.bucket,
      database:{host:proof.database.host,name:proof.database.database,tls:tls.version,role:role.name},
      schema,files:files.length,media:media.length,mediaVerified:verifyMedia?verified:"skipped",state};
  }finally{await c.end().catch(()=>{});}
}
module.exports={preflight};
if(require.main===module)preflight({verifyMedia:process.argv.includes("--verify-media")})
  .then(r=>console.log(JSON.stringify(r,null,2)))
  .catch(e=>{console.error(`staging preflight refused: ${e.code||e.message}`);process.exit(1);});
