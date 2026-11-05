// FUTURE protected Production-process diagnostic only. Not a run command,
// not imported by the current maintenance entrypoint, and no public endpoint.
// Never invokes the importer, runtime activation, DDL or a storage-write method.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Pool } = require("pg");
const base = path.resolve(__dirname, "../maintenance-cd5bd76/source");
const cfg = require(path.join(base, "deploy/managed/config.cjs"));
const schema = require(path.join(base, "deploy/managed/schema.cjs"));
const sourceModule = require(path.join(base, "migration/minimal/source.cjs"));

function stop(code) { throw Object.assign(Error(code), { code }); }
function requireContext(env, bindings) {
  if (env.REPLIT_DEPLOYMENT !== "1") stop("preflight_published_process_required");
  if (bindings?.kind !== "BQ_PENDING_PRODUCTION_BINDINGS_V1" ||
      bindings.implementationCommit !== "cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9")
    stop("preflight_pinned_bindings_required");
  if (!env.REPL_ID || cfg.sha(env.REPL_ID) !== bindings.appFingerprint)
    stop("preflight_app_identity_mismatch");
  if (!/^[a-f0-9]{96}$/.test(env.BQ_MANAGED_SESSION_KEY || "") ||
      !/^[a-f0-9]{64}$/.test(env.BQ_MANAGED_BACKUP_KEY || "") ||
      !/^[a-f0-9]{64}$/.test(env.BQ_MINIMAL_AUDIT_KEY || ""))
    stop("preflight_applied_production_secrets_required");
  const endpoint = cfg.endpoint(env, "production");
  if (endpoint.identity === bindings.developmentEndpointFingerprint)
    stop("preflight_development_endpoint_refused");
  if (!bindings.sourceBucket || !bindings.targetBucket ||
      cfg.sha(bindings.sourceBucket) !== bindings.sourceBucketFingerprint ||
      cfg.sha(bindings.targetBucket) !== bindings.targetBucketFingerprint ||
      bindings.sourceBucket === bindings.targetBucket)
    stop("preflight_distinct_bucket_binding_required");
  if (bindings.targetNameConfirmedByOperator !== true)
    stop("preflight_control_bucket_name_confirmation_required");
  return endpoint;
}
async function verify({ env = process.env, bindings } = {}) {
  const endpoint = requireContext(env, bindings);
  const { Client } = await import("@replit/object-storage");
  const sourceClient = new Client({ bucketId: bindings.sourceBucket });
  const targetClient = new Client({ bucketId: bindings.targetBucket });
  const source = await sourceModule.read({
    client: sourceClient, bucketFingerprint: bindings.sourceBucketFingerprint,
    auditKey: Buffer.from(env.BQ_MINIMAL_AUDIT_KEY, "hex")
  });
  const original = sourceModule.access(source);
  if (!crypto.timingSafeEqual(Buffer.from(original.sessionKey), Buffer.from(env.BQ_MANAGED_SESSION_KEY)) ||
      !crypto.timingSafeEqual(Buffer.from(original.backupKey), Buffer.from(env.BQ_MANAGED_BACKUP_KEY)))
    stop("preflight_original_key_mismatch");
  const objects = await targetClient.list({ maxResults: 1 });
  if (!objects.ok) stop("preflight_control_bucket_read_unverified");
  if (objects.value.length) stop("preflight_control_bucket_not_empty");
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
    const identity = (await client.query(
      "SELECT current_database() AS database_name, current_user AS role_name, current_setting('transaction_read_only') AS read_only"
    )).rows[0];
    if (identity.database_name !== "neondb" || identity.read_only !== "on")
      stop("preflight_readonly_destination_required");
    const shape = await schema.requireSchema(client, {
      releaseFingerprint: schema.releaseFingerprint, schemaFingerprint: bindings.schemaFingerprint
    });
    if (shape.tables !== 117) stop("preflight_schema_table_count_changed");
    const tables = (await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='dev' ORDER BY tablename"
    )).rows.map(r => r.tablename);
    if (tables.length !== 117 || tables.some(n => !/^[a-z_][a-z0-9_]*$/.test(n)))
      stop("preflight_table_identity_changed");
    const total = (await client.query("SELECT sum(n)::text AS total FROM (" +
      tables.map(n => "SELECT count(*) AS n FROM dev." + n).join(" UNION ALL ") + ") q")).rows[0];
    if (total.total !== "0") stop("preflight_destination_not_empty");
    const permissions = await cfg.permissions(client);
    return {
      kind: "BQ_PROTECTED_BINDINGS_PREFLIGHT_V1",
      originalKeysMatch: true, productionSecretsObserved: true,
      database: identity, counts: source.counts,
      manifestDraft: {
        kind: "BQ_REPLIT_MANAGED_V1", environment: "production",
        appFingerprint: bindings.appFingerprint, endpointFingerprint: endpoint.identity,
        developmentEndpointFingerprint: bindings.developmentEndpointFingerprint,
        schemaFingerprint: shape.fingerprint, releaseFingerprint: schema.releaseFingerprint,
        permissionsFingerprint: permissions.fingerprint,
        keys: { session: cfg.sha(original.sessionKey), backup: cfg.sha(original.backupKey) },
        bucket: bindings.targetBucket, productionBucketFingerprint: bindings.targetBucketFingerprint,
        minimal: { policy: "employees-accounts-only-v1", sourceBucket: bindings.sourceBucket,
          sourceBucketFingerprint: source.bucketFingerprint, sourceFingerprint: source.fingerprint,
          membership: source.membership, employees: source.counts.employees,
          accounts: source.counts.accounts, freezeEvidence: null },
        dataset: null, permissionApproval: null, approval: null, release: null
      },
      capabilitiesRequiringOwnerReview: permissions.capabilities,
      sourceFrozen: false, sourceReadStableOnly: true, executionAuthorized: false,
      sourceWritten: false, targetWritten: false, productionRowsWritten: false
    };
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
  }).then(result => console.log(JSON.stringify(result))).catch(error => {
    const code = /^(preflight_|managed_|minimal_)[a-z0-9_]+$/.test(error.code || "")
      ? error.code : "preflight_verification_failed";
    console.error(JSON.stringify({ error: code, executionAuthorized: false }));
    process.exitCode = 1;
  });
}
