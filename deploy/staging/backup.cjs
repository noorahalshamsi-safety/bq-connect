// Staging logical backup and restore over verified TLS. Backup runs as the
// read-only bq_backup identity and writes the pg_dump archive encrypted with
// BQ_STAGING_BACKUP_KEY (AES-256-GCM, bound to the dataset seal). Restore runs
// as bq_migrator into an EMPTY database only; it never overwrites a schema.
//   node deploy/staging/backup.cjs backup  <file>   (BQ_STAGING_BACKUP_DB_PASSWORD)
//   node deploy/staging/backup.cjs restore <file>   (BQ_STAGING_MIGRATOR_PASSWORD)
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const {Client}=require("pg");
const gate=require("./gate.cjs");
const MAGIC=Buffer.from("BQSTGBK1");
function withTls(proof,role,password,fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"bq-staging-pg-"));
  try{
    fs.chmodSync(dir,0o700);
    const ca=path.join(dir,"ca.pem");fs.writeFileSync(ca,proof.database.ssl.ca,{mode:0o600});
    return fn({PATH:process.env.PATH,HOME:dir,PGHOST:proof.database.host,PGPORT:String(proof.database.port),PGDATABASE:proof.database.database,
      PGUSER:role,PGPASSWORD:password,PGSSLMODE:"verify-full",PGSSLROOTCERT:ca,PGSSLMINPROTOCOLVERSION:"TLSv1.2",PGCONNECT_TIMEOUT:"10",
      PGAPPNAME:`bq-staging-${role}`},dir);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const pgError=e=>Error(`pg_tool_failed: ${String(e.stderr||e.message).split("\n").find(Boolean)||"unknown"}`);
async function backup({proof,password,out}) {
  if(proof?.operation!=="staging-backup")throw Error("staging_backup_scope_required");
  if(!password)throw Error("backup_credential_missing");
  const archive=withTls(proof,"bq_backup",password,env=>{
    try{return execFileSync("pg_dump",["--format=custom","--schema=dev","--no-password"],{env,maxBuffer:2**31-1,stdio:["ignore","pipe","pipe"]});}
    catch(e){throw pgError(e);}
  });
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",Buffer.from(proof.backupKey,"hex"),iv);
  cipher.setAAD(Buffer.from(proof.seal));
  const body=Buffer.concat([cipher.update(archive),cipher.final()]);
  fs.writeFileSync(out,Buffer.concat([MAGIC,iv,cipher.getAuthTag(),body]),{mode:0o600,flag:"wx"});
  return {dataset:proof.dataset,bytes:archive.length,sha256:crypto.createHash("sha256").update(archive).digest("hex")};
}
function open(proof,input){
  const data=fs.readFileSync(input);
  if(!data.subarray(0,8).equals(MAGIC))throw Error("backup_format_invalid");
  const decipher=crypto.createDecipheriv("aes-256-gcm",Buffer.from(proof.backupKey,"hex"),data.subarray(8,20));
  decipher.setAAD(Buffer.from(proof.seal));decipher.setAuthTag(data.subarray(20,36));
  try{return Buffer.concat([decipher.update(data.subarray(36)),decipher.final()]);}catch{throw Error("backup_key_or_dataset_mismatch");}
}
async function restore({proof,password,input}) {
  if(proof?.operation!=="staging-migrate")throw Error("staging_restore_scope_required");
  if(!password)throw Error("migrator_credential_missing");
  const archive=open(proof,input);
  const {ssl,...database}=proof.database;
  const c=new Client({...database,ssl:{...ssl},user:"bq_migrator",password,connectionTimeoutMillis:5000,application_name:"bq-staging-restore"});
  await c.connect();
  try{if((await c.query("SELECT 1 FROM pg_namespace WHERE nspname='dev'")).rowCount)throw Error("restore_target_not_empty");}
  finally{await c.end().catch(()=>{});}
  withTls(proof,"bq_migrator",password,(env,dir)=>{
    const file=path.join(dir,"archive.dump");fs.writeFileSync(file,archive,{mode:0o600});
    try{execFileSync("pg_restore",["--no-owner","--role=bq_owner","--single-transaction","--exit-on-error","--no-password","--dbname",proof.database.database,file],{env,stdio:["ignore","pipe","pipe"]});}
    catch(e){throw pgError(e);}
  });
  return {dataset:proof.dataset,database:proof.database.database,bytes:archive.length};
}
module.exports={backup,restore};
if(require.main===module)(async()=>{
  const [mode,file]=process.argv.slice(2);
  if(!file||!["backup","restore"].includes(mode))throw Error("usage: backup.cjs backup|restore <file>");
  const result=mode==="backup"
    ?await backup({proof:gate.verify({operation:"staging-backup"}),password:process.env.BQ_STAGING_BACKUP_DB_PASSWORD,out:path.resolve(file)})
    :await restore({proof:gate.verify({operation:"staging-migrate"}),password:process.env.BQ_STAGING_MIGRATOR_PASSWORD,input:path.resolve(file)});
  console.log(JSON.stringify(result));
})().catch(e=>{console.error(`staging ${process.argv[2]||"backup"} refused: ${e.message}`);process.exit(1);});
