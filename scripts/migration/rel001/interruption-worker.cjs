// Dedicated test worker, not an operator CLI or activation path.
const {importSource}=require("./import.cjs");
const [root,raw]=process.argv.slice(2);
importSource(root,JSON.parse(raw),{afterRows:async()=>{
 process.send?.({stage:"rows_uncommitted"});
 await new Promise(()=>{});
}}).then(()=>process.exit(0)).catch(e=>{process.send?.({error:e.code||"worker_failed"});process.exit(1);});
