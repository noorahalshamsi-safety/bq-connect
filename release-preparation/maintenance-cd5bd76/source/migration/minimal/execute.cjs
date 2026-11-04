// Explicit future protected PRODUCTION execution only. No schema DDL. Never
// called by startup, no arbitrary URL/force/reset option and no output records.
const fs=require("node:fs"),{Pool}=require("pg"),cfg=require("../../deploy/managed/config.cjs"),S=require("./source.cjs"),I=require("./import.cjs");
const {ImmutableStore}=require("../../deploy/staging/object-store.cjs");
async function execute({env=process.env,manifest,sourceClient,mediaClient}={}){
  if(env.REPLIT_DEPLOYMENT!=="1")cfg.fail("minimal_published_execution_required");
  const proof=cfg.verify({env,manifest});if(proof.profile!=="production")cfg.fail("minimal_production_destination_required");
  if(!/^[a-f0-9]{64}$/.test(env.BQ_MINIMAL_AUDIT_KEY||""))cfg.fail("minimal_protected_audit_key_required");
  if(!manifest.minimal?.sourceBucket||cfg.sha(manifest.minimal.sourceBucket)!==manifest.minimal.sourceBucketFingerprint||
    manifest.minimal.sourceBucket===manifest.bucket)cfg.fail("minimal_distinct_bucket_binding_required");
  if(!sourceClient||!mediaClient){const {Client}=await import("@replit/object-storage");
    sourceClient=new Client({bucketId:manifest.minimal.sourceBucket});mediaClient=new Client({bucketId:manifest.bucket});}
  const source=await S.read({client:sourceClient,bucketFingerprint:cfg.sha(manifest.minimal.sourceBucket),auditKey:Buffer.from(env.BQ_MINIMAL_AUDIT_KEY,"hex")});
  const permit=I.authorize(proof,manifest,source),store=new ImmutableStore(mediaClient,{dataset:proof.dataset,managedProof:proof});
  const pool=new Pool(cfg.poolOptions(proof));pool.on("error",()=>{});
  let c;
  try{
    c=await pool.connect();
    await cfg.verifyDatabase(c,proof);
    await c.query("SELECT pg_advisory_lock($1)",[I.lock]);
    const binding=cfg.sha(cfg.canonical({dataset:proof.dataset,seal:proof.seal,source:source.fingerprint,endpoint:proof.endpointFingerprint}));
    const intent=await store.readControl("provision-intent.json"),existing=await I.readMarker(c,proof);
    if(intent){if(intent.binding!==binding||intent.dataset!==proof.dataset||intent.seal!==proof.seal||!existing)cfg.fail("minimal_prior_intent_requires_operator_recovery");}
    else{
      if(existing||(await c.query("SELECT EXISTS(SELECT 1 FROM dev.authority) AS occupied")).rows[0].occupied)cfg.fail("minimal_independent_intent_missing");
      await store.createControl("provision-intent.json",{kind:"BQ_MINIMAL_INTENT_V1",binding,dataset:proof.dataset,seal:proof.seal});
    }
    const result=await I.apply({client:c,source,proof,permit,contract:manifest,verifySourceUnchanged:async()=>{
      const current=await S.read({client:sourceClient,bucketFingerprint:source.bucketFingerprint,auditKey:Buffer.from(env.BQ_MINIMAL_AUDIT_KEY,"hex")});
      if(current.fingerprint!==source.fingerprint)cfg.fail("minimal_source_changed_before_commit");
    }});
    let receipt=await store.readControl("provision-receipt.json");
    if(!receipt){receipt={dataset:proof.dataset,seal:proof.seal,state:"committed",minimalSource:source.fingerprint,binding};await store.createControl("provision-receipt.json",receipt);}
    if(receipt.dataset!==proof.dataset||receipt.seal!==proof.seal||receipt.state!=="committed"||receipt.minimalSource!==source.fingerprint||receipt.binding!==binding)
      cfg.fail("minimal_independent_receipt_mismatch");
    return {employees:result.counts.employees,accounts:result.counts.accounts,replayed:result.replayed,sourceUnchanged:true};
  }finally{if(c){await c.query("SELECT pg_advisory_unlock($1)",[I.lock]).catch(()=>{});c.release();}await pool.end();}
}
module.exports={execute};
if(require.main===module)(async()=>{const manifest=JSON.parse(fs.readFileSync(process.env.BQ_MANAGED_MANIFEST_FILE,"utf8"));
  console.log(JSON.stringify(await execute({manifest})));})().catch(e=>{console.error(JSON.stringify({error:/^minimal_|^managed_/.test(e.code||"")?e.code:"minimal_execution_failed",
    sourceWritten:false,...(e.counts?{observedCounts:e.counts,expectedCounts:{employees:6311,accounts:8,registered:8}}:{})}));process.exitCode=1;});
