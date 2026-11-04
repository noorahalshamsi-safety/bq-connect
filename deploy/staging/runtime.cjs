// Staging application worker, started by start-staging.cjs. Serves the original
// application on the approved staging database (as bq_app over verified TLS) and
// bucket. Performs no DDL and no provisioning; local disk holds only the copied
// application sources and a verified media cache in a fresh private directory.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const gate=require("./gate.cjs"),{ImmutableStore}=require("./object-store.cjs"),{requireCurrent}=require("./migrate.cjs");
const {Repository}=require("../../development/postgres/repository.cjs");
const {serve}=require("../../development/postgres/runtime.cjs");
const workspace=path.resolve(__dirname,"../..");
const RUNTIME_SECRETS=["BQ_STAGING_APP_PASSWORD","BQ_STAGING_SESSION_KEY","BQ_STAGING_BACKUP_KEY","BQ_STAGING_DB_CA","BQ_STAGING_MANIFEST"];
async function start({env=process.env,root=workspace,storeClient,workBase=os.tmpdir()}={}) {
  const verified=gate.verify({operation:"staging-activate",env,root});
  if(env.BQ_STAGING_MIGRATOR_PASSWORD)throw Error("migrator_credential_present_at_runtime");
  const password=env.BQ_STAGING_APP_PASSWORD;
  if(!password)throw Error("app_credential_missing");
  let client=storeClient;
  if(!client){const {Client}=require("@replit/object-storage");client=new Client({bucketId:verified.bucket});}
  const store=new ImmutableStore(client,{dataset:verified.dataset});
  const receipt=await store.readControl("provision-receipt.json");
  if(!receipt)throw Error("staging_not_provisioned");
  const work=fs.mkdtempSync(path.join(workBase,"bq-staging-"));
  fs.chmodSync(work,0o700);
  for(const dir of ["app","objects"])fs.mkdirSync(path.join(work,dir),{mode:0o700});
  const proof=Object.freeze({...verified,root:work,app:path.join(work,"app"),objects:path.join(work,"objects")});
  const repo=new Repository(proof,{proof,password,store,receipt,max:Math.min(6,Math.max(1,Number(env.BQ_STAGING_POOL_MAX)||6))});
  let schema,rows;
  try{
    const c=await repo.pool.connect();
    try{
      schema=await requireCurrent(c);
      await c.query("BEGIN");
      await repo.verify(c);
      rows=(await c.query("SELECT id,object_key,sha256 FROM dev.media WHERE state IN('ready','retained')")).rows;
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
  }catch(e){await repo.pool.end().catch(()=>{});throw e;}
  const media=await store.restore(rows,proof.objects).catch(async e=>{await repo.pool.end().catch(()=>{});throw e;});
  if(env===process.env)for(const name of RUNTIME_SECRETS)delete process.env[name];
  process.env.BQ_STORAGE_SYNC="0";
  process.env.BQ_TRANSLATE="0";
  const app=await serve(proof,repo,{nativeEnabled:true,faults:false});
  console.log(JSON.stringify({staging:"ready",dataset:proof.dataset,schema,media,work}));
  return app;
}
async function main(options) {
  try{
    const app=await start(options);
    let closing=false;
    const stop=()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0),()=>process.exit(1));};
    process.on("SIGTERM",stop);process.on("SIGINT",stop);
  }catch(e){
    console.error(`staging activation refused: ${e.code||e.message}`);
    process.exit(1);
  }
}
module.exports={start,main};
if(require.main===module)main();
