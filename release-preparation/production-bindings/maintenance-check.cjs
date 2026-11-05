// OPTIONAL FUTURE operator-approved publish command. Keeps the same forced
// maintenance listener up while a single protected, read-only check runs.
// Not selected in .replit and never imports or activates the main application.
const fs = require("node:fs");
const path = require("node:path");
const { run } = require("../../deploy/managed/minimal-import-runner.cjs");
const { verify } = require("./verify.cjs");
async function launch({ env = process.env, port, startMaintenance = run, check = verify } = {}) {
  const app = await startMaintenance({ port });
  if (env.REPLIT_DEPLOYMENT === "1" &&
      env.BQ_MINIMAL_BINDINGS_CHECK === "approved-readonly-check") {
    try {
      const bindings = JSON.parse(fs.readFileSync(path.join(__dirname, "bindings.pending.json"), "utf8"));
      const result = await check({ env, bindings });
      console.log(JSON.stringify({ mode: "maintenance", protectedBindingsCheck: result }));
    } catch (error) {
      console.error(JSON.stringify({ mode: "maintenance", ready: false,
        error: /^(preflight_|managed_|minimal_)[a-z0-9_]+$/.test(error.code || "")
          ? error.code : "preflight_verification_failed",
        executionAuthorized: false }));
    }
  } else {
    console.log(JSON.stringify({ mode: "maintenance", protectedBindingsCheckRequested: false }));
  }
  return app;
}
module.exports = { launch };
if (require.main === module) {
  launch().then(app => {
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => app.close().finally(() => process.exit(0)));
  }).catch(() => { console.error("preflight_maintenance_listener_failed"); process.exitCode = 1; });
}
