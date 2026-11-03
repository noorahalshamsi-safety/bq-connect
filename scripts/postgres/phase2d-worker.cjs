// Private synthetic diagnostic worker. No public route or environment switch.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),cp=require("node:child_process");
const root=process.argv[2],reference=process.argv.includes("--phase2b"),workspace=path.resolve(__dirname,"../.."),dir=path.join(workspace,"development/postgres");
const capturedSnapshot=process.argv.find(a=>a.startsWith("--snapshot="))?.slice(11);
process.argv[3]="--measure";
const timers=[],events=[];
let fault=null,releaseGate,application;
const send=value=>{events.push(value);process.send?.(value);};
const {Client}=require("pg"),query=Client.prototype.query;
Client.prototype.query=function(...args){
 const command=typeof args[0]==="string"&&/^(BEGIN|COMMIT|ROLLBACK)$/.test(args[0])?args[0]:null,result=query.apply(this,args);
 if(command&&result?.then)return result.then(value=>{send({type:"sql-boundary",command,acknowledged:true,backendPid:this.processID});return value;},error=>{send({type:"sql-boundary",command,acknowledged:false,backendPid:this.processID});throw error;});
 return result;
};
global.__phase2dMemory=(stage,details={})=>send({type:"memory",stage,...details,...process.memoryUsage(),at:performance.now()});
global.__phase2dJob=async(c,queueState)=>{
 const r=await c.client.query("SELECT pg_backend_pid() AS pid,txid_current()::text AS tx, (SELECT count(*)::int FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory') AS advisory_locks");
 send({type:"job-start",...r.rows[0],attestation:"begin verified dataset and epoch",queueState,clientQueryable:c.client._queryable,connectionEnding:c.client._ending});
};
global.__phase2dFailure=e=>send({type:"job-error",category:e.name,code:e.code||null,frames:(e.stack||"").split("\n").slice(1,5).map(l=>l.match(/[\w.-]+\.(?:c?js):\d+:\d+/)?.[0]).filter(Boolean)});
global.__phase2dRun=async(fn,c)=>{
 const f=fault;fault=null;
 if(f?.mode==="unauthorized")fs.writeFileSync(path.join(application.proof.app,"data/unmapped-secret.json"),"forbidden");
 if(f?.mode==="before")throw Error("injected_job_failure");
 await fn();
 if(f?.mode==="after")throw Error("injected_job_failure");
 if(f?.mode==="hold"){
   send({type:"job-held",tag:f.tag,backendPid:c.client.processID});
   await new Promise(resolve=>releaseGate=resolve);
 }
};
function load(name){
 const filename=path.join(dir,name+".cjs"),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(dir);
 const snapshot=capturedSnapshot;
 let text=snapshot?JSON.parse(fs.readFileSync(snapshot,"utf8"))[name]:reference?cp.execFileSync("git",["show","7209c03:development/postgres/"+name+".cjs"],{cwd:workspace,encoding:"utf8"}):fs.readFileSync(filename,"utf8");
 if(name==="repository"){
  text=text.replace("const acquired=performance.now();","const acquired=performance.now();global.__phase2dMemory('sql-connection',{backendPid:c.processID});");
  text=text.replace("records.push(...r.rows.map(row=>({...row,table})));","records.push(...r.rows.map(row=>({...row,table})));if(['posts','accounts','employees'].includes(table))global.__phase2dMemory('sql-table-'+table,{rows:r.rows.length});");
  text=text.replace("for(const row of r.rows){","if(['posts','accounts','employees'].includes(table))global.__phase2dMemory('sql-table-'+table,{rows:r.rows.length});for(const row of r.rows){");
 }
 if(name==="runtime"){
  if(text.includes("global.__bqDevInterval=(fn,ms)=>{const timer="))text=text.replace("global.__bqDevInterval=(fn,ms)=>{const timer=setInterval(()=>job(fn),ms);", "global.__bqDevInterval=(fn,ms)=>{const invoke=()=>job(fn);global.__phase2dTimers.push({name:fn.name||'anonymous',ms,invoke});const timer=setInterval(invoke,ms);");
  else text=text.replace("const timer=setInterval(invoke,ms);","global.__phase2dTimers.push({name:fn.name||'anonymous',ms,invoke});const timer=setInterval(invoke,ms);");
  text=text.replace("await hydrate(await repo.begin());","await hydrate(await repo.begin());await global.__phase2dJob(c,{httpPending:pending,ingress,poisoned,stopping:typeof stopping==='undefined'?false:stopping});");
  text=text.replace("await fn();","await global.__phase2dRun(fn,context);");
  text=text.replace(/console.error\("Synthetic PostgreSQL job refused:",[^;]+;/,"global.__phase2dFailure(e);");
  text=text.replace("async function hydrate(t,nativeRead=false) {","async function hydrate(t,nativeRead=false) {global.__phase2dMemory('graph-decoded');");
  text=text.replace("async function hydrate(t) {","async function hydrate(t) {global.__phase2dMemory('graph-decoded');");
  text=text.replace("async function refresh() {","async function refresh() {global.__phase2dMemory('before-auth-directory-refresh');");
  text=text.replace('app?.__refresh();',"app?.__refresh();global.__phase2dMemory('after-auth-directory-refresh');");
  text=text.replace('auth=require(path.join(proof.app,"auth.js"));',"global.__phase2dMemory('before-auth-load');auth=require(path.join(proof.app,'auth.js'));global.__phase2dMemory('after-auth-load');");
  text=text.replace('app=require(path.join(proof.app,"server.js"));',"global.__phase2dMemory('before-app-load');app=require(path.join(proof.app,'server.js'));global.__phase2dMemory('after-app-load');");
  text=text.replace('const chunks=[];',"const chunks=[];global.__phase2dMemory('request-response-buffer-start');");
  text=text.replace("const response=Buffer.concat(chunks);","const response=Buffer.concat(chunks);global.__phase2dMemory('response-constructed',{responseBytes:response.length});");
  text=text.replace(/(const|let) boot=context=await hydrate/,"const originalHydrate=hydrate;hydrate=async(...args)=>{const value=await originalHydrate(...args);global.__phase2dMemory('media-and-buffers',{media:value.media.size,bufferBytes:[...value.buffers.values()].reduce((n,b)=>n+b.length,0)});return value;};$1 boot=context=await hydrate");
 }
 require.cache[filename]=m;m._compile(text,filename);return m.exports;
}
global.__phase2dTimers=timers;
const codec=require(path.join(dir,"codec.cjs")),decode=codec.decode;
codec.decode=function(file,rows,...args){const value=decode.call(this,file,rows,...args);if(["ideas.json","accounts.json","employees.json"].includes(file))global.__phase2dMemory("decode-"+file,{rows:rows.length,entities:Array.isArray(value)?value.length:Object.keys(value||{}).length});return value;};
global.__phase2dMemory("process-start");
load("repository");
load("runtime").start(root).then(app=>{
 application=app;
 global.__phase2dMemory("ready");
 send({type:"ready",timers:timers.map(({name,ms},id)=>({id,name,ms}))});
 process.on("message",async message=>{
  if(message.action==="job"){
   fault=message.fault||null;
   const at=events.length;try{const value=await timers[message.id].invoke();send({type:"job-result",id:message.id,request:message.request,value,events:events.slice(at)});}catch(e){global.__phase2dFailure(e);send({type:"job-result",id:message.id,request:message.request,failed:true});}
  }else if(message.action==="gc"){global.gc?.();global.__phase2dMemory("explicit-gc");send({type:"gc-done",request:message.request});}
  else if(message.action==="release"){releaseGate?.();releaseGate=null;}
  else if(message.action==="shutdown"){await app.close();send({type:"closed",request:message.request});}
 });
}).catch(e=>{send({type:"startup-error",category:e.name,code:e.code||null});process.exit(1);});
