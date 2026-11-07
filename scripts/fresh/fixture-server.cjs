// Test-only child. No Production secrets/environment or App Storage capability.
const fs = require("node:fs"), path = require("node:path");
if (process.env.REPLIT_DEPLOYMENT || !process.send) throw Error("isolated_fixture_process_required");
const { base } = require("../../deploy/fresh/config.cjs");
const proof = require(path.join(base, "development/postgres/isolation.cjs")).verify(process.argv[2]);
const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
const repo = new Repository(proof);
// Real TLS SMTP, bound to loopback with an ephemeral test CA trusted only by
// this child. Exercise the unchanged auth.sendMail implementation end-to-end.
const tls=require("node:tls");
const smtp=tls.createServer({
  key:fs.readFileSync(path.join(proof.root,"smtp-test.key")),
  cert:fs.readFileSync(path.join(proof.root,"smtp-test.crt"))
},socket=>{
  let buffer="",step=0,data=false,recipient="";
  socket.on("error",()=>{});
  socket.write("220 synthetic SMTP ready\r\n");
  socket.on("data",chunk=>{
    buffer+=chunk.toString();
    if(data){
      const end=buffer.indexOf("\r\n.\r\n");if(end<0)return;
      const message=buffer.slice(0,end),split=message.indexOf("\r\n\r\n");
      process.send({kind:"mail",to:recipient,text:Buffer.from(message.slice(split+4).replace(/\s/g,""),"base64").toString()});
      buffer=buffer.slice(end+5);data=false;socket.write("250 accepted\r\n");
    }
    while(buffer.includes("\r\n")){
      const end=buffer.indexOf("\r\n"),line=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(line==="QUIT"){socket.end("221 bye\r\n");return;}
      const expected=["EHLO bq-connect","AUTH LOGIN",
        Buffer.from("synthetic@example.invalid").toString("base64"),
        Buffer.from("SYNTHETIC-ONLY").toString("base64")];
      if(step<4){
        if(line!==expected[step]){socket.end("535 rejected\r\n");return;}
        step++;
        if(step===4&&mailFailures){mailFailures--;process.send({kind:"mail-failed"});socket.end("535 rejected\r\n");return;}
        socket.write(["","250 hello","334 username","334 password","235 authenticated"][step]+"\r\n");
      }else if(line==="MAIL FROM:<synthetic@example.invalid>")socket.write("250 sender\r\n");
      else if(/^RCPT TO:</.test(line)){recipient=line.slice(9,-1);socket.write("250 recipient\r\n");}
      else if(line==="DATA"){data=true;socket.write("354 message\r\n");break;}
      else{socket.end("500 refused\r\n");return;}
    }
  });
});
const smtpReady=new Promise(resolve=>smtp.listen(0,"127.0.0.1",resolve));
// IPC is available only in this explicitly isolated synthetic child.
let nextBeginFault="",mailFailures=0;
process.on("message",message=>{
  if(message.kind!=="runtime-fault")return;
  nextBeginFault=message.begin||"";mailFailures=message.mailFailures||0;
  process.send({kind:"fault-armed"});
});
const begin=repo.begin.bind(repo);
repo.begin=async(...args)=>{
  const fault=nextBeginFault;nextBeginFault="";
  if(fault){
    process.send({kind:"fault-active"});
    if(fault==="hang")await new Promise(()=>{});
  }
  const t=await begin(...args);
  if(fault==="sql"){
    try{
      await t.client.query("SET LOCAL statement_timeout=50");
      await t.client.query("SELECT pg_sleep(1)");
    }catch(error){t.client.release(error);throw error;}
  }
  return t;
};
if(process.env.BQ_TEST_LOAD_MODE){
  const load=process.env.BQ_TEST_LOAD_MODE==="serial"
    ?require("./hydrate-reference.cjs").referenceLoad:repo.load.bind(repo);
  repo.load=(client,...args)=>load({query:async(...query)=>{
    await new Promise(r=>setTimeout(r,20));
    return client.query(...query);
  }},...args);
}
const fault=process.env.BQ_TEST_STARTUP_FAULT;
if(fault==="lock")repo.pool.on("connect",client=>{
  const query=client.query.bind(client);
  client.query=(sql,...args)=>{
    if(sql?.text==="SELECT pg_advisory_xact_lock(1793705963)")
      sql={...sql,query_timeout:1000};
    return query(sql,...args);
  };
});
if(fault) {
  const originalBegin=repo.begin.bind(repo);
  let first=true;
  repo.begin=async(...args)=>{
    const t=await originalBegin(...args);
    if(first){
      first=false;
      const query=t.client.query.bind(t.client);
      t.client.query=async(sql,...values)=>{
        const text=typeof sql==="string"?sql:sql.text;
        const hit=(fault==="refresh"&&text==="SELECT * FROM dev.runtime_state")||
          (["persist","timeout"].includes(fault)&&text.startsWith("INSERT INTO dev.runtime_state"))||
          (fault==="commit"&&text==="COMMIT");
        if(hit){
          if(fault==="timeout")return new Promise(()=>{});
          throw Error("SYNTHETIC_PRIVATE_VALUE_MUST_NOT_APPEAR");
        }
        return query(sql,...values);
      };
    }
    return t;
  };
}
if(fault==="syntax"){
  const write=fs.writeFileSync;
  fs.writeFileSync=function(file,data,...args){
    if(file===path.join(proof.app,"server.js"))data+="\nconst = private_synthetic_value;\n";
    return write.call(fs,file,data,...args);
  };
}
const configured = process.argv[3] !== "providers-off";
const serve=async()=>{await smtpReady;return require(path.join(base, "development/postgres/runtime.cjs")).serve(proof, repo, {
  minimalRelease: true, freshInstall: true,
  faults:true,
  startupTimeoutMs:fault==="timeout"?1500:120000,
  freshEmailDomains: ["binquraya.com"],
  freshAdminPolicy: JSON.parse(process.env.BQ_TEST_ADMIN_POLICY || "{}"),
  freshProviders: configured ? {
    "smtp.json": { host: "localhost", port: smtp.address().port, user: "synthetic@example.invalid",
      pass: "SYNTHETIC-ONLY", fromName: "Synthetic BQ" },
    "sms.json": { provider: "twilio", sid: "synthetic", token: "SYNTHETIC-ONLY", from: "+15550000000" }
  } : {},
  deliverSms: async payload => { process.send({ kind: "sms", body: payload.body }); }
});};
// Exercise the same public gateway -> private runtime activation chain.
require(path.join(base,"deploy/managed/minimal-bootstrap.cjs")).launch({
  port:Number(process.env.PORT),retryMs:60000,
  startRuntime:serve
}).then(app => {
  process.send({kind:"gateway",port:app.server.address().port});
  let probing=false;
  const poll=setInterval(async()=>{
    if(probing)return;
    probing=true;
    try{
      const r=await fetch(`http://127.0.0.1:${app.server.address().port}/health/ready`,{signal:AbortSignal.timeout(10000)});
      if(r.status!==200)return;
      clearInterval(poll);
  process.send({ kind: "ready", port: app.server.address().port });
    }catch{}finally{probing=false;}
  },50);
  poll.unref();
  process.on("SIGTERM", () => {smtp.close();app.close().finally(() => process.exit(0));});
}).catch(() => { process.send({ kind: "blocked" }); process.exit(1); });
