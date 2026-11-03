const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {harness,sleep,ok}=require("./harness.cjs"),{usage}=require("./phase2c-support.cjs");
const output=path.resolve(__dirname,"../../generated-artifacts/phase2e");fs.mkdirSync(output,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
async function seed(h,n){const s=fs.readFileSync(path.join(__dirname,"phase2c-load.cjs"),"utf8"),a=s.indexOf("async function seed("),b=s.indexOf("\n(async()=>",a);return Function("codec","crypto","limits","usage",`return (${s.slice(a,b).trim()});`)(require("../../development/postgres/codec.cjs"),crypto,{controllerRssMiB:512},usage)(h,1000,n);}
async function diagnostic(h,port){
 const {fork}=require("node:child_process"),messages=[],errors=[];
 const child=fork(path.join(__dirname,"phase2e-worker.cjs"),[h.root,"--measure"],{env:{...h.proof.childEnv,PORT:String(port)},stdio:["ignore","pipe","pipe","ipc"]});
 child.stdout.resume();child.stderr.on("data",b=>errors.push(b.toString()));child.on("message",m=>messages.push(m));
 for(let i=0;i<220;i++){if(messages.some(m=>m.type==="ready"))return{child,messages};if(child.exitCode!==null)throw Error("diagnostic_start_failed");await sleep(50);}
 await h.stop(child);throw Error("diagnostic_start_deadline: "+errors.join("").slice(0,500));
}
module.exports={harness,sleep,ok,usage,output,save,hash,seed,diagnostic};
