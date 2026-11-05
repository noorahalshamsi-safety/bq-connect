// Normal startup only adopts an already reconciled fresh installation.
// It NEVER calls initialize(), even if the database appears empty.
const path = require("node:path"), { base } = require("./config.cjs");
const { launch } = require(path.join(base, "deploy/managed/minimal-bootstrap.cjs"));
const { start } = require("./runtime.cjs");
if (require.main === module) launch({ port: Number(process.env.PORT) || 4173, startRuntime: start }).then(app => {
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => app.close().finally(() => process.exit(0)));
}).catch(() => { console.error('{"FRESH_RUNTIME":"BLOCKED"}'); process.exitCode = 1; });
