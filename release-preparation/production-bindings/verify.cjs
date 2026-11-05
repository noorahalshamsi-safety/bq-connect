// Protected Production-process diagnostic only. No public diagnostic endpoint.
// Never invokes the importer, runtime activation, DDL or a storage-write method.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const base = path.resolve(__dirname, "../maintenance-cd5bd76/source");
const cfg = require(path.join(base, "deploy/managed/config.cjs"));
const schema = require(path.join(base, "deploy/managed/schema.cjs"));
const sourceModule = require(path.join(base, "migration/minimal/source.cjs"));
const readOnly = require("./read-only.cjs");
const { statuses, report } = require("./status.cjs");
const { assess } = require("./context.cjs");

function stop(code) { throw Object.assign(Error(code), { code }); }
function requireContext(env, bindings, state = statuses()) {
  const result = assess(env, bindings, state);
  if (![result.identityReady, result.secretsReady, result.endpointReady,
    result.bucketsReady, result.schemaReady].every(Boolean)) stop("preflight_context_required");
  return result.endpoint;
}
async function verify({ env = process.env, bindings, workerEnvironmentVerified } = {}) {
  const state = statuses({ READ_ONLY_SAFETY: "PASS" });
  if (workerEnvironmentVerified !== undefined)
    state.WORKER_ENVIRONMENT = workerEnvironmentVerified ? "VERIFIED" : "INVALID";
  const context = assess(env, bindings, state);
  // Independent local checks above ALWAYS run. Unknown/incorrect app identity
  // still forbids ALL protected reads. Never fall back to a configured app ID.
  if (!context.identityReady) return statuses(state);
  if (context.bucketsReady) {
    let Client;
    try { ({ Client } = await import("@replit/object-storage")); } catch {
      state.CONTROL_BUCKET = "INVALID";
      if (context.secretsReady) state.SOURCE_READ = "INVALID";
    }
    if (Client) {
      if (context.secretsReady) {
        let original;
        try {
          const source = await sourceModule.read({
            client: readOnly.source(new Client({ bucketId: bindings.sourceBucket })),
            bucketFingerprint: bindings.sourceBucketFingerprint,
            auditKey: Buffer.from(env.BQ_MINIMAL_AUDIT_KEY, "hex")
          });
          original = sourceModule.access(source);
          state.SOURCE_READ = "VERIFIED";
        } catch { state.SOURCE_READ = "INVALID"; }
        if (original) {
          const equal = (a, b) => typeof a === "string" && typeof b === "string" &&
            Buffer.byteLength(a) === Buffer.byteLength(b) &&
            crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
          state.ORIGINAL_KEY_MATCH = equal(original.sessionKey, env.BQ_MANAGED_SESSION_KEY) &&
            equal(original.backupKey, env.BQ_MANAGED_BACKUP_KEY) ? "VERIFIED" : "INVALID";
        }
      }
      // Target read is independent of source availability/key equality.
      try {
        const objects = await readOnly.target(new Client({ bucketId: bindings.targetBucket })).list({ maxResults: 1 });
        state.CONTROL_BUCKET = objects.ok && objects.value.length === 0 ? "VERIFIED" : "INVALID";
      } catch { state.CONTROL_BUCKET = "INVALID"; }
    }
  }
  // TLS/schema/empty-table observation does not require authentication keys or
  // storage access. It still requires verified app/Production endpoint identity.
  if (context.endpointReady && context.schemaReady) {
    try { await checkDatabase(context.endpoint, bindings, state); } catch {
      if (state.DATABASE_TLS === "NOT_EXECUTED") state.DATABASE_TLS = "INVALID";
      else state.PRODUCTION_DATABASE = "INVALID";
    }
  }
  return statuses(state);
}
async function checkDatabase(endpoint, bindings, state) {
  const pool = new Pool({
    connectionString: endpoint.url.toString(),
    ssl: { rejectUnauthorized: true, servername: endpoint.url.hostname, minVersion: "TLSv1.2" },
    enableChannelBinding: true, max: 1, connectionTimeoutMillis: 5000,
    statement_timeout: 20000, application_name: "bq-minimal-readonly-preflight",
    options: "-c default_transaction_read_only=on"
  });
  pool.on("error", () => {});
  let client;
  try {
    client = await pool.connect();
    if (!client.connection.stream.encrypted || !client.connection.stream.authorized)
      stop("preflight_verified_tls_required");
    state.DATABASE_TLS = "VERIFIED";
    const reads = readOnly.sql(client);
    const identity = (await reads.query(
      "SELECT current_database() AS database_name, current_user AS role_name, current_setting('transaction_read_only') AS read_only"
    )).rows[0];
    if (identity.database_name !== "neondb" || identity.read_only !== "on")
      stop("preflight_readonly_destination_required");
    const shape = await schema.requireSchema(reads, {
      releaseFingerprint: schema.releaseFingerprint, schemaFingerprint: bindings.schemaFingerprint
    });
    if (shape.tables !== 117) stop("preflight_schema_table_count_changed");
    const tables = (await reads.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='dev' ORDER BY tablename"
    )).rows.map(r => r.tablename);
    if (tables.length !== 117 || tables.some(n => !/^[a-z_][a-z0-9_]*$/.test(n)))
      stop("preflight_table_identity_changed");
    const total = (await reads.query("SELECT sum(n)::text AS total FROM (" +
      tables.map(n => "SELECT count(*) AS n FROM dev." + n).join(" UNION ALL ") + ") q")).rows[0];
    if (total.total !== "0") stop("preflight_destination_not_empty");
    const permissions = await cfg.permissions(reads);
    state.PRODUCTION_DATABASE = "VERIFIED";
    // Observation is not owner approval of elevated runtime capabilities.
    if (bindings.permissionReviewApproved === true &&
        bindings.permissionsFingerprint === permissions.fingerprint)
      state.PERMISSION_REVIEW = "VERIFIED";
    else state.PERMISSION_REVIEW = bindings.permissionReviewApproved === true ? "INVALID" : "MISSING";
    // No inference that other writers are frozen; no migration approval exists.
  } finally { if (client) client.release(); await pool.end(); }
}
module.exports = { verify, requireContext };
if (require.main === module) {
  // This file must be executed ONLY by an authorized protected Production
  // operator process. Its safe output is never exposed through a public API.
  Promise.resolve().then(() => {
    if (process.env.REPLIT_DEPLOYMENT !== "1") stop("preflight_published_process_required");
    if (process.argv.length !== 3) stop("preflight_bindings_file_required");
    return verify({ bindings: JSON.parse(fs.readFileSync(process.argv[2], "utf8")) });
  }).then(report).catch(error => {
    report(error.statuses);
    process.exitCode = 1;
  });
}
