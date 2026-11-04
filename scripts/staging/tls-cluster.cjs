// Disposable TLS-only PostgreSQL cluster with a throwaway CA, standing in for the
// hosted provider in local staging tests. It is not hosted certification.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const {Client}=require("pg");
const workspace=path.resolve(__dirname,"../..");
function createCluster({prefix,port,databases}) {
  if(process.env.REPLIT_DEPLOYMENT)throw Error("production_activation_forbidden");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
  const env={PATH:process.env.PATH,HOME:root,LANG:"C.UTF-8"};
  const run=(cmd,args)=>execFileSync(cmd,args,{env,cwd:root,stdio:"pipe"});
  const pgdata=path.join(root,"pgdata"),socket=path.join(root,"socket"),user=os.userInfo().username;
  const passwords={bq_migrator:crypto.randomBytes(24).toString("hex"),bq_app:crypto.randomBytes(24).toString("hex"),bq_backup:crypto.randomBytes(24).toString("hex")};
  const o=(...a)=>run("openssl",a);
  o("req","-x509","-newkey","rsa:2048","-nodes","-keyout","ca.key","-out","ca.pem","-days","2","-subj","/CN=bq-staging-test-ca");
  o("req","-x509","-newkey","rsa:2048","-nodes","-keyout","foreign.key","-out","foreign.pem","-days","2","-subj","/CN=bq-foreign-ca");
  o("req","-newkey","rsa:2048","-nodes","-keyout","server.key","-out","server.csr","-subj","/CN=localhost");
  fs.writeFileSync(path.join(root,"san.ext"),"subjectAltName=DNS:localhost\n");
  o("x509","-req","-in","server.csr","-CA","ca.pem","-CAkey","ca.key","-CAcreateserial","-out","server.pem","-days","2","-extfile","san.ext");
  fs.chmodSync(path.join(root,"server.key"),0o600);
  fs.mkdirSync(socket,{mode:0o700});
  run("initdb",["-D",pgdata,"-A","trust","--no-locale","-E","UTF8","--data-checksums"]);
  fs.writeFileSync(path.join(pgdata,"pg_hba.conf"),[
    `local all ${user} trust`,
    "hostssl all bq_migrator,bq_app,bq_backup 127.0.0.1/32 scram-sha-256",
    "hostssl all bq_migrator,bq_app,bq_backup ::1/128 scram-sha-256",
    "host all all 127.0.0.1/32 reject","host all all ::1/128 reject",""].join("\n"));
  const options=`-k ${socket} -p ${port} -c listen_addresses=localhost -c unix_socket_permissions=0700 -c ssl=on -c ssl_cert_file=${root}/server.pem -c ssl_key_file=${root}/server.key -c ssl_min_protocol_version=TLSv1.2 -c password_encryption=scram-sha-256 -c max_connections=30 -c fsync=on -c synchronous_commit=on`;
  const start=()=>run("pg_ctl",["-D",pgdata,"-l",path.join(root,"postgres.log"),"-w","start","-o",options]);
  const stop=()=>run("pg_ctl",["-D",pgdata,"-w","-m","fast","stop"]);
  start();
  const admin=(database="postgres")=>new Client({host:socket,port,user,database});
  async function query(sql,params,database=databases[0]){const c=admin(database);await c.connect();try{return await c.query(sql,params);}finally{await c.end();}}
  return {root,port,passwords,start,stop,admin,query,
    ca:()=>fs.readFileSync(path.join(root,"ca.pem"),"utf8"),
    foreignCa:()=>fs.readFileSync(path.join(root,"foreign.pem"),"utf8"),
    async provision(){
      for(const db of databases)await query(`CREATE DATABASE ${db}`,[],"postgres");
      for(const db of databases)await query(fs.readFileSync(path.join(workspace,"deploy","staging","roles.sql"),"utf8"),[],db);
      for(const [role,pw] of Object.entries(passwords))await query(`ALTER ROLE ${role} PASSWORD '${pw}'`,[],"postgres");
    },
    tls(role,{database=databases[0],certificate}={}){
      return {host:"localhost",port,database,user:role,password:passwords[role],connectionTimeoutMillis:4000,
        ssl:{ca:certificate||fs.readFileSync(path.join(root,"ca.pem"),"utf8"),servername:"localhost",rejectUnauthorized:true,minVersion:"TLSv1.2"}};
    },
    destroy(){try{stop();}catch{}fs.rmSync(root,{recursive:true,force:true});}};
}
module.exports={createCluster};
