// Operator tool for the staging Repl shell. Staging never sends real mail or SMS:
// messages stay in the encrypted outbox, and this prints the one-time codes from
// the last few minutes (invented accounts only). Message bodies are not printed.
const {Client}=require("pg");
const gate=require("./gate.cjs"),{vault}=require("../../development/postgres/sealed.cjs");
async function latest({env=process.env,root,minutes=5}={}) {
  const proof=gate.verify({operation:"staging-activate",env,root});
  const {ssl,...database}=proof.database;
  const c=new Client({...database,ssl:{...ssl},user:"bq_app",password:env.BQ_STAGING_APP_PASSWORD,connectionTimeoutMillis:5000,application_name:"bq-staging-outbox"});
  await c.connect();
  try{
    const rows=(await c.query("SELECT id,topic,created_at,payload FROM dev.outbox WHERE topic IN('mail','sms') AND created_at>clock_timestamp()-make_interval(mins=>$1) ORDER BY created_at DESC LIMIT 20",[minutes])).rows;
    const sealed=vault(proof);
    return rows.filter(r=>r.payload?.sealed).map(r=>{
      const p=sealed.decode(r.payload,`outbox:${r.id}`),text=r.topic==="mail"?p.text:(new URLSearchParams(p.body).get("Body")||p.body);
      return {at:r.created_at.toISOString(),topic:r.topic,to:r.topic==="mail"?p.to:"sms",code:String(text).match(/\b\d{6}\b/)?.[0]||null};
    });
  }finally{await c.end().catch(()=>{});}
}
module.exports={latest};
if(require.main===module)latest()
  .then(rows=>{for(const r of rows)console.log(`${r.at} ${r.topic} ${r.to} code ${r.code||"-"}`);})
  .catch(e=>{console.error(`staging outbox refused: ${e.code||e.message}`);process.exit(1);});
