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

function stop(code) { throw Object.assign(Error(code), { code }); }
function guard(state, name, condition, code) {
  state[name] = condition ? "PASS" : "BLOCKED";
  if (!condition) stop(code);
}
function requireContext(env, bindings, state = statuses()) {
  guard(state, "PUBLISHED_PROCESS", env.REPLIT_DEPLOYMENT === "1", "preflight_published_process_required");
  guard(state, "PINNED_BINDINGS", bindings?.kind === "BQ_PENDING_PRODUCTION_BINDINGS_V1" &&
    bindings.implementationCommit === "cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9",
    "preflight_pinned_bindings_required");
  guard(state, "APP_IDENTITY", !!env.REPL_ID && cfg.sha(env.REPL_ID) === bindings.appFingerprint,
    "preflight_app_identity_mismatch");
  for (const [name, key, length] of [
    ["SESSION", "BQ_MANAGED_SESSION_KEY", 96],
    ["BACKUP", "BQ_MANAGED_BACKUP_KEY", 64],
    ["AUDIT", "BQ_MINIMAL_AUDIT_KEY", 64]
  ]) {
    state[name + "_KEY_PRESENT"] = typeof env[key] === "string" && env[key].length ? "PASS" : "BLOCKED";
    state[name + "_KEY_FORMAT"] = new RegExp("^[a-f0-9]{" + length + "}$").test(env[key] || "") ? "PASS" : "BLOCKED";
  }
  if (["SESSION", "BACKUP", "AUDIT"].some(name => state[name + "_KEY_FORMAT"] !== "PASS"))
    stop("preflight_applied_production_secrets_required");
  state.PRODUCTION_SECRETS = "PASS"; // presence/format only, NOT original-key equality
  guard(state, "ENDPOINT_PRESENT", !!env.DATABASE_URL, "managed_connection_missing");
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { stop("managed_connection_invalid"); }
  guard(state, "ENDPOINT_SYNTAX", ["postgres:", "postgresql:"].includes(url.protocol) &&
    !!url.hostname && !!url.pathname.slice(1), "managed_connection_invalid");
  guard(state, "ENDPOINT_DESTINATION",
    !["helium", "localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname),
    "managed_production_endpoint_refused");
  guard(state, "ENDPOINT_ALLOWED_OPTIONS",
    [...url.searchParams.keys()].every(key => ["sslmode", "channel_binding"].includes(key)),
    "managed_connection_option_unreviewed");
  guard(state, "ENDPOINT_TLS_POLICY",
    !["disable", "no-verify", "allow", "prefer"].includes(url.searchParams.get("sslmode")),
    "managed_tls_downgrade_refused");
  // Retain the original pinned validator as the authority, not a permissive
  // replacement. Subchecks above expose only which existing guard failed.
  const endpoint = cfg.endpoint(env, "production");
  guard(state, "ENDPOINT_NOT_DEVELOPMENT", endpoint.identity !== bindings.developmentEndpointFingerprint,
    "preflight_development_endpoint_refused");
  guard(state, "BUCKET_BINDING", !!bindings.sourceBucket && !!bindings.targetBucket &&
    bindings.sourceBucketFingerprint === "ce11c603901c2550295d04cf9a5898200348ff8d29086744a88ee73d8f8716ec" &&
    bindings.targetBucketFingerprint === "71b5a307f0aa650bee9a8a4359d5caa2841eb5717f590e983100951fca2dd6b2" &&
    cfg.sha(bindings.sourceBucket) === bindings.sourceBucketFingerprint &&
    cfg.sha(bindings.targetBucket) === bindings.targetBucketFingerprint &&
    bindings.sourceBucket !== bindings.targetBucket, "preflight_distinct_bucket_binding_required");
  guard(state, "CONTROL_BUCKET_CONFIRMATION", bindings.targetNameConfirmedByOperator === true,
    "preflight_control_bucket_name_confirmation_required");
  return endpoint;
}
async function verify({ env = process.env, bindings } = {}) {
  const state = statuses({ READ_ONLY_SAFETY: "PASS" });
  try {
  const endpoint = requireContext(env, bindings, state);
  state.PRODUCTION_CONTEXT = "PASS";
  state.PRODUCTION_SECRETS = "PASS";
  const { Client } = await import("@replit/object-storage");
  // Always explicit IDs: never the new or current default bucket.
  const sourceClient = readOnly.source(new Client({ bucketId: bindings.sourceBucket }));
  const targetClient = readOnly.target(new Client({ bucketId: bindings.targetBucket }));
  const source = await sourceModule.read({
    client: sourceClient, bucketFingerprint: bindings.sourceBucketFingerprint,
    auditKey: Buffer.from(env.BQ_MINIMAL_AUDIT_KEY, "hex")
  });
  const original = sourceModule.access(source);
  if (!crypto.timingSafeEqual(Buffer.from(original.sessionKey), Buffer.from(env.BQ_MANAGED_SESSION_KEY)) ||
      !crypto.timingSafeEqual(Buffer.from(original.backupKey), Buffer.from(env.BQ_MANAGED_BACKUP_KEY)))
    stop("preflight_original_key_mismatch");
  state.ORIGINAL_KEY_MATCH = "PASS";
  const objects = await targetClient.list({ maxResults: 1 });
  if (!objects.ok) stop("preflight_control_bucket_read_unverified");
  if (objects.value.length) stop("preflight_control_bucket_not_empty");
  state.CONTROL_BUCKET = "PASS";
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
    state.DATABASE_TLS = "PASS";
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
    state.PRODUCTION_DATABASE = "PASS";
    // Observation is not owner approval of elevated runtime capabilities.
    if (bindings.permissionReviewApproved === true &&
        bindings.permissionsFingerprint === permissions.fingerprint)
      state.PERMISSION_REVIEW = "PASS";
    // No inference that other writers are frozen; no migration approval exists.
    return statuses(state);
  } finally { if (client) client.release(); await pool.end(); }
  } catch (error) {
    // Never propagate credentials, records, fingerprints or arbitrary messages
    // to either entrypoint. Only allowlisted PASS/BLOCKED statuses survive.
    throw Object.assign(Error("diagnostic blocked"), { statuses: statuses(state) });
  }
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
