// Staging activation gate. Not a generic flag: every staging operation must
// present an explicit staging identity, a synthetic dataset, provider bindings
// that differ from production, matching key fingerprints, and a reviewed
// approval record committed to deploy/staging/approvals.json.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const workspace=path.resolve(__dirname,"../..");
const sha=value=>crypto.createHash("sha256").update(String(value)).digest("hex");
const OPERATIONS=new Set(["staging-migrate","staging-activate","staging-backup"]);
// Production provider credentials never belong in a staging environment.
const PRODUCTION_SECRETS=["SMTP_HOST","SMTP_USER","SMTP_PASS","SMTP_PORT","TWILIO_SID","TWILIO_FROM","SMS_TOKEN",
  "BQ_EXPECTED_BUCKET_FINGERPRINT","BQ_EXPECTED_DATASET_ID","BQ_EXPECTED_GENERATION"];
const LEGACY_DATA=["accounts.json","employees.json","posts.json","security.json"];
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`:
  value&&typeof value==="object"?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`:JSON.stringify(value);
function binding(manifest){const {approval,...bound}=manifest;return sha(canonical(bound));}
function productionBucket(root){
  const config=path.join(root,".replit");
  if(!fs.existsSync(config))return null;
  return fs.readFileSync(config,"utf8").match(/^\s*defaultBucketID\s*=\s*"([^"]+)"/m)?.[1]||null;
}
function readJson(file,code){try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch{throw Error(code);}}
function verify({operation,env=process.env,root=workspace,now=Date.now()}={}) {
  if(!OPERATIONS.has(operation))throw Error("staging_operation_unknown");
  if(!env.BQ_STAGING_MANIFEST)throw Error("staging_manifest_missing");
  let manifest;try{manifest=JSON.parse(env.BQ_STAGING_MANIFEST);}catch{throw Error("staging_manifest_invalid");}
  const m=manifest||{},db=m.database||{},app=m.app||{},keys=m.keys||{};
  if(m.kind!=="BQ_STAGING_SYNTHETIC")throw Error("staging_identity_required");
  if(!/^staging-synthetic-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(m.dataset||""))throw Error("synthetic_dataset_required");
  if(!app.replId||!/^https:\/\/[a-z0-9.-]+$/i.test(app.origin||""))throw Error("staging_app_identity_required");
  if(!/^bq_staging_[a-z0-9_]{1,40}$/.test(db.name||"")||!db.host||!Number.isInteger(db.port)||!/^[0-9a-f]{64}$/.test(db.caSha256||""))throw Error("staging_database_binding_required");
  if(!/^[A-Za-z0-9._-]{3,120}$/.test(m.bucket||""))throw Error("staging_bucket_binding_required");
  if(!/^[0-9a-f]{64}$/.test(keys.session||"")||!/^[0-9a-f]{64}$/.test(keys.backup||""))throw Error("staging_key_fingerprints_required");

  // Provider binding: this process must be the approved staging application.
  if(env.REPL_ID!==app.replId)throw Error("staging_app_identity_mismatch");
  const production=readJson(path.join(root,"deploy","staging","production-identity.json"),"production_identity_unrecorded");
  if(!/^[0-9a-f]{64}$/.test(production.replIdSha256||"")||!/^[0-9a-f]{64}$/.test(production.originSha256||""))throw Error("production_identity_unrecorded");
  if(sha(app.replId)===production.replIdSha256||sha(app.origin.toLowerCase())===production.originSha256)throw Error("production_identity_refused");
  const prodBucket=productionBucket(root);
  if(prodBucket&&m.bucket===prodBucket)throw Error("production_bucket_refused");
  if((production.databaseHostSha256s||[]).includes(sha(String(db.host).toLowerCase())))throw Error("production_database_refused");
  if(PRODUCTION_SECRETS.some(name=>env[name]))throw Error("production_secret_present");
  const legacy=path.join(root,"data");
  if(LEGACY_DATA.some(file=>fs.existsSync(path.join(legacy,file))))throw Error("employee_dataset_present");

  // Key domains are staging-only and must match the approved fingerprints.
  const sessionKey=env.BQ_STAGING_SESSION_KEY||"",backupKey=env.BQ_STAGING_BACKUP_KEY||"";
  if(!/^[0-9a-f]{96}$/.test(sessionKey)||!/^[0-9a-f]{64}$/.test(backupKey))throw Error("staging_keys_required");
  if(sha(sessionKey)!==keys.session||sha(backupKey)!==keys.backup)throw Error("staging_key_fingerprint_mismatch");
  const ca=env.BQ_STAGING_DB_CA||"";
  if(!ca.includes("BEGIN CERTIFICATE")||sha(ca)!==db.caSha256)throw Error("staging_database_ca_mismatch");

  // Separate approval gate: a reviewed commit must name this exact binding.
  const approvals=readJson(path.join(root,"deploy","staging","approvals.json"),"staging_approvals_unreadable");
  const record=(approvals.approvals||[]).find(a=>a.id===m.approval);
  if(!record)throw Error("staging_approval_missing");
  if(!record.approvedBy||!record.approvedAt||!(record.operations||[]).includes(operation))throw Error("staging_approval_scope_refused");
  if(!(Date.parse(record.expires)>now))throw Error("staging_approval_expired");
  if(record.binding!==binding(m))throw Error("staging_approval_binding_mismatch");

  const seal=sha(`${m.dataset}:${keys.session}:${keys.backup}:${record.binding}`);
  return Object.freeze({verifiedStaging:true,operation,dataset:m.dataset,seal,bucket:m.bucket,origin:app.origin,approval:record.id,
    database:Object.freeze({host:db.host,port:db.port,database:db.name,ssl:Object.freeze({ca,servername:db.host,rejectUnauthorized:true,minVersion:"TLSv1.2"})}),
    sessionKey,backupKey});
}
module.exports={verify,binding,sha,canonical,PRODUCTION_SECRETS};
