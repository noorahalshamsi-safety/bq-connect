const crypto=require("node:crypto"),{page}=require("./page.cjs"),deps=require("./dependencies.cjs"),{failure}=require("./cursor.cjs");
const digest=s=>crypto.createHash("sha256").update(s).digest("hex");
let statsCache;
const eligible=req=>req.method==="GET"&&new URL(req.url,"http://synthetic").pathname==="/api/ideas"&&new URL(req.url,"http://synthetic").searchParams.get("pagination")==="keyset-v1";
async function globalStats(c){
 const rev=c.files.allRevisions.get("ideas.json").revision;
 if(statsCache?.revision===rev)return statsCache.value;
 let after=-1,shared=0,review=0,projects=0,max=0;
 while(true){
  const args=["ideas.json",JSON.stringify(["ideas.json"]),after];
  const cap=(await c.client.query(`WITH chunk AS MATERIALIZED(SELECT attrs->'number' AS n FROM dev.posts WHERE file_name=$1 AND parent=$2 AND ordinal>$3 ORDER BY ordinal LIMIT 512) SELECT coalesce(sum(octet_length(n::text)),0)::text AS bytes FROM chunk`,args)).rows[0];
  if(Number(cap.bytes)>8388608)throw Error("statistics_budget");
  const rows=(await c.client.query(`SELECT ordinal,attrs->'number' AS number,attrs->'status' AS status FROM dev.posts WHERE file_name=$1 AND parent=$2 AND ordinal>$3 ORDER BY ordinal LIMIT 512`,args)).rows;
  if(!rows.length)break;
  for(const r of rows){shared++;if(r.status==="review")review++;if(r.status==="project")projects++;max=Math.max(max,Number(r.number)||0);after=r.ordinal;}
 }
 const value={shared,review,projects,nextNumber:max+1};statsCache={revision:rev,value};return value;
}
async function read(c,{req,voter,params,original,proof,cursors}){
 const rawLimit=params.get("limit")??"8",limit=Number(rawLimit);
 if(!/^\d+$/.test(rawLimit)||!Number.isInteger(limit)||limit<1||limit>32)throw failure("page_limit",400);
 const group=params.get("group")||"",feed=params.get("feed")||"company",kind=params.get("kind")||"",saved=params.get("saved")||"";
 await deps.project(c,"groups.json",group?[group]:[]);
 await deps.project(c,"follows.json",[voter]);await deps.project(c,"bookmarks.json",[voter]);
 const check=original.filteredIdeas([],voter,params);if(check.error)throw failure("forbidden",check.error);
 if(!["company","following","today"].includes(feed)||!["","story","post","poll","announcement","event"].includes(kind)||!["","1"].includes(saved))throw failure("filter_invalid");
 if((params.get("sort")||"legacy")!=="legacy"||(params.get("q")||"").trim())throw Object.assign(failure("product_decision_required",422,"unsupported"),{detail:"Only legacy API order is validated. Global date/top sorting and folded search require a versioned product decision."});
 const scope=digest(JSON.stringify({group,feed,kind,saved,limit,id:params.get("id")||""})),actor=digest(String(req.headers["x-session"]||"")+"|"+voter);
 const revision=digest(JSON.stringify([...c.files.allRevisions].map(([f,r])=>[f,r.revision+(c.changed.has(f)?1:0)])));
 const token=params.get("cursor"),prior=token?cursors.decode(token,{actor,scope,revision}):null;
 const postRevision=String(c.files.allRevisions.get("ideas.json").revision);
 let inner=prior?{v:1,revision:postRevision,scope:digest(scope),after:prior.after}:null;
 const id=params.get("id");
 if(id){
  const row=(await c.client.query("SELECT ordinal FROM dev.posts WHERE file_name=$1 AND attrs->>'id'=$2",["ideas.json",id])).rows[0];
  if(!row)return{ideas:[],stats:await globalStats(c),page:{version:"keyset-v1",state:"end",nextCursor:null,order:"legacy",limit}};
  if(row.ordinal>0)inner={v:1,revision:postRevision,scope:digest(scope),after:row.ordinal-1};
 }
 const result=await page(c.client,{limit:id?1:limit,cursor:inner,scopeKey:scope,maxScanned:512,accept:idea=>
  (!id||String(idea.id)===id)&&original.filteredIdeas([idea],voter,params).list.length>0&&original.visibleTo(idea,voter)&&(!kind||(idea.type||"idea")===kind)&&(!saved||original.savedBy(voter,idea.id))});
 const refs=deps.references(result.items);refs.badges.add(String(voter));
 const profiles=await deps.project(c,"profiles.json",[...refs.badges]);
 await deps.project(c,"views.json",result.items.map(p=>String(p.id)));
 await deps.media(c,result.items,profiles,proof);
 const ideas=original.publicList(result.items,voter,{groupId:group}),stats=await globalStats(c);
 const next=!id&&result.cursor?cursors.sign({...cursors.initial(),...(prior?{iat:prior.iat,exp:prior.exp}:{}),actor,scope,revision,after:result.cursor.after}):null;
 c.metrics.feedNodes=result.metrics.nodes;c.metrics.feedQueries=result.metrics.queries;c.metrics.feedScanned=result.metrics.scanned;
 const response={ideas,stats,page:{version:"keyset-v1",state:next?"more":"end",nextCursor:next,order:"legacy",limit}};
 if(Buffer.byteLength(JSON.stringify(response))>2097152)throw Error("response_budget");
 return response;
}
module.exports={eligible,read,globalStats};
