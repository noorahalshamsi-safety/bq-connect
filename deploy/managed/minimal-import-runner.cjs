// Future, separately approved PUBLISHED run command. Never used by normal
// startup. It always stays in maintenance, including after a successful import.
const fs=require("node:fs"),{launch}=require("./minimal-bootstrap.cjs"),{execute}=require("../../migration/minimal/execute.cjs");
function requested(env){return env.REPLIT_DEPLOYMENT==="1"&&env.BQ_MINIMAL_OPERATION==="owner-approved-import-once";}
async function run({env=process.env,port,executeImport=execute}={}){
  const app=await launch({port,maintenanceOnly:true});
  if(requested(env)){
    try{
      const manifest=JSON.parse(fs.readFileSync(env.BQ_MANAGED_MANIFEST_FILE,"utf8"));
      const result=await executeImport({env,manifest});
      console.log(JSON.stringify({mode:"maintenance",imported:true,...result}));
    }catch(e){
      console.error(JSON.stringify({mode:"maintenance",imported:false,error:/^(minimal_|managed_)/.test(e.code||"")?e.code:"minimal_execution_failed",
        sourceWritten:false,...(e.counts?{observedCounts:e.counts}: {})}));
    }
  }else console.log(JSON.stringify({mode:"maintenance",imported:false,executionRequested:false}));
  return app;
}
module.exports={run,requested};
if(require.main===module)run().then(app=>{for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>app.close().finally(()=>process.exit(0)));})
  .catch(()=>{console.error("minimal_maintenance_listener_failed");process.exitCode=1;});
