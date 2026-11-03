// Synthetic operator service. Never loaded from the normal application.
const http=require("node:http"),{base,boot,fixture}=require("./harness.cjs");
(async()=>{
 const h=await base(5181);await fixture(h);const w=await boot(h,5181);let errorOnce=false,sequence=0;
 const reply=(res,status,body)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(body));};
 const server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,"http://synthetic");
   if(u.pathname==="/prototype/session"){
    const actor=u.searchParams.get("actor")||"101",token=h.fixture.credentials.tokens[actor];
    if(!token)return reply(res,404,{error:"invented_actor_missing"});
    return reply(res,200,{synthetic:true,token,actor,actors:Object.keys(h.fixture.credentials.tokens).map(badge=>({badge,name:h.fixture.files["employees.json"].find(e=>e.badge===badge)?.name||"Invented role "+badge}))});
   }
   if(u.pathname==="/prototype/control"&&req.method==="POST"){
    let text="";for await(const b of req){text+=b;if(text.length>1024)return reply(res,413,{error:"control_too_large"});}
    const body=JSON.parse(text||"{}");
    if(body.action==="expire")w.child.send({action:"expire"});
    else if(body.action==="error")errorOnce=true;
    else if(body.action==="insert"){
     const f=await h.repo.exportSynthetic(),now=new Date().toISOString();
     const post={id:"synthetic-new-"+(++sequence),number:10000+sequence,badge:"101",name:"Invented Engineer",department:"Engineering",type:"post",title:"New invented post",text:"Created by the isolated fixture controller only.",createdAt:now,comments:[],ratings:[]};
     await h.repo.importSynthetic({"ideas.json":[post,...f["ideas.json"]]});
    }else return reply(res,400,{error:"control_invalid"});
    return reply(res,200,{synthetic:true,action:body.action});
   }
   if(!["/prototype/feed","/prototype/item"].includes(u.pathname))return reply(res,404,{error:"not_found"});
   if(errorOnce){errorOnce=false;return reply(res,503,{error:"synthetic_injected_failure",state:"error"});}
   if(u.pathname==="/prototype/item"){u.searchParams.set("pagination","keyset-v1");u.searchParams.set("limit","1");}
   const upstream=http.request({host:"127.0.0.1",port:5181,path:"/api/ideas?"+u.searchParams.toString(),method:"GET",headers:{"x-session":String(req.headers["x-session"]||""),"accept-encoding":"identity"}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
   upstream.on("error",()=>reply(res,503,{error:"private_worker_unavailable"}));upstream.end();
  }catch{reply(res,500,{error:"synthetic_control_failure"});}
 });
 server.listen(5180,"127.0.0.1",()=>console.log("Isolated synthetic feed operator on loopback 5180; no production connection."));
 let stopping=false;
 async function stop(){if(stopping)return;stopping=true;server.close();await w.stop();await h.close();process.exit(0);}
 process.on("SIGTERM",stop);process.on("SIGINT",stop);
})().catch(e=>{console.error("Private preview refused:",e.message);process.exit(1);});
