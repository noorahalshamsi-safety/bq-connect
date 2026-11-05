const path = require("node:path"), { base, need, canonical, sha } = require("./config.cjs");
const cfg = require(path.join(base, "deploy/managed/config.cjs"));
const schema = require(path.join(base, "deploy/managed/schema.cjs"));
const { saveFile } = require(path.join(base, "development/postgres/repository.cjs"));
const { vault } = require(path.join(base, "development/postgres/sealed.cjs"));
const codec = require(path.join(base, "development/postgres/codec.cjs"));
const lock = 1793874566, markerName = "fresh-install:v1";
function authority(proof) {
  if (proof.verifiedSynthetic && !process.env.REPLIT_DEPLOYMENT) {
    const p = require(path.join(base, "development/postgres/isolation.cjs")).verify(proof.root);
    need(p.dataset === proof.dataset && p.seal === proof.seal, "fresh_test_isolation_required");
  } else { cfg.assertProof(proof); need(proof.freshInstall && proof.profile === "production"); }
}
function files(rows, manifest) {
  const values = Object.fromEntries(Object.entries(codec.specs).map(([name, s]) => [name, s.kind === "array" ? [] : {}]));
  values["employees.json"] = rows; values["accounts.json"] = {};
  values["security.json"] = { admins: [], adminAccount: {}, announcer: {}, emailDomains: manifest.emailDomains };
  values["moderators.json"] = { badges: [] }; values["conduct.json"] = { warnings: [], bans: {}, resets: {} };
  values["backup.json"] = { enabled: false };
  return values;
}
async function marker(c, proof) {
  const r = await c.query("SELECT value FROM dev.runtime_state WHERE name=$1", [markerName]);
  return r.rowCount ? vault(proof).decode(r.rows[0].value, `state:${markerName}`) : null;
}
async function reconcile(c, proof, manifest, receipt) {
  authority(proof);
  const m = await marker(c, proof);
  need(m && m.kind === "BQ_FRESH_INSTALL_V1" && m.dataset === proof.dataset &&
    m.seal === proof.seal && m.manifest === sha(canonical(manifest)) &&
    m.source === manifest.directorySha256 && m.employees === manifest.employees &&
    m.initialAccounts === 0, "fresh_sql_installation_marker_required");
  need(receipt?.kind === "BQ_FRESH_RECEIPT_V1" && receipt.state === "committed" &&
    receipt.dataset === proof.dataset && receipt.seal === proof.seal &&
    receipt.binding === m.manifest && receipt.source === m.source, "fresh_independent_receipt_required");
  const counts = (await c.query("SELECT count(*)::int AS n, count(DISTINCT attrs->>'badge')::int AS distinct_badges FROM dev.employees")).rows[0];
  need(counts.n === manifest.employees && counts.distinct_badges === manifest.employees, "fresh_directory_reconciliation_failed");
  const records = (await c.query("SELECT attrs FROM dev.employees ORDER BY ordinal")).rows.map(r => r.attrs);
  need(m.recordsHash === sha(canonical(records)) && receipt.recordsHash === m.recordsHash,
    "fresh_directory_attributes_changed");
  const a = (await c.query("SELECT * FROM dev.authority WHERE singleton FOR SHARE")).rows[0];
  need(a?.dataset_id === proof.dataset && a.seal === proof.seal && String(a.epoch) === "1" &&
    a.mode === (proof.verifiedSynthetic ? "synthetic" : "production"), "fresh_database_authority_mismatch");
  return m;
}
async function initialize({ c, proof, manifest, source, store, verifySourceUnchanged }) {
  authority(proof);
  if (proof.verifiedSynthetic) need((await c.query("SELECT current_database() AS n")).rows[0].n === "bq_synthetic_development");
  need(source.rows.length === manifest.employees && source.sha256 === manifest.directorySha256,
    "fresh_directory_binding_mismatch");
  const binding = sha(canonical(manifest));
  await c.query("SELECT pg_advisory_lock($1)", [lock]);
  try {
    const old = await marker(c, proof), receipt = await store.readControl("provision-receipt.json");
    const intent = await store.readControl("provision-intent.json");
    if (old) {
      need(intent?.kind === "BQ_FRESH_INTENT_V1" && intent.binding === binding &&
        intent.dataset === proof.dataset && intent.seal === proof.seal, "fresh_intent_required");
      await reconcile(c, proof, manifest, receipt);
      return { employees: manifest.employees, initialAccounts: 0, replayed: true };
    }
    need(!intent && !receipt, "fresh_partial_installation_requires_forward_recovery");
    const tables = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='dev' ORDER BY tablename")).rows;
    need(tables.length === 117 && tables.every(t => /^[a-z_][a-z0-9_]*$/.test(t.tablename)), "fresh_schema_table_count_changed");
    for (const { tablename } of tables)
      need(!(await c.query(`SELECT EXISTS(SELECT 1 FROM dev.${tablename}) AS occupied`)).rows[0].occupied, "fresh_populated_destination_refused");
    need(source.rows.some(r => String(r.badge) === manifest.initialAdminBadge), "fresh_approved_admin_not_in_directory");
    await store.createControl("provision-intent.json", { kind: "BQ_FRESH_INTENT_V1",
      dataset: proof.dataset, seal: proof.seal, binding });
    await c.query("BEGIN");
    try {
      await c.query("INSERT INTO dev.authority VALUES(true,$1,$2,1,$3)",
        [proof.dataset, proof.seal, proof.verifiedSynthetic ? "synthetic" : "production"]);
      for (const [name, value] of Object.entries(files(source.rows, manifest))) await saveFile(c, name, value, null);
      const rows = (await c.query("SELECT attrs FROM dev.employees ORDER BY ordinal")).rows.map(r => r.attrs);
      need(canonical(rows) === canonical(source.rows) &&
        (await c.query("SELECT count(*)::int AS n FROM dev.accounts")).rows[0].n === 0, "fresh_employee_projection_changed");
      await verifySourceUnchanged();
      const value = { kind: "BQ_FRESH_INSTALL_V1", dataset: proof.dataset, seal: proof.seal,
        manifest: binding, source: source.sha256, recordsHash: sha(canonical(source.rows)),
        employees: manifest.employees, initialAccounts: 0 };
      await c.query("INSERT INTO dev.runtime_state(name,value) VALUES($1,$2::jsonb)",
        [markerName, JSON.stringify(vault(proof).json(value, `state:${markerName}`))]);
      await c.query("COMMIT");
    } catch (error) { await c.query("ROLLBACK").catch(() => {}); throw error; }
    await store.createControl("provision-receipt.json", { kind: "BQ_FRESH_RECEIPT_V1",
      dataset: proof.dataset, seal: proof.seal, binding, source: source.sha256,
      recordsHash: sha(canonical(source.rows)), state: "committed" });
    await reconcile(c, proof, manifest, await store.readControl("provision-receipt.json"));
    return { employees: manifest.employees, initialAccounts: 0, replayed: false };
  } finally { await c.query("SELECT pg_advisory_unlock($1)", [lock]).catch(() => {}); }
}
async function database(c, proof, manifest) {
  cfg.assertProof(proof); need(proof.freshInstall);
  need((await c.query("SELECT current_database() AS n")).rows[0].n === "neondb", "fresh_production_database_required");
  await cfg.verifyDatabase(c, proof);
  need((await schema.requireSchema(c, manifest)).tables === 117, "fresh_schema_table_count_changed");
}
module.exports = { files, initialize, reconcile, database, authority, lock };
