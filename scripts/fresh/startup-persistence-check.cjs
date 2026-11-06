// No database or storage access. Verify the exact boot projection and simulate
// network latency per SQL round trip, without borrowing Production data.
const assert=require("node:assert/strict"),path=require("node:path");
const {base,canonical,sha}=require("../../deploy/fresh/config.cjs");
const codec=require(path.join(base,"development/postgres/codec.cjs"));
const {saveFile}=require(path.join(base,"development/postgres/repository.cjs"));
async function main(){
  const groups=[{id:"synthetic-department",kind:"department",name:"Synthetic",
    members:Array.from({length:6311},(_,i)=>String(10000+i))}];
  const expected=codec.encode("groups.json",groups).map(r=>[
    r.table,r.id,"groups.json",r.parent,r.entry_key,r.ordinal,JSON.stringify(r.attrs),JSON.stringify(r.shape)
  ]).sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  const actual=[];let calls=0;
  const client={query:async(sql,values)=>{
    calls++;
    if(sql.startsWith("INSERT")){
      const table=sql.match(/^INSERT INTO dev\.(\w+)/)[1];
      assert(values.length<=250*7);
      for(let i=0;i<values.length;i+=7)actual.push([table,...values.slice(i,i+7)]);
      await new Promise(r=>setTimeout(r,5));
    }
    return{rowCount:1};
  }};
  const start=performance.now();
  await saveFile(client,"groups.json",groups,1);
  const elapsedMs=Math.round(performance.now()-start);
  actual.sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  assert.equal(sha(canonical(actual)),sha(canonical(expected)));
  assert(calls<40,"boot_persistence_must_not_issue_one_query_per_employee");
  assert(elapsedMs<2500,"simulated_remote_boot_persistence_must_be_bounded");
  console.log(JSON.stringify({result:"PASS",employees:6311,projectionPreserved:true,
    roundTrips:calls,previousRoundTrips:expected.length+2,simulatedRoundTripMs:5,
    elapsedMs,productionAccess:false}));
}
main().catch(()=>{console.error('{"result":"BLOCKED","test":"startup-persistence"}');process.exitCode=1;});
