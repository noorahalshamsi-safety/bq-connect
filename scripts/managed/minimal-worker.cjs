// Invented-data test child. Never used by the production command.
const fs=require("node:fs"),path=require("node:path"),{Repository}=require("../../development/postgres/repository.cjs");
const proof=require("../../development/postgres/isolation.cjs").verify(process.argv[2]),repo=new Repository(proof);
require("../../development/postgres/runtime.cjs").serve(proof,repo,{minimalRelease:true,deliverMail:async(to,subject,text)=>{
  const r=await repo.pool.query("SELECT count(*)::int AS n FROM dev.outbox WHERE topic='mail' AND delivered_at IS NULL");
  if(!r.rows[0].n)throw Error("test_delivery_before_commit");
  if(fs.existsSync(path.join(proof.root,"fail-mail")))throw Error("invented_mail_provider_outage");
  fs.appendFileSync(path.join(proof.root,"invented-mail.jsonl"),JSON.stringify({to,subject,text})+"\n",{mode:0o600});
},deliverSms:async payload=>{
  const r=await repo.pool.query("SELECT count(*)::int AS n FROM dev.outbox WHERE topic='sms' AND delivered_at IS NULL");
  if(!r.rows[0].n)throw Error("test_sms_before_commit");
  fs.appendFileSync(path.join(proof.root,"invented-sms.jsonl"),JSON.stringify(payload)+"\n",{mode:0o600});
}}).then(app=>{for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>app.close().finally(()=>process.exit(0)));})
.catch(()=>{console.error("minimal invented worker startup failed");process.exit(1);});
