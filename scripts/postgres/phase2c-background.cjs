// Accelerate timers only in owned invented-data workers. Compare checkpoint
// reference bytes with current code; do not alter the application or its timers.
const {harness,sleep,save}=require("./phase2c-support.cjs");
const {spawn}=require("node:child_process"),path=require("node:path");
(async()=>{
 const rows=[];
 for(const original of [true,false]){
  const port=original?5153:5154,h=await harness(port);let child;
  try{
   const dir=path.resolve(__dirname,"../../development/postgres");
   const source=`
    const fs=require("fs"),Module=require("module"),cp=require("child_process");
    const timer=global.setInterval;global.setInterval=(fn,ms,...args)=>timer(fn,Math.min(ms,500),...args);
    const dir=${JSON.stringify(dir)},original=${original};
    function load(name){
      const filename=dir+"/"+name+".cjs",m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(dir);
      let text=original?cp.execFileSync("git",["show","HEAD:development/postgres/"+name+".cjs"],{cwd:${JSON.stringify(path.resolve(dir,"../.."))},encoding:"utf8"}):fs.readFileSync(filename,"utf8");
      text=text.replace('console.error("Synthetic PostgreSQL job refused:",e.code||"transaction_error")','console.error("BACKGROUND",e.name,(e.stack||"").split("\\\\n")[1])');
      require.cache[filename]=m;m._compile(text,filename);return m.exports;
    }
    load("repository");load("runtime").start(${JSON.stringify(h.root)}).catch(e=>{console.error("PROBE_START",e.name);process.exitCode=1;});
   `;
   let logs="";child=spawn(process.execPath,["-e",source],{cwd:h.proof.app,env:{...h.proof.childEnv,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
   child.stdout.on("data",b=>logs+=b);child.stderr.on("data",b=>logs+=b);
   let ready=false;for(let i=0;i<100;i++){await sleep(100);if(logs.includes(`0.0.0.0:${port}`)){ready=true;break;}if(child.exitCode!==null)break;}
   if(ready)await sleep(1800);
   rows.push({mode:original?"checkpoint reference":"current",ready,refusals:logs.split("\n").filter(l=>l.startsWith("BACKGROUND")||l.startsWith("PROBE_START")),limits:"Timers accelerated only in isolated test workers; stack frame only, no exception messages or credential values."});
  }finally{if(child)await h.stop(child);await h.close();}
 }
 save("background-comparison.json",{results:rows});console.log(JSON.stringify(rows));
})();
