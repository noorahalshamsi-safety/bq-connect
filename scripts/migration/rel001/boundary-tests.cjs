const C=require("./common.cjs"),L=require("./lab.cjs"),S=require("./source.cjs"),I=require("./import.cjs"),R=require("./reconcile.cjs");
const assert=require("node:assert/strict"),{fs,path,hash,atomic}=C;
const out=path.join(C.workspace,"generated-artifacts/rel001-evidence"),results=[];let lab;
async function run(id,name,fn){try{results.push({id,name,status:"PASS",evidence:await fn()});}catch(e){results.push({id,name,status:"FAIL",error:e.code||e.message.slice(0,200)});}console.log(id,results.at(-1).status);}
const fingerprint=c=>C.digest(C.walk(c.source).map(n=>[n,hash(C.safeFile(path.join(c.source,n)))]));
(async()=>{
try{
 lab=await L.create({mutate:s=>{s.values["mail.json"].unknownPath="/media/opaque-uninterpreted.bin";s.values["messages.json"].push({at:"not-a-business-timestamp-schema"});}});
 const c=C.context(lab.root,lab.expected),before=fingerprint(c);
 await run("M25","Opaque mail/messages are preserved without invented media/date semantics",async()=>{
  const r=await I.importSource(lab.root,lab.expected);assert.equal(r.status,"PASS");
  const s=S.load(c);assert.equal(s.values["mail.json"].unknownPath,"/media/opaque-uninterpreted.bin");
  return{fullSemanticEquality:true,opaqueUnknownSemanticsNotInterpreted:true};
 });
 await run("M26","Unavailable database refuses without reinitializing and same cluster recovers",async()=>{
  C.stop(c);await assert.rejects(R.reconcile(lab.root,lab.expected));C.resume(c);
  const r=await R.reconcile(lab.root,lab.expected);assert.equal(r.status,"PASS");assert.equal(fingerprint(c),before);
  return{outageRefused:true,recoverySameIdentity:true,sourceIntact:true};
 });
 await run("M27","Source file symlink is refused before SQL",async()=>{
  const f=path.join(c.source,"data/ideas.json"),saved=f+".owned";
  fs.renameSync(f,saved);fs.symlinkSync(saved,f);
  try{await assert.rejects(I.importSource(lab.root,lab.expected),e=>e.code==="unsafe_file");}
  finally{fs.unlinkSync(f);fs.renameSync(saved,f);}
  assert.equal(fingerprint(c),before);return{symlinkRefused:true,sourceRestoredByTestOnly:true};
 });
 await run("M28","Unexpected source file blocks inventory rather than disappearing",async()=>{
  const f=path.join(c.source,"data/unknown-path.json");C.write(f,"{}",true);
  try{await assert.rejects(I.importSource(lab.root,lab.expected),e=>e.code==="source_inventory_mismatch");}
  finally{fs.unlinkSync(f);}
  assert.equal(fingerprint(c),before);return{unknownFileNotDropped:true};
 });
 await run("M29","Array-order corruption fails independent semantic reconciliation",async()=>{
  const p=C.pool(c),client=await p.connect();
  try{
   await client.query("BEGIN");await client.query("UPDATE dev.comments SET ordinal=1-ordinal WHERE parent=$1",[JSON.stringify(["ideas.json",0,"comments"])]);
   await assert.rejects(R.compare(client,c,S.load(c)),e=>e.code?.startsWith("semantic_mismatch"));
  }finally{await client.query("ROLLBACK");client.release();await p.end();}
  assert.equal(fingerprint(c),before);return{countsUnchanged:true,arrayOrderingMismatch:true};
 });
 await run("M30","Corrupt source escrow is rejected, not silently regenerated",async()=>{
  const f=path.join(c.root,"recovery",c.meta.manifestSha,"custody/backup.key"),original=fs.readFileSync(f);
  fs.chmodSync(f,0o600);C.write(f,Buffer.from("corrupt invented escrow"));
  try{await assert.rejects(I.importSource(lab.root,lab.expected),e=>e.code==="escrow_bytes_mismatch");}
  finally{C.write(f,original);fs.chmodSync(f,0o400);}
  assert.equal(fingerprint(c),before);return{corruptEscrowRefused:true,noAutomaticReplacement:true};
 });
 await run("M31","Decimal precision loss is refused, equivalent decimal notation retained in escrow",async()=>{
  assert.throws(()=>C.parse(Buffer.from('{"n":1.0000000000000001}')),e=>e.code==="unsupported_json_number");
  assert.throws(()=>C.parse(Buffer.from('{"n":1e-9999}')),e=>e.code==="unsupported_json_number");
  assert.equal(C.parse(Buffer.from('{"n":1.2500e1}')).n,12.5);
  assert.equal(C.parse(Buffer.from('{"n":0.1}')).n,0.1);
  assert.equal(C.parse(Buffer.from('{"n":0e10}')).n,0);
  return{lossyDecimalRefused:true,underflowRefused:true,semanticEquivalentNotation:true};
 });
 await R.reconcile(lab.root,lab.expected);
}catch(e){results.push({id:"ENV",status:"FAIL",error:e.code||e.message.slice(0,200)});}
finally{
 if(lab)try{C.stop(C.context(lab.root,lab.expected));}catch{}
 const summary={results,pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length};
 atomic(path.join(out,"boundary-tests.json"),summary);console.log(JSON.stringify({pass:summary.pass,fail:summary.fail}));if(summary.fail)process.exitCode=1;
}
})();
