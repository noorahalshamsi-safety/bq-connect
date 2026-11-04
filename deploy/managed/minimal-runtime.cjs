// Startup is verification only. The explicit, separately approved DATA importer
// is never called here; missing/empty/foreign state holds readiness closed.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const cfg=require("./config.cjs"),schema=require("./schema.cjs"),I=require("../../migration/minimal/import.cjs");
const {Repository}=require("../../development/postgres/repository.cjs"),{ImmutableStore}=require("../staging/object-store.cjs");
async function start({env=process.env,manifest,storeClient}={}){
  if(!manifest)manifest=JSON.parse(fs.readFileSync(env.BQ_MANAGED_MANIFEST_FILE,"utf8"));
  if(env.REPLIT_DEPLOYMENT!=="1"||manifest.environment!=="production")cfg.fail("minimal_production_runtime_only");
  if(manifest.minimal?.policy!=="employees-accounts-only-v1"||manifest.minimal.employees!==6311||manifest.minimal.accounts!==8||
    cfg.sha(manifest.bucket)===manifest.minimal.sourceBucketFingerprint)cfg.fail("minimal_runtime_policy_required");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-minimal-"));fs.chmodSync(root,0o700);
  const app=path.join(root,"app"),objects=path.join(root,"objects");fs.mkdirSync(app,{mode:0o700});fs.mkdirSync(objects,{mode:0o700});
  let repo;
  try{
  const proof=cfg.verify({env,manifest,paths:{root,app,objects}});
  if(!storeClient){const {Client}=await import("@replit/object-storage");storeClient=new Client({bucketId:manifest.bucket});}
  const store=new ImmutableStore(storeClient,{dataset:proof.dataset,managedProof:proof});
  const receipt=await store.readControl("provision-receipt.json");
  const intent=await store.readControl("provision-intent.json");
  const binding=cfg.sha(cfg.canonical({dataset:proof.dataset,seal:proof.seal,source:manifest.minimal.sourceFingerprint,endpoint:proof.endpointFingerprint}));
  if(!receipt||receipt.minimalSource!==manifest.minimal.sourceFingerprint||receipt.binding!==binding||
    intent?.binding!==binding||intent.dataset!==proof.dataset||intent.seal!==proof.seal)cfg.fail("minimal_independent_receipt_required");
  repo=new Repository(proof,null,{proof,store,receipt});
    const c=await repo.pool.connect();let media;
    try{
      await c.query("BEGIN");await cfg.verifyDatabase(c,proof);await schema.requireSchema(c,manifest);await repo.verify(c);
      const marker=await I.readMarker(c,proof);
      if(!marker||marker.sourceFingerprint!==manifest.minimal.sourceFingerprint||marker.dataset!==proof.dataset||marker.seal!==proof.seal||
        marker.counts.employees!==6311||marker.counts.accounts!==8||marker.originalKeys.session!==manifest.keys.session||
        marker.originalKeys.backup!==manifest.keys.backup||marker.sourceBucketFingerprint!==manifest.minimal.sourceBucketFingerprint||
        marker.membership.accounts!==manifest.minimal.membership?.accounts||marker.membership.employees!==manifest.minimal.membership?.employees)
        cfg.fail("minimal_sql_adoption_marker_required");
      media=(await c.query("SELECT id,object_key,sha256 FROM dev.media WHERE state IN('ready','retained')")).rows;
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
    await store.restore(media,objects);
    process.env.BQ_STORAGE_SYNC="0";process.env.BQ_TRANSLATE="0";
    const running=await require("../../development/postgres/runtime.cjs").serve(proof,repo,{nativeEnabled:true,minimalRelease:true});
    return {...running,close:async()=>{try{await running.close();}finally{fs.rmSync(root,{recursive:true,force:true});}}};
  }catch(e){await repo?.pool.end().catch(()=>{});fs.rmSync(root,{recursive:true,force:true});throw e;}
}
module.exports={start};
