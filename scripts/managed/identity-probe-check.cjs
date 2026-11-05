// Synthetic inputs only; no actual Production process, IDs or secrets queried.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const { Worker } = require("node:worker_threads");
const { spawnSync } = require("node:child_process");
const { probe } = require("../../release-preparation/production-bindings/identity-probe.cjs");
const { launch } = require("../../release-preparation/production-bindings/maintenance-check.cjs");
const sample = "synthetic-test-app";
const expected = crypto.createHash("sha256").update(sample).digest("hex");
function exact(result) {
  assert.deepEqual(Object.keys(result), [
    "REPL_ID_PRESENT", "REPL_ID_FINGERPRINT_MATCH", "REPLIT_DEPLOYMENT_PRESENT"
  ]);
  assert.ok(["YES", "NO"].includes(result.REPL_ID_PRESENT));
  assert.ok(["YES", "NO", "NOT_EXECUTED"].includes(result.REPL_ID_FINGERPRINT_MATCH));
  assert.ok(["YES", "NO"].includes(result.REPLIT_DEPLOYMENT_PRESENT));
  assert.ok(!JSON.stringify(result).includes(sample));
  assert.ok(!JSON.stringify(result).includes(expected));
}
function response(port, url) {
  return new Promise((resolve, reject) => http.get({
    hostname: "127.0.0.1", port, path: url, agent: false
  }, res => {
    let body = ""; res.on("data", chunk => { body += chunk; });
    res.on("end", () => resolve({ code: res.statusCode, body: JSON.parse(body) }));
  }).on("error", reject));
}
(async () => {
  const cases = [
    [{ REPL_ID: sample, REPLIT_DEPLOYMENT: "1" }, expected, ["YES", "YES", "YES"]],
    [{ REPL_ID: "different-synthetic-app", REPLIT_DEPLOYMENT: "1" }, expected, ["YES", "NO", "YES"]],
    [{ REPLIT_DEPLOYMENT: "1" }, expected, ["NO", "NOT_EXECUTED", "YES"]],
    [{ REPL_ID: "", REPLIT_DEPLOYMENT: "1" }, expected, ["NO", "NOT_EXECUTED", "YES"]],
    [{ REPL_ID: sample }, expected, ["YES", "NOT_EXECUTED", "NO"]],
    [{ REPL_ID: sample, REPLIT_DEPLOYMENT: "0" }, expected, ["YES", "NOT_EXECUTED", "YES"]],
    [{ REPL_ID: sample, REPLIT_DEPLOYMENT: "1" }, undefined, ["YES", "NOT_EXECUTED", "YES"]],
    [{ REPL_ID: sample, REPLIT_DEPLOYMENT: "1" }, "bad-binding", ["YES", "NOT_EXECUTED", "YES"]]
  ];
  for (const [env, fingerprint, values] of cases) {
    const result = probe(env, fingerprint); exact(result);
    assert.deepEqual(Object.values(result), values);
    // Confirm Node's explicit env option copies these values into a worker.
    // This does not claim anything about the actual deployed parent process.
    const actual = await new Promise((resolve, reject) => {
      const worker = new Worker(`
        const {parentPort,workerData}=require("node:worker_threads");
        parentPort.postMessage(require(workerData.module).probe(process.env,workerData.fingerprint));
      `, { eval: true, env, workerData: {
        module: require.resolve("../../release-preparation/production-bindings/identity-probe.cjs"),
        fingerprint
      } });
      worker.once("message", resolve); worker.once("error", reject);
    });
    assert.deepEqual(actual, result); exact(actual);
  }
  probe(new Proxy({ REPL_ID: sample, REPLIT_DEPLOYMENT: "1" }, {
    get(target, name) {
      assert.ok(["REPL_ID", "REPLIT_DEPLOYMENT"].includes(name));
      return target[name];
    }
  }), expected);
  const failedStartup = spawnSync(process.execPath, [
    require.resolve("../../release-preparation/production-bindings/maintenance-check.cjs")
  ], { encoding: "utf8", env: { PORT: "invalid", REPL_ID: sample,
    REPLIT_DEPLOYMENT: "1", BQ_MINIMAL_IDENTITY_CHECK: "approved-readonly-identity" } });
  assert.equal(failedStartup.status, 1);
  assert.equal(failedStartup.stderr.trim(), "");
  exact(JSON.parse(failedStartup.stdout));
  const lines = [], errors = [];
  const log = console.log, error = console.error;
  console.log = line => lines.push(line); console.error = line => errors.push(line);
  let app, called = 0;
  try {
    app = await launch({ port: 0, env: {
      REPL_ID: sample, REPLIT_DEPLOYMENT: "1",
      BQ_MINIMAL_BINDINGS_CHECK: "approved-readonly-check",
      BQ_MINIMAL_IDENTITY_CHECK: "approved-readonly-identity",
      BQ_MINIMAL_OPERATION: "owner-approved-import-once"
    }, check: async () => { called++; throw Error("broad verifier forbidden"); } });
    const result = await app.diagnostic; exact(result);
    assert.equal(called, 0);
    assert.equal(lines.length, 1); assert.equal(errors.length, 0);
    assert.deepEqual(JSON.parse(lines[0]), result);
    const port = app.server.address().port;
    const live = await response(port, "/");
    assert.equal(live.code, 200); assert.equal(live.body.ready, false);
    const ready = await response(port, "/health/ready");
    assert.equal(ready.code, 503); assert.equal(ready.body.ready, false);
    assert.equal((await response(port, "/api/login")).code, 503);
  } finally {
    console.log = log; console.error = error;
    if (app) await app.close();
  }
  console.log(JSON.stringify({ result: "PASS", cases: cases.length,
    workerCopy: "PASS", exactlyThreeFields: "PASS", noSecretReads: "PASS",
    broaderVerifierSkipped: "PASS", maintenanceHttp: "PASS",
    startupFailureOutput: "PASS", productionVerified: false }));
})().catch(error => {
  console.error("identity_probe_check_failed");
  console.error(String(error.stack || "").split("\n").filter(line => line.startsWith("    at ")).join("\n"));
  process.exitCode = 1;
});
