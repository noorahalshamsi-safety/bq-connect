// Keep module loading, crypto and database/storage I/O off the HTTP event loop.
// The worker inherits the protected runtime environment; no key is serialized
// into a message or written to disk. Only projected statuses cross back.
const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads");
const { createHash } = require("node:crypto");
const { statuses } = require("./status.cjs");
const environmentNames = ["REPL_ID", "REPLIT_DEPLOYMENT", "DATABASE_URL",
  "BQ_MANAGED_SESSION_KEY", "BQ_MANAGED_BACKUP_KEY", "BQ_MINIMAL_AUDIT_KEY"];
function environmentProof(env) {
  return Object.fromEntries(environmentNames.map(name => [name,
    typeof env[name] === "string" ? createHash("sha256").update(env[name]).digest("hex") : null]));
}
function runCheck({ env = process.env, WorkerClass = Worker } = {}) {
  return new Promise(resolve => {
    const worker = new WorkerClass(__filename, { env, stdout: true, stderr: true,
      workerData: { environmentProof: environmentProof(env) } });
    // Never forward dependency output or exception messages to deployment logs.
    worker.stdout.resume();
    worker.stderr.resume();
    let finished = false;
    function finish(result) {
      if (finished) return;
      finished = true;
      resolve(statuses(result));
      Promise.resolve(worker.terminate()).catch(() => {});
    }
    worker.once("message", result => finish({ ...statuses(result), DIAGNOSTIC_WORKER: "PASS" }));
    worker.once("error", () => finish({ DIAGNOSTIC_WORKER: "INVALID" }));
    worker.once("exit", () => finish({ DIAGNOSTIC_WORKER: "INVALID" }));
    worker.unref();
  });
}
module.exports = { runCheck, environmentProof };
if (!isMainThread) {
  Promise.resolve().then(() => {
    const path = require("node:path"), fs = require("node:fs");
    const bindings = JSON.parse(fs.readFileSync(path.join(__dirname, "bindings.pending.json"), "utf8"));
    const inherited = environmentProof(process.env);
    const workerEnvironmentVerified = environmentNames.every(
      name => workerData?.environmentProof?.[name] === inherited[name]);
    return require("./verify.cjs").verify({ bindings, workerEnvironmentVerified });
  }).then(result => parentPort.postMessage(statuses(result)))
    .catch(error => parentPort.postMessage(statuses(error?.statuses)));
}
