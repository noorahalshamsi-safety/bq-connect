const C=require("./common.cjs"),{fs,path,hash}=C;
const out=path.join(C.workspace,"generated-artifacts/rel001-evidence");fs.mkdirSync(out,{recursive:true,mode:0o700});
function list(dir,filter=()=>true){
 if(!fs.existsSync(dir))return[];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>{
  const p=path.join(dir,x.name);
  if(x.isSymbolicLink())return[];
  if(x.isDirectory())return ["node_modules","models","pgdata",".git"].includes(x.name)?[]:list(p,filter);
  return filter(p)?[p]:[];
 });
}
function snapshot(){
 const roots=["development/postgres","scripts/postgres","scripts/architecture","scripts/forensics","reports","public/js"];
 const files=roots.flatMap(n=>list(path.join(C.workspace,n)));
 for(const n of ["start.js","auth.js","server.js","backup.js","vault.js","storage-sync.js","persistence-safety.js","moderation.js","push.js","translate.js","spark-agent.js","package.json","package-lock.json",".replit","replit.md","public/sw.js"])files.push(path.join(C.workspace,n));
 const gen=path.join(C.workspace,"generated-artifacts");
 for(const n of fs.readdirSync(gen))if(/^(phase2|forensics|repair|architecture)/.test(n)&&fs.statSync(path.join(gen,n)).isDirectory())
  files.push(...list(path.join(gen,n),p=>/\.(json|md|html)$/.test(p)));
 return Object.fromEntries([...new Set(files)].sort().map(f=>[path.relative(C.workspace,f),hash(fs.readFileSync(f))]));
}
const baseline=path.join(out,"preservation-baseline.json");
if(process.argv[2]==="verify"){
 const prior=JSON.parse(fs.readFileSync(baseline)),now=snapshot(),changed=Object.keys(prior).filter(k=>prior[k]!==now[k]);
 fs.writeFileSync(path.join(out,"preservation.json"),JSON.stringify({files:Object.keys(prior).length,changed},null,2));
 console.log(JSON.stringify({files:Object.keys(prior).length,changed}));if(changed.length)process.exitCode=1;
}else{if(fs.existsSync(baseline))C.fail("baseline_exists");C.write(baseline,JSON.stringify(snapshot(),null,2),true);console.log("Protected source and prior evidence baseline recorded.");}
