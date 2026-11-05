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
const { resolvePort, publishingPort } = require("../../release-preparation/production-bindings/maintenance-http.cjs");
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
function response(port, url, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: url, method,
      headers: { Host: "127.0.0.1:11044" }, agent: false }, res => {
      let body = "";
      res.on("data", data => { body += data; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(1500, () => req.destroy(Error("liveness timeout")));
    req.on("error", reject); req.end();
  });
}
(async () => {
  assert.equal(bindings.targetNameConfirmedByOperator, true);
  assert.notEqual(bindings.sourceBucket, bindings.targetBucket);
  assert.throws(() => requireContext({}, spec));
  assert.throws(() => requireContext({ ...env, DATABASE_URL: "postgresql://a:b@helium/neondb" }, spec));
  assert.throws(() => requireContext(env, { ...spec,
    sourceBucket: spec.targetBucket, sourceBucketFingerprint: spec.targetBucketFingerprint }));
  const contextCases = [
    [{ REPLIT_DEPLOYMENT: undefined }, {}, "PUBLISHED_PROCESS"],
    [{}, { implementationCommit: "incorrect" }, "PINNED_BINDINGS"],
    [{ REPL_ID: undefined }, {}, "APP_IDENTITY"],
    [{ REPL_ID: "wrong-app" }, {}, "APP_IDENTITY"],
    [{ BQ_MANAGED_SESSION_KEY: undefined }, {}, "SESSION_KEY_PRESENT"],
    [{ BQ_MANAGED_SESSION_KEY: "1".repeat(96) + "\n" }, {}, "SESSION_KEY_FORMAT"],
    [{ BQ_MANAGED_BACKUP_KEY: "wrong" }, {}, "BACKUP_KEY_FORMAT"],
    [{ BQ_MINIMAL_AUDIT_KEY: undefined }, {}, "AUDIT_KEY_PRESENT"],
    [{ DATABASE_URL: undefined }, {}, "ENDPOINT_PRESENT"],
    [{ DATABASE_URL: "invalid" }, {}, "ENDPOINT_SYNTAX"],
    [{ DATABASE_URL: "postgres://a:b@helium/neondb" }, {}, "ENDPOINT_DESTINATION"],
    [{ DATABASE_URL: "postgres://a:b@localhost/neondb" }, {}, "ENDPOINT_DESTINATION"],
    [{ DATABASE_URL: "postgres://a:b@[::1]/neondb" }, {}, "ENDPOINT_DESTINATION"],
    [{ DATABASE_URL: env.DATABASE_URL + "?options=unreviewed" }, {}, "ENDPOINT_ALLOWED_OPTIONS"],
    [{ DATABASE_URL: env.DATABASE_URL + "?sslmode=no-verify" }, {}, "ENDPOINT_TLS_POLICY"],
    [{}, { developmentEndpointFingerprint: cfg.endpoint(env, "production").identity }, "ENDPOINT_NOT_DEVELOPMENT"],
    [{}, { sourceBucket: spec.targetBucket }, "BUCKET_BINDING"],
    [{}, { targetNameConfirmedByOperator: false }, "CONTROL_BUCKET_CONFIRMATION"]
  ];
  for (const [changes, bindingChanges, expected] of contextCases) {
    const state = statuses();
    assert.throws(() => requireContext({ ...env, ...changes }, { ...spec, ...bindingChanges }, state));
    assert.equal(state[expected], "BLOCKED");
    statusOnly(state);
  }
  assert.equal(resolvePort({}, undefined), 4173);
  assert.equal(publishingPort, 4173);
  assert.equal(resolvePort({ PORT: "11044" }), 11044);
  assert.equal(resolvePort({ PORT: "4173" }), 4173);
  for (const value of ["0", "-1", "5000bad", "65536", ""]) assert.throws(() => resolvePort({ PORT: value }));
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
        await app.diagnostic;
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
    await app.diagnostic;
    await app.close(); assert.equal(unchecked, 0);
    // Exercise the actual isolated diagnostic loader. This intentionally
    // invented app identity fails BEFORE cloud access, even with valid formats.
    const isolated = await launch({ env, port: 0 });
    try {
      assert.equal(await request(isolated.server.address().port, "/"), 200);
      const result = await isolated.diagnostic;
      assert.equal(result.DIAGNOSTIC_WORKER, "PASS");
      assert.equal(result.APP_IDENTITY, "BLOCKED");
      assert.equal(result.PRODUCTION_CONTEXT, "BLOCKED");
      assert.equal(await request(isolated.server.address().port, "/"), 200);
    } finally { await isolated.close(); }

    // Verify the exact configured listen argument without taking over the
    // workspace's existing4173 listener. Own an ephemeral TCP listener instead.
    // The real context failure occurs before ANY source/database access.
    const originalListen = http.Server.prototype.listen;
    let requestedPort, blocked;
    http.Server.prototype.listen = function (port, ...args) {
      requestedPort = port;
      return originalListen.call(this, 0, ...args);
    };
    try {
      blocked = await launch({ env, check: options => verify({
        env: { ...options.env, DATABASE_URL: undefined }, bindings: spec
      }) });
    } finally { http.Server.prototype.listen = originalListen; }
    try {
      assert.equal(requestedPort, 4173);
      const localPort = blocked.server.address().port;
      assert.equal(blocked.server.address().address, "0.0.0.0");
      const result = await blocked.diagnostic;
      assert.equal(result.MAINTENANCE, "PASS");
      assert.equal(result.DIAGNOSTIC_REQUEST, "PASS");
      assert.equal(result.PRODUCTION_CONTEXT, "BLOCKED");
      assert.equal(result.ENDPOINT_PRESENT, "BLOCKED");
      for (const url of ["/", "/?probe=1", "/health/live"]) {
        const res = await response(localPort, url);
        assert.equal(res.status, 200); assert.equal(JSON.parse(res.body).ready, false);
      }
      const head = await response(localPort, "/", "HEAD");
      assert.equal(head.status, 200); assert.equal(head.body, "");
      for (const url of ["/health/ready", "/health/ready?probe=1", "/api/login"]) {
        const res = await response(localPort, url);
        assert.equal(res.status, 503); assert.equal(JSON.parse(res.body).ready, false);
      }
      assert.equal((await response(localPort, "/", "POST")).status, 503);
    } finally { await blocked.close(); }

    // A stuck diagnostic must not delay listener availability or launch().
    let release;
    const stuck = await launch({ env, port: 0, check: () => new Promise((resolve, reject) => {
      release = () => reject(null);
    }) });
    try {
      assert.equal(await request(stuck.server.address().port, "/"), 200);
      assert.equal(await request(stuck.server.address().port, "/health/ready"), 503);
      release(); await stuck.diagnostic;
      assert.equal(await request(stuck.server.address().port, "/"), 200);
    } finally { await stuck.close(); }
  } finally { console.log = log; console.error = errorLog; }
  assert.equal(errors.length, 0);
  for (const line of lines) {
    assert.ok(!line.includes("NEVER_OUTPUT_THIS")); statusOnly(JSON.parse(line));
    assert.equal(JSON.parse(line).MAINTENANCE, "PASS");
  }
  assert.ok(sqlSeen.length > 0);
  console.log(JSON.stringify({ result: "PASS", readOnlyCapabilities: "PASS", keyMismatchRefused: "PASS",
    statusOnlyOutput: "PASS", maintenanceOnSuccessAndFailure: "PASS",
    importFlagCannotActivate: "PASS", configuredPort4173: "PASS",
    contextFailureAndHungDiagnosticHealth: "PASS", contextGuardCases: contextCases.length,
    realProductionAccess: false }));
})().catch(error => {
  console.error("diagnostic_publication_check_failed");
  // Local synthetic test locations only, never exception messages/values.
  console.error(String(error.stack || "").split("\n").filter(line => line.startsWith("    at ")).join("\n"));
  process.exitCode = 1;
});
