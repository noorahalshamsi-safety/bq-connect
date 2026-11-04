// Run command for a separate staging deployment; never `node start.js`.
// The gate must pass first. The hosted runtime (repository on the staging
// database as bq_app, bucket-held provision receipt, media through
// object-store.cjs) is not integrated yet, so even an approved binding refuses.
const gate=require("./gate.cjs");
try{
  const proof=gate.verify({operation:"staging-activate"});
  console.error(`staging gate passed for ${proof.dataset} (approval ${proof.approval})`);
  throw Error("staging_runtime_not_integrated");
}catch(e){
  console.error(`staging activation refused: ${e.message}`);
  process.exit(1);
}
