const C=require("./common.cjs"),S=require("./source.cjs"),R=require("./reconcile.cjs");
const codec=require("../../../development/postgres/codec.cjs");
const {fs,path,hash,digest,fail,write,atomic}=C;
function bundle(c,source){
 const destination=path.join(c.root,"recovery",c.meta.manifestSha);
 if(fs.existsSync(destination)){verifyBundle(c,source,destination);return destination;}
 const stage=path.join(c.root,"recovery",".candidate-"+C.crypto.randomUUID());fs.mkdirSync(stage,{mode:0o700});
 for(const [name,b]of [...source.bytes,["manifest.json",C.safeFile(path.join(c.source,"manifest.json"))]]){
  const file=path.join(stage,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});write(file,b,true);fs.chmodSync(file,0o400);
 }
 for(const dir of ["data","media","custody"])C.syncDir(path.join(stage,dir));C.syncDir(stage);
 fs.renameSync(stage,destination);C.syncDir(path.dirname(destination));verifyBundle(c,source,destination);return destination;
}
function verifyBundle(c,source,dir=path.join(c.root,"recovery",c.meta.manifestSha)){
 if(digest(C.walk(dir))!==digest([...source.bytes.keys(),"manifest.json"].sort()))fail("escrow_inventory_mismatch");
 for(const [name,b]of source.bytes)if(!C.safeFile(path.join(dir,name)).equals(b))fail("escrow_bytes_mismatch");
 if(hash(C.safeFile(path.join(dir,"manifest.json")))!==c.meta.manifestSha)fail("escrow_manifest_mismatch");
 return{status:"PASS",files:source.bytes.size+1,exactBytes:true,bundleIdentity:c.meta.manifestSha};
}
async function importSource(root,expected,hooks={}){
 const c=C.context(root,expected),source=S.load(c);bundle(c,source);
 const p=C.pool(c);let client,committed=false;
 try{
  client=await p.connect();await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(1793770374)");await C.attest(client,c);
  const receipts=(await client.query("SELECT * FROM migration.receipt")).rows;
  if(receipts.length){
   if(receipts.length!==1||receipts[0].source_id!==c.meta.sourceId||receipts[0].manifest_sha!==c.meta.manifestSha)fail("different_source_replay");
   const report=await R.compare(client,c,source);
   if(report.semanticSha!==receipts[0].semantic_sha||report.mediaSha!==receipts[0].media_sha)fail("committed_target_changed");
   await client.query("ROLLBACK");
   atomic(path.join(c.target,"journal.json"),{state:"committed",sourceId:c.meta.sourceId,targetId:c.meta.targetId,manifestSha:c.meta.manifestSha});
   return{...report,operation:"IDENTICAL_IMPORT_NOOP",escrow:verifyBundle(c,source)};
  }
  for(const table of ["dev.files","migration.media","migration.media_refs","migration.source_files"]){
   if((await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n)fail("unreceipted_target_data");
  }
  // Empty metadata may not conceal orphan graph rows or a deleted receipt.
  for(const table of codec.tables.keys())if((await client.query(`SELECT count(*)::int AS n FROM dev.${table}`)).rows[0].n)fail("unreceipted_target_data");
  atomic(path.join(c.target,"journal.json"),{state:"importing",sourceId:c.meta.sourceId,targetId:c.meta.targetId,manifestSha:c.meta.manifestSha});
  for(const f of S.files){
   await client.query("INSERT INTO dev.files(name) VALUES($1)",[f]);
   for(const r of codec.encode(f,source.values[f])){
    await client.query(`INSERT INTO dev.${r.table}(id,file_name,parent,entry_key,ordinal,attrs,shape) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
     [r.id,f,r.parent,r.entry_key,r.ordinal,JSON.stringify(r.attrs),JSON.stringify(r.shape)]);
   }
  }
  for(const [name,b]of source.bytes)if(name.startsWith("media/"))
   await client.query("INSERT INTO migration.media VALUES($1,$2,$3,$4)",["/"+name,hash(b),b.length,b]);
  for(const ref of source.refs)await client.query("INSERT INTO migration.media_refs VALUES($1,$2,$3)",[ref.file,ref.pointer,ref.legacy]);
  for(const row of source.manifest.inventory)await client.query("INSERT INTO migration.source_files VALUES($1,$2,$3)",[row.path,row.sha256,row.size]);
  await hooks.afterRows?.(client,c);
  const report=await R.compare(client,c,source);
  // Assert source was not changed after preflight; every import uses the frozen bytes.
  if(digest(S.load(c).manifest)!==digest(source.manifest))fail("source_changed_during_import");
  await client.query("INSERT INTO migration.receipt VALUES(true,$1,$2,$3,$4)",[c.meta.sourceId,c.meta.manifestSha,report.semanticSha,report.mediaSha]);
  await hooks.beforeCommit?.(client,c);
  await client.query("COMMIT");committed=true;
  await hooks.afterCommit?.(client,c);
  atomic(path.join(c.target,"journal.json"),{state:"committed",sourceId:c.meta.sourceId,targetId:c.meta.targetId,manifestSha:c.meta.manifestSha});
  return{...report,operation:"IMPORTED_STAGING_ONLY",escrow:verifyBundle(c,source)};
 }catch(e){
  await client?.query("ROLLBACK").catch(()=>{});
  // Journal is diagnostic, not permission to recreate or select another target.
  atomic(path.join(c.target,"journal.json"),{state:committed?"commit_ack_uncertain":"interrupted_or_rejected",sourceId:c.meta.sourceId,targetId:c.meta.targetId,manifestSha:c.meta.manifestSha});
  throw e;
 }finally{client?.release();await p.end();}
}
module.exports={importSource,bundle,verifyBundle};
