// Run command for a separate staging deployment; never `node start.js`.
// Checks the gate, then supervises one runtime worker. A worker that exits (for
// example after retiring a timed-out request scope) is restarted with backoff;
// repeated failures end the process so the platform reports the deployment down.
const path=require("node:path"),{spawn}=require("node:child_process");
const gate=require("./gate.cjs");
function supervise({entry=path.join(__dirname,"runtime.cjs"),args=[],env=process.env,maxRestarts=5,windowMs=300000,baseDelayMs=1000,log=m=>console.error(m)}={}) {
  let child,stopping=false,failures=[],timer,resolveDone;
  const done=new Promise(resolve=>resolveDone=resolve);
  const launch=()=>{
    child=spawn(process.execPath,[entry,...args],{env,stdio:["ignore","inherit","inherit"]});
    child.on("exit",(code,signal)=>{
      if(stopping)return resolveDone(0);
      const now=Date.now();
      failures=failures.filter(t=>now-t<windowMs);failures.push(now);
      if(failures.length>maxRestarts){log(`staging supervisor: ${failures.length} worker exits within ${windowMs} ms; giving up`);return resolveDone(1);}
      const delay=Math.min(30000,baseDelayMs*2**(failures.length-1));
      log(`staging supervisor: worker exited (${signal||code}); restart ${failures.length} in ${delay} ms`);
      timer=setTimeout(launch,delay);
    });
  };
  launch();
  return {done,current:()=>child,stop(){
    stopping=true;clearTimeout(timer);
    if(child.exitCode===null&&child.signalCode===null)child.kill("SIGTERM");else resolveDone(0);
    return done;
  }};
}
module.exports={supervise};

if(require.main===module){
  try{gate.verify({operation:"staging-activate"});}
  catch(e){console.error(`staging activation refused: ${e.message}`);process.exit(1);}
  const supervisor=supervise();
  for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>supervisor.stop());
  supervisor.done.then(code=>process.exit(code));
}
