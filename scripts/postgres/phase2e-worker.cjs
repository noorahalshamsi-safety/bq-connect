// Compile the existing private diagnostic worker, augmenting only owned workers.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const candidate=require("./phase2e-candidate.cjs");
const totals=new Map();
const pg=require("pg"),query=pg.Client.prototype.query;
pg.Client.prototype.query=function(...args){
 const began=performance.now(),result=query.apply(this,args);
 if(typeof args[0]==="string"&&args[0].startsWith("SELECT id,file_name,parent")&&result?.then)return result.then(r=>{const prior=totals.get("sql-retrieval-and-driver-decode")||{count:0,ms:0,rows:0};prior.count++;prior.ms+=performance.now()-began;prior.rows+=r.rows.length;totals.set("sql-retrieval-and-driver-decode",prior);return r;});
 return result;
};
global.__phase2eStage=(stage,fn)=>function(...args){const at=performance.now(),result=fn.apply(this,args),prior=totals.get(stage)||{count:0,ms:0};prior.count++;prior.ms+=performance.now()-at;totals.set(stage,prior);if(["authorization-filter","enrichment-and-visibility"].includes(stage))global.__phase2dMemory(stage,{ms:performance.now()-at});return result;};
global.__phase2eTransform=source=>{
 source+=`\nfilteredIdeas=global.__phase2eStage("authorization-filter",filteredIdeas);
 publicList=global.__phase2eStage("enrichment-and-visibility",publicList);
 publicIdea=global.__phase2eStage("post-enrichment",publicIdea);
 visibleTo=global.__phase2eStage("visibility-check",visibleTo);
 safeMedia=global.__phase2eStage("media-reference",safeMedia);
 const originalFeedSend=send;send=function(res,code,data){const at=performance.now();const result=originalFeedSend(res,code,data);global.__phase2dMemory("serialization-and-send",{ms:performance.now()-at,components:Object.fromEntries(global.__phase2eTotals)});global.__phase2eTotals.clear();return result;};\n`;
 const marker="const ideas = readIdeas();\n    const filtered = filteredIdeas(ideas, voter, params);";
 if(!source.includes(marker))throw Error("feed_reference_contract_changed");
 source=source.replace("let body = Buffer.from(JSON.stringify(data));",'const jsonAt=performance.now();const jsonText=JSON.stringify(data);global.__phase2dMemory("json-stringification",{ms:performance.now()-jsonAt,characters:jsonText.length});let body=Buffer.from(jsonText);global.__phase2dMemory("json-response-buffer",{bytes:body.length});');
 return source.replace(marker,`if(req.headers["x-private-feed-component"]==="1"){
   const scope=filteredIdeas([],voter,params);if(scope.error){send(res,scope.error,{error:"forbidden"});return;}
   const items=await global.__phase2eCollect(voter,params,idea=>filteredIdeas([idea],voter,params).list.length>0&&visibleTo(idea,voter));
   send(res,200,{ideas:publicList(items,voter,{groupId:params.get("group")||""}),stats:statsFor(readIdeas())});return;
  }
  ${marker}`);
};
global.__phase2eCollect=async(voter,params,accept)=>{
 const c=global.__phase2eContext().client;let cursor=null,items=[];
 do{const result=await candidate.page(c,{limit:16,cursor,scopeKey:voter+"|"+params.toString(),accept});items.push(...result.items);cursor=result.cursor;global.__phase2dMemory("native-component-page",result.metrics);}while(cursor);
 return items;
};
const filename=path.join(__dirname,"phase2d-worker.cjs"),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(__dirname);
global.__phase2eTotals=totals;
let source=fs.readFileSync(filename,"utf8");
source=source.replace("const value=decode.call(this,file,rows,...args);","const at=performance.now();const value=decode.call(this,file,rows,...args);const prior=global.__phase2eTotals.get('relational-object-decoding')||{count:0,ms:0};prior.count++;prior.ms+=performance.now()-at;global.__phase2eTotals.set('relational-object-decoding',prior);");
source=source.replace('if(name==="runtime"){',`if(name==="runtime"){
 text=text.replace('let context=null,queue=', 'global.__phase2eContext=()=>context;let context=null,queue=');
 text=text.replace('if(file==="server.js"){','if(file==="server.js"){source=global.__phase2eTransform(source);');
`);
m._compile(source,filename);
