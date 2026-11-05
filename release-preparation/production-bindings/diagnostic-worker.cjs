// Keep module loading, crypto and database/storage I/O off the HTTP event loop.
// The worker inherits the protected runtime environment; no key is serialized
// into a message or written to disk. Only projected statuses cross back.
const { Worker, isMainThread, parentPort } = require("node:worker_threads");
const { statuses } = require("./status.cjs");
function runCheck({ env = process.env, WorkerClass = Worker } = {}) {
  return new Promise(resolve => {
    const worker = new WorkerClass(__filename, { env, stdout: true, stderr: true });
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
    worker.once("error", () => finish({}));
    worker.once("exit", () => finish({}));
    worker.unref();
  });
}
module.exports = { runCheck };
if (!isMainThread) {
  Promise.resolve().then(() => {
    const path = require("node:path"), fs = require("node:fs");
    const bindings = JSON.parse(fs.readFileSync(path.join(__dirname, "bindings.pending.json"), "utf8"));
    return require("./verify.cjs").verify({ bindings });
  }).then(result => parentPort.postMessage(statuses(result)))
    .catch(error => parentPort.postMessage(statuses(error?.statuses)));
}
