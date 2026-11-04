// One-time provisioning of the invented staging dataset, run by an operator as
// bq_migrator (acting as bq_owner) under an approved `staging-seed` operation.
// Refuses when the bucket or the database already shows provisioning, so a lost
// or emptied database is never silently re-seeded. The runtime never seeds.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {Client}=require("pg");
const gate=require("./gate.cjs"),{fromProof}=require("./object-store.cjs"),{requireCurrent}=require("./migrate.cjs");
const {saveFile}=require("../../development/postgres/repository.cjs");
const {create}=require("../../development/postgres/fixtures.cjs");
const workspace=path.resolve(__dirname,"../..");
const CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const random=n=>Array.from({length:n},()=>CHARS[crypto.randomInt(CHARS.length)]).join("");
function base32(hex){
  const bits=[...Buffer.from(hex,"hex")].map(b=>b.toString(2).padStart(8,"0")).join("");
  return (bits.match(/.{1,5}/g)||[]).map(c=>"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[parseInt(c.padEnd(5,"0"),2)]).join("");
}
async function connect(proof,password){
  const {ssl,...database}=proof.database;
  const client=new Client({...database,ssl:{...ssl},user:"bq_migrator",password,connectionTimeoutMillis:5000,application_name:"bq-staging-seed"});
  await client.connect();
  return client;
}
async function authority(client){
  return (await client.query("SELECT dataset_id,seal FROM dev.authority")).rows[0]||null;
}
// Recovery for a seed whose database commit succeeded but whose receipt upload
// did not: writes the receipt only when the committed authority matches.
async function finishReceipt({proof,store,password}){
  if(!await store.readControl("provision-intent.json"))throw Error("staging_provision_intent_missing");
  if(await store.readControl("provision-receipt.json"))throw Error("staging_previously_provisioned");
  const client=await connect(proof,password);
  try{
    const row=await authority(client);
    if(!row||row.dataset_id!==proof.dataset||row.seal!==proof.seal)throw Error("staging_authority_not_committed");
  }finally{await client.end().catch(()=>{});}
  await store.createControl("provision-receipt.json",{dataset:proof.dataset,seal:proof.seal,state:"committed",at:new Date().toISOString()});
  return {dataset:proof.dataset,receipt:"written"};
}
async function seed({proof,store,password,out}){
  if(!proof?.verifiedStaging||proof.operation!=="staging-seed")throw Error("staging_identity_required");
  if(!password)throw Error("migrator_credential_missing");
  if(await store.readControl("provision-intent.json")||await store.readControl("provision-receipt.json"))throw Error("staging_previously_provisioned");
  const client=await connect(proof,password);
  let fixture;
  try{
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE bq_owner");
    await client.query("SELECT pg_advisory_xact_lock(1793705963)");
    await requireCurrent(client);
    if(await authority(client))throw Error("staging_authority_exists");
    if((await client.query("SELECT 1 FROM dev.files LIMIT 1")).rowCount)throw Error("staging_dataset_not_empty");
    fixture=create(proof.sessionKey,{password:`Stg-${random(16)}-${crypto.randomBytes(4).toString("hex")}`,recovery:random(10)});
    // Written before COMMIT: losing these after a commit would strand the accounts.
    fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});
    const c=fixture.credentials;
    fs.writeFileSync(out,JSON.stringify({dataset:proof.dataset,note:"Invented staging accounts only",password:c.password,recovery:c.recovery,
      registrationCheck:c.check,registrationMobile:c.mobile,
      totp:Object.fromEntries(Object.entries(c.totpKeys).map(([badge,hex])=>[badge,{hex,base32:base32(hex)}]))},null,2),{mode:0o600,flag:"wx"});
    await store.createControl("provision-intent.json",{dataset:proof.dataset,seal:proof.seal,at:new Date().toISOString()});
    for(const [file,value] of Object.entries(fixture.files))await saveFile(client,file,value,null);
    await client.query("INSERT INTO dev.authority VALUES(true,$1,$2,1,'synthetic')",[proof.dataset,proof.seal]);
    await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}
  finally{await client.end().catch(()=>{});}
  await store.createControl("provision-receipt.json",{dataset:proof.dataset,seal:proof.seal,state:"committed",at:new Date().toISOString()});
  return {dataset:proof.dataset,accounts:Object.keys(fixture.files["accounts.json"]).length,credentialsFile:out};
}
module.exports={seed,finishReceipt,base32};

if(require.main===module)(async()=>{
  const proof=gate.verify({operation:"staging-seed"});
  const options={proof,store:fromProof(proof),password:process.env.BQ_STAGING_MIGRATOR_PASSWORD,
    out:path.join(workspace,"generated-artifacts","staging","seed-credentials.json")};
  console.log(JSON.stringify(process.argv.includes("--finish-receipt")?await finishReceipt(options):await seed(options)));
})().catch(e=>{console.error(`staging seed refused: ${e.message}`);process.exit(1);});
