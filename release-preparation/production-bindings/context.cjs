// Independent LOCAL observations only. Never connects to SQL or App Storage.
const cfg = require("../maintenance-cd5bd76/source/deploy/managed/config.cjs");
const hex = /^[a-f0-9]{64}$/;
const valid = value => value === "VERIFIED";
const present = value => typeof value === "string" && value.length > 0;
function assess(env, bindings, state) {
  const b = bindings || {};
  state.PUBLISHED_PROCESS = env.REPLIT_DEPLOYMENT === undefined ? "MISSING" :
    env.REPLIT_DEPLOYMENT === "1" ? "VERIFIED" : "INVALID";
  state.PINNED_BINDINGS = !bindings ? "MISSING" :
    b.kind === "BQ_PENDING_PRODUCTION_BINDINGS_V1" &&
    b.implementationCommit === "cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9" ? "VERIFIED" : "INVALID";
  state.APP_BINDING = !present(b.appFingerprint) ? "MISSING" : hex.test(b.appFingerprint) ? "VERIFIED" : "INVALID";
  state.APP_ID_PRESENT = present(env.REPL_ID) ? "VERIFIED" : "MISSING";
  state.APP_IDENTITY = !valid(state.APP_ID_PRESENT) ? "MISSING" :
    !valid(state.APP_BINDING) ? state.APP_BINDING :
    cfg.sha(env.REPL_ID) === b.appFingerprint ? "VERIFIED" : "INVALID";
  const identityReady = ["PUBLISHED_PROCESS", "PINNED_BINDINGS", "APP_IDENTITY"]
    .every(key => valid(state[key])) && state.WORKER_ENVIRONMENT !== "INVALID";
  state.PRODUCTION_CONTEXT = identityReady ? "VERIFIED" :
    ["PUBLISHED_PROCESS", "PINNED_BINDINGS", "APP_IDENTITY"].some(key => state[key] === "MISSING") ? "MISSING" : "INVALID";

  for (const [name, key, length] of [
    ["SESSION", "BQ_MANAGED_SESSION_KEY", 96],
    ["BACKUP", "BQ_MANAGED_BACKUP_KEY", 64],
    ["AUDIT", "BQ_MINIMAL_AUDIT_KEY", 64]
  ]) {
    state[name + "_KEY_PRESENT"] = present(env[key]) ? "VERIFIED" : "MISSING";
    state[name + "_KEY_FORMAT"] = !present(env[key]) ? "NOT_EXECUTED" :
      new RegExp("^[a-f0-9]{" + length + "}$").test(env[key]) ? "VERIFIED" : "INVALID";
  }
  const secretsReady = ["SESSION", "BACKUP", "AUDIT"].every(name => valid(state[name + "_KEY_FORMAT"]));
  state.PRODUCTION_SECRETS = secretsReady ? "VERIFIED" :
    ["SESSION", "BACKUP", "AUDIT"].some(name => state[name + "_KEY_PRESENT"] === "MISSING") ? "MISSING" : "INVALID";
  // This is observed presence/format, never original-key equality or approval.

  let endpoint;
  state.ENDPOINT_PRESENT = present(env.DATABASE_URL) ? "VERIFIED" : "MISSING";
  if (valid(state.ENDPOINT_PRESENT)) {
    let url;
    try { url = new URL(env.DATABASE_URL); } catch {}
    state.ENDPOINT_SYNTAX = url && ["postgres:", "postgresql:"].includes(url.protocol) &&
      !!url.hostname && !!url.pathname.slice(1) ? "VERIFIED" : "INVALID";
    if (valid(state.ENDPOINT_SYNTAX)) {
      state.ENDPOINT_DESTINATION = ["helium", "localhost", "127.0.0.1", "::1", "[::1]"]
        .includes(url.hostname) ? "INVALID" : "VERIFIED";
      state.ENDPOINT_ALLOWED_OPTIONS = [...url.searchParams.keys()]
        .every(key => ["sslmode", "channel_binding"].includes(key)) ? "VERIFIED" : "INVALID";
      state.ENDPOINT_TLS_POLICY = ["disable", "no-verify", "allow", "prefer"]
        .includes(url.searchParams.get("sslmode")) ? "INVALID" : "VERIFIED";
      if (["ENDPOINT_DESTINATION", "ENDPOINT_ALLOWED_OPTIONS", "ENDPOINT_TLS_POLICY"]
        .every(key => valid(state[key]))) {
        // Pinned validator remains authoritative. No normalization/fallback.
        try { endpoint = cfg.endpoint(env, "production"); } catch {
          state.ENDPOINT_SYNTAX = "INVALID";
        }
      }
    }
  }
  if (endpoint) state.ENDPOINT_NOT_DEVELOPMENT = !present(b.developmentEndpointFingerprint) ? "MISSING" :
    !hex.test(b.developmentEndpointFingerprint) ? "INVALID" :
    !valid(state.APP_IDENTITY) ? "NOT_EXECUTED" :
    endpoint.identity === b.developmentEndpointFingerprint ? "INVALID" : "VERIFIED";
  const endpointReady = !!endpoint && valid(state.ENDPOINT_NOT_DEVELOPMENT);

  const bucketFields = ["sourceBucket", "targetBucket", "sourceBucketFingerprint", "targetBucketFingerprint"];
  state.BUCKET_BINDING = bucketFields.some(key => !present(b[key])) ? "MISSING" :
    b.sourceBucketFingerprint === "ce11c603901c2550295d04cf9a5898200348ff8d29086744a88ee73d8f8716ec" &&
    b.targetBucketFingerprint === "71b5a307f0aa650bee9a8a4359d5caa2841eb5717f590e983100951fca2dd6b2" &&
    cfg.sha(b.sourceBucket) === b.sourceBucketFingerprint &&
    cfg.sha(b.targetBucket) === b.targetBucketFingerprint &&
    b.sourceBucket !== b.targetBucket ? "VERIFIED" : "INVALID";
  state.CONTROL_BUCKET_CONFIRMATION = b.targetNameConfirmedByOperator === undefined ? "MISSING" :
    b.targetNameConfirmedByOperator === true ? "VERIFIED" : "INVALID";
  state.SCHEMA_BINDING = !present(b.schemaFingerprint) ? "MISSING" : hex.test(b.schemaFingerprint) ? "VERIFIED" : "INVALID";
  return { identityReady, secretsReady, endpointReady, endpoint,
    bucketsReady: valid(state.BUCKET_BINDING) && valid(state.CONTROL_BUCKET_CONFIRMATION),
    schemaReady: valid(state.SCHEMA_BINDING) };
}
module.exports = { assess };
