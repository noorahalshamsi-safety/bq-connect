const path = require("node:path"), { base, need, load, sha, canonical } = require("./config.cjs");
const I = require("./installation.cjs");
const { saveFile } = require(path.join(base, "development/postgres/repository.cjs"));
const { vault } = require(path.join(base, "development/postgres/sealed.cjs"));
const tombstone = "fresh-admin-bootstrap:v1";
async function bootstrap({ c, proof, manifest, approval }) {
  I.authority(proof);
  need(approval === "bootstrap:" + sha(canonical([sha(canonical(manifest)), manifest.initialAdminBadge])),
    "fresh_operator_bootstrap_approval_required");
  await c.query("BEGIN");
  try {
    await c.query("SELECT pg_advisory_xact_lock($1)", [I.lock]);
    need(!(await c.query("SELECT 1 FROM dev.runtime_state WHERE name=$1", [tombstone])).rowCount,
      "fresh_admin_bootstrap_consumed");
    // Existing codec is reused, including encrypted TOTP state and password KDF.
    const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
    const files = await Repository.prototype.load.call({}, c, ["accounts.json", "security.json"]);
    const account = files.get("accounts.json")?.value?.[manifest.initialAdminBadge];
    need(account?.hash && account.totp?.on === true && typeof account.email === "string" &&
      account.email.length > 3, "fresh_admin_must_register_verify_email_and_mfa");
    const security = files.get("security.json");
    need(security && Array.isArray(security.value.admins) && security.value.admins.length === 0,
      "fresh_existing_administrator_refused");
    await saveFile(c, "security.json", { ...security.value, admins: [manifest.initialAdminBadge] }, security.revision);
    await c.query("INSERT INTO dev.runtime_state(name,value) VALUES($1,$2::jsonb)", [tombstone,
      JSON.stringify(vault(proof).json({ badge: manifest.initialAdminBadge, used: true }, `state:${tombstone}`))]);
    await c.query("COMMIT");
  } catch (error) { await c.query("ROLLBACK").catch(() => {}); throw error; }
}
async function execute({ env = process.env, manifest = load(env) } = {}) {
  const cfg = require(path.join(base, "deploy/managed/config.cjs"));
  const proof = cfg.verifyFresh({ env, manifest });
  const { Pool } = require("pg"), { Client } = await import("@replit/object-storage");
  const { ImmutableStore } = require(path.join(base, "deploy/staging/object-store.cjs"));
  const store = new ImmutableStore(new Client({ bucketId: manifest.bucket }), { dataset: proof.dataset, managedProof: proof });
  const receipt = await store.readControl("provision-receipt.json");
  const pool = new Pool(cfg.poolOptions(proof)); pool.on("error", () => {});
  let c;
  try {
    c = await pool.connect(); await I.database(c, proof, manifest); await I.reconcile(c, proof, manifest, receipt);
    await bootstrap({ c, proof, manifest, approval: env.BQ_FRESH_ADMIN_APPROVAL });
  } finally { c?.release(); await pool.end(); }
}
module.exports = { execute, bootstrap };
if (require.main === module) require("../../release-preparation/production-bindings/maintenance-http.cjs").start().then(async app => {
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => app.close().finally(() => process.exit(0)));
  try { await execute(); console.log('{"ADMIN_BOOTSTRAP":"PASS","mode":"maintenance"}'); }
  catch { console.log('{"ADMIN_BOOTSTRAP":"BLOCKED","mode":"maintenance"}'); }
}).catch(() => { console.error('{"ADMIN_BOOTSTRAP":"BLOCKED"}'); process.exitCode = 1; });
