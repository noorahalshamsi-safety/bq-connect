const {harness:base,sleep,ok}=require("../harness.cjs"),{fork}=require("node:child_process"),fs=require("node:fs"),path=require("node:path");
const {usage}=require("../phase2c-support.cjs");
const output=path.resolve(__dirname,"../../../generated-artifacts/phase2f");fs.mkdirSync(output,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2));
async function boot(h,port){
 const messages=[],errors=[],child=fork(path.join(__dirname,"worker.cjs"),[h.root,"--measure"],{env:{...h.proof.childEnv,PORT:String(port)},stdio:["ignore","pipe","pipe","ipc"]});
 child.stdout.resume();child.stderr.on("data",b=>errors.push(b.toString()));
 child.on("error",e=>errors.push(e.code||e.message));
 child.on("message",m=>messages.push(m));
 let reason="",peak=0;
 const monitor=setInterval(()=>{const rss=usage(child.pid).rssMiB;peak=Math.max(peak,rss);if(rss>384||usage(process.pid).rssMiB>512){reason=rss>384?"worker RSS guard":"controller RSS guard";child.kill("SIGKILL");}},40);
 child.once("exit",()=>clearInterval(monitor));
 for(let i=0;i<400;i++){
  if(messages.some(m=>m.type==="ready"))return{child,messages,errors,get peak(){return peak;},get reason(){return reason;},stop:async()=>{clearInterval(monitor);await h.stop(child);}};
  if(child.exitCode!==null||child.signalCode!==null||errors.join("").includes("refused:")){clearInterval(monitor);await h.stop(child);throw Error(reason||errors.join("").slice(-700)||"private_boot_failed");}
  await sleep(50);
 }
 await h.stop(child);throw Error("private_boot_deadline:"+errors.join("").slice(-700));
}
async function fixture(h,count=96){
 const now=Date.now(),ideas=Array.from({length:count},(_,i)=>({id:`synthetic-feed-${i}`,number:i+1,badge:i%2?"103":"101",name:i%2?"Invented Colleague":"Invented Engineer",department:i%2?"Operations":"Engineering",position:"Engineer",type:i%13===0?"story":i%9===0?"poll":i%7===0?"announcement":"post",title:`Synthetic update ${i+1} — تحديث تجريبي`,text:`Invented project note ${i+1}. Synthetic data only. محتوى تجريبي معزول.`,createdAt:new Date(now-i*60000).toISOString(),...(i%13===0?{expiresAt:new Date(now+(i%26===0?-86400000:86400000)).toISOString()}:{}),...(i%11===0?{groupId:"private-g"}:{}),...(i%17===0?{hidden:true}:{}),comments:[{id:"comment-"+i,badge:"102",name:"Invented Reviewer",text:"Synthetic reply",createdAt:new Date(now-1000).toISOString(),likes:["101"]}],ratings:[{badge:"102",stars:5}],reposts:[],poll:i%9===0?[{text:"نعم / Yes",votes:["101"]},{text:"No",votes:[]}]:[],...(i%19===0?{reports:[{badge:"102",at:new Date(now).toISOString()}]}:{}),legacy:{keep:null}}));
 await h.repo.importSynthetic({"ideas.json":ideas,"groups.json":[{id:"private-g",name:"Invented group",members:["101","103"]},{id:"empty-g",members:[]}],"follows.json":{"101":{people:["103"],departments:["Operations"]}},"bookmarks.json":{"101":ideas.filter((_,i)=>i%6===0).map(p=>p.id)},"daily-sparks.json":{v:2,date:new Date(now+10800000).toISOString().slice(0,10),items:{}}});
 return ideas;
}
module.exports={base,sleep,ok,boot,fixture,output,save};
