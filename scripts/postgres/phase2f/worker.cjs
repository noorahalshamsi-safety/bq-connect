// Private compilation only: no application runtime file is edited.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),crypto=require("node:crypto");
const dir=path.resolve(__dirname,"../../../development/postgres"),feed=require("./feed.cjs"),deps=require("./dependencies.cjs"),{create}=require("./cursor.cjs");
let clockOffset=0;
const cursors=create(crypto.randomBytes(32),{now:()=>Date.now()+clockOffset});
global.__phase2fRoute=async(req,res,voter,params,original)=>{
 try{const c=global.__phase2fContext();const response=await feed.read(c,{req,voter,params,original,proof:global.__phase2fProof,cursors});original.send(res,200,response);}
 catch(e){process.send?.({type:"component-error",error:e.message});const status=e.status||503;original.send(res,status,{error:e.status?e.code:"component_unavailable",...(e.code==="forbidden"?{}:{state:e.state||"error"}),...(e.detail?{detail:e.detail}:{})});}
};
global.__phase2fTransform=source=>{
 const marker="const ideas = readIdeas();\n    const filtered = filteredIdeas(ideas, voter, params);";
 if(!source.includes(marker))throw Error("feed_source_contract_changed");
 return source.replace(marker,`if(global.__phase2fEligible(req))return global.__phase2fRoute(req,res,voter,params,{filteredIdeas,visibleTo,publicList,savedBy,send});\n    ${marker}
    if(req.headers["x-private-reference-page"]==="1"){
      if(filtered.error)return send(res,403,{error:"forbidden"});
      return send(res,200,{ideas:publicList(filtered.list.filter(p=>visibleTo(p,voter)).slice(0,Number(params.get("limit")||16)),voter,{groupId:params.get("group")||""}),stats:statsFor(ideas)});
    }`);
};
global.__phase2fEligible=feed.eligible;
const filename=path.join(dir,"runtime.cjs"),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(dir);
let text=fs.readFileSync(filename,"utf8");
const replace=(a,b)=>{if(!text.includes(a))throw Error("private_runtime_contract_changed");text=text.replace(a,b);};
replace("let context=null,queue=","global.__phase2fContext=()=>context;let context=null,queue=");
replace('if(file==="server.js"){','if(file==="server.js"){source=global.__phase2fTransform(source);');
replace("const proof=verify(root),repo=new Repository(proof);","const proof=verify(root),repo=new Repository(proof);global.__phase2fProof=proof;");
replace("let boot=context=await hydrate(await repo.begin());",`const bootFiles=Object.keys(require(${JSON.stringify(path.join(dir,"codec.cjs"))}).specs).filter(f=>f!=="ideas.json");
  const startup=await repo.begin(bootFiles);startup.files.set("ideas.json",{value:[],revision:startup.files.allRevisions.get("ideas.json").revision});
  let boot=context=await hydrate(startup,true);boot.bootstrap=true;`);
replace("let nativeRead=nativeEnabled&&nativeProfile.eligible(req,captured.bytes);","const feedRead=global.__phase2fEligible(req);let nativeRead=feedRead||(nativeEnabled&&nativeProfile.eligible(req,captured.bytes));");
replace("repo.begin(nativeRead?nativeProfile.dependencies:undefined)",`repo.begin(nativeRead?${JSON.stringify(deps.dependencies)}:undefined)`);
replace("if(nativeRead&&!await nativeProfile.safe(transaction))","if(nativeRead&&!feedRead&&!await nativeProfile.safe(transaction))");
replace("c=context=await hydrate(transaction,nativeRead);await refresh();","c=context=await hydrate(transaction,nativeRead);c.feedRead=feedRead;await refresh();");
replace('c.media.size))throw Error("native_read_write_scope")','(!c.feedRead&&c.media.size)))throw Error("native_read_write_scope")');
replace('f=>f!=="accounts.json"','f=>f!=="accounts.json"&&!(c.bootstrap&&f==="groups.json")');
replace('throw Error("native_read_write_scope");','throw Error("native_read_write_scope:"+JSON.stringify([...c.changed])+":"+c.events.length+":"+c.media.size);');
replace("const timer=setInterval(invoke,ms);","const timer={unref(){}};"); // Feed-only owned worker; background suite stays separate.
m._compile('const setInterval=()=>({unref(){}});\n'+text,filename);
m.exports.start(process.argv[2]).then(app=>{
 process.send?.({type:"ready"});
 process.on("message",msg=>{if(msg.action==="expire")clockOffset+=180000;if(msg.action==="metrics")process.send?.({type:"memory",...process.memoryUsage()});});
}).catch(e=>{console.error("Private feed worker refused:",e.code||e.message);process.exit(1);});
