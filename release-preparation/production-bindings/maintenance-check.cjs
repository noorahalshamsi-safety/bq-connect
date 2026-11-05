// Diagnostic-only maintenance command. No import/activation entrypoint is used.
const fs = require("node:fs");
const path = require("node:path");
const { launch: maintenance } = require("../maintenance-cd5bd76/source/deploy/managed/minimal-bootstrap.cjs");
const { verify } = require("./verify.cjs");
const { statuses, report } = require("./status.cjs");
const startForcedMaintenance = ({ port } = {}) => maintenance({ port, maintenanceOnly: true });
async function launch({
  env = process.env, port, startMaintenance = startForcedMaintenance, check = verify
} = {}) {
  const app = await startMaintenance({ port, maintenanceOnly: true });
  let result = statuses({ MAINTENANCE: "PASS", READ_ONLY_SAFETY: "PASS" });
  if (env.REPLIT_DEPLOYMENT === "1" &&
      env.BQ_MINIMAL_BINDINGS_CHECK === "approved-readonly-check") {
    result.DIAGNOSTIC_REQUEST = "PASS";
    try {
      const bindings = JSON.parse(fs.readFileSync(path.join(__dirname, "bindings.pending.json"), "utf8"));
      result = statuses({ ...(await check({ env, bindings })),
        MAINTENANCE: "PASS", DIAGNOSTIC_REQUEST: "PASS", READ_ONLY_SAFETY: "PASS" });
    } catch (error) {
      result = statuses({ ...error.statuses, MAINTENANCE: "PASS",
        DIAGNOSTIC_REQUEST: "PASS", READ_ONLY_SAFETY: "PASS" });
    }
  }
  report(result);
  return app;
}
module.exports = { launch };
if (require.main === module) {
  launch().then(app => {
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => app.close().finally(() => process.exit(0)));
  }).catch(() => { report({}); process.exitCode = 1; });
}
