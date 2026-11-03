// Local integrity/fail-closed fences. This is NOT a distributed storage protocol.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const CRITICAL = ["accounts.json", "employees.json", "ideas.json", "session.key", "backup.key"];
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
function fault(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
function object(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function accounts(value) {
  if (!object(value)) throw fault("critical_accounts_schema");
  for (const [id, row] of Object.entries(value)) {
    if (!id || ["__proto__", "constructor", "prototype"].includes(id) || !object(row)) throw fault("critical_accounts_schema");
    if (row.hash != null && (typeof row.hash !== "string" || !row.hash || typeof row.salt !== "string" || !row.salt)) throw fault("critical_accounts_schema");
    if (row.ver != null && (!Number.isSafeInteger(row.ver) || row.ver < 1)) throw fault("critical_accounts_schema");
    if (row.sessions != null && !Array.isArray(row.sessions)) throw fault("critical_accounts_schema");
  }
  return value;
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { throw fault("critical_json_missing_or_corrupt"); }
}
function readAccounts(file) { return accounts(readJson(file)); }
function readKey(file, length) {
  let text;
  try { text = fs.readFileSync(file, "utf8").trim(); } catch { throw fault("critical_key_missing"); }
  if (!new RegExp(`^[0-9a-f]{${length}}$`).test(text)) throw fault("critical_key_invalid");
  return text;
}
function digest(file) {
  try { return sha(fs.readFileSync(file)); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
function syncDirectory(dir) {
  const fd = fs.openSync(dir, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function atomicWrite(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
    syncDirectory(path.dirname(file));
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(temp, { force: true });
  }
}
function requireDurableBackend() {
  // SDK 1.0.0 exposes no conditional object writes, transactions or fenced leases.
  // No environment flag or mock property may bypass this production fence.
  throw fault("durable_commit_provider_unavailable");
}
function counts(dir) {
  const rows = readAccounts(path.join(dir, "accounts.json"));
  const posts = readJson(path.join(dir, "ideas.json"));
  const employees = readJson(path.join(dir, "employees.json"));
  if (!Array.isArray(posts) || posts.some((row) => !object(row) || !row.id)) throw fault("critical_posts_schema");
  if (!Array.isArray(employees) || employees.some((row) => !object(row) || !String(row.badge || ""))) throw fault("critical_employees_schema");
  if (new Set(employees.map((row) => String(row.badge))).size !== employees.length) throw fault("critical_employees_duplicate");
  return { accounts: Object.values(rows).filter((row) => row.hash).length,
    posts: posts.filter((row) => row.type !== "story").length, employees: employees.length };
}
function validateData(dir, options = {}) {
  readKey(path.join(dir, "session.key"), 96);
  readKey(path.join(dir, "backup.key"), 64);
  const result = counts(dir);
  const visit = (value) => {
    if (typeof value === "string" && value.startsWith("/media/")) {
      let rel;
      try { rel = decodeURIComponent(value.split(/[?#]/)[0].slice(1)); } catch { throw fault("media_reference_invalid"); }
      const target = path.resolve(dir, rel);
      if (!target.startsWith(path.resolve(dir, "media") + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) throw fault("referenced_media_missing");
      if (options.manifestFiles && !Object.hasOwn(options.manifestFiles, rel)) throw fault("manifest_media_unbound");
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (object(value)) Object.values(value).forEach(visit);
  };
  visit(readJson(path.join(dir, "ideas.json")));
  return result;
}
function validateManifest(value, expected) {
  if (!object(value) || value.version !== 1 || typeof value.datasetId !== "string"
    || !Number.isSafeInteger(value.generation) || value.generation < 1 || !object(value.files)
    || !/^[0-9a-f]{12,64}$/.test(value.bucketFingerprint || "")) throw fault("manifest_invalid");
  if (!expected?.datasetId || !Number.isSafeInteger(expected.generation) || !expected.bucketFingerprint) throw fault("manifest_adoption_required");
  if (value.datasetId !== expected.datasetId || value.bucketFingerprint !== expected.bucketFingerprint) throw fault("dataset_identity_mismatch");
  if (value.generation !== expected.generation) throw fault("committed_generation_mismatch");
  for (const name of CRITICAL) if (!/^[0-9a-f]{64}$/.test(value.files[name] || "")) throw fault("manifest_incomplete");
  for (const [name, hash] of Object.entries(value.files)) {
    if (!name || name.includes("\\") || path.isAbsolute(name) || name.split("/").some((p) => p === ".." || p === ".") || !/^[0-9a-f]{64}$/.test(hash)) throw fault("manifest_invalid");
  }
  return value;
}
function verifyManifestFiles(dir, manifest) {
  validateData(dir, { manifestFiles: manifest.files });
  for (const [rel, hash] of Object.entries(manifest.files)) {
    const full = path.resolve(dir, rel);
    if (!full.startsWith(path.resolve(dir) + path.sep) || rel.includes("\\") || !fs.existsSync(full)
      || !fs.lstatSync(full).isFile() || digest(full) !== hash) throw fault("manifest_content_mismatch");
  }
}
function validateBucketBinding(bucketId, expectedFingerprint) {
  if (typeof bucketId !== "string" || !bucketId || !/^[0-9a-f]{12}$/.test(expectedFingerprint || "")) throw fault("bucket_binding_adoption_required");
  if (sha(bucketId).slice(0, 12) !== expectedFingerprint) throw fault("bucket_binding_mismatch");
}
async function preflight(client) {
  const response = await client.downloadAsText("meta/dataset-manifest.json");
  if (!response.ok) throw fault("authoritative_manifest_unavailable");
  let manifest;
  try { manifest = JSON.parse(response.value); } catch { throw fault("manifest_invalid"); }
  validateManifest(manifest, {
    datasetId: process.env.BQ_EXPECTED_DATASET_ID,
    generation: Number(process.env.BQ_EXPECTED_GENERATION),
    bucketFingerprint: process.env.BQ_EXPECTED_BUCKET_FINGERPRINT,
  });
  // A valid legacy/adopted read manifest is not proof of an available commit protocol.
  requireDurableBackend();
}
function preserveMembership(before, after) {
  for (const [id, row] of Object.entries(before)) {
    if (!Object.hasOwn(after, id) || (row.hash && !after[id].hash)) throw fault("account_membership_loss");
    if (Number(after[id].ver || 0) < Number(row.ver || 0)) throw fault("account_generation_rollback");
  }
}
function assertKeyDomain(live, stage, addedRows) {
  if (!addedRows.some((row) => row.totp?.on || row.totp?.key || row.totpSetup?.key || row.totp?.recovery?.length)) return;
  if (readKey(path.join(live, "session.key"), 96) !== readKey(path.join(stage, "session.key"), 96)) throw fault("import_2fa_key_domain_mismatch");
}
// Offline, same-filesystem directory activation with a recovery journal.
// NOT an atomic distributed commit; never used to bypass the provider fence.
function recoverDirectory(live) {
  const parent = path.dirname(live);
  const journal = path.join(parent, ".persistence-journal.json");
  if (!fs.existsSync(journal)) return;
  const state = readJson(journal);
  if (state.live !== live || !["prepared", "committed"].includes(state.phase)
    || path.dirname(state.old || "") !== parent || !path.basename(state.old).startsWith(".data-old-")) throw fault("recovery_journal_invalid");
  if (state.phase === "prepared" && state.hadLive === false) {
    if (fs.existsSync(live)) fs.renameSync(live, path.join(parent, `.data-quarantine-${crypto.randomUUID()}`));
    throw fault("fresh_activation_uncommitted");
  } else if (state.phase === "prepared" && fs.existsSync(state.old)) {
    if (fs.existsSync(live)) fs.renameSync(live, path.join(parent, `.data-quarantine-${crypto.randomUUID()}`));
    fs.renameSync(state.old, live);
  } else if (!fs.existsSync(live)) throw fault("recovery_live_missing");
  syncDirectory(parent);
  fs.rmSync(journal);
  syncDirectory(parent);
  // Retain old/quarantined generations; never delete potentially newer data automatically.
}
function activateLocal(live, candidate) {
  if (process.env.REPLIT_DEPLOYMENT) requireDurableBackend();
  if (fs.existsSync(path.join(live, "accounts.json.write-lock"))) throw fault("account_write_conflict");
  recoverDirectory(live);
  validateData(candidate);
  const parent = path.dirname(live);
  if (path.dirname(candidate) !== parent || !path.basename(candidate).startsWith(".data-candidate-")) throw fault("candidate_path_invalid");
  const journal = path.join(parent, ".persistence-journal.json");
  const state = { phase: "prepared", live, old: path.join(parent, `.data-old-${crypto.randomUUID()}`), hadLive: fs.existsSync(live) };
  atomicWrite(journal, JSON.stringify(state));
  try {
    if (fs.existsSync(live)) fs.renameSync(live, state.old);
    fs.renameSync(candidate, live);
    syncDirectory(parent);
    atomicWrite(journal, JSON.stringify({ ...state, phase: "committed" }));
    recoverDirectory(live);
  } catch (error) { recoverDirectory(live); throw error; }
}
module.exports = { CRITICAL, fault, sha, accounts, readAccounts, readJson, readKey, digest,
  atomicWrite, requireDurableBackend, counts, validateData, validateManifest, preflight,
  preserveMembership, assertKeyDomain, recoverDirectory, activateLocal, verifyManifestFiles, validateBucketBinding };
