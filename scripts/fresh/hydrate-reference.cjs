// Test-only pre-fix read path, retained for a measured round-trip regression.
// Called only by the private synthetic fixture child.
const path=require("node:path");
const {base}=require("../../deploy/fresh/config.cjs");
const codec=require(path.join(base,"development/postgres/codec.cjs"));
async function referenceLoad(c,selected){
  const files=await c.query("SELECT * FROM dev.files ORDER BY name"),records=new Map();
  const tables=new Set();
  function visit(s){tables.add(s.table);if(s.item)visit(s.item);Object.values(s.children||{}).forEach(visit);}
  if(selected)selected.forEach(f=>visit(codec.specs[f]));
  for(const table of codec.tables.keys()){
    if(selected&&!tables.has(table))continue;
    const r=await c.query(`SELECT id,file_name,parent,entry_key,ordinal,attrs,shape FROM dev.${table}`);
    for(const row of r.rows){
      row.table=table;
      if(!records.has(row.file_name))records.set(row.file_name,[]);
      records.get(row.file_name).push(row);
    }
  }
  const result=new Map();
  for(const file of files.rows)if(!selected||selected.includes(file.name))
    result.set(file.name,{value:codec.decode(file.name,records.get(file.name)||[]),revision:Number(file.revision)});
  result.allRevisions=new Map(files.rows.map(f=>[f.name,{revision:Number(f.revision)}]));
  result.loadQueryCount=1+(selected?tables.size:codec.tables.size);
  return result;
}
module.exports={referenceLoad};
