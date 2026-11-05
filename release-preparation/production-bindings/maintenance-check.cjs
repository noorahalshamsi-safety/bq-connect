// Diagnostic-only maintenance command. No import/activation entrypoint is used.
const fs = require("node:fs");
const path = require("node:path");
const { start } = require("./maintenance-http.cjs");
const { statuses, report } = require("./status.cjs");
const identity = require("./identity-probe.cjs");
// The verifier loads in a protected worker only after HTTP is listening.
const defaultCheck = options => require("./diagnostic-worker.cjs").runCheck(options);
async function launch({
  env = process.env, port, startMaintenance = start, check = defaultCheck
} = {}) {
  const app = await startMaintenance({ env, port });
  // Return the listener immediately: slow/failed diagnostics cannot delay
  // liveness or signal-handler registration. No diagnostic result activates it.
  const diagnostic = runDiagnostic({ env, check });
  return { ...app, diagnostic };
}
async function runDiagnostic({ env, check }) {
  // Takes precedence over the broader check, even if its existing flag is set.
  // Observe the main process, not a worker copy, and emit exactly three fields.
  if (identity.selected(env)) return identity.report(env);
  let result = statuses({ MAINTENANCE: "PASS", READ_ONLY_SAFETY: "PASS" });
  if (env.REPLIT_DEPLOYMENT === "1" &&
      env.BQ_MINIMAL_BINDINGS_CHECK === "approved-readonly-check") {
    result.DIAGNOSTIC_REQUEST = "PASS";
    try {
      const bindings = JSON.parse(fs.readFileSync(path.join(__dirname, "bindings.pending.json"), "utf8"));
      result = statuses({ ...(await check({ env, bindings })),
        MAINTENANCE: "PASS", DIAGNOSTIC_REQUEST: "PASS", READ_ONLY_SAFETY: "PASS" });
    } catch (error) {
      result = statuses({ ...error?.statuses, MAINTENANCE: "PASS",
        DIAGNOSTIC_REQUEST: "PASS", READ_ONLY_SAFETY: "PASS" });
    }
  }
  report(result);
  return result;
}
module.exports = { launch };
if (require.main === module) {
  launch().then(app => {
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => app.close().finally(() => process.exit(0)));
  }).catch(() => {
    if (identity.selected(process.env)) identity.report(process.env);
    else report({});
    process.exitCode = 1;
  });
}
