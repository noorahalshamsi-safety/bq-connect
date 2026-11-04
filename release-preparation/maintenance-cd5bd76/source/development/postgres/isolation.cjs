const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {execFileSync}=require("node:child_process");
const workspace=path.resolve(__dirname,"../..");
const base=path.join(workspace,"generated-artifacts","pg-development");
const hash=x=>crypto.createHash("sha256").update(x).digest("hex");
// Bind the SQL authority and provision receipt to both key domains, not just
// the dataset label. A same-length foreign key must not pass startup checks.
const seal=m=>hash(`${m.dataset}:${m.nonce}:${hash(m.sessionKey)}:${hash(m.backupKey)}`);
function guard(root) {
  if(process.env.REPLIT_DEPLOYMENT)throw Error("production_activation_forbidden");
  const real=fs.realpathSync(root),stat=fs.statSync(real);
  if(real!==base&&!real.startsWith(path.join(os.tmpdir(),"bq-pg-dev-")))throw Error("unapproved_development_root");
  if(stat.uid!==process.getuid()||(stat.mode&0o077)!==0)throw Error("insecure_development_root");
  return real;
}
function prepare(root=base) {
  if(process.env.REPLIT_DEPLOYMENT)throw Error("production_activation_forbidden");
  if(root!==base&&!root.startsWith(path.join(os.tmpdir(),"bq-pg-dev-")))throw Error("unapproved_development_root");
  fs.mkdirSync(root,{recursive:true,mode:0o700});fs.chmodSync(root,0o700);guard(root);
  const config=path.join(root,"synthetic-manifest.json");
  let manifest;
  if(fs.existsSync(config)) {
    if(fs.lstatSync(config).isSymbolicLink())throw Error("synthetic_manifest_symlink");
    if(fs.statSync(config).mode&0o077)throw Error("insecure_synthetic_manifest");
    manifest=JSON.parse(fs.readFileSync(config,"utf8"));
    if(manifest.kind!=="BQ_SYNTHETIC_ONLY"||!manifest.dataset.startsWith("synthetic-")||!/^[0-9a-f]{96}$/.test(manifest.sessionKey)||!/^[0-9a-f]{64}$/.test(manifest.backupKey))throw Error("invalid_synthetic_manifest");
  }else{
    if(fs.readdirSync(root).length)throw Error("missing_manifest_in_existing_development_root");
    manifest={kind:"BQ_SYNTHETIC_ONLY",dataset:`synthetic-${crypto.randomUUID()}`,nonce:crypto.randomBytes(32).toString("hex"),sessionKey:crypto.randomBytes(48).toString("hex"),backupKey:crypto.randomBytes(32).toString("hex")};
    fs.writeFileSync(config,JSON.stringify(manifest),{mode:0o600,flag:"wx"});
  }
  for(const dir of ["socket","objects","app","pgdata"])if(fs.existsSync(path.join(root,dir))&&fs.lstatSync(path.join(root,dir)).isSymbolicLink())throw Error("synthetic_path_symlink_refused");
  for(const dir of ["socket","objects","app"])fs.mkdirSync(path.join(root,dir),{mode:0o700,recursive:true});
  const env={PATH:process.env.PATH,HOME:root,LANG:"C.UTF-8"};
  const pgdata=path.join(root,"pgdata"),socket=path.join(root,"socket"),user=os.userInfo().username;
  let fresh=false;
  if(!fs.existsSync(path.join(pgdata,"PG_VERSION"))) {
    if(fs.existsSync(path.join(root,"provision-receipt.json")))throw Error("previously_provisioned_database_missing");
    if(fs.existsSync(pgdata))throw Error("unexpected_cluster_directory");
    execFileSync("initdb",["-D",pgdata,"-A","trust","--no-locale","-E","UTF8","--data-checksums"],{env,stdio:"pipe"});fresh=true;
  }
  let running=true;try{execFileSync("pg_ctl",["-D",pgdata,"status"],{env,stdio:"pipe"});}catch{running=false;}
  if(!running)execFileSync("pg_ctl",["-D",pgdata,"-l",path.join(root,"postgres.log"),"-o",`-k ${socket} -p 55441 -c listen_addresses='' -c unix_socket_permissions=0700 -c fsync=on -c synchronous_commit=on -c full_page_writes=on -c max_connections=20`,"-w","start"],{env,stdio:"pipe"});
  if(fresh)execFileSync("createdb",["-h",socket,"-p","55441","-U",user,"bq_synthetic_development"],{env,stdio:"pipe"});
  return {...manifest,root,socket,user,objects:path.join(root,"objects"),app:path.join(root,"app"),verifiedSynthetic:true,seal:seal(manifest),
    childEnv:{PATH:process.env.PATH,HOME:root,TMPDIR:os.tmpdir(),HOST:"0.0.0.0",PORT:"5000",BQ_TRANSLATE:"0",BQ_STORAGE_SYNC:"0"},
    stop(){execFileSync("pg_ctl",["-D",pgdata,"-w","-m","fast","stop"],{env,stdio:"pipe"});}};
}
function verify(root) {
  guard(root);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"synthetic-manifest.json"),"utf8"));
  if(manifest.kind!=="BQ_SYNTHETIC_ONLY"||!manifest.dataset?.startsWith("synthetic-")||!/^[0-9a-f]{96}$/.test(manifest.sessionKey||"")||!/^[0-9a-f]{64}$/.test(manifest.backupKey||"")||!/^[0-9a-f]{64}$/.test(manifest.nonce||""))throw Error("synthetic_identity_required");
  for(const dir of ["socket","objects","pgdata"])if(fs.lstatSync(path.join(root,dir)).isSymbolicLink())throw Error("synthetic_path_symlink_refused");
  return {...manifest,root,socket:path.join(root,"socket"),objects:path.join(root,"objects"),app:path.join(root,"app"),user:os.userInfo().username,
    seal:seal(manifest),verifiedSynthetic:true};
}
module.exports={prepare,verify,base};
