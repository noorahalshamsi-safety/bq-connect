// Real isolated PostgreSQL only. No application state or Production access.
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const assert=require("node:assert/strict");
const {base}=require("../../deploy/fresh/config.cjs");
const {prepare}=require("../../development/postgres/isolation.cjs");
const {Repository}=require(path.join(base,"development/postgres/repository.cjs"));
const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-pg-dev-lock-snapshot-"));
const sql=fs.readFileSync(path.join(__dirname,"advisory-lock-snapshot.sql"),"utf8");
let proof,repo,holder,waiter,observer,waiting;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function snapshot(){
  const results=await observer.query(sql);
  return results.find(result=>result.command==="SELECT").rows;
}
async function main(){
  proof=prepare(root);repo=new Repository(proof);
  holder=await repo.pool.connect();waiter=await repo.pool.connect();observer=await repo.pool.connect();
  await holder.query("SET application_name='bq-fresh-production'");
  await waiter.query("SET application_name='bq-fresh-production'");
  await holder.query("BEGIN");
  await holder.query("SELECT pg_advisory_xact_lock(1793705963) /* SYNTHETIC_PRIVATE_QUERY_VALUE */");
  await waiter.query("BEGIN");
  waiting=waiter.query("SELECT pg_advisory_xact_lock(1793705963)");
  waiting.catch(()=>{});
  let rows;
  for(let i=0;i<100;i++){
    rows=await snapshot();
    if(rows.length===2&&rows.some(row=>row.granted===false))break;
    await delay(20);
  }
  assert.equal(rows.length,2);
  const owner=rows.find(row=>row.granted),blocked=rows.find(row=>row.granted===false);
  assert(owner&&blocked);
  assert(rows.every(row=>row.evidence==="LOCK_OBSERVED"&&row.read_only&&
    row.application_class==="FRESH_RUNTIME"&&row.transaction_ms>=0&&
    /^[a-f0-9]{12}$/.test(row.backend_label)));
  assert.equal(blocked.wait_event_type,"Lock");assert.equal(blocked.wait_event,"advisory");
  assert.deepEqual(blocked.blocker_labels,[owner.backend_label]);
  assert(!JSON.stringify(rows).includes("SYNTHETIC_PRIVATE_QUERY_VALUE"));
  // Observing must not release, acquire, cancel or interfere with either lock.
  const same=await snapshot();
  assert(same.some(row=>!row.granted&&row.blocker_labels.includes(owner.backend_label)));
  await holder.query("ROLLBACK");await waiting;
  rows=await snapshot();
  assert.equal(rows.length,1);assert.equal(rows[0].granted,true);
  assert.equal(rows[0].backend_label,blocked.backend_label);
  await waiter.query("ROLLBACK");
  rows=await snapshot();
  assert.equal(rows.length,1);assert.equal(rows[0].evidence,"NO_MATCHING_LOCK_AT_CAPTURE");
  assert.equal(rows[0].backend_label,null);
  // Test the replica-refusal branch with only its context predicate replaced
  // in this isolated test. No claim that a real replica was provisioned here.
  const refused=await observer.query(sql.replace("NOT pg_is_in_recovery() AS is_primary","false AS is_primary"));
  const refusedRows=refused.find(result=>result.command==="SELECT").rows;
  assert.equal(refusedRows[0].evidence,"PRIMARY_REQUIRED");
  assert.equal(refusedRows[0].backend_label,null);
  console.log(JSON.stringify({result:"PASS",realLockHolderAndWaiter:true,
    readOnlyObservation:true,releaseAndReacquire:true,redactedQueryAndIdentity:true,
    simulatedReplicaRefusal:true,productionAccess:false}));
}
main().catch(error=>{
  console.error(JSON.stringify({result:"BLOCKED",category:error.name}));process.exitCode=1;
}).finally(async()=>{
  await holder?.query("ROLLBACK").catch(()=>{});
  await waiting?.catch(()=>{});
  await waiter?.query("ROLLBACK").catch(()=>{});
  holder?.release();waiter?.release();observer?.release();
  await repo?.pool.end().catch(()=>{});
  try{proof?.stop();}catch{}
  fs.rmSync(root,{recursive:true,force:true});
});
