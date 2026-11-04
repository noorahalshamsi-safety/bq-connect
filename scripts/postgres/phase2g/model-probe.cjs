// Original engine and cached public weights; invented text only. No external AI API.
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
const root=path.resolve(__dirname,"../../.."),out=path.join(root,"generated-artifacts/phase2g");
const samples=[
 ["ar","en","صباح الخير. المشروع جاهز."],["en","ar","The project is ready."],
 ["ar","en","مرحبا Project A42، الموعد غدا 😊"],
 ["en","ar","Invented Noor met Synthetic Sami."],
 ["en","ar","Read https://example.invalid/A42 #Project 😊!"],
 ["ar","en","راجع https://example.invalid/42 #مشروع!"],
 ["en","ar","The project is delayed."],["en","ar","The project is ready."]
];
if(process.argv[2]==="child"){
 const engine=require("../../../translate.js");
 (async()=>{
  for(const [from,to,text]of samples){const at=performance.now();try{
   const result=await engine.translate(text,from,to);
   console.log("ROW "+JSON.stringify({from,to,text,result,ms:performance.now()-at,
    urlPresent:!text.includes("https://")||result.includes(text.match(/https:\/\/\S+/)[0]),
    emojiPresent:!text.includes("😊")||result.includes("😊"),
    excessivePunctuation:/[.،!؟?]{4,}/.test(result)}));
  }catch(e){console.log("ROW "+JSON.stringify({from,to,text,error:e.message.slice(0,150)}));}}
 })().catch(()=>{process.exitCode=1;});
}else{
 fs.mkdirSync(out,{recursive:true});
 const child=spawn(process.execPath,[__filename,"child"],{
  env:{PATH:process.env.PATH,HOME:out,BQ_TRANSLATE:"1",BQ_MODELS_DIR:path.join(root,"generated-artifacts/phase2b/models"),
   HF_HUB_OFFLINE:"1",TRANSFORMERS_OFFLINE:"1"},stdio:["ignore","pipe","pipe"]});
 let text="",peak=0,reason=null,diagnostic="";child.stdout.on("data",b=>text+=b);
 child.stderr.on("data",b=>diagnostic=(diagnostic+b.toString()).slice(-1000));
 const stop=r=>{if(!reason){reason=r;child.kill("SIGKILL");}};
 const wall=setTimeout(()=>stop("120000ms wall guard"),120000);
 const memory=setInterval(()=>{try{const m=fs.readFileSync(`/proc/${child.pid}/status`,"utf8").match(/VmRSS:\s+(\d+)/);peak=Math.max(peak,Number(m?.[1]||0)/1024);if(peak>768)stop("768MiB RSS guard");}catch{}},50);
 child.on("error",e=>{reason=e.code||e.message;});
 child.on("exit",(code,signal)=>{
  clearTimeout(wall);clearInterval(memory);
  const rows=text.split("\n").filter(x=>x.startsWith("ROW ")).map(x=>JSON.parse(x.slice(4)));
  const result={status:rows.length===samples.length&&!reason&&code===0?"COMPLETED / QUALITY REQUIRES REVIEW":"PARTIAL / NOT CERTIFIED",
   planned:samples.length,completed:rows.length,rows,peakSampledRssMiB:peak,guard:reason,code,signal,
   diagnostic:diagnostic.replace(/\x1b\[[0-9;]*m/g,""),limits:"Only invented text. Timings include model load/queue, not HTTP. Partial rows do not certify missing samples; offline environment flags are not a packet-capture proof."};
  fs.writeFileSync(path.join(out,"model-probe.json"),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 });
}
