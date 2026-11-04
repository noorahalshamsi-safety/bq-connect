// Translation regression on invented text with the existing local OPUS models (REL-012).
// Usage: node scripts/translation/regression.cjs [unit|ar>en|en>ar]   (default: all, one model per process)
// Models must already be cached: node development/local/fetch-models.cjs
const path=require("node:path"),assert=require("node:assert/strict"),{spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"../..");
const CORPUS={
  "ar>en":[
    "صباح الخير. المشروع جاهز.",
    "مرحبا Project A42، الموعد غدا 😊",
    "راجع https://example.invalid/42 #مشروع!",
    "تواصل مع fixture-101@example.invalid اليوم.",
    "شكرا لك.",
  ],
  "en>ar":[
    "Good morning. The project is ready. Thank you.",
    "Read https://example.invalid/A42 #Project 😊!",
    "Invented Noor met Synthetic Sami.",
    "Email fixture-102@example.invalid before Sunday.",
    "The project is delayed.",
  ],
};
const verbatim=text=>[...text.matchAll(/https?:\/\/\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\p{Extended_Pictographic}/gu)].map(m=>m[0]);
const results=[];
function check(id,name,fn){
  return Promise.resolve().then(fn).then(evidence=>results.push({id,name,status:"PASS",evidence}),e=>results.push({id,name,status:"FAIL",error:e.message.slice(0,400)}))
    .then(()=>console.log(id,results.at(-1).status,name,results.at(-1).status==="FAIL"?results.at(-1).error:""));
}

async function unit(){
  process.env.BQ_TRANSLATE="0";
  const {segments}=require(path.join(root,"translate.js"));
  await check("T01","URLs, e-mail and emoji are verbatim segments",()=>{
    const parts=segments("Read https://example.invalid/A42 #Project 😊! fixture@example.invalid ok");
    const kept=parts.filter(p=>!p.translate).map(p=>p.text.trim()).filter(Boolean);
    assert.deepEqual(kept,["https://example.invalid/A42","😊","!","fixture@example.invalid"]);
    assert.equal(parts.map(p=>p.text).join(""),"Read https://example.invalid/A42 #Project 😊! fixture@example.invalid ok");
    return{kept:kept.length,lossless:true};
  });
  await check("T02","Segments without letters are never sent to the model",()=>{
    assert(segments("2026 / 42 !!").every(p=>!p.translate));
    assert(segments("مرحبا 2026").some(p=>p.translate));
    return{numbersOnly:"verbatim"};
  });
}

async function model(pair){
  process.env.BQ_TRANSLATE="1";
  process.env.BQ_MODELS_DIR=path.join(root,"generated-artifacts/phase2b/models");
  const engine=require(path.join(root,"translate.js"));
  const [from,to]=pair.split(">");
  const tag=pair==="ar>en"?"A":"E";
  let warm=0;
  await engine.translate(CORPUS[pair][4],from,to);
  for(const [i,text] of CORPUS[pair].entries()){
    await check(`${tag}${String(i+1).padStart(2,"0")}`,`${pair} ${JSON.stringify(text)}`,async()=>{
      const source=String(text),at=performance.now(),result=await engine.translate(source,from,to),ms=Math.round(performance.now()-at);
      warm=Math.max(warm,ms);
      assert.equal(source,text);
      assert(result.length>0,"empty translation");
      for(const span of verbatim(text))assert(result.includes(span),`missing verbatim span ${span}`);
      const sourceRun=(text.match(/[.،,!؟?]{2,}/g)||[]).length;
      assert(!/[.،,!؟?]{3,}/.test(result)||sourceRun,`punctuation run: ${result}`);
      assert(!/(\S+(?:\s+\S+)?)(?:\s+\1){2,}/u.test(result),`repeated phrase: ${result}`);
      assert(ms<8000,`warm latency ${ms}ms`);
      return{result,ms};
    });
  }
  await check(`${tag}90`,`${pair} edited text is translated afresh, not served from the previous cache entry`,async()=>{
    const a=await engine.translate(CORPUS[pair][0],from,to),b=await engine.translate(CORPUS[pair][0]+" "+CORPUS[pair][4],from,to);
    assert.notEqual(a,b);return{distinct:true};
  });
  console.log("RSS_MIB",Math.round(process.memoryUsage().rss/1048576),"MAX_WARM_MS",warm);
}

const mode=process.argv[2];
if(mode==="unit")unit().then(done);
else if(CORPUS[mode])model(mode).then(done);
else{
  let fail=0;
  for(const m of ["unit","ar>en","en>ar"]){
    const r=spawnSync(process.execPath,[__filename,m],{cwd:root,encoding:"utf8",env:{PATH:process.env.PATH,HOME:process.env.HOME,HF_HUB_OFFLINE:"1",TRANSFORMERS_OFFLINE:"1"}});
    process.stdout.write(r.stdout.split("\n").filter(l=>!l.includes("MarianTokenizer")).join("\n"));
    if(r.status!==0)fail++;
  }
  process.exitCode=fail?1:0;
}
function done(){
  const pass=results.filter(r=>r.status==="PASS").length,fail=results.length-pass;
  console.log(JSON.stringify({mode:process.argv[2],pass,fail}));
  if(fail)process.exitCode=1;
}
