// Adoption-only SQL runtime. No importer or provisioning fallback.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const base = path.resolve(__dirname, "../maintenance-cd5bd76/source");
const cfg = require(path.join(base, "deploy/managed/config.cjs"));
const schema = require(path.join(base, "deploy/managed/schema.cjs"));
const I = require(path.join(base, "migration/minimal/import.cjs"));
const reconciliation = require("./reconciliation.cjs");
async function start({ env, manifest, approvalRoot }) {
  if (env.REPLIT_DEPLOYMENT !== "1" || manifest.environment !== "production" ||
      manifest.minimal?.policy !== "employees-accounts-only-v1" ||
      manifest.minimal.employees !== 6311 || manifest.minimal.accounts !== 8 ||
      cfg.sha(manifest.bucket) === manifest.minimal.sourceBucketFingerprint)
    cfg.fail("minimal_runtime_policy_required");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bq-minimal-"));
  fs.chmodSync(root, 0o700);
  const app = path.join(root, "app"), objects = path.join(root, "objects");
  fs.mkdirSync(app, { mode: 0o700 }); fs.mkdirSync(objects, { mode: 0o700 });
  let repo;
  try {
    const proof = cfg.verify({ env, manifest, approvalRoot, paths: { root, app, objects } });
    const { Client } = await import("@replit/object-storage");
    const { ImmutableStore } = require(path.join(base, "deploy/staging/object-store.cjs"));
    const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
    const store = new ImmutableStore(new Client({ bucketId: manifest.bucket }),
      { dataset: proof.dataset, managedProof: proof });
    const receipt = await store.readControl("provision-receipt.json");
    const intent = await store.readControl("provision-intent.json");
    reconciliation.receipt({ proof, manifest, intent, receipt });
    repo = new Repository(proof, null, { proof, store, receipt });
    const c = await repo.pool.connect(); let media;
    try {
      await c.query("BEGIN");
      await cfg.verifyDatabase(c, proof); await schema.requireSchema(c, manifest); await repo.verify(c);
      const marker = await I.readMarker(c, proof);
      reconciliation.marker({ proof, manifest, marker });
      media = (await c.query("SELECT id,object_key,sha256 FROM dev.media WHERE state IN('ready','retained')")).rows;
      await c.query("COMMIT");
    } catch (error) { await c.query("ROLLBACK").catch(() => {}); throw error; }
    finally { c.release(); }
    await store.restore(media, objects);
    process.env.BQ_STORAGE_SYNC = "0"; process.env.BQ_TRANSLATE = "0";
    const running = await require(path.join(base, "development/postgres/runtime.cjs"))
      .serve(proof, repo, { nativeEnabled: true, minimalRelease: true });
    return { ...running, close: async () => {
      try { await running.close(); } finally { fs.rmSync(root, { recursive: true, force: true }); }
    } };
  } catch (error) {
    await repo?.pool.end().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
module.exports = { start };
