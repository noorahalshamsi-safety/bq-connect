const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),os=require("node:os");
const {execFileSync}=require("node:child_process"),{Pool}=require("pg");
const workspace=path.resolve(__dirname,"../../.."),base=path.join(workspace,"generated-artifacts/rel001-labs");
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
const canonical=v=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?`[${v.map(canonical).join(",")}]`:`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")}}`;
const digest=v=>hash(canonical(v));
function fail(code){const e=Error(code);e.code=code;throw e;}
function environment(){if(process.env.REPLIT_DEPLOYMENT)fail("deployment_forbidden");}
function syncDir(dir){const fd=fs.openSync(dir,"r");try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function write(file,bytes,exclusive=false){const fd=fs.openSync(file,exclusive?"wx":"w",0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}syncDir(path.dirname(file));}
function atomic(file,value){const tmp=file+"."+crypto.randomUUID()+".tmp";write(tmp,JSON.stringify(value),true);fs.renameSync(tmp,file);syncDir(path.dirname(file));}
function safeFile(file){
 const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||s.uid!==process.getuid()||s.nlink!==1)fail("unsafe_file");
 if(s.mode&0o077)fail("public_fixture_file");
 return fs.readFileSync(file);
}
function walk(dir,prefix=""){
 const s=fs.lstatSync(dir);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077))fail("unsafe_directory");
 return fs.readdirSync(dir).sort().flatMap(n=>{
   if(n==="."||n===".."||n.includes("\0"))fail("unsafe_path");
   const rel=prefix+n,p=path.join(dir,n),st=fs.lstatSync(p);
   if(st.isDirectory()&&!st.isSymbolicLink())return walk(p,rel+"/");
   safeFile(p);return [rel];
 });
}
// Strict JSON parser: no duplicate object keys, prototype setters, lossy integer
// parsing, nonfinite numbers, lone surrogates or negative-zero normalization.
function parse(bytes){
 const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);let i=0,depth=0;
 const decimal=s=>{
  const m=s.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  let digits=(m[2]+(m[3]||"")).replace(/^0+/,""),power=Number(m[4]||0)-(m[3]||"").length;
  if(!digits)return"0";
  const trailing=digits.match(/0+$/)?.[0].length||0;digits=digits.slice(0,digits.length-trailing);power+=trailing;
  return m[1]+digits+"e"+power;
 };
 const ws=()=>{while(/[ \t\r\n]/.test(text[i]||"x"))i++;};
 function string(){
  const start=i++;while(i<text.length){if(text[i]==="\\"){i+=2;continue;}if(text[i++]==='"'){const v=JSON.parse(text.slice(start,i));if(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))fail("unsupported_unicode");return v;}}
  fail("corrupt_json");
 }
 function value(){
  ws();if(++depth>128)fail("source_depth_limit");let v,c=text[i];
  if(c==="{"){
   i++;v=Object.create(null);ws();
   if(text[i]!=="}")while(true){ws();if(text[i]!=='"')fail("corrupt_json");const k=string();if(Object.hasOwn(v,k))fail("duplicate_json_key");ws();if(text[i++]!==":")fail("corrupt_json");v[k]=value();ws();if(text[i]!==",")break;i++;}
   if(text[i++]!=="}")fail("corrupt_json");
  }else if(c==="["){
   i++;v=[];ws();if(text[i]!=="]")while(true){v.push(value());ws();if(text[i]!==",")break;i++;}
   if(text[i++]!=="]")fail("corrupt_json");
  }else if(c==='"')v=string();
  else{
   const match=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);if(!match)fail("corrupt_json");
   i+=match[0].length;v=JSON.parse(match[0]);
   if(typeof v==="number"&&(!Number.isFinite(v)||Object.is(v,-0)||(Number.isInteger(v)&&!Number.isSafeInteger(v))||decimal(match[0])!==decimal(JSON.stringify(v))))fail("unsupported_json_number");
  }
  depth--;return v;
 }
 try{const result=value();ws();if(i!==text.length)fail("corrupt_json");return result;}catch(e){if(e.code)throw e;fail("corrupt_json");}
}
function context(root,expected){
 environment();
 const absolute=path.resolve(root);
 if(path.dirname(absolute)!==base||!/^lab-[0-9a-f-]{36}$/.test(path.basename(absolute)))fail("unauthorized_lab");
 if(fs.realpathSync(absolute)!==absolute)fail("unauthorized_lab");
 const st=fs.lstatSync(absolute);if(!st.isDirectory()||st.uid!==process.getuid()||(st.mode&0o077))fail("unsafe_lab");
 const meta=parse(safeFile(path.join(absolute,"lab.json")));
 if(meta.kind!=="REL001_SYNTHETIC_STAGING_ONLY"||meta.lab!==path.basename(absolute)||!/^source-[0-9a-f-]{36}$/.test(meta.sourceId)||!/^target-[0-9a-f-]{36}$/.test(meta.targetId))fail("invalid_lab_identity");
 if(!expected||expected.sourceId!==meta.sourceId||expected.targetId!==meta.targetId||expected.manifestSha!==meta.manifestSha)fail("explicit_identity_required");
 for(const n of ["source","target","recovery"])if(fs.realpathSync(path.join(absolute,n))!==path.join(absolute,n))fail("lab_path_symlink");
 const target=path.join(absolute,"target"),socket=path.join(os.tmpdir(),"bq-mig-"+hash(meta.targetId).slice(0,16));
 const identity=parse(safeFile(path.join(target,"identity.json")));
 if(identity.targetId!==meta.targetId||identity.sourceId!==meta.sourceId||identity.manifestSha!==meta.manifestSha||identity.state!=="created"||!identity.systemId)fail("target_identity_refused");
 if(!fs.existsSync(path.join(target,"pgdata/PG_VERSION")))fail("previously_created_target_missing");
 if(!fs.existsSync(socket)||fs.realpathSync(socket)!==socket)fail("owned_socket_missing");
 const ss=fs.statSync(socket);if(ss.uid!==process.getuid()||(ss.mode&0o077))fail("unsafe_socket");
 return{root:absolute,meta,target,socket,source:path.join(absolute,"source"),identity,expected};
}
function pgEnv(c){return{PATH:process.env.PATH,HOME:c.root,LANG:"C.UTF-8"};}
function pool(c){
 const p=new Pool({host:c.socket,port:55449,user:os.userInfo().username,database:c.meta.database,max:2,
  connectionTimeoutMillis:2000,statement_timeout:20000,lock_timeout:5000});
 p.on("error",()=>{});p.on("connect",client=>client.on("error",()=>{}));return p;
}
async function attest(client,c){
 const r=(await client.query("SELECT current_database() AS db,current_setting('data_directory') AS dir,system_identifier::text AS system FROM pg_control_system()")).rows[0];
 if(r.db!==c.meta.database||fs.realpathSync(r.dir)!==path.join(c.target,"pgdata")||r.system!==c.identity.systemId)fail("target_server_mismatch");
 const t=(await client.query("SELECT * FROM migration.target")).rows;
 if(t.length!==1||t[0].target_id!==c.meta.targetId||t[0].source_id!==c.meta.sourceId||t[0].manifest_sha!==c.meta.manifestSha||t[0].mode!=="staging")fail("target_binding_mismatch");
 if((await client.query("SELECT count(*)::int AS n FROM dev.authority")).rows[0].n!==0)fail("authority_activation_forbidden");
}
function stop(c){execFileSync("pg_ctl",["-D",path.join(c.target,"pgdata"),"-w","-m","fast","stop"],{env:pgEnv(c),stdio:"pipe"});}
function resume(c){
 // Never initialize or create a database on resume.
 if(!fs.existsSync(path.join(c.target,"pgdata/PG_VERSION")))fail("previously_created_target_missing");
 let running=true;try{execFileSync("pg_ctl",["-D",path.join(c.target,"pgdata"),"status"],{env:pgEnv(c),stdio:"pipe"});}catch{running=false;}
 if(!running)execFileSync("pg_ctl",["-D",path.join(c.target,"pgdata"),"-l",path.join(c.target,"postgres.log"),"-o",`-k ${c.socket} -p 55449 -c listen_addresses='' -c unix_socket_permissions=0700 -c fsync=on -c synchronous_commit=on -c full_page_writes=on -c max_connections=12`,"-w","start"],{env:pgEnv(c),stdio:"pipe"});
}
module.exports={fs,path,crypto,os,execFileSync,workspace,base,hash,canonical,digest,fail,write,atomic,safeFile,walk,parse,environment,context,pool,attest,stop,resume,syncDir,pgEnv};
