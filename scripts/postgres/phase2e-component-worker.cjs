const {Repository}=require("../../development/postgres/repository.cjs"),{verify}=require("../../development/postgres/isolation.cjs");
const {page}=require("./phase2e-candidate.cjs"),crypto=require("node:crypto"),repo=new Repository(verify(process.argv[2]));
process.send({type:"ready",memory:process.memoryUsage()});
process.on("message",async message=>{
 const at=performance.now();let c;
 try{
  const beforePool=performance.now();c=await repo.pool.connect();const poolWaitMs=performance.now()-beforePool;
  // The unchanged authority verifier takes FOR SHARE, which PostgreSQL rejects
  // in a READ ONLY transaction. Preserve that verifier; execute SELECT-only
  // component code in the ordinary guarded transaction and always roll it back.
  await c.query("BEGIN");const lockAt=performance.now();await c.query("SELECT pg_advisory_xact_lock(1793705963)");
  const advisoryWaitMs=performance.now()-lockAt,held=performance.now();await repo.verify(c);
  const result=await page(c,{limit:16,scopeKey:"invented-public-fixture",accept:()=>true});
  const bytes=Buffer.from(JSON.stringify(result.items)),digest=crypto.createHash("sha256").update(bytes).digest("hex");
  const memory=process.memoryUsage();await c.query("ROLLBACK");c.release();c=null;
  process.send({type:"result",request:message.request,status:"SUCCESS",ms:performance.now()-at,poolWaitMs,advisoryWaitMs,advisoryHeldMs:performance.now()-held,bytes:bytes.length,digest,count:result.items.length,metrics:result.metrics,memory});
 }catch(e){if(c){await c.query("ROLLBACK").catch(()=>{});c.release();}process.send({type:"result",request:message.request,status:"FAILED",code:e.code||e.message,memory:process.memoryUsage()});}
});
