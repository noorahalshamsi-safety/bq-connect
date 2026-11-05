// Synthetic signatures and dependency spies only. Never accesses a real key,
// database, source bucket, Production process or account.
const assert = require("node:assert/strict"), fs = require("node:fs");
const path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const A = require("../../release-preparation/production-release/attestation.cjs");
const R = require("../../release-preparation/production-release/runner.cjs");
const cfg = require("../../release-preparation/maintenance-cd5bd76/source/deploy/managed/config.cjs");
const clone = v => JSON.parse(JSON.stringify(v)), hash = v => cfg.sha(v);
const nonce = "synthetic-nonce", now = 1000000;
const bindings = { appFingerprint: hash("workspace"), sourceBucket: "synthetic-source",
  targetBucket: "synthetic-target", sourceBucketFingerprint: hash("synthetic-source"),
  targetBucketFingerprint: hash("synthetic-target"), schemaFingerprint: hash("schema"),
  developmentEndpointFingerprint: hash("development") };
const observed = { bindings, claims: { nonce, parentAppFingerprint: bindings.appFingerprint,
  runtimeAppFingerprint: hash("different-production"), bindingHash: hash("file"),
  artifactDigest: hash("artifact"), endpointFingerprint: hash("production-endpoint") } };
const manifest = { kind: "BQ_REPLIT_MANAGED_V1", environment: "production", appFingerprint: observed.claims.runtimeAppFingerprint,
  endpointFingerprint: observed.claims.endpointFingerprint, bucket: bindings.targetBucket,
  productionBucketFingerprint: bindings.targetBucketFingerprint, schemaFingerprint: bindings.schemaFingerprint,
  developmentEndpointFingerprint: bindings.developmentEndpointFingerprint,
  permissionApproval: "reviewed-managed-runtime-capabilities", permissionsFingerprint: hash("permissions"),
  minimal: { employees: 6311, accounts: 8, policy: "employees-accounts-only-v1",
    sourceBucket: bindings.sourceBucket, sourceBucketFingerprint: bindings.sourceBucketFingerprint,
    freezeEvidence: hash("all-writers-frozen") } };
const privateKeys = {};
const trust = { kind: "BQ_PRODUCTION_TRUST_V1", productionUrlFingerprint: hash("approved-url"),
  parentAppFingerprint: bindings.appFingerprint,
  keys: ["deployment", "workload", "owner"].map(role => {
    const key = crypto.generateKeyPairSync("ed25519"); privateKeys[role] = key.privateKey;
    return { id: role, role, algorithm: "Ed25519",
      publicKey: key.publicKey.export({ type: "spki", format: "pem" }) };
  }) };
function request(operation = "preflight", mutate = () => {}) {
  const p = { kind: "BQ_PRODUCTION_ATTESTATION_V1", audience: "bq-production-release-v1",
    ...observed.claims, productionUrlFingerprint: trust.productionUrlFingerprint,
    deploymentFingerprint: hash("deployment"), environment: "production",
    operation, manifestHash: hash(cfg.canonical(manifest)), issuedAt: now, expiresAt: now + 60000,
    sourceWritersFrozen: "confirmed-all-writers", freezeEvidence: manifest.minimal.freezeEvidence };
  const r = { operation, manifest: clone(manifest) };
  for (const role of ["deployment", "workload", "owner"]) {
    const payload = clone(p); mutate(payload, role);
    r[role] = { keyId: role, payload,
      signature: crypto.sign(null, Buffer.from(cfg.canonical(payload)), privateKeys[role]).toString("base64") };
  }
  return r;
}
function check(r, extra = {}) { return A.verify({ nonce, request: r, trust, observed, now, ...extra }); }
async function main() {
  assert.equal(check(request()).appFingerprint, observed.claims.runtimeAppFingerprint);
  assert.equal(bindings.appFingerprint, hash("workspace"));
  const mutations = [
    p => { p.nonce = "replayed"; }, p => { p.artifactDigest = hash("old-artifact"); },
    p => { p.bindingHash = hash("other-binding"); }, p => { p.parentAppFingerprint = hash("other-project"); },
    p => { p.runtimeAppFingerprint = hash("workspace"); }, p => { p.endpointFingerprint = hash("other-db"); },
    p => { p.productionUrlFingerprint = hash("other-url"); }, p => { p.audience = "development"; },
    p => { p.environment = "development"; }, p => { p.operation = "import"; },
    p => { p.expiresAt = now - 1; }, p => { p.issuedAt = now + 60000; },
    p => { p.expiresAt = now + 900001; }, p => { p.manifestHash = hash("other-manifest"); },
    (p, role) => { if (role === "workload") p.deploymentFingerprint = hash("other-deployment"); }
  ];
  for (const mutation of mutations) assert.throws(() => check(request("preflight", mutation)));
  const tampered = request(); tampered.owner.payload.nonce = "tampered";
  assert.throws(() => check(tampered));
  assert.throws(() => check(request(), { trust: { ...trust, keys: [] } }));
  assert.throws(() => check(request(), { trust: { ...trust, productionUrlFingerprint: null } }));
  assert.throws(() => check(request(), { trust: { ...trust, parentAppFingerprint: hash("other-project") } }));
  const aliasTrust = clone(trust), aliasRequest = request();
  aliasTrust.keys.find(k => k.role === "owner").publicKey = aliasTrust.keys.find(k => k.role === "workload").publicKey;
  aliasRequest.owner.signature = crypto.sign(null, Buffer.from(cfg.canonical(aliasRequest.owner.payload)),
    privateKeys.workload).toString("base64");
  assert.throws(() => check(aliasRequest, { trust: aliasTrust }));
  const noWorkload = request(); delete noWorkload.workload; assert.throws(() => check(noWorkload));
  assert.throws(() => check(request("import", (p, role) => {
    if (role === "owner") p.sourceWritersFrozen = "unconfirmed";
  })));
  assert.throws(() => check(request(), { observed: { ...observed,
    bindings: { ...bindings, sourceBucket: "different-source" } } }));
  assert.equal(check(request("import")).appFingerprint, observed.claims.runtimeAppFingerprint);
  assert.equal(check(request("activate")).appFingerprint, observed.claims.runtimeAppFingerprint);
  const unsigned = request(); unsigned.operation = "activate"; assert.throws(() => check(unsigned));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bq-release-check-"));
  fs.chmodSync(dir, 0o700);
  function write(name, value) { fs.writeFileSync(path.join(dir, name), JSON.stringify(value), { mode: 0o600 }); }
  try {
    write("production-approvals.json", { approvals: [] }); write("approvals.json", { approvals: [] });
    write("request.json", request());
    const mode = fs.statSync(path.join(dir, "request.json")).mode;
    fs.chmodSync(path.join(dir, "request.json"), 0o644);
    assert.throws(() => A.readProtected(dir, "request.json"));
    fs.chmodSync(path.join(dir, "request.json"), mode);
    fs.symlinkSync(path.join(dir, "request.json"), path.join(dir, "symlink.json"));
    assert.throws(() => A.readProtected(dir, "symlink.json"));
    fs.linkSync(path.join(dir, "request.json"), path.join(dir, "hardlink.json"));
    assert.throws(() => A.readProtected(dir, "request.json"));
    fs.unlinkSync(path.join(dir, "hardlink.json"));
    let imports = 0, activations = 0, reads = 0;
    const ready = Object.fromEntries(["PRODUCTION_SECRETS", "ORIGINAL_KEY_MATCH", "CONTROL_BUCKET",
      "PRODUCTION_DATABASE", "DATABASE_TLS", "PERMISSION_REVIEW", "SOURCE_READ"].map(k => [k, "VERIFIED"]));
    const options = { env: {}, nonce, directory: dir, trust,
      verifyEvidence: ({ request: r }) => check(r),
      preflight: async () => { reads++; return ready; },
      importRecords: async () => { imports++; return { employees: 6311, accounts: 8 }; },
      activate: async () => { activations++; return {}; } };
    await R.operation({ ...options, request: request() });
    assert.equal(imports, 0); assert.equal(activations, 0);
    await R.operation({ ...options, request: request("import") });
    assert.equal(imports, 1); assert.equal(activations, 0);
    await R.operation({ ...options, request: request("activate") });
    assert.equal(activations, 1); assert.equal(reads, 2); // No empty-target preflight after import.
    await assert.rejects(R.operation({ ...options, request: request("import"),
      preflight: async () => ({ ...ready, ORIGINAL_KEY_MATCH: "INVALID" }) }));
    assert.equal(imports, 1);
    await assert.rejects(R.operation({ ...options, request: request(),
      verifyEvidence: () => { throw Error("blocked"); } }));
    assert.equal(reads, 2);
    for (const field of Object.keys(ready)) await assert.rejects(
      R.operation({ ...options, request: request("import"),
        preflight: async () => ({ ...ready, [field]: "NOT_EXECUTED" }) }));
    assert.equal(imports, 1);
    const reconciliation = require("../../release-preparation/production-release/reconciliation.cjs");
    const proof = { dataset: "synthetic-dataset", seal: hash("seal"), endpointFingerprint: hash("endpoint") };
    const m = { ...manifest, keys: { session: hash("session"), backup: hash("backup") },
      minimal: { ...manifest.minimal, sourceFingerprint: hash("source"),
        membership: { employees: hash("employees"), accounts: hash("accounts") } } };
    const binding = hash(cfg.canonical({ dataset: proof.dataset, seal: proof.seal,
      source: m.minimal.sourceFingerprint, endpoint: proof.endpointFingerprint }));
    const receipt = { dataset: proof.dataset, seal: proof.seal, state: "committed",
      minimalSource: m.minimal.sourceFingerprint, binding };
    const intent = { dataset: proof.dataset, seal: proof.seal, binding };
    reconciliation.receipt({ proof, manifest: m, receipt, intent });
    for (const field of Object.keys(receipt)) assert.throws(() => reconciliation.receipt({
      proof, manifest: m, intent, receipt: { ...receipt, [field]: "different" } }));
    assert.throws(() => reconciliation.receipt({ proof, manifest: m, intent: null, receipt }));
    const marker = { sourceFingerprint: m.minimal.sourceFingerprint, dataset: proof.dataset, seal: proof.seal,
      counts: { employees: 6311, accounts: 8 }, originalKeys: m.keys,
      sourceBucketFingerprint: m.minimal.sourceBucketFingerprint, membership: m.minimal.membership };
    reconciliation.marker({ proof, manifest: m, marker });
    for (const field of ["sourceFingerprint", "dataset", "seal", "sourceBucketFingerprint",
      "counts", "originalKeys", "membership"]) assert.throws(() => reconciliation.marker({
      proof, manifest: m, marker: { ...marker, [field]: null } }));
    // Real legacy guards cannot be authorized by a manifest alone.
    await assert.rejects(require("../../release-preparation/production-release/import.cjs")
      .execute({ env: { REPLIT_DEPLOYMENT: "0" }, manifest, approvalRoot: dir }));
    await assert.rejects(require("../../release-preparation/production-release/runtime.cjs")
      .start({ env: { REPLIT_DEPLOYMENT: "0" }, manifest, approvalRoot: dir }));
    const app = await R.launch({ env: {}, port: 0 });
    const url = `http://127.0.0.1:${app.server.address().port}`;
    try {
      assert.equal((await fetch(url + "/")).status, 200);
      assert.equal((await fetch(url + "/health/ready")).status, 503);
      assert.equal((await fetch(url + "/", { method: "POST" })).status, 503);
      assert.equal(await app.trigger(), false);
      assert.equal((await fetch(url + "/")).status, 200);
      assert.equal((await (await fetch(url + "/health/ready")).json()).ready, false);
    } finally { await app.close(); }
    // Public listener stays in maintenance while activation is pending/failing,
    // then switches only after the verified runtime has actually listened.
    const http = require("node:http");
    let finish, shouldStart = false;
    const gate = await R.launch({ env: {}, port: 0, directory: dir, perform: async () => {
      if (!shouldStart) await new Promise((_, reject) => { finish = reject; });
      const server = http.createServer((req, res) => { res.end("synthetic-sql-active"); });
      await new Promise(resolve => server.listen(Number(process.env.PORT), "127.0.0.1", resolve));
      return { activated: true, runtime: { server,
        close: () => new Promise(resolve => server.close(resolve)) } };
    } });
    const gateUrl = `http://127.0.0.1:${gate.server.address().port}`;
    try {
      const pending = gate.trigger();
      while (!finish) await new Promise(resolve => setImmediate(resolve));
      assert.equal((await (await fetch(gateUrl)).json()).ready, false);
      finish(Error("synthetic-reconciliation-failure")); assert.equal(await pending, false);
      assert.equal((await fetch(gateUrl + "/health/ready")).status, 503);
      shouldStart = true; assert.equal(await gate.trigger(), true);
      assert.equal(await (await fetch(gateUrl)).text(), "synthetic-sql-active");
      assert.equal(await gate.trigger(), false);
    } finally { await gate.close(); }
    assert.match(A.artifactDigest(), /^[a-f0-9]{64}$/);
    assert.equal(require("../../release-preparation/production-release/trust.json").keys.length, 0);
    console.log(JSON.stringify({ result: "PASS", signatureMutationCases: mutations.length,
      custody: "PASS", separateOperations: "PASS", originalGuards: "PASS",
      maintenanceOnFailure: "PASS", reconciliation: "PASS", activationGateway: "PASS",
      realProductionAccess: false }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
main().catch(() => { console.error('{"result":"BLOCKED","testFailure":true}'); process.exitCode = 1; });
