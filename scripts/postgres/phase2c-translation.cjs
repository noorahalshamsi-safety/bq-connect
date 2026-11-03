const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process"),vm=require("node:vm");
const out=path.resolve(__dirname,"../../generated-artifacts/phase2c");
if(process.argv[2]==="child"){
 (async()=>{
   const engine=require("../../translate.js"),rows=[],original=[
     ["ar","en","صباح الخير. المشروع جاهز."],["en","ar","The project is ready."],
     ["en","ar","Project A42 is delayed 😊\nhttps://example.invalid"],
     ["ar","en","مرحبا Project A42 😊"],["en","ar","The project has been delayed."]
   ];
   const rssBefore=process.memoryUsage().rss;
   const inputSnapshot=JSON.stringify(original);
   for(const [from,to,text]of original){
     const at=performance.now(),result=await engine.translate(text,from,to);
     rows.push({from,to,text,result,ms:performance.now()-at,rssMiB:process.memoryUsage().rss/1048576,excessivePunctuation:/[.،!؟?]{4,}/.test(result)});
   }
   const at=performance.now(),cached=await engine.translate(original[0][2],"ar","en"),cacheMs=performance.now()-at;
   const concurrentAt=performance.now(),concurrent=await Promise.all([engine.translate("Thank you.","en","ar"),engine.translate("شكرا لك.","ar","en")]);
   const source=fs.readFileSync(path.resolve(__dirname,"../../public/js/posting.js"),"utf8").match(/function textLanguage\(text\) \{[\s\S]*?\n\}/)?.[0];
   if(!source)throw Error("Language detector source changed");
   const detect=vm.runInNewContext(`(${source})`);
   const detection=["مرحبا","Hello","مرحبا https://example.invalid/long/url","١٢٣٤","OK","Hello مرحبا"].map(text=>({text,detected:detect(text)}));
   console.log("RESULT "+JSON.stringify({status:rows.every(r=>r.result)?"AVAILABLE":"FAILED",rows,cached,cacheMs,concurrent,concurrentMs:performance.now()-concurrentAt,rssBeforeMiB:rssBefore/1048576,rssAfterMiB:process.memoryUsage().rss/1048576,detection,inputFixturesUnchanged:JSON.stringify(original)===inputSnapshot,limits:"Cached public weights; first sample per direction includes model initialization. Cache hit is not warm uncached inference. Input check is not a database preservation test; B22 covers stored source. Quality examples, not a scored bilingual evaluation; HTTP model-failure/timeout semantics not changed."}));
 })().catch(e=>{console.log("RESULT "+JSON.stringify({status:"BLOCKED",reason:e.message}));process.exitCode=1;});
}else{
 const child=spawn(process.execPath,[__filename,"child"],{env:{PATH:process.env.PATH,HOME:out,BQ_TRANSLATE:"1",BQ_MODELS_DIR:path.resolve(__dirname,"../../generated-artifacts/phase2b/models")},stdio:["ignore","pipe","pipe"]});
 let text="",result;const collect=b=>{text+=b.toString();};
 child.stdout.on("data",collect);child.stderr.on("data",()=>{});
 const timer=setTimeout(()=>child.kill("SIGKILL"),120000);
 const memory=setInterval(()=>{try{const rss=Number(fs.readFileSync(`/proc/${child.pid}/status`,"utf8").match(/VmRSS:\s+(\d+)/)?.[1]||0);if(rss>768*1024)child.kill("SIGKILL");}catch{}},100);
 child.on("exit",()=>{clearTimeout(timer);clearInterval(memory);for(const line of text.split("\n"))if(line.startsWith("RESULT "))try{result=JSON.parse(line.slice(7));}catch{}
   result||={status:"BLOCKED",reason:"Model worker failed or exceeded 120 second budget"};
   fs.writeFileSync(path.join(out,"translation-review.json"),JSON.stringify(result,null,2));console.log("translation",result.status);});
}
