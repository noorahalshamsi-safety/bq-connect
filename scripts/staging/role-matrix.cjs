// Local rehearsal of the staging least-privilege and TLS policy (REL-003).
// Uses a disposable TLS-only PostgreSQL cluster in a private temp directory as
// a stand-in for the hosted provider; it is not hosted certification.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const {Client,Pool}=require("pg");
const {migrate,requireCurrent,migrations}=require("../../deploy/staging/migrate.cjs");
const {controlDdl}=require("../../development/postgres/repository.cjs");
const {indexes}=require("../../development/postgres/native-profile.cjs");
if(process.env.REPLIT_DEPLOYMENT)throw Error("production_activation_forbidden");
const workspace=path.resolve(__dirname,"../..");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-pg-roles-"));
const env={PATH:process.env.PATH,HOME:root,LANG:"C.UTF-8"};
const run=(cmd,args)=>execFileSync(cmd,args,{env,cwd:root,stdio:"pipe"});
const port=55462,pgdata=path.join(root,"pgdata"),socket=path.join(root,"socket");
const DB="bq_staging_rehearsal",DB2="bq_staging_interrupt",DB3="bq_staging_unversioned";
const passwords={bq_migrator:crypto.randomBytes(24).toString("hex"),bq_app:crypto.randomBytes(24).toString("hex"),bq_backup:crypto.randomBytes(24).toString("hex")};
const results=[];
async function check(id,name,fn){
  try{results.push({id,name,result:"PASS",detail:await fn()});}
  catch(e){results.push({id,name,result:"FAIL",detail:e.message});}
}
function certificates(){
  const o=(...a)=>run("openssl",a);
  o("req","-x509","-newkey","rsa:2048","-nodes","-keyout","ca.key","-out","ca.pem","-days","2","-subj","/CN=bq-staging-rehearsal-ca");
  o("req","-x509","-newkey","rsa:2048","-nodes","-keyout","foreign.key","-out","foreign.pem","-days","2","-subj","/CN=bq-foreign-ca");
  o("req","-newkey","rsa:2048","-nodes","-keyout","server.key","-out","server.csr","-subj","/CN=localhost");
  fs.writeFileSync(path.join(root,"san.ext"),"subjectAltName=DNS:localhost\n");
  o("x509","-req","-in","server.csr","-CA","ca.pem","-CAkey","ca.key","-CAcreateserial","-out","server.pem","-days","2","-extfile","san.ext");
  fs.chmodSync(path.join(root,"server.key"),0o600);
}
function cluster(){
  fs.mkdirSync(socket,{mode:0o700});
  run("initdb",["-D",pgdata,"-A","trust","--no-locale","-E","UTF8","--data-checksums"]);
  const user=os.userInfo().username;
  fs.writeFileSync(path.join(pgdata,"pg_hba.conf"),[
    `local all ${user} trust`,
    "hostssl all bq_migrator,bq_app,bq_backup 127.0.0.1/32 scram-sha-256",
    "host all all 127.0.0.1/32 reject",""].join("\n"));
  run("pg_ctl",["-D",pgdata,"-l",path.join(root,"postgres.log"),"-w","start","-o",
    `-k ${socket} -p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_permissions=0700 -c ssl=on -c ssl_cert_file=${root}/server.pem -c ssl_key_file=${root}/server.key -c ssl_min_protocol_version=TLSv1.2 -c password_encryption=scram-sha-256 -c max_connections=30 -c fsync=on -c synchronous_commit=on`]);
  return user;
}
const admin=(user,database="postgres")=>new Client({host:socket,port,user,database});
const ca=()=>fs.readFileSync(path.join(root,"ca.pem"),"utf8");
function tls(user,{database=DB,certificate=ca(),servername="localhost",ssl=true,password=passwords[user]}={}){
  return {host:"127.0.0.1",port,database,user,password,connectionTimeoutMillis:4000,
    ssl:ssl?{ca:certificate,servername,rejectUnauthorized:true,minVersion:"TLSv1.2"}:false};
}
async function session(user,options,fn){const c=new Client(tls(user,options));await c.connect();try{return await fn(c);}finally{await c.end().catch(()=>{});}}
async function refused(fn,pattern){
  try{await fn();}catch(e){if(pattern.test(`${e.code||""} ${e.message}`))return e.code||e.message.split("\n")[0];throw Error(`unexpected refusal: ${e.code||""} ${e.message}`);}
  throw Error("operation was allowed");
}
const denied=(c,sql)=>refused(()=>c.query(sql),/^42501 /);
async function rolesSql(user,database){
  const c=admin(user,database);await c.connect();
  try{await c.query(fs.readFileSync(path.join(workspace,"deploy","staging","roles.sql"),"utf8"));}finally{await c.end();}
}
(async()=>{
  certificates();
  const user=cluster();
  try{
    const boot=admin(user);await boot.connect();
    for(const db of [DB,DB2,DB3])await boot.query(`CREATE DATABASE ${db}`);
    await boot.end();
    for(const db of [DB,DB2,DB3])await rolesSql(user,db);
    {const c=admin(user);await c.connect();
      for(const [role,pw] of Object.entries(passwords))await c.query(`ALTER ROLE ${role} PASSWORD '${pw}'`);await c.end();}

    await check("R01","Role script is idempotent",async()=>{await rolesSql(user,DB);return "second run applied without error";});
    await check("R02","TLS with approved CA and hostname connects (verify-full)",()=>session("bq_app",{},async c=>{
      const r=await c.query("SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
      if(!r.rows[0]?.ssl)throw Error("connection not encrypted");return r.rows[0].version;}));
    await check("R03","Certificate from a foreign CA is rejected",()=>refused(()=>session("bq_app",{certificate:fs.readFileSync(path.join(root,"foreign.pem"),"utf8")},()=>{}),/self[- ]signed|unable to verify|certificate/i));
    await check("R04","Hostname mismatch is rejected",()=>refused(()=>session("bq_app",{servername:"wrong.example"},()=>{}),/Hostname|altnames|does not match/i));
    await check("R05","Plaintext connection is rejected",()=>refused(()=>session("bq_app",{ssl:false},()=>{}),/pg_hba|reject|SSL/i));
    await check("R06","Wrong password is rejected",()=>refused(()=>session("bq_app",{password:"not-the-password"},()=>{}),/password authentication failed|28P01/));
    await check("R07","Migrator applies versioned migrations; rerun is a no-op",()=>session("bq_migrator",{},async c=>{
      const first=await migrate(c),second=await migrate(c);
      if(first.ran.length!==migrations.length||second.ran.length)throw Error(JSON.stringify({first,second}));
      return `${first.ran.join(", ")}; rerun ran nothing`;}));
    await check("R08","Interrupted migration rolls back completely and retries cleanly",()=>session("bq_migrator",{database:DB2},async c=>{
      await refused(()=>migrate(c,{stopAfter:migrations[1].version}),/migration_interrupted/);
      const left=await c.query("SELECT 1 FROM pg_namespace WHERE nspname='dev'");
      if(left.rowCount)throw Error("partial schema left behind");
      const retry=await migrate(c);if(retry.ran.length!==migrations.length)throw Error("retry incomplete");
      return "no partial schema; retry applied all versions";}));
    await check("R09","Unversioned pre-existing schema is refused",async()=>{
      const c=admin(user,DB3);await c.connect();await c.query("CREATE SCHEMA dev AUTHORIZATION bq_owner");await c.end();
      return session("bq_migrator",{database:DB3},m=>refused(()=>migrate(m),/unversioned_schema_refused/));});
    await check("R10","Edited migration checksum and newer schema are refused",async()=>{
      const c=admin(user,DB2);await c.connect();
      try{
        await c.query("UPDATE dev.schema_migrations SET checksum='tampered' WHERE version=$1",[migrations[1].version]);
        const edited=await session("bq_migrator",{database:DB2},m=>refused(()=>migrate(m),/migration_checksum_mismatch/));
        await c.query("UPDATE dev.schema_migrations SET checksum=$2 WHERE version=$1",[migrations[1].version,migrations[1].checksum]);
        await c.query("INSERT INTO dev.schema_migrations(version,checksum) VALUES('9999_future','x')");
        const newer=await session("bq_app",{database:DB2},a=>refused(()=>requireCurrent(a),/schema_newer_than_release/));
        await c.query("DELETE FROM dev.schema_migrations WHERE version='9999_future'");
        return `${edited}; ${newer}`;
      }finally{await c.end();}});
    await check("R11","App identity performs every runtime operation",()=>session("bq_app",{},async c=>{
      await requireCurrent(c);
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(1793705963)");
      await c.query("INSERT INTO dev.authority VALUES(true,'staging-synthetic-rehearsal','seal',1,'synthetic')");
      await c.query("INSERT INTO dev.files(name) VALUES('rehearsal.json')");
      await c.query("SELECT name FROM dev.files ORDER BY name FOR UPDATE");
      await c.query("UPDATE dev.files SET revision=revision+1 WHERE name='rehearsal.json'");
      await c.query("INSERT INTO dev.outbox(id,topic,payload) VALUES($1,'rehearsal','{}')",[crypto.randomUUID()]);
      await c.query("SELECT id FROM dev.outbox WHERE delivered_at IS NULL FOR UPDATE SKIP LOCKED LIMIT 25");
      await c.query("INSERT INTO dev.requests(actor,request_key,digest,status,headers,body) VALUES('a','k','d',200,'{}','')");
      await c.query("DELETE FROM dev.requests WHERE actor='a'");
      await c.query("COMMIT");
      return "lock, insert, update, select-for-update, skip-locked, delete committed";}));
    await check("R12","App identity cannot run any DDL, including the runtime's own",()=>session("bq_app",{},async c=>{
      const statements=["CREATE TABLE dev.intruder(x int)","CREATE TABLE public.intruder(x int)","CREATE SCHEMA intruder",
        "CREATE TEMP TABLE intruder(x int)","DROP TABLE dev.files","TRUNCATE dev.files","ALTER TABLE dev.files ADD COLUMN x int",
        controlDdl.requestColumns,...controlDdl.faultPoints,...indexes];
      for(const sql of statements)await denied(c,sql);
      return `${statements.length} DDL statements refused with 42501`;}));
    await check("R13","App identity cannot escalate or reach server files",()=>session("bq_app",{},async c=>{
      const statements=["CREATE ROLE intruder","ALTER ROLE bq_app SUPERUSER","GRANT bq_owner TO bq_app","SET ROLE bq_owner","SET ROLE bq_migrator",
        "INSERT INTO dev.schema_migrations(version,checksum) VALUES('x','x')","COPY dev.files TO PROGRAM 'true'","SELECT pg_read_file('postgresql.conf')",
        "CREATE DATABASE intruder"];
      for(const sql of statements)await denied(c,sql);
      return `${statements.length} escalation attempts refused with 42501`;}));
    await check("R14","No superuser/createrole/replication identity and no inherited memberships for app",async()=>{
      const c=admin(user,DB);await c.connect();
      try{
        const r=await c.query("SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolinherit,rolconnlimit FROM pg_roles WHERE rolname IN('bq_owner','bq_migrator','bq_app','bq_backup') ORDER BY rolname");
        if(r.rows.length!==4||r.rows.some(x=>x.rolsuper||x.rolcreaterole||x.rolcreatedb||x.rolreplication||x.rolbypassrls))throw Error("privileged attribute present");
        const m=await c.query("SELECT count(*)::int AS n FROM pg_auth_members WHERE member='bq_app'::regrole OR member='bq_backup'::regrole");
        if(m.rows[0].n)throw Error("app/backup role memberships present");
        return r.rows.map(x=>`${x.rolname}(limit ${x.rolconnlimit})`).join(" ");
      }finally{await c.end();}});
    await check("R15","Backup identity is read-only",()=>session("bq_backup",{},async c=>{
      await c.query("SELECT count(*) FROM dev.files");
      for(const sql of ["INSERT INTO dev.files(name) VALUES('b')","UPDATE dev.files SET revision=revision+1","DELETE FROM dev.files","CREATE TABLE dev.b(x int)"])await denied(c,sql);
      return "SELECT allowed; write and DDL refused";}));
    await check("R16","Migrator cannot read data without explicit SET ROLE",()=>session("bq_migrator",{},async c=>{
      await denied(c,"SELECT count(*) FROM dev.files");return "NOINHERIT: direct read refused";}));
    await check("R17","App connection limit bounds the pool budget",async()=>{
      const open=[];
      try{
        for(let i=0;i<8;i++){const c=new Client(tls("bq_app"));await c.connect();open.push(c);}
        return await refused(async()=>{const c=new Client(tls("bq_app"));open.push(c);await c.connect();},/53300|too many connections/);
      }finally{await Promise.all(open.map(c=>c.end().catch(()=>{})));}});
    await check("R18","Role timeouts apply to the app identity",()=>session("bq_app",{},async c=>{
      const s=(await c.query("SHOW statement_timeout")).rows[0].statement_timeout,l=(await c.query("SHOW lock_timeout")).rows[0].lock_timeout;
      if(s!=="20s"||l!=="12s")throw Error(`${s}/${l}`);return `statement ${s}, lock ${l}`;}));
    await check("R19","Server restart: in-flight use fails closed, pool reconnects, committed rows survive",async()=>{
      const pool=new Pool({...tls("bq_app"),max:2,idleTimeoutMillis:30000});pool.on("error",()=>{});
      try{
        await pool.query("INSERT INTO dev.files(name) VALUES('restart-probe.json')");
        const held=await pool.connect();held.on("error",()=>{});
        run("pg_ctl",["-D",pgdata,"-l",path.join(root,"postgres.log"),"-w","-m","fast","restart"]);
        const failed=await refused(()=>held.query("SELECT 1"),/terminat|Connection|closed|ECONNRESET|57P01/i);
        held.release(true);
        let row,tries=0;
        while(!row&&tries++<30){try{row=(await pool.query("SELECT name FROM dev.files WHERE name='restart-probe.json'")).rows[0];}catch{await new Promise(r=>setTimeout(r,500));}}
        if(!row)throw Error("committed row missing or pool did not reconnect");
        return `held connection refused (${failed}); reconnected after ${tries} attempt(s); committed row present`;
      }finally{await pool.end().catch(()=>{});}});
  }finally{
    try{run("pg_ctl",["-D",pgdata,"-w","-m","fast","stop"]);}catch{}
    fs.rmSync(root,{recursive:true,force:true});
  }
  const out=path.join(workspace,"generated-artifacts","staging");
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,"role-matrix.json"),JSON.stringify({generated:new Date().toISOString(),scope:"local TLS-only stand-in; not hosted certification",results},null,2));
  for(const r of results)console.log(`${r.id} ${r.result.padEnd(4)} ${r.name} — ${r.detail}`);
  const failed=results.filter(r=>r.result!=="PASS").length;
  console.log(`role-matrix: ${results.length-failed}/${results.length} PASS`);
  process.exit(failed?1:0);
})().catch(e=>{console.error(`role-matrix error: ${e.message}`);try{run("pg_ctl",["-D",pgdata,"-w","-m","fast","stop"]);}catch{}fs.rmSync(root,{recursive:true,force:true});process.exit(2);});
