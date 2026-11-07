// Separate development process; never imported by start.js or production auth.
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),https=require("node:https");
const crypto=require("node:crypto"),{Writable,Readable}=require("node:stream");
const {Script}=require("node:vm");
const {verify}=require("./isolation.cjs"),{Repository,hash}=require("./repository.cjs");
const {install}=require("./virtual-fs.cjs");
const {staticRequest,originAllowed,bufferRequest}=require("./ingress.cjs");
const {sensitive,scope}=require("./sealed.cjs");
const nativeProfile=require("./native-profile.cjs");
const workspace=path.resolve(__dirname,"../..");
async function start(root) {
  const proof=verify(root),repo=new Repository(proof);
  await repo.hardenControls();
  const nativeEnabled=!process.argv.includes("--reference");
  if(nativeEnabled)await nativeProfile.prepare(repo);
  return serve(proof,repo,{nativeEnabled,faults:true,measure:process.argv[3]==="--measure"});
}
// Shared by development and staging. Performs no DDL; callers own schema state.
// `faults` honours dev.test_faults injection points and is development-only.
async function serve(proof,repo,{nativeEnabled=true,faults=false,measure=false,minimalRelease=false,deliverMail,deliverSms,freshInstall=false,freshProviders={},freshEmailDomains,freshAdminPolicy,mediaEnabled=false,startupTimeoutMs=120000}={}) {
  let poisoned=false,stopping=false,ingress=0,pending=0;
  const jobTimers=new Set();
  const timings=[];
  let context=null,queue=Promise.resolve(),auth,app,readyResolve,readyReject;
  let boot,virtual,realHttps,outboxTimer,internalServer,bootComplete=false;
  const startupAt=performance.now();
  const realCreate=http.createServer;
  let startupStage="HYDRATE";
  function stage(name,status="STARTED",error,elapsedMs) {
    startupStage=name;
    console.log(JSON.stringify({SQL_STARTUP:name,status,...(elapsedMs!==undefined?{elapsedMs}:{}),...(error?{
      errorType:["Error","TypeError","ReferenceError","SyntaxError","RangeError"].includes(error.name)?error.name:"OTHER"
    }:{})}));
  }
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  // A synchronous generated-module error can precede the final await.
  ready.catch(()=>{});
  const startupTimer=setTimeout(()=>{
    poisoned=true;stopping=true;
    stage(startupStage,"BLOCKED",Error());
    readyReject(Object.assign(Error("fresh_startup_timeout"),{code:"fresh_startup_timeout"}));
    // Promise rejection cannot cancel a pending SQL operation or legacy
    // callback. Retire, never retry in this mutable worker after a deadline.
    setTimeout(()=>process.exit(1),100).unref();
  },startupTimeoutMs);
  startupTimer.unref();
  try {
  console.log(JSON.stringify({SQL_STARTUP:"SOURCE",status:"PASS",
    repositorySha256:require("./repository.cjs").sourceFingerprint,
    runtimeSha256:hash(fs.readFileSync(__filename))}));
  stage("HYDRATE");
  const serial=fn=>{const work=queue.then(fn,fn);queue=work.catch(()=>{});return work;};
  const failureCategory=e=>["55P03","57014","53300","08006","57P01","42501","23502","23503","23505","23514"].includes(e.code)?e.code:
    e.message==="Query read timeout"?"READ_TIMEOUT":"OTHER";
  function retire(c) {
    poisoned=true;stopping=true;
    // Destroy, never reuse a connection whose operation may still be running.
    c?.client.connection?.stream?.destroy(Error("runtime_deadline"));
    setTimeout(()=>process.exit(1),100).unref();
  }
  const acquisitionLog=label=>entry=>{
    if(entry.status==="BLOCKED"||(entry.status==="PASS"&&entry.elapsedMs>=1000))
      console.error(JSON.stringify({SQL_RUNTIME:label,...entry}));
  };
  const responseScope=c=>scope(new Map([...(c.files.allRevisions||c.files),...c.files]));
  async function hydrate(t,nativeRead=false) {
    const observe=bootComplete?undefined:async(operation,fn)=>{
      const at=performance.now();stage("HYDRATE_"+operation);
      try{
        const result=await fn();stage("HYDRATE_"+operation,"PASS",undefined,Math.round(performance.now()-at));
        return result;
      }catch(error){
        stage("HYDRATE_"+operation,"BLOCKED",error,Math.round(performance.now()-at));throw error;
      }
    };
    const run=(name,fn)=>observe?observe(name,fn):fn();
    try{
      const media=nativeRead?{rows:[]}:await run("MEDIA_INDEX",()=>t.client.query({
        text:"SELECT * FROM dev.media WHERE state IN('ready','retained')",query_timeout:20000
      }));
      await run("MEDIA_RESTORE",()=>repo.ensureMedia(media.rows));
      const at=performance.now();if(!bootComplete)stage("HYDRATE_BUFFERS");
      const hydrated={...t,nativeProfile:nativeRead,buffers:new Map([...t.files].map(([f,r])=>[f,Buffer.from(JSON.stringify(r.value))])),
        changed:new Set(),temps:new Map(),events:[],media:new Map(media.rows.map(row=>[row.legacy_path,{...row,legacy:row.legacy_path,object:path.join(proof.objects,row.id)}])),actor:""};
      // Production provider secrets are process-local overlays, not SQL settings.
      if(freshInstall)for(const [name,value]of Object.entries(freshProviders)){
        hydrated.buffers.set(name,Buffer.from(JSON.stringify(value)));
        if(hydrated.files.has(name))hydrated.files.set(name,{...hydrated.files.get(name),value});
      }
      if(!bootComplete)stage("HYDRATE_BUFFERS","PASS",undefined,Math.round(performance.now()-at));
      return hydrated;
    }catch(e){t.client.release(e);throw e;}
  }
  async function refresh() {
    auth?.__refresh();
    app?.__refresh();
    const saved=await context.client.query("SELECT * FROM dev.runtime_state");
    const state=Object.fromEntries(saved.rows.map(r=>[r.name,repo.vault.decode(r.value,`state:${r.name}`)]));
    for(const [group,collection] of [["auth",auth?.__maps],["app",app?.__maps]])for(const [name,map]of Object.entries(collection||{})){
      map.clear();for(const [k,v]of state[`${group}:${name}`]||[])map.set(k,v);
    }
  }
  async function persist(c) {
    if(c.nativeProfile&&(c.events.length||[...c.changed].some(f=>f!=="accounts.json")||c.media.size))throw Error("native_read_write_scope");
    for(const file of c.changed) {
      const value=JSON.parse(c.buffers.get(file).toString()),r=c.files.get(file);
      await repo.save(c.client,file,value,r.revision);
      c.files.set(file,{value,revision:r.revision+1});
    }
    if(!c.nativeProfile)await repo.commitMedia(c.client,c.media,c.files);
    for(const [group,collection] of [["auth",auth?.__maps],["app",app?.__maps]])for(const [name,map]of Object.entries(collection||{}))
      await c.client.query("INSERT INTO dev.runtime_state(name,value) VALUES($1,$2::jsonb) ON CONFLICT(name) DO UPDATE SET value=excluded.value",[`${group}:${name}`,JSON.stringify(repo.vault.json([...map],`state:${group}:${name}`))]);
    for(const event of c.events)await repo.enqueue(c.client,event.topic,event.payload);
  }
  async function finish(c,commit) {
    let discard;
    try {if(commit){
      if(poisoned)throw Error("worker_retired");
      if(c===boot)stage("BOOT_PERSIST");
      await persist(c);
      if(c.replayRecord){
        const r=c.replayRecord,policy=sensitive.has(c.path)||r.response.length>262144?"no-response":"encrypted";
        const body=policy==="encrypted"?repo.vault.seal(Buffer.from(JSON.stringify({scope:responseScope(c),headers:r.headers,response:r.response.toString("base64")})),`request:${r.actor}:${r.key}:${r.digest}`):Buffer.alloc(0);
        await c.client.query("INSERT INTO dev.requests(actor,request_key,digest,status,headers,body,policy) VALUES($1,$2,$3,$4,'{}'::jsonb,$5,$6)",[r.actor,r.key,r.digest,r.status,body,policy]);
      }
      if(c.fault==="before_commit")throw Error("synthetic_injected_commit_failure");
      if(c.fault==="during_commit"){
        await c.client.query("CREATE TEMP TABLE commit_guard(id int PRIMARY KEY,parent int REFERENCES commit_guard(id) DEFERRABLE INITIALLY DEFERRED) ON COMMIT DROP");
        await c.client.query("INSERT INTO commit_guard VALUES(1,2)");
      }
      if(c.fault==="unknown_commit"){
        // Real driver loses the response while COMMIT is in flight. A separate
        // test witness confirms the server commit, but not the requesting client.
        const stream=c.client.connection.stream;stream.pause();
        const committing=c.client.query("COMMIT");committing.catch(()=>{});
        const witness=await repo.pool.connect();
        try{for(let i=0;i<50;i++){const seen=await witness.query("SELECT 1 FROM dev.requests WHERE actor=$1 AND request_key=$2",[c.replayRecord.actor,c.replayRecord.key]);if(seen.rowCount)break;await new Promise(r=>setTimeout(r,10));}}
        finally{witness.release();}
        stream.destroy(Error("synthetic_commit_outcome_unknown"));await committing;
      } else {
        if(c===boot)stage("BOOT_COMMIT");
        await c.client.query("COMMIT");
      }
    }else await c.client.query("ROLLBACK");}
    catch(e){discard=e;await c.client.query("ROLLBACK").catch(()=>{});throw e;}
    finally{
      c.client.release(discard);context=null;
      if(measure&&c.label){
        timings.push({...c.metrics,queryCount:c.client.__bqQueries-c.queryStart,nativeProfile:c.nativeProfile,label:c.label,totalTxMs:performance.now()-c.started,queueWaitMs:c.queueWaitMs});
        if(timings.length>1000)timings.shift();
        fs.writeFileSync(path.join(proof.root,"request-timings.json"),JSON.stringify(timings),{mode:0o600});
      }
    }
    if(commit&&!minimalRelease)repo.drainFixtureOutbox().catch(()=>{}); // Never synthetic acknowledgements in a real release.
  }
  const enqueue=(topic,payload)=>{
    if(!context)throw Error("outbox_transaction_required");
    context.events.push({topic,payload});
    return Promise.resolve();
  };
  async function job(fn,label) {
    return serial(async()=>{
      if(!bootComplete||poisoned||stopping)return {committed:false,skipped:true};
      let c,timer;
      try {
        // Include acquisition, hydration, refresh, persistence and COMMIT,
        // not just the callback. A timeout is fail-stop, not cancellation.
        const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{
          retire(c);reject(Error("background_deadline"));
        },25000);});
        const work=(async()=>{
          c=context=await hydrate(await repo.begin(undefined,{observe:acquisitionLog(label)}));
          if(poisoned)throw Error("worker_retired");
          await refresh();await fn();await finish(c,true);
        })();
        await Promise.race([work,deadline]);
        return {committed:true};
      }catch(e){
        if(!poisoned&&c&&context===c)await finish(c,false).catch(()=>{});
        const frames=(e.stack||"").split("\n").slice(1,4).map(l=>l.match(/[\w.-]+\.(?:c?js):\d+:\d+/)?.[0]).filter(Boolean);
        console.error("PostgreSQL job refused:",JSON.stringify({job:label||fn.name||"scheduled",category:failureCategory(e),frames}));
        return {committed:false};
      }finally{clearTimeout(timer);}
    });
  }
  global.__bqDevInterval=(fn,ms)=>{
    let queued=false;
    const label=fn.name||`timer-${jobTimers.size}`;
    const invoke=()=>{
      if(queued||poisoned||stopping)return Promise.resolve({committed:false,skipped:true});
      queued=true;return job(fn,label).finally(()=>queued=false);
    };
    const timer=setInterval(invoke,ms);jobTimers.add(timer);timer.unref();return timer;
  };
  const hydrateAt=performance.now();
  boot=context=await hydrate(await repo.begin(undefined,{observe:entry=>{
    startupStage="HYDRATE_"+entry.operation;
    console.log(JSON.stringify({SQL_STARTUP:"HYDRATE",...entry}));
  }}));
  stage("HYDRATE","PASS",undefined,Math.round(performance.now()-hydrateAt));
  stage("GENERATE");
  const files=["auth.js","server.js","backup.js","push.js","moderation.js","spark-agent.js","translate.js","persistence-safety.js"];
  // Transform only the isolated copies. The production source remains unchanged.
  for(const file of files) {
    let source=fs.readFileSync(path.join(workspace,file),"utf8");
    if(file==="translate.js"){
      const marker='import("@huggingface/transformers")';
      if(!source.includes(marker))throw Error("development_translation_import_contract_changed");
      const entry=require.resolve("@huggingface/transformers").replace(/\.cjs$/,".mjs");
      if(!fs.existsSync(entry))throw Error("development_translation_entry_missing");
      source=source.replace(marker,`import(${JSON.stringify(entry)})`);
    }
    if(file==="auth.js"){
      // The original fence refuses JSON-file account authority in deployments.
      // This copy has none: account bytes only reach the virtual filesystem,
      // which commits through the request's SQL transaction or refuses.
      const durable="if (process.env.REPLIT_DEPLOYMENT) safety.requireDurableBackend();";
      if(!source.includes(durable))throw Error("durable_backend_contract_changed");
      source='const setInterval=global.__bqDevInterval;\n'+source.replace(durable,"global.__bqRequireTransaction();").replaceAll('.replace(/^0+/, "")',"");
      if(minimalRelease){
        // Keep original session/recovery/TOTP keys and signatures. Only old
        // unfinished login/reset challenge tickets are excluded at cutover.
        const marker="`ticket:${stage}:";
        if(source.split(marker).length!==3)throw Error("minimal_ticket_epoch_contract_changed");
        source=source.replaceAll(marker,"`ticket:"+proof.dataset+":${stage}:");
      }
      if(freshInstall)source=require(path.resolve(__dirname,"../../../../../deploy/fresh/runtime-policy.cjs")).transformAuth(source);
      source+='\nmodule.exports.__maps={failures,mailLog,usedTickets};\nmodule.exports.__refresh=()=>{for(const k of Object.keys(accounts))delete accounts[k];Object.assign(accounts,safety.readAccounts(ACCOUNTS));loadedStamp=accountsStamp();securityCache={stamp:"",value:null};};\n';
    }
    if(file==="server.js"){
      if(freshInstall)source=require(path.resolve(__dirname,"../../../../../deploy/fresh/runtime-policy.cjs")).transform(source,{mediaEnabled,emailDomains:freshEmailDomains,adminPolicy:freshAdminPolicy});
      const marker="handleApi(req, res, urlPath, params).catch(";
      if(!source.includes(marker))throw Error("route_wrapper_source_changed");
      source='const setInterval=global.__bqDevInterval;\n'+source.replace(marker,"return "+marker).replaceAll('.replace(/^0+/, "")',"");
      source+='\nmodule.exports.__maps={attempts,pendingOtp,pendingEmail,apiHits,ipFailures,writeUse,forgotUse,translateUse,placeUse,joinUse,uploadUse,noteEcho};\nmodule.exports.__refresh=()=>{const fresh=loadDirectory();directory.splice(0,directory.length,...fresh);byBadge.clear();fresh.forEach(p=>byBadge.set(String(p.badge),p));departmentList=null;audienceSize=0;viewCache=null;sharedJson.clear();conductCache={stamp:"",data:null};avatarCache={stamp:"",byBadge:new Map(),byPid:new Map()};};\nmodule.exports.__server=server;\n';
      source+='\nmodule.exports.__eligible=token=>Boolean(personFromToken(token));\n';
      const profileMarker='if (action === "person") {';
      if(!source.includes(profileMarker))throw Error("native_profile_source_contract_changed");
      source=source.replace(profileMarker,profileMarker+'\nif(global.__bqNativePerson.active())return global.__bqNativePerson.read(body,person,res);');
      source+='\nmodule.exports.__profileReads={personByPid,lightCard,isOfficialBadge,send};\n';
    }
    fs.writeFileSync(path.join(proof.app,file),source,{mode:0o600});
  }
  stage("COMPILE_MODULES");
  // Parse the complete generated copies, not just their source templates.
  // Never report their source text or raw SyntaxError messages.
  for(const file of files)new Script(fs.readFileSync(path.join(proof.app,file),"utf8"),{filename:file});
  const publicDir=path.join(proof.app,"public");
  // Read-only links preserve existing assets; only the isolated HTML gains a
  // transport shim assigning one stable request key across a network retry.
  if(fs.existsSync(publicDir)&&fs.lstatSync(publicDir).isSymbolicLink())fs.unlinkSync(publicDir);
  fs.mkdirSync(publicDir,{recursive:true});
  for(const item of fs.readdirSync(path.join(workspace,"public"))) {
    const dest=path.join(publicDir,item);
    if(item==="index.html") {
      const html=fs.readFileSync(path.join(workspace,"public",item),"utf8");
      fs.writeFileSync(dest,html.replace("<head>","<head><script src=\"/synthetic-request.js\"></script>"));
    } else if(!fs.existsSync(dest))fs.symlinkSync(path.join(workspace,"public",item),dest);
  }
  fs.writeFileSync(path.join(publicDir,"synthetic-request.js"),`(()=>{const native=window.fetch.bind(window);window.fetch=async(input,options)=>{const r=new Request(input,options);if(new URL(r.url).origin!==location.origin||!["POST","PATCH","DELETE"].includes(r.method))return native(r);const h=new Headers(r.headers);if(!h.has("Idempotency-Key"))h.set("Idempotency-Key",crypto.randomUUID());const request=new Request(r,{headers:h}),retry=request.clone();try{return await native(request);}catch(error){return native(retry);}};})();`);
  if(freshInstall)require(path.resolve(__dirname,"../../../../../deploy/fresh/client-policy.cjs")).prepare(publicDir,workspace);
  virtual=install(proof,()=>context);
  global.__bqRequireTransaction=()=>{if(!context?.client)throw Error("transaction_context_required");};
  global.__bqNativePerson={
    active:()=>Boolean(context?.nativeProfile),
    read:(body,viewer,res)=>{context.response=res;return nativeProfile.person(context,body,viewer,app.__profileReads);}
  };
  stage("LOAD_AUTH");
  auth=require(path.join(proof.app,"auth.js"));
  const realMail=auth.sendMail.bind(auth);
  auth.sendMail=(to,subject,text)=>{
    if(minimalRelease&&!deliverMail&&!auth.mailConfigured())return Promise.reject(Error("smtp_unconfigured"));
    return enqueue("mail",{to,subject,text});
  };
  const push=require(path.join(proof.app,"push.js"));
  const originalPublic=push.publicKey;
  push.publicKey=()=>{if(!context.files.get("push-keys.json")?.value?.privateJwk){if(minimalRelease)return "";throw Error("vapid_key_missing");}return originalPublic();};
  push.send=minimalRelease?async()=>false:(badge,message)=>enqueue("push",{badge,message});
  const backup=require(path.join(proof.app,"backup.js"));
  const backupStatus=()=>JSON.parse(context.buffers.get("backup-status.json"));
  backup.status=()=>{const saved=backupStatus();return{vault:null,lastAt:saved.lastAt||"",size:saved.lastSize||0,files:saved.files||0,kept:saved.kept||0,failed:false,keyReady:true};};
  backup.createBackup=async()=>{
    const bundle={kind:minimalRelease?"BQ_MINIMAL_SQL_BACKUP":"SYNTHETIC_PG_BACKUP",dataset:proof.dataset,files:Object.fromEntries([...context.buffers].map(([f,b])=>[f,JSON.parse(b)])),media:{}};
    for(const [legacy,row]of context.media)bundle.media[legacy]=(row.bytes||virtual.original.readFileSync(row.object)).toString("base64");
    const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",Buffer.from(proof.backupKey,"hex"),iv);
    const bytes=Buffer.concat([iv,cipher.update(JSON.stringify(bundle)),cipher.final(),cipher.getAuthTag()]);
    const id=crypto.randomUUID(),manifest={dataset:proof.dataset,files:context.files.size,sha256:hash(bytes),media:context.media.size};
    await context.client.query("INSERT INTO dev.backups(id,ciphertext,manifest) VALUES($1,$2,$3::jsonb)",[id,bytes,JSON.stringify(manifest)]);
    const state={lastAt:new Date().toISOString(),lastSize:bytes.length,files:context.files.size,kept:1};
    fs.writeFileSync(path.join(proof.app,"data/backup-status.json"),JSON.stringify(state));
    return state;
  };
  backup.schedule=()=>{
    global.__bqDevInterval(async()=>{
      const settings=JSON.parse(context.buffers.get("backup.json")),last=backupStatus();
      const hours=Math.max(1,Number(settings.intervalHours)||24);
      if(settings.enabled!==false&&Date.now()-Date.parse(last.lastAt||"1970-01-01")>=hours*3600000)await backup.createBackup();
    },60000).unref();
    return()=>backup.createBackup();
  };
  // HTTP SMS provider boundary is an explicit fixture transport, never internet.
  realHttps=https.request;
  https.request=(url,options,callback)=>{
    const host=typeof url==="string"?new URL(url).hostname:url.hostname;
    if(!(minimalRelease?/^(api\.twilio\.com|api\.taqnyat\.sa|el\.cloud\.unifonic\.com)$/:/^(api\.twilio\.com|api\.taqnyat\.sa)$/).test(host||"")){
      // Production App Storage and other SDK HTTPS must retain their real
      // transport. Only the known SMS requests belong in the durable outbox.
      if(minimalRelease)return realHttps(url,options,callback);
      throw Error("external_transport_not_available");
    }
    if(typeof options==="function"){callback=options;options={};}
    const chunks=[],request=new Writable({write(chunk,encoding,done){chunks.push(Buffer.from(chunk));done();}});
    request.setTimeout=()=>request;
    request.on("finish",()=>{
      const payload={host,body:Buffer.concat(chunks).toString()};
      if(minimalRelease){
        const target=typeof url==="string"?new URL(url):url;
        payload.path=target.pathname!==undefined?target.pathname+(target.search||""):target.path;
        payload.method=options.method||target.method||"POST";payload.headers=options.headers||target.headers||{};
        require("./minimal-delivery.cjs").validate(payload);
      }
      enqueue("sms",payload);
      const response=Readable.from([Buffer.from(minimalRelease?'{"queued":true}':'{"synthetic":true}')]);
      response.statusCode=minimalRelease?202:201;callback(response);
    });
    return request;
  };
  async function handle(listener,req,res) {
    if(req.url==="/health/live"){res.writeHead(200,{"Content-Type":"application/json"});res.end('{"live":true}');return;}
    if(!bootComplete||poisoned||stopping){
      const live=req.url==="/"&&["GET","HEAD"].includes(req.method);
      res.writeHead(live?200:503,{"Content-Type":"application/json","Cache-Control":"no-store"});
      res.end('{"live":true,"ready":false,"error":"runtime_starting"}');return;
    }
    if(minimalRelease&&["/api/push"].includes((req.url||"").split("?")[0])){
      res.writeHead(503,{"Content-Type":"application/json","Cache-Control":"no-store"});
      res.end('{"error":"not_enabled_in_existing_accounts_release"}');return;
    }
    if(poisoned){res.writeHead(503,{"Content-Type":"application/json"});res.end('{"error":"worker_restarting"}');return;}
    if(!["GET","HEAD"].includes(req.method)&&!originAllowed(req)){res.writeHead(403,{"Content-Type":"application/json"});res.end('{"error":"origin_forbidden"}');return;}
    if(staticRequest(req))return listener(req,res);
    if(ingress>=8){res.writeHead(503,{"Content-Type":"application/json"});res.end('{"error":"ingress_busy"}');return;}
    ingress++;
    let captured;
    try{captured=await bufferRequest(req);}catch(e){res.writeHead(e.message==="body_too_large"?413:408,{"Content-Type":"application/json"});res.end(JSON.stringify({error:e.message}));return;}finally{ingress--;}
    req=captured.req;
    if(pending>=32){res.writeHead(503,{"Content-Type":"application/json"});res.end('{"error":"queue_busy"}');return;}
    pending++;
    const queuedAt=performance.now();
    let admitted=false,expired=false;
    // Queued work has no transaction or mutable state to cancel. Remove its
    // right to execute when admission expires; return a bounded retry response.
    const admissionTimer=setTimeout(()=>{
      if(admitted)return;expired=true;
      if(!res.headersSent){res.writeHead(503,{"Content-Type":"application/json","Cache-Control":"no-store"});
        res.end('{"error":"queue_busy"}');}
    },5000);
    return serial(async()=>{
      admitted=true;clearTimeout(admissionTimer);
      if(expired||res.destroyed||res.writableEnded)return;
      if(poisoned){res.writeHead(503);res.end();return;}
      let c,timer,watchdog,operation="ACQUIRE";
      const original={writeHead:res.writeHead.bind(res),write:res.write.bind(res),end:res.end.bind(res)};
      const chunks=[];let endedResolve,ended=false,status=200;
      const ending=new Promise(resolve=>endedResolve=resolve);
      function restore(){Object.assign(res,original);}
      try {
        watchdog=setTimeout(()=>{
          retire(c);restore();
          if(!res.headersSent){
            for(const k of res.getHeaderNames())res.removeHeader(k);
            original.writeHead(503,{"Content-Type":"application/json","Cache-Control":"no-store"});
            original.end('{"error":"transaction_deadline"}');
          }
          console.error(JSON.stringify({SQL_RUNTIME:"HTTP",operation,status:"BLOCKED",category:"DEADLINE"}));
        },25000);
        const queueWaitMs=performance.now()-queuedAt;
        let nativeRead=nativeEnabled&&nativeProfile.eligible(req,captured.bytes);
        const transaction=await repo.begin(nativeRead?nativeProfile.dependencies:undefined,{observe:acquisitionLog("HTTP")});
        if(poisoned){transaction.client.release(Error("worker_retired"));throw Error("worker_retired");}
        try{
          if(nativeRead&&!await nativeProfile.safe(transaction)){
            const fallbackAt=performance.now();
            transaction.files=await repo.load(transaction.client);transaction.metrics.loadQueries+=transaction.files.loadQueryCount;transaction.metrics.loadMs+=performance.now()-fallbackAt;nativeRead=false;
          }
        }catch(e){await transaction.client.query("ROLLBACK").catch(()=>{});transaction.client.release(e);throw e;}
        operation="HYDRATE";c=context=await hydrate(transaction,nativeRead);
        operation="REFRESH";await refresh();
        c.path=req.url.split("?")[0];c.label=`${req.method} ${c.path}`;c.queueWaitMs=queueWaitMs;
        try{c.metrics.action=JSON.parse(captured.bytes).action||null;}catch{}
        if(!["accounts.json","employees.json","ideas.json"].every(f=>c.files.allRevisions.has(f)))throw Error("critical_entity_missing");
        c.actor=auth.readSession(req.headers["x-session"])||"";
        const key=req.headers["idempotency-key"];
        if(key&&(!/^[A-Za-z0-9:_-]{8,120}$/.test(key)))throw Error("invalid_idempotency_key");
        let parsed={};try{parsed=JSON.parse(captured.bytes);}catch{}
        const credential=String(req.headers["x-session"]||parsed.token||"");
        const actor=repo.vault.digest(credential||`anonymous:${parsed.badge||""}:${req.headers["user-agent"]||""}`);
        const digest=repo.vault.digest(Buffer.concat([Buffer.from(`${req.method}:${req.url}:`),captured.bytes]));
        if(key&&["POST","PATCH","DELETE"].includes(req.method)){
          const existing=await c.client.query("SELECT * FROM dev.requests WHERE actor=$1 AND request_key=$2",[actor,key]);
          if(existing.rowCount){
            const saved=existing.rows[0];let replay,error;
            if(saved.digest!==digest)error="conflict";
            else if(saved.policy!=="encrypted")error="already_committed_reauthenticate";
            else if(saved.expires_at<=new Date())error="retry_expired";
            else if(!credential||!app.__eligible(credential))error="replay_not_authorized";
            else {
              replay=JSON.parse(repo.vault.open(saved.body,`request:${actor}:${key}:${digest}`));
              if(replay.scope!==responseScope(c)){replay=null;error="replay_state_changed";}
            }
            await finish(c,false);
            if(error){original.writeHead(409,{"Content-Type":"application/json","Cache-Control":"no-store"});original.end(JSON.stringify({error}));}
            else {original.writeHead(saved.status,replay.headers);original.end(Buffer.from(replay.response,"base64"));}
            return;
          }
        }
        if(key&&faults) {
          const injected=await c.client.query("SELECT point FROM dev.test_faults WHERE request_key=$1 FOR UPDATE",[key]);
          c.fault=injected.rows[0]?.point;
          if(c.fault)await c.client.query("DELETE FROM dev.test_faults WHERE request_key=$1",[key]);
        }
        res.writeHead=(code,headers)=>{status=code;res.statusCode=code;if(headers&&typeof headers==="object")for(const[k,v]of Object.entries(headers))res.setHeader(k,v);return res;};
        res.write=(chunk,encoding,cb)=>{if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));if(typeof cb==="function")cb();return true;};
        res.end=(chunk,encoding,cb)=>{if(ended)chunks.length=0;if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));ended=true;endedResolve();if(typeof cb==="function")cb();return res;};
        const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("request_transaction_timeout")),25000);});
        operation="HANDLER";
        // The original HTTP callback must return handleApi's Promise; otherwise
        // its early res.end (e.g. forgot password) precedes later awaited writes.
        await Promise.race([(async()=>{if(c.fault==="handler_timeout")await new Promise(()=>{});await listener(req,res);await ending;})(),timeout]);
        clearTimeout(timer);
        const response=Buffer.concat(chunks);
        if(key&&["POST","PATCH","DELETE"].includes(req.method)&&status>=200&&status<300)c.replayRecord={actor,key,digest,status,headers:res.getHeaders(),response};
        operation="PERSIST_COMMIT";await finish(c,status<500);restore();
        if(c.path==="/api/register")console.log(JSON.stringify({
          SQL_RUNTIME:"REGISTER",status:"COMMITTED",httpStatus:status,
          queueMs:Math.round(queueWaitMs),elapsedMs:Math.round(performance.now()-queuedAt)
        }));
        if(c.path==="/api/ideas"&&req.method==="POST")console.log(JSON.stringify({
          SQL_RUNTIME:"POST_CREATE",status:status<500?"COMMITTED":"ROLLED_BACK",
          accepted:status===201,httpStatus:status,operation:"PERSIST_COMMIT",
          requestRef:key?hash(key).slice(0,12):"UNKEYED",
          queueMs:Math.round(queueWaitMs),elapsedMs:Math.round(performance.now()-queuedAt)
        }));
        if(c.fault==="after_commit_drop"){res.destroy();return;}
        // A killed/ambiguous connection here is recoverable with the same key.
        original.writeHead(status);original.end(response);
      }catch(e){
        clearTimeout(timer);
        // Legacy module maps cannot be cancelled safely. Never run a new scope
        // after a timed-out async handler: fail-stop this development worker.
        if(e.message==="request_transaction_timeout")poisoned=true;
        if(!poisoned&&context&&c)await finish(c,false).catch(()=>{});
        restore();
        if(!res.headersSent){for(const k of res.getHeaderNames())res.removeHeader(k);const conflict=e.message==="idempotency_input_mismatch"||e.message==="stale_entity_revision";
          original.writeHead(conflict?409:503,{"Content-Type":"application/json","Cache-Control":"no-store"});original.end(JSON.stringify({error:conflict?"conflict":"database_unavailable"}));}
        console.error(JSON.stringify({SQL_RUNTIME:"HTTP",operation,status:"BLOCKED",category:failureCategory(e),
          ...(req.method==="POST"&&req.url?.split("?")[0]==="/api/ideas"?{
            endpoint:"POST_CREATE",httpStatus:503
          }:{})}));
        if(poisoned)setTimeout(()=>process.exit(1),100).unref();
      }
      finally{clearTimeout(watchdog);clearTimeout(timer);}
    }).finally(()=>{clearTimeout(admissionTimer);pending--;});
  }
  http.createServer=function(...args){
    const listener=args.pop(),server=realCreate.call(http,...args,(req,res)=>handle(listener,req,res).catch(()=>res.destroy()));
    internalServer=server;
    server.once("error",readyReject);
    const listen=server.listen.bind(server);
    server.listen=(...params)=>{
      const callback=typeof params.at(-1)==="function"?params.pop():()=>{};
      return listen(...params,async()=>{
        try{
          stage("LISTEN");
          // Modules have now exported their maps. Restore fresh-install SQL
          // security state before boot's first persist, or restarts erase locks.
          if(freshInstall){stage("BOOT_REFRESH");await refresh();}
          stage("BOOT_CALLBACK");
          await callback();await finish(boot,true);boot=null;
          bootComplete=true;clearTimeout(startupTimer);stage("READY","PASS",undefined,Math.round(performance.now()-startupAt));readyResolve();
        }
        catch(e){readyReject(e);}
      });
    };
    return server;
  };
  stage("LOAD_SERVER");
  try{app=require(path.join(proof.app,"server.js"));}
  finally{http.createServer=realCreate;}
  // Production mail is queued in the request transaction and delivered only by
  // a later committed job. SMTP is at-least-once; unknown acknowledgement can
  // cause a duplicate message, never a fabricated provider-success receipt.
  const deliver=()=>job(async()=>{
    const c=context.client;
    await c.query("UPDATE dev.requests SET body=''::bytea,headers='{}'::jsonb,policy='expired' WHERE expires_at<clock_timestamp() AND policy='encrypted'");
    const rows=(await c.query("SELECT id,topic,payload FROM dev.outbox WHERE topic IN('mail','sms') AND delivered_at IS NULL AND (fixture_receipt IS NULL OR (fixture_receipt->>'retryAfter')::timestamptz<=clock_timestamp()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows;
    for(const row of rows){
      const payload=repo.vault.decode(row.payload,`outbox:${row.id}`);let sent=false;
      console.log(JSON.stringify({SQL_RUNTIME:"MAIL_OUTBOX",operation:"DELIVER",status:"STARTED"}));
      try{
        if(row.topic==="mail")await (deliverMail||realMail)(payload.to,payload.subject,payload.text);
        else await (deliverSms||((p)=>require("./minimal-delivery.cjs").sendSms(p,realHttps)))(payload);
        sent=true;
      }catch{
        console.error(JSON.stringify({SQL_RUNTIME:"MAIL_OUTBOX",operation:"DELIVER",status:"BLOCKED",category:"PROVIDER_REFUSED"}));
      }
      const receipt={transport:row.topic==="mail"?"smtp-outbox-v1":"sms-outbox-v1",event:row.id,...(!sent?{retryAfter:new Date(Date.now()+60000).toISOString()}:{}),semantics:"provider-accepted-at-least-once"};
      await c.query("UPDATE dev.outbox SET attempts=attempts+1,delivered_at=CASE WHEN $2 THEN clock_timestamp() ELSE NULL END,fixture_receipt=$3::jsonb WHERE id=$1",[row.id,sent,JSON.stringify(receipt)]);
      if(sent)console.log(JSON.stringify({SQL_RUNTIME:"MAIL_OUTBOX",operation:"DELIVER",status:"PROVIDER_ACCEPTED"}));
    }
  },"minimal-mail-outbox");
  let outboxQueued=false,outboxRetryAt=0;
  outboxTimer=setInterval(()=>{
    if(!bootComplete||poisoned||stopping||outboxQueued||Date.now()<outboxRetryAt)return;
    outboxQueued=true;
    (minimalRelease?deliver():repo.drainFixtureOutbox())
      .then(result=>{if(result?.committed===false)outboxRetryAt=Date.now()+60000;})
      .catch(()=>{outboxRetryAt=Date.now()+60000;})
      .finally(()=>{outboxQueued=false;});
  },1000);outboxTimer.unref();
  await ready;
  return {repo,proof,server:app.__server,close:async()=>{stopping=true;clearInterval(outboxTimer);for(const timer of jobTimers)clearInterval(timer);await new Promise(r=>app.__server.close(r));await queue;await repo.pool.end();virtual.restore();https.request=realHttps;}};
  } catch(error) {
    clearTimeout(startupTimer);poisoned=true;stopping=true;
    stage(startupStage,"BLOCKED",error);
    clearInterval(outboxTimer);for(const timer of jobTimers)clearInterval(timer);
    http.createServer=realCreate;if(realHttps)https.request=realHttps;
    internalServer?.closeAllConnections();internalServer?.close();
    // Destroy the boot connection: the server rolls back uncommitted work.
    // Do not persist an unsuccessful boot or reuse its mutable context.
    if(boot&&context===boot){boot.client.release(error);context=null;boot=null;}
    virtual?.restore();
    throw error;
  }
}
if(require.main===module)start(process.argv[2]).catch(e=>{console.error("Synthetic PostgreSQL application refused:",e.code||e.message);process.exit(1);});
module.exports={start,serve};
