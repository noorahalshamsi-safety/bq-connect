// PRIVATE DESIGN PROTOTYPE. Not imported by the application or exposed by HTTP.
// Authorization must be supplied from the unchanged reference policy in tests.
const codec=require("../../development/postgres/codec.cjs"),crypto=require("node:crypto");
const fields="id,file_name,parent,entry_key,ordinal,attrs,shape",file="ideas.json";
const freeze=v=>{if(v&&typeof v==="object"){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const fail=code=>{throw Object.assign(Error(code),{code});};
async function prepare(repo){
 const c=await repo.pool.connect();try{await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1793705963)");await repo.verify(c);
 await c.query("CREATE INDEX IF NOT EXISTS phase2e_post_ordinal ON dev.posts(file_name,parent,ordinal)");
 await c.query("COMMIT");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
async function page(c,{limit=16,cursor=null,scopeKey,accept,maxNodes=8192,maxBytes=8388608,maxScanned=512}={}){
 if(typeof accept!=="function"||typeof scopeKey!=="string")fail("trusted_reference_policy_required");
 if(!Number.isInteger(limit)||limit<1||limit>64)fail("invalid_page_limit");
 const began=performance.now(),q0=c.__bqQueries||0,scope=crypto.createHash("sha256").update(scopeKey).digest("hex");
 const revision=String((await c.query("SELECT revision FROM dev.files WHERE name=$1",[file])).rows[0]?.revision||"");
 if(cursor&&(cursor.v!==1||cursor.revision!==revision||cursor.scope!==scope||!Number.isSafeInteger(cursor.after)||cursor.after<0))fail("cursor_restart_required");
 const root=(await c.query(`SELECT ${fields} FROM dev.post_root WHERE file_name=$1`,[file])).rows;
 if(root.length!==1||root[0].shape.kind!=="array")fail("unsupported_legacy_root");
 let after=cursor?.after??-1,scanned=0,nodes=0,bytes=0,done=false;const selected=[];
 async function fetch(table,where,params,order="",bound=maxNodes-nodes+1){
  if(!codec.tables.has(table))fail("invalid_table");
  const tail=`FROM dev.${table} WHERE file_name=$1 AND ${where} ${order} LIMIT $${params.length+2}`,args=[file,...params,bound];
  const stats=(await c.query(`WITH chosen AS MATERIALIZED (SELECT attrs,shape ${tail}) SELECT count(*)::int AS n,coalesce(sum(octet_length(attrs::text)+octet_length(shape::text)),0)::text AS bytes FROM chosen`,args)).rows[0];
  if(nodes+stats.n>maxNodes||bytes+Number(stats.bytes)>maxBytes)fail("component_budget");
  const rows=(await c.query(`SELECT ${fields} ${tail}`,args)).rows;nodes+=rows.length;bytes+=Number(stats.bytes);
  return rows.map(r=>({...r,table}));
 }
 async function descendants(spec,parents,records){
  for(const child of [...(spec.item?[spec.item]:[]),...Object.values(spec.children||{})]){
   if(!parents.length)continue;
   const rows=await fetch(child.table,"parent=ANY($2::text[])",[parents]);
   records.push(...rows);await descendants(child,rows.map(r=>r.id),records);
  }
 }
 while(selected.length<limit){
  if(scanned>=maxScanned)fail("component_scan_budget");
  const posts=await fetch("posts","parent=$2 AND ordinal>$3",[root[0].id,after],"ORDER BY ordinal",Math.min(32,maxScanned-scanned));
  if(!posts.length){done=true;break;}
  const records=[{...root[0],table:"post_root"},...posts];
  await descendants(codec.specs[file].item,posts.map(r=>r.id),records);
  const decoded=codec.decode(file,records);freeze(decoded);
  for(let i=0;i<posts.length;i++){
   scanned++;after=posts[i].ordinal;
   if(await accept(decoded[i]))selected.push(decoded[i]);
   if(selected.length===limit)break;
  }
 }
 return freeze({items:selected,cursor:done?null:{v:1,revision,scope,after},done,metrics:{scanned,nodes,decodedAttributeBytes:bytes,queries:(c.__bqQueries||0)-q0,ms:performance.now()-began}});
}
module.exports={page,prepare};
