const C=require("./common.cjs"),S=require("./source.cjs"),R=require("./reconcile.cjs"),{verifyBundle}=require("./import.cjs");
const {fs,path,hash,digest,fail,write,atomic}=C;
async function reverse(root,expected){
 const c=C.context(root,expected),source=S.load(c),p=C.pool(c);let client;
 try{
  client=await p.connect();await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await C.attest(client,c);
  const receipt=(await client.query("SELECT * FROM migration.receipt")).rows;
  if(receipt.length!==1||receipt[0].manifest_sha!==c.meta.manifestSha)fail("import_not_committed");
  const report=await R.compare(client,c,source),sql=await R.readSql(client);
  if(report.semanticSha!==receipt[0].semantic_sha||report.mediaSha!==receipt[0].media_sha)fail("receipt_content_mismatch");
  const destination=path.join(c.root,"reverse-"+C.crypto.randomUUID());fs.mkdirSync(destination,{mode:0o700});
  fs.mkdirSync(path.join(destination,"data"),{mode:0o700});fs.mkdirSync(path.join(destination,"media"),{mode:0o700});
  const coverage=[];
  for(const f of S.files){
   const b=Buffer.from(JSON.stringify(sql.values[f],null,2)+"\n");write(path.join(destination,"data",f),b,true);
   const actual=C.parse(C.safeFile(path.join(destination,"data",f)));
   if(C.canonical(actual)!==C.canonical(source.values[f]))fail("reverse_semantic_mismatch");
   coverage.push({file:f,status:"PASS",semanticSha:digest(actual),sourceBytesSha:hash(source.bytes.get("data/"+f)),
    reverseBytesSha:hash(b),byteEqual:b.equals(source.bytes.get("data/"+f))});
  }
  const mediaObjects=[];
  for(const r of (await client.query("SELECT legacy,bytes,sha256 FROM migration.media")).rows){
   if(hash(r.bytes)!==r.sha256)fail("reverse_media_checksum");
   write(path.join(destination,r.legacy.slice(1)),r.bytes,true);
   if(hash(C.safeFile(path.join(destination,r.legacy.slice(1))))!==r.sha256)fail("reverse_media_readback");
   mediaObjects.push({referenceSha:hash(r.legacy),bytesSha:r.sha256,status:"PASS"});
  }
  const escrow=verifyBundle(c,source);
  await client.query("ROLLBACK");
  const result={status:"PASS",sourceId:c.meta.sourceId,targetId:c.meta.targetId,semanticSha:report.semanticSha,
   files:coverage.length,coverage,mediaObjects,sourceEscrow:escrow,
   destination:path.relative(C.workspace,destination),
   warning:"Development reconstruction only; JSON formatting/key order may differ. Exact original bytes are in separate private escrow, not inferred from JSONB. No signing keys copied into reverse output; no legacy activation suitability claimed."};
  atomic(path.join(c.root,"reverse-report.json"),result);return result;
 }finally{await client?.query("ROLLBACK").catch(()=>{});client?.release();await p.end();}
}
module.exports={reverse};
