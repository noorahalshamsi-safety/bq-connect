const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {prepare}=require("../../development/postgres/isolation.cjs");
const {Repository}=require("../../development/postgres/repository.cjs");
const {create}=require("../../development/postgres/fixtures.cjs");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function harness(port=5128) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-pg-dev-")),proof=prepare(root),repo=new Repository(proof),fixture=create(proof.sessionKey),requests=[],children=[],logs=[];
  await repo.initialize(fixture.files);
  async function boot(p=port,localTranslation=false) {
    const modelEnv=localTranslation?{BQ_TRANSLATE:"1",BQ_MODELS_DIR:path.resolve(__dirname,"../../generated-artifacts/phase2b/models")}:{};
    const child=spawn(process.execPath,[path.resolve(__dirname,"../../development/postgres/runtime.cjs"),root,"--measure"],{cwd:proof.app,env:{...proof.childEnv,PORT:String(p),...modelEnv},stdio:["ignore","pipe","pipe"]});
    let listening=false;
    children.push(child);child.stdout.on("data",x=>{const text=x.toString();logs.push(text);if(text.includes(`BQ Connect: http://0.0.0.0:${p}`))listening=true;});child.stderr.on("data",x=>logs.push(x.toString()));
    for(let i=0;i<200;i++){await sleep(100);if(child.exitCode!==null||child.signalCode!==null)throw Error("Isolated app failed startup");try{const r=await fetch(`http://127.0.0.1:${p}/health/ready`);if(listening&&r.status===200)return child;}catch{}}
    throw Error("Isolated app startup timed out");
  }
  async function request(url,body={},badge="101",options={}) {
    const method=options.method||"POST",token=fixture.credentials.tokens[badge],headers={"Content-Type":"application/json","x-forwarded-for":options.ip||"192.0.2.20",...options.headers};
    if(token){headers["x-session"]=token;body={token,...body};}
    if(!["GET","HEAD"].includes(method))headers["Idempotency-Key"]=options.key||crypto.randomUUID();
    const at=performance.now(),r=await fetch(`http://127.0.0.1:${options.port||port}${url}`,{method,headers,body:["GET","HEAD"].includes(method)?undefined:options.raw||JSON.stringify(body),signal:AbortSignal.timeout(options.timeout||35000)});
    const bytes=Buffer.from(await r.arrayBuffer());let json={};try{json=JSON.parse(bytes);}catch{}
    requests.push({url:url.split("?")[0],method,action:body.action||null,op:body.op||null,badge:badge||"anonymous",status:r.status,ms:performance.now()-at});
    return {status:r.status,json,bytes,headers:r.headers};
  }
  const social=(action,body={},badge="101",opts)=>request("/api/social",{action,...body},badge,opts);
  async function stop(child){if(child?.exitCode===null&&child.signalCode===null)await new Promise(r=>{child.once("exit",r);child.kill("SIGKILL");});}
  async function close(){for(const c of children)await stop(c);await Promise.race([repo.pool.end(),sleep(1500)]);try{proof.stop();}catch{}fs.rmSync(root,{recursive:true,force:true});}
  return {root,proof,repo,fixture,port,boot,request,social,stop,close,requests,logs};
}
const ok=(r,status=200)=>assert.equal(r.status,status,`HTTP ${r.status} ${r.json.error||""}`);
module.exports={harness,ok,sleep};
