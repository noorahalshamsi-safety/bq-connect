// Independent reader: deliberately does NOT call codec.decode or Repository.load.
const C=require("./common.cjs"),S=require("./source.cjs"),codec=require("../../../development/postgres/codec.cjs");
const {digest,hash,fail,canonical}=C;
async function readSql(client){
 const inventory=(await client.query("SELECT name FROM dev.files ORDER BY name")).rows.map(x=>x.name);
 if(digest(inventory)!==digest(S.files))fail("sql_file_inventory_mismatch");
 const rows=[],children=new Map(),roots=new Map(),used=new Set();
 for(const table of codec.tables.keys())for(const r of (await client.query(`SELECT id,file_name,parent,entry_key,ordinal,attrs,shape FROM dev.${table}`)).rows){
  r.table=table;rows.push(r);const key=r.file_name+"\0"+(r.parent||"");
  if(!children.has(key))children.set(key,[]);children.get(key).push(r);
 }
 const decoded=Object.create(null);
 function node(r){
  const uid=r.table+"\0"+r.id;if(used.has(uid))fail("sql_relation_cycle");used.add(uid);
  const sub=(children.get(r.file_name+"\0"+r.id)||[]).sort((a,b)=>a.ordinal-b.ordinal);
  if(sub.some((x,i)=>x.ordinal!==i))fail("sql_relationship_order_gap");
  if(r.shape.kind==="opaque"){if(sub.length)fail("opaque_sql_children");return r.attrs;}
  if(r.shape.kind==="array")return sub.map(node);
  const value=Object.create(null);
  if(r.shape.kind==="map"){
   for(const child of sub){if(child.entry_key===null||Object.hasOwn(value,child.entry_key))fail("sql_duplicate_map_key");value[child.entry_key]=node(child);}return value;
  }
  if(r.shape.kind!=="object"||!r.attrs||typeof r.attrs!=="object"||Array.isArray(r.attrs)||!Array.isArray(r.shape.children))fail("sql_shape_invalid");
  for(const [k,v]of Object.entries(r.attrs))value[k]=v;
  if(sub.length!==r.shape.children.length)fail("sql_missing_child");
  for(let i=0;i<sub.length;i++){if(sub[i].entry_key!==r.shape.children[i]||Object.hasOwn(value,sub[i].entry_key))fail("sql_object_child_mismatch");value[sub[i].entry_key]=node(sub[i]);}
  return value;
 }
 for(const f of inventory){
  const candidates=children.get(f+"\0")||[];
  if(candidates.length!==1||candidates[0].table!==codec.specs[f].table)fail("sql_root_mismatch");
  decoded[f]=node(candidates[0]);roots.set(f,candidates[0].id);
 }
 if(used.size!==rows.length)fail("sql_orphan_relation");
 return{values:decoded,rows:rows.length};
}
async function compare(client,c,source){
 const actual=await readSql(client),mismatches=[],paths=[];
 function diff(a,b,at){
  if(canonical(a)===canonical(b))return;
  if(paths.length<20)paths.push(digest(at)); // Never emit field values or identifiers.
 }
 for(const f of S.files){if(canonical(source.values[f])!==canonical(actual.values[f])){mismatches.push(f);diff(source.values[f],actual.values[f],[f]);}}
 if(mismatches.length)fail("semantic_mismatch:"+mismatches.join(","));
 const auth=source.values["accounts.json"],other=actual.values["accounts.json"];
 const categories={
  fileInventory:digest(S.files),accountMembership:digest(Object.keys(other).sort()),
  employeeMembership:digest(actual.values["employees.json"].map(x=>x.badge).sort()),
  postsAndStories:digest(actual.values["ideas.json"]),
  commentsReactionsPolls:digest(actual.values["ideas.json"].map(p=>({id:p.id,comments:p.comments,ratings:p.ratings,poll:p.poll}))),
  groups:digest(actual.values["groups.json"]),notificationsAudit:digest([actual.values["notifications.json"],actual.values["security-log.json"]]),
  profilesSettings:digest(S.files.filter(f=>!["accounts.json","employees.json","ideas.json"].includes(f)).map(f=>actual.values[f])),
  credentialsSessionsFactors:digest(other),fieldPresenceNullOrderingUnknown:digest(actual.values)
 };
 if(digest(auth)!==digest(other))fail("auth_semantic_mismatch");
 const media=(await client.query("SELECT legacy,sha256,size,bytes FROM migration.media ORDER BY legacy")).rows;
 const expectedMedia=[...source.bytes].filter(([n])=>n.startsWith("media/")).map(([n,b])=>({legacy:"/"+n,sha256:hash(b),size:b.length})).sort((a,b)=>a.legacy.localeCompare(b.legacy,"en"));
 const mediaMeta=media.map(r=>{
  if(hash(r.bytes)!==r.sha256||r.bytes.length!==Number(r.size))fail("sql_media_checksum");
  return{legacy:r.legacy,sha256:r.sha256,size:Number(r.size)};
 }).sort((a,b)=>a.legacy.localeCompare(b.legacy,"en"));
 if(digest(mediaMeta)!==digest(expectedMedia))fail("media_inventory_mismatch");
 const refs=(await client.query("SELECT source_file,pointer,legacy FROM migration.media_refs")).rows.map(r=>({file:r.source_file,pointer:r.pointer,legacy:r.legacy}));
 const sort=a=>a.map(C.canonical).sort();
 if(digest(sort(refs))!==digest(sort(source.refs)))fail("media_reference_mismatch");
 const stored=(await client.query("SELECT path,sha256,size::text FROM migration.source_files ORDER BY path")).rows;
 const expected=source.manifest.inventory.map(r=>({path:r.path,sha256:r.sha256,size:String(r.size)}));
 if(digest(stored)!==digest(expected))fail("sql_source_inventory_mismatch");
 return{status:"PASS",sourceId:c.meta.sourceId,targetId:c.meta.targetId,manifestSha:c.meta.manifestSha,
  semanticSha:digest(actual.values),mediaSha:digest(mediaMeta),categories,
  counts:{files:S.files.length,accounts:Object.keys(other).length,employees:actual.values["employees.json"].length,
   posts:actual.values["ideas.json"].length,stories:actual.values["ideas.json"].filter(p=>p.type==="story").length,
   comments:actual.values["ideas.json"].reduce((n,p)=>n+(p.comments?.length||0),0),media:media.length,mediaReferences:refs.length,relationalNodes:actual.rows},
  exactIdentityEvidence:"Canonical SHA256 digests only; no fixture credentials/tokens/plaintext factor material in this report."};
}
async function reconcile(root,expected){
 const c=C.context(root,expected),source=S.load(c),p=C.pool(c),client=await p.connect();
 try{
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await C.attest(client,c);
  const receipt=(await client.query("SELECT * FROM migration.receipt")).rows;
  if(receipt.length!==1||receipt[0].manifest_sha!==c.meta.manifestSha||receipt[0].source_id!==c.meta.sourceId)fail("import_not_committed");
  const report=await compare(client,c,source);
  if(report.semanticSha!==receipt[0].semantic_sha||report.mediaSha!==receipt[0].media_sha)fail("receipt_content_mismatch");
  await client.query("ROLLBACK");return report;
 }finally{await client.query("ROLLBACK").catch(()=>{});client.release();await p.end();}
}
module.exports={readSql,compare,reconcile};
