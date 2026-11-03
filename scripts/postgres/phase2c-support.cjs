const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
const {harness,ok,sleep}=require("./harness.cjs");
const output=path.resolve(__dirname,"../../generated-artifacts/phase2c");
fs.mkdirSync(output,{recursive:true});
function save(name,value){fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));}
async function reference(h,port,native=false){
  const child=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/runtime.cjs"),h.root,"--measure",...native?[]:["--reference"]],{cwd:h.proof.app,env:{...h.proof.childEnv,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
  let startupLimit=false;
  const monitor=setInterval(()=>{if(usage(child.pid).rssMiB>384){startupLimit=true;child.kill("SIGKILL");}},100);
  let bound=false;child.stdout.on("data",b=>{if(b.toString().includes(`0.0.0.0:${port}`))bound=true;});child.stderr.on("data",()=>{});
  try{for(let i=0;i<200;i++){await sleep(100);if(child.exitCode!==null||child.signalCode!==null)throw Error(startupLimit?"startup memory safety limit":"Reference worker exited");
    if(bound){try{if((await fetch(`http://127.0.0.1:${port}/health/ready`)).status===200)return child;}catch{}}}
    throw Error("Reference worker not ready");
  }catch(e){await h.stop(child);throw e;}finally{clearInterval(monitor);}
}
function usage(pid){
  try{
    const text=fs.readFileSync(`/proc/${pid}/status`,"utf8"),stat=fs.readFileSync(`/proc/${pid}/stat`,"utf8").split(" ");
    return {rssMiB:Number(text.match(/VmRSS:\s+(\d+)/)?.[1]||0)/1024,cpuSeconds:(Number(stat[13])+Number(stat[14]))/100};
  }catch{return {rssMiB:0,cpuSeconds:0};}
}
module.exports={harness,ok,sleep,save,reference,usage,output};
