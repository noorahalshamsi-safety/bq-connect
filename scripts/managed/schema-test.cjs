// Non-destructive catalog probes on the existing invented managed-development
// dataset. Every temporary schema/policy change is rolled back, never published.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{Client}=require("pg");
const cfg=require("../../deploy/managed/config.cjs"),schema=require("../../deploy/managed/schema.cjs");
const root=path.resolve(__dirname,"../../generated-artifacts/managed-development");
const results=[];
async function probe(name,fn){try{await client.query("BEGIN");await client.query("SET LOCAL lock_timeout='2s'");await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",code:e.code||e.message});}finally{await client.query("ROLLBACK");}}
let client;
(async()=>{
  if(process.env.REPLIT_DEPLOYMENT==="1")cfg.fail("managed_development_only");
  const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8")),keys=JSON.parse(fs.readFileSync(path.join(root,"keys.json"),"utf8"));
  const env={...process.env,BQ_MANAGED_SESSION_KEY:keys.sessionKey,BQ_MANAGED_BACKUP_KEY:keys.backupKey};
  const proof=cfg.verify({env,manifest});
  client=new Client(cfg.poolOptions(proof));await client.connect();
  try{
    await probe("Unreviewed RLS is a release blocker",async()=>{await client.query("ALTER TABLE dev.authority ENABLE ROW LEVEL SECURITY");await assert.rejects(schema.requireSchema(client,manifest),/managed_unreviewed_schema_policy/);});
    await probe("Unreviewed view is a release blocker",async()=>{await client.query("CREATE VIEW dev.managed_review_probe AS SELECT 1 AS n");await assert.rejects(schema.requireSchema(client,manifest),/managed_unreviewed_schema_policy/);});
    await probe("Unexpected schema column is a release blocker",async()=>{await client.query("ALTER TABLE dev.authority ADD COLUMN managed_review_probe text");await assert.rejects(schema.requireSchema(client,manifest),/managed_schema_contract_mismatch/);});
    await probe("Permission fingerprint mismatch refuses managed connection",async()=>{const wrong=cfg.verify({env,manifest:{...manifest,permissionsFingerprint:"f".repeat(64)}});await assert.rejects(cfg.verifyDatabase(client,wrong),/managed_permissions_changed/);});
    await schema.requireSchema(client,manifest);
  }finally{await client.end();}
  console.log(JSON.stringify({suite:"actual-managed-schema-probes",pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,results}));
  if(results.some(r=>r.status!=="PASS"))process.exitCode=1;
})().catch(e=>{console.error(JSON.stringify({failed:e.code||"managed_schema_probe_failed"}));process.exitCode=1;});
