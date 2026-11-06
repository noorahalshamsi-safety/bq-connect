// Test-only child. No Production secrets/environment or App Storage capability.
const fs = require("node:fs"), path = require("node:path");
if (process.env.REPLIT_DEPLOYMENT || !process.send) throw Error("isolated_fixture_process_required");
const { base } = require("../../deploy/fresh/config.cjs");
const proof = require(path.join(base, "development/postgres/isolation.cjs")).verify(process.argv[2]);
const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
const repo = new Repository(proof);
const fault=process.env.BQ_TEST_STARTUP_FAULT;
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
const serve=()=>require(path.join(base, "development/postgres/runtime.cjs")).serve(proof, repo, {
  minimalRelease: true, freshInstall: true,
  startupTimeoutMs:fault==="timeout"?1500:120000,
  freshEmailDomains: ["binquraya.com"],
  freshAdminPolicy: JSON.parse(process.env.BQ_TEST_ADMIN_POLICY || "{}"),
  freshProviders: configured ? {
    "smtp.json": { host: "synthetic.invalid", port: 465, user: "synthetic@example.invalid",
      pass: "SYNTHETIC-ONLY", fromName: "Synthetic BQ" },
    "sms.json": { provider: "twilio", sid: "synthetic", token: "SYNTHETIC-ONLY", from: "+15550000000" }
  } : {},
  deliverMail: async (to, subject, text) => { process.send({ kind: "mail", to, text }); },
  deliverSms: async payload => { process.send({ kind: "sms", body: payload.body }); }
});
// Exercise the same public gateway -> private runtime activation chain.
require(path.join(base,"deploy/managed/minimal-bootstrap.cjs")).launch({
  port:Number(process.env.PORT),retryMs:60000,
  startRuntime:serve
}).then(app => {
  process.send({kind:"gateway",port:app.server.address().port});
  const poll=setInterval(async()=>{
    try{
      const r=await fetch(`http://127.0.0.1:${app.server.address().port}/health/ready`,{signal:AbortSignal.timeout(1000)});
      if(r.status!==200)return;
      clearInterval(poll);
  process.send({ kind: "ready", port: app.server.address().port });
    }catch{}
  },50);
  poll.unref();
  process.on("SIGTERM", () => app.close().finally(() => process.exit(0)));
}).catch(() => { process.send({ kind: "blocked" }); process.exit(1); });
