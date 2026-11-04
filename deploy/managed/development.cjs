// Explicit one-time DEVELOPMENT installation and invented-data setup.
// Not imported by runtime. No production connection/DDL path is supported.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {Client}=require("pg");
const cfg=require("./config.cjs"),schema=require("./schema.cjs");
const {saveFile}=require("../../development/postgres/repository.cjs");
const {create}=require("../../development/postgres/fixtures.cjs");
const {readSql}=require("../../scripts/migration/rel001/reconcile.cjs");
function write(file,value){const fd=fs.openSync(file,"wx",0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}const d=fs.openSync(path.dirname(file),"r");try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}
async function prepare({root,env=process.env,productionBucketFingerprint}){
  if(env.REPLIT_DEPLOYMENT==="1"||!env.REPL_ID)cfg.fail("managed_development_only");
  if(!/^[0-9a-f]{64}$/.test(productionBucketFingerprint||""))cfg.fail("production_storage_identity_required");
  const e=cfg.endpoint(env,"development");
  if(fs.existsSync(root))cfg.fail("managed_development_evidence_exists");
  fs.mkdirSync(root,{recursive:true,mode:0o700});fs.chmodSync(root,0o700);
  // Intent is independent of SQL: an empty/lost schema cannot reseed this lab.
  const dataset=`staging-synthetic-${crypto.randomUUID()}`,sessionKey=crypto.randomBytes(48).toString("hex"),backupKey=crypto.randomBytes(32).toString("hex");
  write(path.join(root,"intent.json"),{dataset,endpointFingerprint:e.identity,created:new Date().toISOString()});
  const keys={sessionKey,backupKey};write(path.join(root,"keys.json"),keys);
  const fixture=create(sessionKey,{password:`Managed-${crypto.randomBytes(18).toString("hex")}-Aa1!`,recovery:crypto.randomBytes(6).toString("hex").toUpperCase()});
  write(path.join(root,"credentials.json"),fixture.credentials);
  const client=new Client({connectionString:e.url.toString(),ssl:false,connectionTimeoutMillis:5000,application_name:"bq-managed-development-setup"});
  await client.connect();
  let manifest;
  try{
    await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(1793804287)");
    const tables=(await client.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")).rows[0].n;
    const existing=(await client.query("SELECT 1 FROM pg_namespace WHERE nspname='dev'")).rowCount;
    if(tables||existing)cfg.fail("managed_development_database_not_empty");
    for(const statement of schema.statements)await client.query(statement);
    for(const m of schema.migrations)await client.query("INSERT INTO dev.schema_migrations(version,checksum) VALUES($1,$2)",[m.version,m.checksum]);
    const keyPrints={session:cfg.sha(sessionKey),backup:cfg.sha(backupKey)};
    const seal=cfg.sha(cfg.canonical([dataset,keyPrints.session,keyPrints.backup]));
    for(const [file,value]of Object.entries(fixture.files))await saveFile(client,file,value,null);
    if(cfg.canonical((await readSql(client)).values)!==cfg.canonical(fixture.files))cfg.fail("managed_fixture_semantic_mismatch");
    await client.query("INSERT INTO dev.authority VALUES(true,$1,$2,1,'synthetic')",[dataset,seal]);
    const shape=await schema.describe(client),p=await cfg.permissions(client);
    manifest={kind:"BQ_REPLIT_MANAGED_V1",environment:"development",appFingerprint:cfg.sha(env.REPL_ID),
      endpointFingerprint:e.identity,dataset,bucket:`invented-managed-${crypto.randomUUID()}`,productionBucketFingerprint,mockStorage:true,
      keys:keyPrints,schemaFingerprint:shape.fingerprint,releaseFingerprint:schema.releaseFingerprint,permissionsFingerprint:p.fingerprint};
    write(path.join(root,"manifest.json"),manifest);
    await client.query("COMMIT");
    write(path.join(root,"receipt.json"),{dataset,seal,state:"committed"});
    return {manifest,keys,credentials:fixture.credentials,tables:shape.tables,capabilities:p.capabilities};
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
  finally{await client.end();}
}
module.exports={prepare};
if(require.main===module)console.error("Use the explicit synthetic managed validation harness; never run setup from an application entrypoint.");
