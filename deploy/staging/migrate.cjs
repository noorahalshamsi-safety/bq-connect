// Versioned schema deployment for staging, run only as bq_migrator. The runtime
// identity (bq_app) cannot execute DDL, so it can never create or reset schema.
const crypto=require("node:crypto");
const codec=require("../../development/postgres/codec.cjs");
const {controlDdl}=require("../../development/postgres/repository.cjs");
const {indexes}=require("../../development/postgres/native-profile.cjs");
const migrations=[
  ["0001_base",[codec.ddl(),"CREATE TABLE dev.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp())"]],
  ["0002_request_expiry_and_fault_points",[controlDdl.requestColumns,...controlDdl.faultPoints]],
  ["0003_native_profile_indexes",indexes]].map(([version,statements])=>({version,statements,
  checksum:crypto.createHash("sha256").update(statements.join("\n;\n")).digest("hex")}));
const LOCK=1793705964;
async function applied(client){
  const table=await client.query("SELECT to_regclass('dev.schema_migrations') AS found");
  if(!table.rows[0].found){
    const schema=await client.query("SELECT 1 FROM pg_namespace WHERE nspname='dev'");
    if(schema.rowCount)throw Error("unversioned_schema_refused");
    return new Map();
  }
  return new Map((await client.query("SELECT version,checksum FROM dev.schema_migrations")).rows.map(r=>[r.version,r.checksum]));
}
function check(done){
  const known=new Map(migrations.map(m=>[m.version,m.checksum]));
  for(const [version,checksum] of done){
    if(!known.has(version))throw Error("schema_newer_than_release");
    if(known.get(version)!==checksum)throw Error("migration_checksum_mismatch");
  }
  // Versions must be a prefix of the release list; gaps mean manual edits.
  migrations.forEach((m,i)=>{if(done.has(m.version)&&i>0&&!done.has(migrations[i-1].version))throw Error("migration_sequence_gap");});
}
async function migrate(client,{stopAfter}={}){
  await client.query("BEGIN");
  try{
    await client.query("SET LOCAL ROLE bq_owner");
    await client.query("SELECT pg_advisory_xact_lock($1)",[LOCK]);
    const done=await applied(client);check(done);
    const ran=[];
    for(const m of migrations){
      if(done.has(m.version))continue;
      for(const sql of m.statements)await client.query(sql);
      await client.query("INSERT INTO dev.schema_migrations(version,checksum) VALUES($1,$2)",[m.version,m.checksum]);
      ran.push(m.version);
      if(stopAfter===m.version)throw Object.assign(Error("migration_interrupted"),{ran});
    }
    await client.query("REVOKE ALL ON SCHEMA dev FROM PUBLIC");
    await client.query("GRANT USAGE ON SCHEMA dev TO bq_app,bq_backup");
    await client.query("REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON dev.schema_migrations FROM bq_app");
    await client.query("COMMIT");
    return {ran,version:migrations.at(-1).version};
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
}
// Runtime check under bq_app: refuse to serve against an unknown schema.
async function requireCurrent(client){
  const done=await applied(client);check(done);
  if(done.size!==migrations.length)throw Error("schema_migration_pending");
  return migrations.at(-1).version;
}
module.exports={migrations,migrate,requireCurrent};

if(require.main===module)(async()=>{
  const proof=require("./gate.cjs").verify({operation:"staging-migrate"});
  const password=process.env.BQ_STAGING_MIGRATOR_PASSWORD;
  if(!password)throw Error("migrator_credential_missing");
  const {Client}=require("pg");
  const {ssl,...database}=proof.database;
  const client=new Client({...database,ssl:{...ssl},user:"bq_migrator",password,connectionTimeoutMillis:5000,application_name:"bq-staging-migrate"});
  await client.connect();
  try{const result=await migrate(client);console.log(JSON.stringify({dataset:proof.dataset,...result}));}
  finally{await client.end();}
})().catch(e=>{console.error(`staging migration refused: ${e.message}`);process.exit(1);});
