// Value-free observations only. No worker, database, SDK, source keys or APIs.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
function probe(env, expectedFingerprint) {
  const id = env.REPL_ID, deployment = env.REPLIT_DEPLOYMENT;
  const idPresent = typeof id === "string" && id.length > 0;
  const deploymentPresent = typeof deployment === "string" && deployment.length > 0;
  // Never present a workspace comparison as Production-process evidence.
  const canCompare = deployment === "1" && idPresent &&
    typeof expectedFingerprint === "string" && /^[a-f0-9]{64}$/.test(expectedFingerprint);
  return {
    REPL_ID_PRESENT: idPresent ? "YES" : "NO",
    REPL_ID_FINGERPRINT_MATCH: !canCompare ? "NOT_EXECUTED" :
      crypto.createHash("sha256").update(id).digest("hex") === expectedFingerprint ? "YES" : "NO",
    REPLIT_DEPLOYMENT_PRESENT: deploymentPresent ? "YES" : "NO"
  };
}
function diagnostic(env = process.env) {
  let fingerprint;
  try {
    const bindings = JSON.parse(fs.readFileSync(path.join(__dirname, "bindings.pending.json"), "utf8"));
    if (bindings.kind === "BQ_PENDING_PRODUCTION_BINDINGS_V1" &&
        bindings.implementationCommit === "cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9")
      fingerprint = bindings.appFingerprint;
  } catch {} // Missing/invalid binding means comparison NOT_EXECUTED, not mismatch.
  return probe(env, fingerprint);
}
function selected(env) {
  return env.BQ_MINIMAL_IDENTITY_CHECK === "approved-readonly-identity";
}
function report(env) {
  const result = diagnostic(env);
  console.log(JSON.stringify(result));
  return result;
}
module.exports = { probe, diagnostic, selected, report };
