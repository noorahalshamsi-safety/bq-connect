// Integrated candidate only. No public mutation endpoint. No trusted issuers
// shipped. A protected operator signal cannot bypass any evidence/approval gate.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const crypto = require("node:crypto");
const A = require("./attestation.cjs");
const { resolvePort } = require("../production-bindings/maintenance-http.cjs");
const requiredPreflight = ["PRODUCTION_SECRETS", "ORIGINAL_KEY_MATCH", "CONTROL_BUCKET",
  "PRODUCTION_DATABASE", "DATABASE_TLS", "PERMISSION_REVIEW", "SOURCE_READ"];
function pass(result) {
  if (!requiredPreflight.every(k => result[k] === "VERIFIED")) throw Error("release_blocked");
}
async function operation({ env, nonce, directory, request, trust,
  verifyEvidence = A.verify,
  preflight = options => require("../production-bindings/verify.cjs").verify(options),
  importRecords = options => require("./import.cjs").execute(options),
  activate = options => require("./runtime.cjs").start(options) }) {
  const bindings = verifyEvidence({ env, nonce, request, trust });
  if (request.operation !== "activate") {
    pass(await preflight({ env, bindings }));
    if (request.operation === "preflight") return { activated: false };
  }
  // Preserve the pinned manifest approval and separate minimal-import approval.
  A.readProtected(directory, "production-approvals.json");
  if (request.operation === "import") {
    A.readProtected(directory, "approvals.json");
    const counts = await importRecords({ env, manifest: request.manifest, approvalRoot: directory });
    if (counts.employees !== 6311 || counts.accounts !== 8) throw Error("release_blocked");
    return { activated: false };
  }
  if (request.operation !== "activate") throw Error("release_blocked");
  return { activated: true, runtime: await activate({ env, manifest: request.manifest, approvalRoot: directory }) };
}
async function launch({ env = process.env, port, perform = operation, directory = env.BQ_RELEASE_CONTROL_DIR } = {}) {
  let nonce = crypto.randomBytes(32).toString("hex"), busy = false, runtime = null, backend;
  const body = JSON.stringify({ status: "maintenance", live: true, ready: false, error: "migration_not_activated" });
  const server = http.createServer((req, res) => {
    if (backend) {
      const upstream = http.request({ hostname: "127.0.0.1", port: backend,
        path: req.url, method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      upstream.on("error", () => { if (!res.headersSent) res.writeHead(503); res.end(); });
      req.pipe(upstream); return;
    }
    const live = ["GET", "HEAD"].includes(req.method) && ["/", "/health/live"].includes((req.url || "").split("?")[0]);
    res.writeHead(live ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject); server.listen(resolvePort(env, port), "0.0.0.0", resolve);
  });
  function challenge() {
    if (!directory) return;
    try {
      // Validate custody before writing any protected observations.
      const trust = JSON.parse(fs.readFileSync(path.join(__dirname, "trust.json"), "utf8"));
      // readProtected checks the directory and an operator-provisioned sentinel.
      const custody = A.readProtected(directory, "custody.json");
      if (custody.kind !== "BQ_PRODUCTION_OPERATOR_CUSTODY_V1") throw Error("release_blocked");
      const observed = A.observation(env, nonce);
      const filename = path.join(directory, "challenge.json");
      const fd = fs.openSync(filename, fs.constants.O_WRONLY | fs.constants.O_CREAT |
        fs.constants.O_NOFOLLOW, 0o600);
      try {
        const stat = fs.fstatSync(fd);
        if (stat.uid !== process.getuid() || stat.nlink !== 1 ||
            (stat.mode & 0o077) !== 0 || !stat.isFile()) throw Error("release_blocked");
        fs.ftruncateSync(fd, 0);
        fs.writeFileSync(fd, JSON.stringify({ kind: "BQ_PRODUCTION_CHALLENGE_V1",
          pid: process.pid, ...observed.claims, productionUrlFingerprint: trust.productionUrlFingerprint }));
      } finally { fs.closeSync(fd); }
    } catch { console.log('{"RELEASE_CHALLENGE":"BLOCKED","MODE":"MAINTENANCE"}'); }
  }
  challenge();
  async function trigger() {
    if (busy || runtime) return false;
    busy = true;
    const savedPort = process.env.PORT, savedHost = process.env.HOST;
    try {
      const request = A.readProtected(directory, "request.json");
      const trust = JSON.parse(fs.readFileSync(path.join(__dirname, "trust.json"), "utf8"));
      // Reserve an internal port, never remove the public maintenance listener.
      const socket = http.createServer();
      await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
      const internal = socket.address().port;
      await new Promise(resolve => socket.close(resolve));
      process.env.PORT = String(internal); process.env.HOST = "127.0.0.1";
      const result = await perform({ env, nonce, directory, request, trust });
      if (result.activated) {
        if (!result.runtime?.server?.listening ||
            result.runtime.server.address().port !== internal ||
            !["127.0.0.1", "::1"].includes(result.runtime.server.address().address)) {
          await result.runtime?.close(); throw Error("release_blocked");
        }
        runtime = result.runtime; backend = internal;
      }
      console.log(JSON.stringify({ RELEASE_OPERATION: "PASS", MODE: runtime ? "SQL_ACTIVE" : "MAINTENANCE" }));
      return true;
    } catch {
      console.log('{"RELEASE_OPERATION":"BLOCKED","MODE":"MAINTENANCE"}');
      return false;
    } finally {
      if (!runtime) {
        if (savedPort === undefined) delete process.env.PORT; else process.env.PORT = savedPort;
        if (savedHost === undefined) delete process.env.HOST; else process.env.HOST = savedHost;
        nonce = crypto.randomBytes(32).toString("hex"); challenge();
      }
      busy = false;
    }
  }
  return { server, trigger, close: async () => {
    await new Promise(resolve => server.close(resolve)); await runtime?.close();
  } };
}
module.exports = { launch, operation, pass };
if (require.main === module) launch().then(app => {
  process.on("SIGUSR2", () => { void app.trigger(); });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    app.close().finally(() => process.exit(0));
  });
}).catch(() => { console.log('{"RELEASE_START":"BLOCKED"}'); process.exitCode = 1; });
