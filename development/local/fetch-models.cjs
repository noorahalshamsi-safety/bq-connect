// Downloads the public OPUS-MT weights used by translate.js into the cache that the
// synthetic suites read (generated-artifacts/phase2b/models). Invented text only.
const path=require("node:path");
process.env.BQ_TRANSLATE="1";
process.env.BQ_MODELS_DIR=path.resolve(__dirname,"../../generated-artifacts/phase2b/models");
const engine=require("../../translate.js");
(async()=>{
  for(const [from,to,text] of [["ar","en","صباح الخير."],["en","ar","Good morning."]]){
    const result=await engine.translate(text,from,to);
    console.log(`${from}>${to} ${result?"ready":"empty result"}`);
  }
})().catch(e=>{console.error("Model download failed:",e.message);process.exitCode=1;});
