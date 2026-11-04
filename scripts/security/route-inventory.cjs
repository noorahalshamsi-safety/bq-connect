// Method/path/action/op inventory of server.js and which existing synthetic suites reference each entry (REL-015).
// "referenced" means a suite sends that path/action/op literal; it is not proof of the full role/object denial matrix.
// Writes generated-artifacts/security/route-inventory.json and prints counts plus unreferenced entries.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const lines=fs.readFileSync(path.join(root,"server.js"),"utf8").split("\n");

const routes=[];
lines.forEach((line,i)=>{
  if(/^\s{2}if \(/.test(line)&&/urlPath === "/.test(line)){
    const method=line.match(/req\.method === "(\w+)"/)?.[1]||"(inherited)";
    for(const m of line.matchAll(/urlPath === "([^"]+)"/g))routes.push({line:i+1,method,path:m[1]});
  }
  if(/^\s{2}if \(.*urlPath\.startsWith\("\/(media|avatar)\/"\)/.test(line))routes.push({line:i+1,method:"GET|HEAD",path:line.match(/startsWith\("([^"]+)"\)/)[1]+"*"});
});
const headers=routes.filter(r=>r.method!=="(inherited)").sort((a,b)=>a.line-b.line);
const routeAt=line=>[...headers].reverse().find(r=>r.line<=line)?.path||"?";

const entries=[];
for(const r of routes)if(r.method!=="(inherited)"||!entries.some(e=>e.path===r.path))entries.push({kind:"route",method:r.method,path:r.path,name:r.path,line:r.line});
const ideaActions=lines.join("\n").match(/action && !\[([^\]]+)\]\.includes\(action\)/)?.[1].match(/"([^"]+)"/g).map(s=>s.slice(1,-1))||[];
for(const a of ideaActions)entries.push({kind:"idea-action",method:"POST",path:`/api/ideas/<id>/${a}`,name:a});
lines.forEach((line,i)=>{
  const m=line.match(/req\.method === "(\w+)" && !route\.action/);
  if(m)entries.push({kind:"idea-item",method:m[1],path:"/api/ideas/<id>",name:m[1],line:i+1});
});
const seen=new Set();
lines.forEach((line,i)=>{
  for(const m of line.matchAll(/\b(action|op) === "([\w-]+)"/g)){
    const route=routeAt(i+1),key=`${route}|${m[1]}|${m[2]}`;
    if(route.startsWith("/api/ideas")&&m[1]==="action"&&ideaActions.includes(m[2]))continue;
    if(seen.has(key))continue;seen.add(key);
    entries.push({kind:m[1],method:"POST",path:route,name:m[2],line:i+1});
  }
});

const suiteFiles=[];
(function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else if(/\.cjs$/.test(d.name))suiteFiles.push(p);}})(path.join(root,"scripts/postgres"));
for(const dir of ["scripts/migration/rel001","scripts/security"])
  for(const f of fs.readdirSync(path.join(root,dir)))if(f.endsWith(".cjs")&&f!==path.basename(__filename))suiteFiles.push(path.join(root,dir,f));
const suites=suiteFiles.map(f=>({file:path.relative(root,f).replace(/\\/g,"/"),text:fs.readFileSync(f,"utf8")}));
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function patterns(e){
  if(e.kind==="route")return[new RegExp(`["'\`]${esc(e.path.replace(/\*$/,""))}`)];
  if(e.kind==="idea-action")return[new RegExp(`/${esc(e.name)}["'\`]`)];
  if(e.kind==="idea-item")return[new RegExp(`method\\s*:\\s*["'\`]${e.method}["'\`]`)];
  return[new RegExp(`^(?=.*(?:social\\(|\\baction\\b|\\bop\\b)).*["'\`]${esc(e.name)}["'\`]`,"m")];
}
for(const e of entries){
  const p=patterns(e);
  e.referencedBy=suites.filter(s=>p.some(re=>re.test(s.text))).map(s=>s.file);
}

const by=k=>entries.filter(e=>e.kind===k);
const summary=Object.fromEntries(["route","idea-item","idea-action","action","op"].map(k=>[k,{total:by(k).length,referenced:by(k).filter(e=>e.referencedBy.length).length}]));
const out=path.join(root,"generated-artifacts/security");
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,"route-inventory.json"),JSON.stringify({generated:new Date().toISOString(),meaning:"referenced = literal sent by a synthetic suite; role/object denial matrix not established by this inventory",suites:suites.length,summary,entries},null,2));
console.log(JSON.stringify({suites:suites.length,summary}));
for(const e of entries.filter(e=>!e.referencedBy.length))console.log("UNREFERENCED",e.kind,e.method,e.path,e.kind==="route"?"":e.name);
