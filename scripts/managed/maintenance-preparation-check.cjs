// Focused first-deployment checks: no database, storage SDK, real records or
// credentials are used. Unexpected import/start/provider I/O fails this check.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "../..");
const pinned = path.join(root, "release-preparation/maintenance-cd5bd76/source");
const pg = require("pg");
const calls = { database: 0, source: 0, import: 0, activation: 0 };
const originalPool = pg.Pool, originalClient = pg.Client;
pg.Pool = class { constructor() { calls.database++; throw Error("unexpected_database"); } };
pg.Client = pg.Pool;
const source = require(path.join(pinned, "migration/minimal/source.cjs"));
const importer = require(path.join(pinned, "migration/minimal/execute.cjs"));
const runtime = require(path.join(pinned, "deploy/managed/minimal-runtime.cjs"));
const cfg = require(path.join(pinned, "deploy/managed/config.cjs"));
const originalRead = source.read, originalExecute = importer.execute, originalStart = runtime.start;
source.read = async () => { calls.source++; throw Error("unexpected_source_access"); };
importer.execute = async () => { calls.import++; throw Error("unexpected_import"); };
runtime.start = async () => { calls.activation++; throw Error("unexpected_activation"); };
const { run } = require("../../deploy/managed/minimal-import-runner.cjs");
function request(port, url) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port, path: url, agent: false }, res => {
      let body = "";
      res.on("data", data => { body += data; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on("error", reject);
  });
}
async function checkListener(operation) {
  process.env.REPLIT_DEPLOYMENT = "1";
  if (operation) process.env.BQ_MINIMAL_OPERATION = operation;
  else delete process.env.BQ_MINIMAL_OPERATION;
  const app = await run({ port: 0 });
  try {
    const port = app.server.address().port;
    for (const url of ["/", "/health/live", "/health/ready", "/api/login"]) {
      const response = await request(port, url);
      assert.equal(response.status, url === "/" || url === "/health/live" ? 200 : 503);
      assert.equal(response.body.ready, false);
    }
    // The original bootstrap schedules activation after 50ms unless its
    // maintenanceOnly guard is set; cross that boundary before checking calls.
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(calls, { database: 0, source: 0, import: 0, activation: 0 });
  } finally { await app.close(); }
}
(async () => {
  const oldMarker = process.env.REPLIT_DEPLOYMENT, oldOperation = process.env.BQ_MINIMAL_OPERATION;
  try {
    await checkListener(undefined);
    await checkListener("owner-approved-import-once");
    for (const file of ["deploy/managed/production-approvals.json", "migration/minimal/approvals.json"]) {
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(pinned, file), "utf8")).approvals, []);
    }
    // A fully invented production configuration reaches the exact activation
    // approval gate, without connecting anywhere or using actual secrets.
    const env = { REPLIT_DEPLOYMENT: "1", REPL_ID: "invented-maintenance-check",
      DATABASE_URL: "postgresql://invented:invented@production.example.invalid/invented",
      BQ_MANAGED_SESSION_KEY: "1".repeat(96), BQ_MANAGED_BACKUP_KEY: "2".repeat(64) };
    const digest = cfg.sha("invented"), bucket = "invented-distinct-target";
    const manifest = { kind: "BQ_REPLIT_MANAGED_V1", environment: "production",
      appFingerprint: cfg.sha(env.REPL_ID), endpointFingerprint: cfg.endpoint(env, "production").identity,
      dataset: "managed-production-11111111-1111-4111-8111-111111111111",
      schemaFingerprint: digest, releaseFingerprint: digest, permissionsFingerprint: digest,
      keys: { session: cfg.sha(env.BQ_MANAGED_SESSION_KEY), backup: cfg.sha(env.BQ_MANAGED_BACKUP_KEY) },
      bucket, productionBucketFingerprint: cfg.sha(bucket),
      developmentEndpointFingerprint: cfg.sha("invented-development"),
      permissionApproval: "reviewed-managed-runtime-capabilities",
      release: Object.fromEntries(["source", "backup", "reconciliation", "custody", "rollback", "frozenGeneration"].map(k => [k, digest])),
      approval: "never-approved" };
    assert.throws(() => cfg.verify({ env, manifest }), { code: "managed_production_approval_missing" });
    await assert.rejects(originalExecute({ env, manifest }), { code: "managed_production_approval_missing" });
    assert.deepEqual(calls, { database: 0, source: 0, import: 0, activation: 0 });
    console.log(JSON.stringify({ result: "PASS", defaultMaintenance: true,
      accidentalImportFlagIgnored: true, readinessAndLoginClosed: true,
      exactActivationAndImportApprovalsEmpty: true, directExecutorRefusesMissingApproval: true,
      externalIoCalls: calls }));
  } finally {
    if (oldMarker === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = oldMarker;
    if (oldOperation === undefined) delete process.env.BQ_MINIMAL_OPERATION;
    else process.env.BQ_MINIMAL_OPERATION = oldOperation;
    source.read = originalRead; importer.execute = originalExecute; runtime.start = originalStart;
    pg.Pool = originalPool; pg.Client = originalClient;
  }
})().catch(() => { console.error("maintenance_preparation_check_failed"); process.exitCode = 1; });
