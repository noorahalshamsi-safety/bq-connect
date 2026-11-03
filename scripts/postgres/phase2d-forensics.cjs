const {harness,sleep}=require("./harness.cjs"),{spawn}=require("node:child_process"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const output=path.resolve(__dirname,"../../generated-artifacts/phase2d");fs.mkdirSync(output,{recursive:true});
async function worker(h,port,reference=false,snapshot=null,onSpawn=null){
 const messages=[],child=spawn(process.execPath,["--expose-gc",path.join(__dirname,"phase2d-worker.cjs"),h.root,...reference?["--phase2b"]:[],...snapshot?["--snapshot="+snapshot]:[]],{cwd:h.proof.app,env:{...h.proof.childEnv,PORT:String(port)},stdio:["ignore","pipe","pipe","ipc"]});
 onSpawn?.(child,messages);
 child.on("message",m=>messages.push(m));child.stdout.on("data",()=>{});child.stderr.on("data",()=>{});
 async function wait(type,request,timeout=20000){
  const until=Date.now()+timeout;
  while(Date.now()<until){const found=messages.find(m=>m.type===type&&(!request||m.request===request));if(found)return found;if(child.exitCode!==null||child.signalCode!==null)throw Error("diagnostic_worker_exited");await sleep(50);}
  throw Error("diagnostic_deadline");
 }
 try{const ready=await wait("ready");return{child,messages,ready,call:async(action,id,extra={})=>{const request=crypto.randomUUID();child.send({action,id,request,...extra});return wait(action==="gc"?"gc-done":action==="shutdown"?"closed":"job-result",request,extra.timeout||20000);}};}catch(e){await h.stop(child);throw e;}
}
async function main(){
 const results=[];
 for(const reference of [true,false]){
  const h=await harness(reference?5160:5161);let w;
  try{
   w=await worker(h,reference?5160:5161,reference,!reference&&process.argv.includes("--reproduce")?path.join(output,"before-sources.json"):null);
   const outcomes=[];
   for(const timer of w.ready.timers){
    const before=await h.repo.pool.query("SELECT count(*)::int AS n FROM dev.backups");
    const result=await w.call("job",timer.id),after=await h.repo.pool.query("SELECT count(*)::int AS n FROM dev.backups");
    outcomes.push({timer,result,backupsBefore:before.rows[0].n,backupsAfter:after.rows[0].n});
   }
   results.push({reference,outcomes,memory:w.messages.filter(m=>m.type==="memory")});
  }catch(e){results.push({reference,status:"BLOCKED",reason:e.message});}
  finally{if(w)await h.stop(w.child);await h.close();}
  fs.writeFileSync(path.join(output,process.argv.includes("--reproduce")?"background-before-detailed.json":"background-current.json"),JSON.stringify({results},null,2));console.log(reference?"Phase2B":"Current",JSON.stringify(results.at(-1).outcomes?.map(o=>({timer:o.timer,error:o.result.events?.filter(e=>e.type==="job-error")}))||results.at(-1)));
 }
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={worker,output};
