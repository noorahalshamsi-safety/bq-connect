// Focused synthetic checks for diagnostic publication. No real secrets, source
// records, cloud calls or Production connections are used.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const base = path.join(root, "release-preparation/maintenance-cd5bd76/source");
const bindings = require("../../release-preparation/production-bindings/bindings.pending.json");
const cfg = require(path.join(base, "deploy/managed/config.cjs"));
const schema = require(path.join(base, "deploy/managed/schema.cjs"));
const source = require(path.join(base, "migration/minimal/source.cjs"));
const runtime = require(path.join(base, "deploy/managed/minimal-runtime.cjs"));
let activated = 0;
runtime.start = async () => { activated++; throw Error("activation forbidden"); };
const { launch } = require("../../release-preparation/production-bindings/maintenance-check.cjs");
const { verify, requireContext } = require("../../release-preparation/production-bindings/verify.cjs");
const { statuses } = require("../../release-preparation/production-bindings/status.cjs");
const readonly = require("../../release-preparation/production-bindings/read-only.cjs");
const env = { REPLIT_DEPLOYMENT: "1", REPL_ID: "invented-diagnostic-test",
  DATABASE_URL: "postgresql://invented:invented@production.example.invalid/neondb",
  BQ_MANAGED_SESSION_KEY: "1".repeat(96), BQ_MANAGED_BACKUP_KEY: "2".repeat(64),
  BQ_MINIMAL_AUDIT_KEY: "3".repeat(64),
  BQ_MINIMAL_BINDINGS_CHECK: "approved-readonly-check",
  BQ_MINIMAL_OPERATION: "owner-approved-import-once" };
const spec = { ...bindings, appFingerprint: cfg.sha(env.REPL_ID) };
function statusOnly(result) {
  assert.deepEqual(result, statuses(result));
  for (const value of Object.values(result)) assert.ok(["PASS", "BLOCKED"].includes(value));
}
function request(port, url) {
  return new Promise((resolve, reject) => http.get({
    hostname: "127.0.0.1", port, path: url, agent: false
  }, res => { res.resume(); res.on("end", () => resolve(res.statusCode)); }).on("error", reject));
}
(async () => {
  assert.equal(bindings.targetNameConfirmedByOperator, true);
  assert.notEqual(bindings.sourceBucket, bindings.targetBucket);
  assert.throws(() => requireContext({}, spec));
  assert.throws(() => requireContext({ ...env, DATABASE_URL: "postgresql://a:b@helium/neondb" }, spec));
  assert.throws(() => requireContext(env, { ...spec,
    sourceBucket: spec.targetBucket, sourceBucketFingerprint: spec.targetBucketFingerprint }));
  let selects = 0;
  const reads = readonly.sql({ query: async () => { selects++; return { rows: [] }; } });
  await reads.query("SELECT 1");
  for (const sql of ["INSERT INTO dev.accounts VALUES(1)", "UPDATE dev.authority SET mode='production'",
    "DELETE FROM dev.files", "TRUNCATE dev.accounts", "CREATE TABLE anything(id int)",
    "SET transaction_read_only=off", "BEGIN", "SELECT 1; DELETE FROM dev.accounts"]) {
    assert.throws(() => reads.query(sql), { code: "preflight_query_refused" });
  }
  assert.equal(selects, 1);
  assert.deepEqual(Object.keys(readonly.source({})), ["exists", "downloadAsText"]);
  assert.deepEqual(Object.keys(readonly.target({})), ["list"]);

  const pg = require("pg"), { Client } = await import("@replit/object-storage");
  const saved = { Pool: pg.Pool, list: Client.prototype.list, read: source.read,
    access: source.access, schema: schema.requireSchema, permissions: cfg.permissions };
  const sqlSeen = [];
  let pools = 0;
  const fakeClient = {
    connection: { stream: { encrypted: true, authorized: true } }, release() {},
    async query(sql) {
      assert.match(sql, /^\s*SELECT\b/i); assert.ok(!sql.includes(";")); sqlSeen.push(sql);
      if (sql.includes("current_database()")) return { rows: [{ database_name: "neondb", role_name: "invented", read_only: "on" }] };
      if (sql.includes("pg_tables")) return { rows: Array.from({ length: 117 }, (_, i) => ({ tablename: "table_" + i })) };
      if (sql.includes("sum(n)")) return { rows: [{ total: "0" }] };
      return { rows: [] };
    }
  };
  // Pool was captured on module load; substitute its prototype methods instead.
  const originalConnect = pg.Pool.prototype.connect, originalEnd = pg.Pool.prototype.end;
  pg.Pool.prototype.connect = async function () {
    pools++;
    assert.equal(this.options.options, "-c default_transaction_read_only=on");
    assert.equal(this.options.ssl.rejectUnauthorized, true);
    assert.equal(this.options.ssl.minVersion, "TLSv1.2");
    return fakeClient;
  };
  pg.Pool.prototype.end = async function () {};
  Client.prototype.list = async () => ({ ok: true, value: [] });
  source.read = async input => {
    assert.equal(input.bucketFingerprint, bindings.sourceBucketFingerprint);
    assert.deepEqual(Object.keys(input.client), ["exists", "downloadAsText"]);
    return {};
  };
  source.access = () => ({ sessionKey: env.BQ_MANAGED_SESSION_KEY, backupKey: env.BQ_MANAGED_BACKUP_KEY });
  schema.requireSchema = async client => { await client.query("SELECT 1"); return { tables: 117 }; };
  cfg.permissions = async client => {
    await client.query("SELECT 1"); return { fingerprint: "4".repeat(64), capabilities: {} };
  };
  try {
    const success = await verify({ env, bindings: spec });
    statusOnly(success);
    assert.equal(success.ORIGINAL_KEY_MATCH, "PASS");
    assert.equal(success.PRODUCTION_DATABASE, "PASS");
    assert.equal(success.SOURCE_WRITER_FREEZE, "BLOCKED");
    assert.equal(success.PERMISSION_REVIEW, "BLOCKED");
    const priorPools = pools;
    await assert.rejects(verify({ env: { ...env, BQ_MANAGED_BACKUP_KEY: "5".repeat(64) }, bindings: spec }),
      error => { statusOnly(error.statuses); return error.statuses.ORIGINAL_KEY_MATCH === "BLOCKED"; });
    assert.equal(pools, priorPools);
  } finally {
    Client.prototype.list = saved.list; source.read = saved.read; source.access = saved.access;
    schema.requireSchema = saved.schema; cfg.permissions = saved.permissions;
    pg.Pool.prototype.connect = originalConnect; pg.Pool.prototype.end = originalEnd;
  }

  const lines = [], errors = [], log = console.log, errorLog = console.error;
  console.log = line => lines.push(line);
  console.error = line => errors.push(line);
  try {
    for (const check of [
      async () => ({ PRODUCTION_SECRETS: "PASS", credentials: "NEVER_OUTPUT_THIS", records: [{ secret: "NEVER_OUTPUT_THIS" }] }),
      async () => { throw Object.assign(Error("NEVER_OUTPUT_THIS"), { password: "NEVER_OUTPUT_THIS" }); }
    ]) {
      const app = await launch({ env, port: 0, check });
      try {
        const port = app.server.address().port;
        assert.equal(await request(port, "/"), 200);
        assert.equal(await request(port, "/health/ready"), 503);
        assert.equal(await request(port, "/api/login"), 503);
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(activated, 0);
      } finally { await app.close(); }
    }
    let unchecked = 0;
    const app = await launch({ env: {}, port: 0, check: async () => { unchecked++; } });
    await app.close(); assert.equal(unchecked, 0);
  } finally { console.log = log; console.error = errorLog; }
  assert.equal(errors.length, 0);
  for (const line of lines) {
    assert.ok(!line.includes("NEVER_OUTPUT_THIS")); statusOnly(JSON.parse(line));
    assert.equal(JSON.parse(line).MAINTENANCE, "PASS");
  }
  assert.ok(sqlSeen.length > 0);
  console.log(JSON.stringify({ result: "PASS", readOnlyCapabilities: "PASS", keyMismatchRefused: "PASS",
    statusOnlyOutput: "PASS", maintenanceOnSuccessAndFailure: "PASS",
    importFlagCannotActivate: "PASS", realProductionAccess: false }));
})().catch(() => { console.error("diagnostic_publication_check_failed"); process.exitCode = 1; });
