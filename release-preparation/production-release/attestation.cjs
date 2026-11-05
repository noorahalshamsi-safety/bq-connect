// No issuer is trusted by default. Never mint evidence from workspace identity.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const cfg = require("../maintenance-cd5bd76/source/deploy/managed/config.cjs");
const hex = /^[a-f0-9]{64}$/;
function requireTrue(value) { if (!value) throw Error("release_blocked"); }
function readProtected(directory, name) {
  requireTrue(path.isAbsolute(directory) && fs.realpathSync(directory) === path.resolve(directory));
  const dir = fs.statSync(directory);
  requireTrue(dir.isDirectory() && (dir.mode & 0o077) === 0 && dir.uid === process.getuid());
  requireTrue(/^[a-z-]+\.json$/.test(name));
  const fd = fs.openSync(path.join(directory, name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    requireTrue(stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid() &&
      (stat.mode & 0o077) === 0 && stat.size <= 1048576);
    return JSON.parse(fs.readFileSync(fd, "utf8"));
  } finally { fs.closeSync(fd); }
}
function artifactDigest() {
  const entries = [];
  function walk(relative) {
    const full = path.join(root, relative), stat = fs.lstatSync(full);
    requireTrue(!stat.isSymbolicLink());
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) walk(path.join(relative, name));
    } else {
      requireTrue(stat.isFile());
      entries.push([relative, cfg.sha(fs.readFileSync(full))]);
    }
  }
  for (const relative of [".replit", "package.json", "package-lock.json",
    "release-preparation/production-bindings",
    "release-preparation/production-release",
    "release-preparation/maintenance-cd5bd76/source"]) walk(relative);
  return cfg.sha(cfg.canonical(entries));
}
function observation(env, nonce) {
  requireTrue(env.REPLIT_DEPLOYMENT === "1" && typeof env.REPL_ID === "string" && env.REPL_ID.length > 0);
  const bytes = fs.readFileSync(path.join(root, "release-preparation/production-bindings/bindings.pending.json"));
  const bindings = JSON.parse(bytes);
  requireTrue(bindings.kind === "BQ_PENDING_PRODUCTION_BINDINGS_V1" &&
    bindings.implementationCommit === "cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9");
  return { bindings, claims: {
    nonce, parentAppFingerprint: bindings.appFingerprint,
    runtimeAppFingerprint: cfg.sha(env.REPL_ID), bindingHash: cfg.sha(bytes),
    artifactDigest: artifactDigest(), endpointFingerprint: cfg.endpoint(env, "production").identity
  } };
}
function signed(envelope, role, trust, now) {
  const p = envelope?.payload;
  const key = trust.keys?.find(k => k.id === envelope?.keyId && k.role === role);
  requireTrue(key && p && key.algorithm === "Ed25519");
  const publicKey = crypto.createPublicKey(key.publicKey);
  requireTrue(publicKey.asymmetricKeyType === "ed25519");
  requireTrue(crypto.verify(null, Buffer.from(cfg.canonical(p)), publicKey,
    Buffer.from(envelope.signature || "", "base64")));
  requireTrue(p.audience === "bq-production-release-v1" &&
    Number.isSafeInteger(p.issuedAt) && Number.isSafeInteger(p.expiresAt) &&
    p.issuedAt <= now + 30000 && p.expiresAt > now &&
    p.expiresAt > p.issuedAt && p.expiresAt - p.issuedAt <= 900000);
  return p;
}
function verify({ env, nonce, request, trust, observed, now = Date.now() }) {
  requireTrue(trust.kind === "BQ_PRODUCTION_TRUST_V1" && hex.test(trust.productionUrlFingerprint || ""));
  requireTrue(["preflight", "import", "activate"].includes(request.operation));
  const o = observed || observation(env, nonce);
  requireTrue(hex.test(trust.parentAppFingerprint || "") &&
    trust.parentAppFingerprint === o.bindings.appFingerprint);
  const d = signed(request.deployment, "deployment", trust, now);
  const w = signed(request.workload, "workload", trust, now);
  const a = signed(request.owner, "owner", trust, now);
  // Separation of trust domains, not three aliases of one signing key.
  const keys = ["deployment", "workload", "owner"].map(role => {
    const e = request[role];
    return crypto.createPublicKey(trust.keys.find(k => k.id === e.keyId && k.role === role).publicKey)
      .export({ type: "spki", format: "der" }).toString("hex");
  });
  requireTrue(new Set(keys).size === 3);
  for (const p of [d, w, a]) {
    requireTrue(p.kind === "BQ_PRODUCTION_ATTESTATION_V1" && p.environment === "production" &&
      p.operation === request.operation && p.manifestHash === cfg.sha(cfg.canonical(request.manifest)) &&
      p.productionUrlFingerprint === trust.productionUrlFingerprint && hex.test(p.deploymentFingerprint || ""));
    for (const [key, value] of Object.entries(o.claims)) requireTrue(p[key] === value);
    requireTrue(p.deploymentFingerprint === d.deploymentFingerprint);
  }
  requireTrue(request.manifest.kind === "BQ_REPLIT_MANAGED_V1" && request.manifest.environment === "production" &&
    request.manifest.appFingerprint === o.claims.runtimeAppFingerprint &&
    request.manifest.endpointFingerprint === o.claims.endpointFingerprint &&
    request.manifest.minimal?.employees === 6311 && request.manifest.minimal?.accounts === 8 &&
    request.manifest.minimal?.policy === "employees-accounts-only-v1");
  requireTrue(request.manifest.bucket === o.bindings.targetBucket &&
    request.manifest.minimal.sourceBucket === o.bindings.sourceBucket &&
    request.manifest.minimal.sourceBucketFingerprint === o.bindings.sourceBucketFingerprint &&
    request.manifest.productionBucketFingerprint === o.bindings.targetBucketFingerprint &&
    request.manifest.developmentEndpointFingerprint === o.bindings.developmentEndpointFingerprint &&
    request.manifest.schemaFingerprint === o.bindings.schemaFingerprint);
  if (request.operation !== "preflight") requireTrue(a.sourceWritersFrozen === "confirmed-all-writers" &&
    hex.test(request.manifest.minimal.freezeEvidence || "") &&
    a.freezeEvidence === request.manifest.minimal.freezeEvidence);
  // This is a NEW, evidence-bound Production view, not a rewrite of the pin.
  return { ...o.bindings, appFingerprint: o.claims.runtimeAppFingerprint,
    endpointFingerprint: o.claims.endpointFingerprint,
    permissionsFingerprint: request.manifest.permissionsFingerprint,
    permissionReviewApproved: request.manifest.permissionApproval === "reviewed-managed-runtime-capabilities" };
}
module.exports = { readProtected, artifactDigest, observation, verify };
