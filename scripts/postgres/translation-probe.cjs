// Existing local model engine only. No translation API/provider is introduced.
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
const out=path.resolve(__dirname,"../../generated-artifacts/phase2b");
if(process.argv[2]==="child"){
  (async()=>{
    const hosts=new Set(),native=global.fetch;
    global.fetch=(input,options={})=>{
      const url=new URL(typeof input==="string"?input:input.url||String(input));
      if(!["GET","HEAD"].includes(options.method||"GET"))throw Error("model_download_only");
      hosts.add(url.hostname);return native(input,options);
    };
    const t=require("../../translate.js"),results=[];
    for(const [from,to,text]of [["ar","en","صباح الخير. المشروع جاهز."],["en","ar","Good morning. The project is ready."]]){
      const start=performance.now(),translated=await t.translate(text,from,to);
      results.push({from,to,text,translated,ms:performance.now()-start});
      if(!translated||translated===text)throw Error("No successful local translation");
    }
    const start=performance.now(),cached=await t.translate(results[0].text,"ar","en");
    const cacheMs=performance.now()-start;
    const edited=await t.translate("The project has been delayed.","en","ar");
    const concurrent=await Promise.all([t.translate("Thank you.","en","ar"),t.translate("شكرا لك.","ar","en")]);
    console.log("BQ_TRANSLATION_RESULT "+JSON.stringify({status:"PASS",results,cached,cacheMs,edited,concurrent,downloadHosts:[...hosts],quality:"Manual semantic review required; this is not a language-quality benchmark."}));
  })().catch(e=>{console.error("BQ_TRANSLATION_RESULT "+JSON.stringify({status:"BLOCKED",error:e.message}));process.exitCode=1;});
}else{
  fs.mkdirSync(out,{recursive:true});
  const child=spawn(process.execPath,[__filename,"child"],{env:{PATH:process.env.PATH,HOME:out,BQ_TRANSLATE:"1",BQ_MODELS_DIR:path.join(out,"models")},stdio:["ignore","pipe","pipe"]});
  let result,diagnostic="";
  const collect=bytes=>{const text=bytes.toString();diagnostic+=text;for(const line of text.split("\n"))if(line.includes("BQ_TRANSLATION_RESULT "))try{result=JSON.parse(line.split("BQ_TRANSLATION_RESULT ")[1]);}catch{}};
  child.stdout.on("data",collect);child.stderr.on("data",collect);
  const timer=setTimeout(()=>child.kill("SIGKILL"),150000);
  child.on("exit",code=>{clearTimeout(timer);result||={status:"BLOCKED",error:code===null?"Local model probe exceeded 150 second budget":"Local model initialization failed",diagnostic:diagnostic.slice(-1000)};
    fs.writeFileSync(path.join(out,"translation.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});
}
