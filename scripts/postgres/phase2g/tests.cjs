const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const {harness,ok}=require("../harness.cjs");
const root=path.resolve(__dirname,"../../.."),out=path.join(root,"generated-artifacts/phase2g");
fs.mkdirSync(out,{recursive:true});
const results=[];let h;
async function test(id,name,fn){try{const evidence=await fn();results.push({id,name,status:"PASS",evidence});}catch(e){results.push({id,name,status:"FAIL",error:e.message.slice(0,400)});}console.log(id,results.at(-1).status);}
(async()=>{
try{
 h=await harness(5138);await h.boot();
 let post,media;
 await test("G01","Original authenticated feed, no-store and security headers",async()=>{
   const r=await h.request("/api/ideas",{},"101",{method:"GET"});ok(r);
   assert(Array.isArray(r.json.ideas));assert.match(r.headers.get("cache-control"),/no-store/);
   for(const n of ["content-security-policy","x-content-type-options","referrer-policy"])assert(r.headers.get(n));
   ok(await h.request("/api/ideas",{},null,{method:"GET"}),401);
   return "Normal full-feed route, not private paginated worker; authenticated synthetic session and anonymous denial.";
 });
 await test("G02","Horizontal edit/delete and administrator boundary",async()=>{
   const r=await h.request("/api/ideas",{type:"post",text:"Invented security review — محتوى مصطنع"});ok(r,201);post=r.json.idea;
   ok(await h.request(`/api/ideas/${post.id}`,{text:"Forbidden"},"103",{method:"PATCH"}),403);
   ok(await h.request(`/api/ideas/${post.id}`,{},"103",{method:"DELETE"}),403);
   ok(await h.social("admin-users",{},"101"),403);ok(await h.social("admin-users",{},"9001"));
   return "Sampled ownership and role boundaries only; not exhaustive route/object authorization.";
 });
 await test("G03","Cross-site unsafe request denied without a write",async()=>{
   const text="Invented cross-site sentinel";
   ok(await h.request("/api/ideas",{type:"post",text},"101",{headers:{Origin:"https://attacker.invalid","Sec-Fetch-Site":"cross-site"}}),403);
   assert(!(await h.repo.exportSynthetic())["ideas.json"].some(x=>x.text===text));
   return "Cross-site Origin and Fetch Metadata request; browser CSRF execution NOT TESTED.";
 });
 await test("G04","Stored markup retained as data, never declared browser-safe",async()=>{
   const text='<img src=x onerror="window.phase2gXss=1"> نص مصطنع';
   const r=await h.request("/api/ideas",{type:"post",text});ok(r,201);
   const files=await h.repo.exportSynthetic();assert.equal(files["ideas.json"].find(x=>x.id===r.json.idea.id).text,text);
   const feed=await h.request("/api/ideas",{},"101",{method:"GET"});ok(feed);assert.match(feed.headers.get("content-type"),/application\/json/);
   return "Storage and JSON transport only. Stored-markup execution remains NOT TESTED.";
 });
 await test("G05","Existing anonymous media exposure reproduced with invented bytes",async()=>{
   const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64");
   const r=await h.request("/api/media",{},"101",{raw:png,headers:{"Content-Type":"image/png"}});ok(r,201);media=r.json.url;assert(media.startsWith("/media/"));
   const read=await h.request(media,{},null,{method:"GET"});ok(read);assert.deepEqual(read.bytes,png);
   const head=await h.request(media,{},null,{method:"HEAD"});ok(head);
   return "Confirmed unauthenticated GET/HEAD by known URL: existing behavior, not a newly introduced BOLA conclusion. Employee-only policy requires approval.";
 });
 await test("G06","Disabled model and unauthenticated translation preserve post",async()=>{
   const before=JSON.stringify((await h.repo.exportSynthetic())["ideas.json"]);
   ok(await h.request("/api/translate",{text:"Invented note",from:"en",to:"ar"},null),401);
   const r=await h.request("/api/translate",{text:"Invented note",from:"en",to:"ar"});ok(r,503);assert.equal(r.json.error,"translate_off");
   assert.equal(JSON.stringify((await h.repo.exportSynthetic())["ideas.json"]),before);
   return "Actual authenticated HTTP disabled-service failure; positive local model quality is separate.";
 });
 await test("G07","Revoked session cannot read original feed",async()=>{
   ok(await h.request("/api/logout-all",{},"103"));
   ok(await h.request("/api/ideas",{},"103",{method:"GET"}),401);
   return "Fresh authentication enforced on original route following logout-all.";
 });
 // Exact original engine code, replacing only its library import with a fixture.
 // These checks certify orchestration, NOT actual OPUS model output.
 const engineSource=fs.readFileSync(path.join(root,"translate.js"),"utf8");
 const marker='import("@huggingface/transformers")';assert.equal(engineSource.split(marker).length,2);
 function engine(mode="echo"){
   const calls=[];const module={exports:{}};const lib={env:{},pipeline:async()=>{
     if(mode==="load-fail")throw Error("invented model load failure");
     return async batch=>{calls.push(batch);if(mode==="infer-fail")throw Error("invented inference failure");
       if(mode==="hang")return new Promise(()=>{});
       return batch.map(t=>({translation_text:mode==="empty"?"":`fixture:${t}`}));};
   }};
   const context={module,exports:module.exports,require:n=>{assert(["crypto","path"].includes(n));return require(n);},process:{env:{BQ_TRANSLATE:"1"}},__dirname:root,__fixtureLibrary:lib,setTimeout,clearTimeout};
   vm.runInNewContext(engineSource.replace(marker,"Promise.resolve(__fixtureLibrary)"),context);
   return{api:module.exports,calls,setMode:next=>{mode=next;}};
 }
 await test("G08","Multilingual orchestration and content-keyed edits",async()=>{
   const {api,calls}=engine(),samples=["مرحبا بالعالم.","Hello colleagues.","مرحبا Project A42","Invented Noor / نور","https://example.invalid/a?b=1 #مشروع #Project","😊 !؟،.","First line\nالسطر الثاني"];
   const frozen=JSON.stringify(samples);
   for(const s of samples){const r=await api.translate(s,"en","ar");if(/\p{L}/u.test(s))assert(r.includes("fixture:"));else assert.equal(r,s.trim());assert(s.trim());}
   const n=calls.length;await api.translate(samples[0],"en","ar");assert.equal(calls.length,n);
   await api.translate("Edited invented note","en","ar");assert.equal(calls.length,n+1);
   assert.equal(JSON.stringify(samples),frozen);
   return "Seven invented script/name/URL/hashtag/emoji/newline inputs; echo fixture verifies plumbing only, not preservation by real model.";
 });
 await test("G09","Model errors reject and queue recovers; empty response",async()=>{
   for(const mode of ["load-fail","infer-fail"]){const e=engine(mode);await assert.rejects(e.api.translate("Invented failure","en","ar"));e.setMode("echo");assert((await e.api.translate("Retry invented","en","ar")).includes("fixture:"));}
   assert.equal(await engine("empty").api.translate("Invented empty","en","ar"),"");
   return "Import/inference failure and empty result simulated; no real provider outage or HTTP failure injection.";
 });
 await test("G10","Engine deadline releases a hung caller; overlong token truncation demonstrated",async()=>{
   const stuck=engine("hang");stuck.api.limits.waitMs=200;
   const at=Date.now(),hung=stuck.api.translate("Invented wait","en","ar");
   const result=await Promise.race([hung.then(()=>"resolved"),new Promise(r=>setTimeout(()=>r("pending"),50))]);assert.equal(result,"pending");
   assert.equal(await hung,"");assert(Date.now()-at<1000);
   const {api,calls}=engine();await api.translate("x".repeat(500),"en","ar");
   assert.equal(calls.flat().join("").length,380);
   return "Controlled hung fixture stays pending at 50ms and is released empty at the 200ms test deadline (not a measured real-model timeout); 500-character unbroken token becomes 380 before inference. Existing server fail-stop deadline is separate.";
 });
 await test("G11","Exact frontend language heuristic and translation output sinks",async()=>{
   const source=fs.readFileSync(path.join(root,"public/js/posting.js"),"utf8");
   const code=source.match(/function textLanguage\(text\) \{[\s\S]*?\n\}/)[0],detect=vm.runInNewContext(`(${code})`);
   assert.equal(detect("مرحبا"),"ar");assert.equal(detect("Hello"),"en");assert.equal(detect("OK"),"");
   assert.equal(detect("مرحبا https://example.invalid/long/url"),"en");
   assert(source.includes('body.dir = "auto"'));assert(source.includes("body.textContent = result"));
   assert(source.includes("translate.google.com/"));assert(source.includes("encodeURIComponent(text.slice(0, 4000))"));
   return "Mixed input can be classified English due to URL Latin letters; translated text uses textContent and dir=auto. External link encodes source text on click; no link opened, no real content transmitted.";
 });
}catch(e){results.push({id:"ENV",status:"FAIL",error:e.message.slice(0,400)});}
finally{await h?.close();fs.writeFileSync(path.join(out,"targeted-tests.json"),JSON.stringify({results,requests:h?.requests||[],pass:results.filter(x=>x.status==="PASS").length,fail:results.filter(x=>x.status==="FAIL").length},null,2));if(results.some(x=>x.status==="FAIL"))process.exitCode=1;}
})();
