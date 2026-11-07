const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { base, load, need, sha, canonical } = require("./config.cjs");
async function start({ env = process.env, manifest = load(env) } = {}) {
  // In-process comparisons only, before authority gates so a configuration
  // mismatch remains diagnosable. Nothing here changes those gates or readiness.
  require("./admin-startup-diagnostic.cjs").report(manifest, env);
  need(env.BQ_FRESH_ACTIVATE_APPROVAL === "activate:" + sha(canonical(manifest)), "fresh_activation_approval_required");
  const policy = require("./runtime-policy.cjs"), freshProviders = policy.providers(env);
  require("./providers.cjs").requireReady(freshProviders, env, manifest);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bq-fresh-"));
  fs.chmodSync(root, 0o700);
  const app = path.join(root, "app"), objects = path.join(root, "objects");
  fs.mkdirSync(app, { mode: 0o700 }); fs.mkdirSync(objects, { mode: 0o700 });
  let repo;
  try {
    const cfg = require(path.join(base, "deploy/managed/config.cjs"));
    const proof = cfg.verifyFresh({ env, manifest, paths: { root, app, objects } });
    need((await require("./providers.cjs").probeSmtp(freshProviders["smtp.json"])).status ===
      "AUTHENTICATED_NO_MESSAGE", "fresh_smtp_authentication_required");
    const { Client } = await import("@replit/object-storage");
    const { ImmutableStore } = require(path.join(base, "deploy/staging/object-store.cjs"));
    const store = new ImmutableStore(new Client({ bucketId: manifest.bucket }), { dataset: proof.dataset, managedProof: proof });
    const receipt = await store.readControl("provision-receipt.json"), intent = await store.readControl("provision-intent.json");
    need(intent?.kind === "BQ_FRESH_INTENT_V1" && intent.dataset === proof.dataset &&
      intent.seal === proof.seal && intent.binding === proof.manifestFingerprint, "fresh_intent_required");
    const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
    repo = new Repository(proof, null, { proof, store, receipt });
    const c = await repo.pool.connect();
    let media;
    try {
      await c.query("BEGIN");
      await require("./installation.cjs").database(c, proof, manifest);
      await require("./installation.cjs").reconcile(c, proof, manifest, receipt);
      await repo.verify(c);
      media = (await c.query("SELECT id,object_key,sha256 FROM dev.media WHERE state IN('ready','retained')")).rows;
      await c.query("COMMIT");
    } catch (error) { await c.query("ROLLBACK").catch(() => {}); throw error; }
    finally { c.release(); }
    // Existing repository restores only SQL-authorized media; no source storage.
    await store.restore(media, objects);
    process.env.BQ_STORAGE_SYNC = "0"; process.env.BQ_TRANSLATE = "0";
    const freshAdminPolicy = require("./email-ownership.cjs").adminPolicy(manifest, env);
    // Only booleans from this process's actual environment. Never emit the
    // approval, email, email hash, credentials or environment contents.
    console.log(JSON.stringify({ FRESH_ADMIN_CONFIGURATION: freshAdminPolicy.approved ? "PASS" : "BLOCKED",
      ...freshAdminPolicy.checks }));
    const running = await require(path.join(base, "development/postgres/runtime.cjs")).serve(proof, repo, {
      nativeEnabled: true, minimalRelease: true, freshInstall: true,
      freshProviders, freshEmailDomains: manifest.emailDomains,
      freshAdminPolicy,
      mediaEnabled: env.BQ_FRESH_MEDIA_ENABLED === "1"
    });
    return { ...running, close: async () => {
      try { await running.close(); } finally { fs.rmSync(root, { recursive: true, force: true }); }
    } };
  } catch (error) {
    await repo?.pool.end().catch(() => {});
    fs.rmSync(root, { recursive: true, force: true }); throw error;
  }
}
module.exports = { start };
