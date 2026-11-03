const codec=require("../../../development/postgres/codec.cjs"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const dependencies=["accounts.json","employees.json","security.json","moderators.json","conduct.json"];
async function project(c,file,keys){
 const spec=codec.specs[file],root=(await c.client.query(`SELECT * FROM dev.${spec.table} WHERE file_name=$1`,[file])).rows;
 if(root.length!==1)throw Error("projection_root_missing");
 const records=root.map(r=>({...r,table:spec.table}));let nodes=1,bytes=0;
 async function children(s,parents,isTop=false){
  const childSpecs=[...(s.item?[s.item]:[]),...Object.values(s.children||{})];
  for(const child of childSpecs){
   if(!parents.length)continue;
   const filter=isTop?(spec.kind==="map"?" AND entry_key=ANY($3::text[])":" AND attrs->>'id'=ANY($3::text[])"):"";
   const args=[file,parents,...(isTop?[keys.map(String)]:[])],where=`file_name=$1 AND parent=ANY($2::text[])${filter}`,bound=8193-nodes;
   const capArgs=[...args,bound],limit="$"+capArgs.length;
   const check=(await c.client.query(`WITH chosen AS MATERIALIZED(SELECT attrs,shape FROM dev.${child.table} WHERE ${where} LIMIT ${limit}) SELECT count(*)::int AS n,coalesce(sum(octet_length(attrs::text)+octet_length(shape::text)),0)::text AS bytes FROM chosen`,capArgs)).rows[0];
   nodes+=check.n;bytes+=Number(check.bytes);if(nodes>8192||bytes>8388608)throw Error("projection_budget");
   const rows=(await c.client.query(`SELECT * FROM dev.${child.table} WHERE ${where} LIMIT ${limit}`,capArgs)).rows.map(r=>({...r,table:child.table}));
   records.push(...rows);await children(child,rows.map(r=>r.id));
  }
 }
 await children(spec,root.map(r=>r.id),true);
 const value=codec.decode(file,records),revision=c.files.allRevisions.get(file)?.revision;
 c.files.set(file,{value,revision});c.buffers.set(file,Buffer.from(JSON.stringify(value)));
 return value;
}
function references(value,result=new Set(),badges=new Set()){
 if(typeof value==="string"&&value.startsWith("/media/"))result.add(value);
 else if(value&&typeof value==="object"){
  for(const k of ["badge","thanksBadge"])if(value[k]!=null)badges.add(String(value[k]));
  for(const v of Object.values(value))references(v,result,badges);
 }
 return{paths:result,badges};
}
async function media(c,items,profiles,proof){
 const refs=references([items,profiles]);if(!refs.paths.size)return;
 const rows=(await c.client.query("SELECT * FROM dev.media WHERE legacy_path=ANY($1::text[]) AND state IN('ready','retained')",[[...refs.paths]])).rows;
 if(rows.length!==refs.paths.size)throw Error("referenced_media_not_ready");
 if(rows.some(r=>Number(r.size)>33554432)||rows.reduce((n,r)=>n+Number(r.size),0)>67108864)throw Error("selected_media_budget");
 for(const row of rows){
  const object=path.join(proof.objects,row.id);
  if(!fs.existsSync(object))throw Error("referenced_media_missing_or_corrupt");
  const hash=crypto.createHash("sha256");for await(const chunk of fs.createReadStream(object))hash.update(chunk);
  if(hash.digest("hex")!==row.sha256)throw Error("referenced_media_missing_or_corrupt");
  c.media.set(row.legacy_path,{...row,legacy:row.legacy_path,object});
 }
}
module.exports={dependencies,project,references,media};
