// Explicit source/report allowlist. Never traverses imported data or secrets.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../../.."),out=path.join(root,"generated-artifacts/phase2g");
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const reports=["PRODUCTION_AUDIT.md",...fs.readdirSync(path.join(root,"reports")).filter(n=>n.endsWith(".md")&&!n.includes("PHASE2G")).map(n=>"reports/"+n)];
const files=[...reports,".replit","package.json","package-lock.json","replit.md",
  ...["start.js","auth.js","server.js","storage-sync.js","backup.js","vault.js","persistence-safety.js","moderation.js","push.js","translate.js","spark-agent.js"],
  ...fs.readdirSync(path.join(root,"development/postgres")).filter(n=>n.endsWith(".cjs")).map(n=>"development/postgres/"+n),
  "public/sw.js","public/js/posting.js","artifacts/mockup-sandbox/package-lock.json"];
const snapshot=()=>Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
if(process.argv[2]==="verify"){
  const before=JSON.parse(fs.readFileSync(path.join(out,"source-baseline.json"))),now=snapshot();
  const changed=Object.keys(before).filter(f=>before[f]!==now[f]);
  fs.writeFileSync(path.join(out,"preservation.json"),JSON.stringify({files:Object.keys(before).length,changed},null,2));
  console.log(JSON.stringify({files:Object.keys(before).length,changed}));if(changed.length)process.exitCode=1;
}else{
  if(fs.existsSync(path.join(out,"source-baseline.json")))throw Error("baseline_already_exists");
  fs.writeFileSync(path.join(out,"source-baseline.json"),JSON.stringify(snapshot(),null,2));
  const inventory=reports.map(file=>{
    const text=fs.readFileSync(path.join(root,file),"utf8");
    return{file,sha256:sha(text),lines:text.split("\n").length,
      headings:text.split("\n").filter(l=>/^#{1,3} /.test(l)),
      caveats:text.split("\n").filter(l=>/NOT TESTED|NO.GO|BLOCKED|NOT VERIFIED|not implemented|OPEN/i.test(l))};
  });
  fs.writeFileSync(path.join(out,"report-inventory.json"),JSON.stringify(inventory,null,2));
  console.log(JSON.stringify({reports:reports.length,protectedFiles:files.length}));
}
