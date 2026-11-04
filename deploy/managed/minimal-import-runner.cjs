// FIRST MAINTENANCE DEPLOYMENT ONLY.
// The pinned release remains separate from the original application source.
// This entrypoint intentionally cannot request an import, even if a deployment
// accidentally supplies BQ_MINIMAL_OPERATION=owner-approved-import-once.
// Enabling migration/activation requires a separately reviewed configuration.
const path = require("node:path");
const pinnedRunner = path.resolve(__dirname,
  "../../release-preparation/maintenance-cd5bd76/source/deploy/managed/minimal-import-runner.cjs");

async function run({ port } = {}) {
  const runner = require(pinnedRunner);
  // The verified runner only imports when BOTH its explicit operation and
  // published marker are present in its supplied env. Neither is supplied here.
  // Its listener is permanently maintenanceOnly, so SQL runtime never starts.
  return runner.run({ port, env: Object.freeze({}) });
}

module.exports = { run };
if (require.main === module) {
  run().then(app => {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => app.close().finally(() => process.exit(0)));
    }
  }).catch(() => {
    console.error("minimal_maintenance_listener_failed");
    process.exitCode = 1;
  });
}
