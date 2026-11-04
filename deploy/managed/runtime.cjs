// Replit-managed adapter. Startup verifies schema/identity; never seeds or DDLs.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const cfg=require("./config.cjs"),schema=require("./schema.cjs");
const {ImmutableStore}=require("../staging/object-store.cjs");
const {Repository}=require("../../development/postgres/repository.cjs");
async function start({env=process.env,manifest,storeClient,workBase=os.tmpdir()}={}){
  if(!manifest)manifest=JSON.parse(fs.readFileSync(env.BQ_MANAGED_MANIFEST_FILE,"utf8"));
  const work=fs.mkdtempSync(path.join(workBase,"bq-managed-"));fs.chmodSync(work,0o700);
  for(const dir of ["app","objects"])fs.mkdirSync(path.join(work,dir),{mode:0o700});
  const proof=cfg.verify({env,manifest,paths:{root:work,app:path.join(work,"app"),objects:path.join(work,"objects")}});
  // The inherited handler bridge uses fixture SMS/email/push sinks. It must not
  // be activated for real employees until a real managed outbox worker is reviewed.
  if(proof.profile==="production")cfg.fail("managed_production_side_effects_not_certified");
  if(!storeClient)cfg.fail("managed_development_mock_storage_required");
  const store=new ImmutableStore(storeClient,{dataset:proof.dataset});
  const receipt=await store.readControl("provision-receipt.json");
  if(!receipt)cfg.fail("managed_provision_receipt_missing");
  const repo=new Repository(proof,null,{proof,store,receipt});
  try{
    const c=await repo.pool.connect();
    let shape,permissions,rows;
    try{
      await c.query("BEGIN");
      permissions=await cfg.verifyDatabase(c,proof);
      shape=await schema.requireSchema(c,proof);
      await repo.verify(c);
      rows=(await c.query("SELECT id,object_key,sha256 FROM dev.media WHERE state IN('ready','retained')")).rows;
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
    await store.restore(rows,proof.objects);
    process.env.BQ_STORAGE_SYNC="0";process.env.BQ_TRANSLATE="0";
    const app=await require("../../development/postgres/runtime.cjs").serve(proof,repo,{nativeEnabled:true,faults:false});
    console.log(JSON.stringify({managed:"ready",environment:proof.profile,schema:shape.version,tables:shape.tables,
      transport:"internal-development-no-TLS",leastPrivilege:false,capabilities:permissions.capabilities}));
    return app;
  }catch(e){await repo.pool.end().catch(()=>{});throw e;}
}
module.exports={start};
if(require.main===module)(async()=>{
  // Development CLI uses the isolated filesystem stand-in, never a live bucket.
  const {FileStorage}=require("../../scripts/forensics/file-storage.cjs");
  const app=await start({storeClient:new FileStorage(process.env.BQ_MANAGED_MOCK_DIRECTORY)});
  let closing=false;const stop=()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0),()=>process.exit(1));};
  process.on("SIGINT",stop);process.on("SIGTERM",stop);
})().catch(e=>{console.error(`managed activation refused: ${e.code||"managed_startup_failed"}`);process.exit(1);});
