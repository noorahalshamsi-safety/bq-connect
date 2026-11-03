// Phase-isolated allocation diagnosis, NOT the load/capacity benchmark.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),codec=require("../../development/postgres/codec.cjs");
const {harness,ok}=require("./harness.cjs"),{worker,output}=require("./phase2d-forensics.cjs"),{usage}=require("./phase2c-support.cjs");
const source=fs.readFileSync(path.join(__dirname,"phase2c-load.cjs"),"utf8"),start=source.indexOf("async function seed("),end=source.indexOf("\n(async()=>",start);
const seed=Function("codec","crypto","limits","usage",`return (${source.slice(start,end).trim()});`)(codec,crypto,{controllerRssMiB:512},usage);
(async()=>{
 const results=[];
 for(const mode of ["before","after"]){
  const h=await harness(5164),row={mode,employees:1000,posts:20000,stages:[],note:"Explicit GC between phases for diagnosis only; not used in the load benchmark or application."};let child,w,monitor,reason="";
  try{
   await seed(h,1000,20000);const at=Date.now();
   w=await worker(h,5164,false,path.join(output,mode+"-sources.json"),c=>{
    child=c;c.on("message",m=>{if(m.type==="memory")row.stages.push(m);});
    monitor=setInterval(()=>{const rss=usage(c.pid).rssMiB;row.peakRssMiB=Math.max(row.peakRssMiB||0,rss);if(rss>384||Date.now()-at>35000||usage(process.pid).rssMiB>512){reason="diagnostic resource guard";c.kill("SIGKILL");}},50);
   });
   await w.call("gc");const session=await h.request("/api/session",{},"101");ok(session);await w.call("gc");
   ok(await h.social("person",{pid:session.json.person.pid}));await w.call("gc");
   const feed=await h.request("/api/ideas",{},"101",{method:"GET",timeout:18000});ok(feed);row.feed={posts:feed.json.ideas.length,decodedBytes:feed.bytes.length};await w.call("gc");row.status="COMPLETED DIAGNOSTIC ONLY";
  }catch(e){row.status="NOT COMPLETED";row.reason=reason||e.message;}
  finally{clearInterval(monitor);if(child)await h.stop(child);await h.close();results.push(row);fs.writeFileSync(path.join(output,"allocation-stage-probe.json"),JSON.stringify({results},null,2));console.log(mode,row.status,row.peakRssMiB);}
 }
})();
