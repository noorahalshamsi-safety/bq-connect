// Compares generation settings for the existing OPUS-MT models on invented text.
// Usage: node development/local/translation-experiment.cjs ar>en|en>ar
// Evidence only: it does not change translate.js behavior. Requires fetch-models.cjs first.
const path=require("node:path");
const MODELS={"ar>en":"Xenova/opus-mt-ar-en","en>ar":"Xenova/opus-mt-en-ar"};
const SAMPLES={
  "ar>en":["صباح الخير. المشروع جاهز.","مرحبا Project A42، الموعد غدا 😊","راجع https://example.invalid/42 #مشروع!","شكرا لك."],
  "en>ar":["The project is ready.","Invented Noor met Synthetic Sami.","Read https://example.invalid/A42 #Project 😊!","The project is delayed."],
};
const VARIANTS={
  current:{max_new_tokens:400},
  noRepeat3:{max_new_tokens:400,no_repeat_ngram_size:3},
  repetition12:{max_new_tokens:400,repetition_penalty:1.2},
  beams4:{max_new_tokens:400,num_beams:4},
};
const pair=process.argv[2];
if(!MODELS[pair]){console.error("Usage: translation-experiment.cjs ar>en|en>ar");process.exit(2);}
(async()=>{
  const lib=await import("@huggingface/transformers");
  lib.env.cacheDir=path.resolve(__dirname,"../../generated-artifacts/phase2b/models");
  lib.env.allowLocalModels=false;
  const translator=await lib.pipeline("translation",MODELS[pair],{dtype:"q8"});
  if(process.argv[3]==="batch"){
    const pieces=pair==="ar>en"?["صباح الخير.","المشروع جاهز.","شكرا لك."]:["Good morning.","The project is ready.","Thank you."];
    const batched=(await translator(pieces,{max_new_tokens:400})).map(r=>r.translation_text);
    const single=[];for(const p of pieces)single.push((await translator([p],{max_new_tokens:400}))[0].translation_text);
    console.log(JSON.stringify({pair,batched,single}));
    return;
  }
  for(const [name,options] of Object.entries(VARIANTS)){
    for(const text of SAMPLES[pair]){
      const at=performance.now();
      const [row]=await translator([text],options);
      const result=String(row.translation_text||"").trim();
      console.log(JSON.stringify({pair,variant:name,text,result,ms:Math.round(performance.now()-at),
        punctuationRun:/[.،,!؟?]{3,}/.test(result),rssMiB:Math.round(process.memoryUsage().rss/1048576)}));
    }
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
