const path = require("node:path"), { base, load, need, sha, canonical } = require("./config.cjs");
async function execute({ env = process.env, manifest = load(env) } = {}) {
  need(env.BQ_FRESH_INIT_APPROVAL === "initialize:" + sha(canonical(manifest)), "fresh_initialization_approval_required");
  const cfg = require(path.join(base, "deploy/managed/config.cjs"));
  const proof = cfg.verifyFresh({ env, manifest });
  const { Pool } = require("pg"), { Client } = await import("@replit/object-storage");
  const { ImmutableStore } = require(path.join(base, "deploy/staging/object-store.cjs"));
  const I = require("./installation.cjs"), S = require("./directory.cjs");
  const source = { downloadAsText: name => {
    need(name === "data/employees.json"); return sourceClient.downloadAsText(name);
  } };
  const sourceClient = new Client({ bucketId: manifest.sourceBucket });
  const store = new ImmutableStore(new Client({ bucketId: manifest.bucket }), { dataset: proof.dataset, managedProof: proof });
  const pool = new Pool(cfg.poolOptions(proof)); pool.on("error", () => {});
  let c;
  try {
    c = await pool.connect(); await I.database(c, proof, manifest);
    const directory = await S.read(source);
    return await I.initialize({ c, proof, manifest, source: directory, store, verifySourceUnchanged: async () => {
      need((await S.read(source)).sha256 === directory.sha256, "fresh_directory_changed_before_commit");
    } });
  } finally { c?.release(); await pool.end(); }
}
module.exports = { execute };
if (require.main === module) {
  require("../../release-preparation/production-bindings/maintenance-http.cjs").start().then(async app => {
    for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => app.close().finally(() => process.exit(0)));
    try { const r = await execute(); console.log(JSON.stringify({ FRESH_INSTALL: "PASS", ...r, mode: "maintenance" })); }
    catch (err) {
      const allowed = new Set([
        "fresh_initialization_approval_required",
        "fresh_configuration_required",
        "fresh_owner_binding_required",
        "fresh_production_secrets_required",
        "fresh_production_database_required",
        "fresh_tls_required",
        "fresh_destination_binding_mismatch",
        "fresh_bucket_binding_mismatch",
        "fresh_reviewed_contract_required",
        "fresh_schema_permission_review_required",
        "fresh_registration_policy_required"
      ]);
      const code = allowed.has(err?.code) ? err.code : "OTHER_BLOCKER";
      console.log(JSON.stringify({
        FRESH_INSTALL: "BLOCKED",
        reason: code,
        mode: "maintenance"
      }));
    }
  }).catch(() => { console.error('{"FRESH_INSTALL":"BLOCKED"}'); process.exitCode = 1; });
}
