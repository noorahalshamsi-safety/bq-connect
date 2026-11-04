// Remote activation and authoritative index writes are fenced pending a verified
// durable provider. Offline candidates use a local recovery journal, not a
// distributed transaction. Existing production archives are never auto-adopted.
const fs = require("fs");
const os = require("os");
const path = require("path");
const backup = require("./backup");
const safety = require("./persistence-safety");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const INDEX = "vault/index.json";
const REQUEST = "meta/restore-request.json";
const RESULT = "meta/restore-result.json";
const LOCAL_STATUS = path.join(DATA_DIR, "vault-status.json");
const KEEP = 60;
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;
const NAME = /^vault\/bq-\d{8}-\d{6}-[a-z]+\.bqb$/;
const IGNORED = new Set(["vault-status.json", "backup-status.json"]);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function countsFrom(accounts, ideas, employees) {
  return {
    accounts: Object.values(accounts && typeof accounts === "object" ? accounts : {}).filter((item) => item && item.hash).length,
    posts: Array.isArray(ideas) ? ideas.filter((item) => item && item.type !== "story").length : 0,
    employees: Array.isArray(employees) ? employees.length : 0,
  };
}

function localCounts(dir = DATA_DIR) {
  return countsFrom(readJson(path.join(dir, "accounts.json"), {}), readJson(path.join(dir, "ideas.json"), []), readJson(path.join(dir, "employees.json"), []));
}

async function remoteJson(client, name, fallback) {
  const { ok, value } = await client.downloadAsText(name);
  if (!ok) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function remoteCounts(client) {
  const [accounts, ideas, employees] = await Promise.all([
    remoteJson(client, "data/accounts.json", {}),
    remoteJson(client, "data/ideas.json", []),
    remoteJson(client, "data/employees.json", []),
  ]);
  return countsFrom(accounts, ideas, employees);
}

function fingerprint() {
  let names = [];
  try {
    names = fs.readdirSync(DATA_DIR).filter((name) => name.endsWith(".json") && !IGNORED.has(name)).sort();
  } catch {}
  return names
    .map((name) => {
      try {
        const stat = fs.statSync(path.join(DATA_DIR, name));
        return `${name}:${stat.size}:${stat.mtimeMs}`;
      } catch {
        return name;
      }
    })
    .join("|");
}

function stampOf(date) {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

async function readIndex(client) {
  const response = await client.downloadAsText(INDEX);
  if (!response.ok) throw safety.fault("authoritative_index_unavailable");
  let list;
  try { list = JSON.parse(response.value); } catch { throw safety.fault("authoritative_index_corrupt"); }
  if (!Array.isArray(list) || !list.length || list.some((item) => !item || !NAME.test(String(item.name)) || !item.counts
    || ["accounts", "posts", "employees"].some((key) => !Number.isSafeInteger(item.counts[key]) || item.counts[key] < 0))) throw safety.fault("authoritative_index_invalid");
  return list;
}

function writeLocalStatus(status) {
  try {
    const temp = `${LOCAL_STATUS}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(status));
    fs.renameSync(temp, LOCAL_STATUS);
  } catch {}
}

let lastPrint = "";

async function snapshot(client, reason, log = console.log) {
  safety.requireDurableBackend();
  const at = new Date();
  const name = `vault/bq-${stampOf(at)}-${reason}.bqb`;
  const temp = path.join(os.tmpdir(), `bq-vault-${process.pid}-${at.getTime()}.bqb`);
  const print = fingerprint();
  try {
    const result = await backup.writeArchive(temp, { skipMedia: false });
    const bytes = fs.readFileSync(temp);
    const sent = await client.uploadFromBytes(name, bytes);
    if (!sent.ok) throw new Error(`upload failed: ${sent.error && sent.error.message}`);
    const entry = { name, at: at.toISOString(), reason, size: bytes.length, files: result.files, counts: result.counts, includesMedia: result.includesMedia, contentHashes: result.contentHashes };
    const kept = [];
    for (const item of [entry, ...(await readIndex(client)).filter((item) => item.name !== name)]) {
      if (kept.length >= KEEP && at.getTime() - Date.parse(item.at) > KEEP_MS) await client.delete(item.name, { ignoreNotFound: true });
      else kept.push(item);
    }
    const saved = await client.uploadFromText(INDEX, JSON.stringify(kept, null, 1));
    if (!saved.ok) throw new Error(`index upload failed: ${saved.error && saved.error.message}`);
    lastPrint = print;
    writeLocalStatus({ lastAt: entry.at, kept: kept.length });
    log(`Vault: saved ${name} (${entry.counts.accounts} accounts, ${entry.counts.posts} posts)`);
    return entry;
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function changed() {
  return fingerprint() !== lastPrint;
}

// Accounts are never deleted by the app and posts rarely vanish in bulk, so either happening
// between two runs means the data came back wrong and must not be served or synced.
async function checkDrop(client) {
  safety.validateData(DATA_DIR);
  const last = (await readIndex(client))[0];
  if (!last || !last.counts) return "";
  const now = localCounts();
  const was = last.counts;
  if (now.accounts < was.accounts) return `accounts went from ${was.accounts} to ${now.accounts}`;
  if (now.employees < was.employees) return `employees went from ${was.employees} to ${now.employees}`;
  if (was.posts >= 10 && now.posts < was.posts / 2) return `posts went from ${was.posts} to ${now.posts}`;
  return "";
}

async function pendingRestore(client) {
  const request = await remoteJson(client, REQUEST, null);
  return request && NAME.test(String(request.name)) ? request : null;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function download(client, name) {
  const { ok, value, error } = await client.downloadAsBytes(name);
  if (!ok) throw new Error(`download failed for ${name}: ${error && error.message}`);
  return Array.isArray(value) ? value[0] : value;
}

// Unpacks a snapshot into a scratch folder first, so a damaged file or a wrong key changes nothing.
async function unpack(client, name, key) {
  const file = path.join(os.tmpdir(), `bq-vault-in-${process.pid}-${Date.now()}.bqb`);
  const stage = path.join(os.tmpdir(), `bq-vault-stage-${process.pid}-${Date.now()}`);
  fs.writeFileSync(file, await download(client, name), { mode: 0o600 });
  fs.mkdirSync(stage, { recursive: true });
  try {
    await backup.openBackup(file, async (rel, data) => {
      const out = path.resolve(stage, rel);
      if (!out.startsWith(stage + path.sep)) throw new Error("bad_path");
      await fs.promises.mkdir(path.dirname(out), { recursive: true });
      await fs.promises.writeFile(out, data, { mode: 0o600 });
    }, key);
    return stage;
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function applyRestore(client, request, log = console.log) {
  // SDK cannot safely activate a distributed authoritative generation.
  // Preserve request, archive, keys and live files; do not run legacy promotion.
  log("Vault: recovery_commit_unavailable; restore request and data preserved");
  return { ok: false, code: "recovery_commit_unavailable", name: request.name };
}

const IMPORT_REQUEST = "meta/import-request.json";
const IMPORT_DIR = "meta/import/";

async function pendingImport(client) {
  const request = await remoteJson(client, IMPORT_REQUEST, null);
  const inside = (name) => typeof name === "string" && name.startsWith(IMPORT_DIR) && !name.includes("..");
  return request && inside(request.file) && inside(request.key) ? request : null;
}

function keyFrom(text) {
  const hex = String(text || "").trim();
  return /^[0-9a-f]{64}$/.test(hex) ? Buffer.from(hex, "hex") : null;
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

// Adds what an older backup has and the live data lacks. Nothing that exists now is changed or removed.
function mergeInto(dataDir, stage) {
  if (process.env.REPLIT_DEPLOYMENT) safety.requireDurableBackend();
  safety.recoverDirectory(dataDir);
  safety.validateData(dataDir);
  const liveAccounts = safety.readAccounts(path.join(dataDir, "accounts.json"));
  const sourceAccounts = fs.existsSync(path.join(stage, "accounts.json")) ? safety.readJson(path.join(stage, "accounts.json")) : {};
  if (!sourceAccounts || typeof sourceAccounts !== "object" || Array.isArray(sourceAccounts)) throw safety.fault("import_accounts_schema");
  safety.assertKeyDomain(dataDir, stage, Object.entries(sourceAccounts).filter(([id, row]) => row?.hash && !Object.hasOwn(liveAccounts, id)).map(([, row]) => row));
  const candidate = path.join(path.dirname(dataDir), `.data-candidate-${crypto.randomUUID()}`);
  fs.cpSync(dataDir, candidate, { recursive: true });
  try {
    const result = mergeCandidate(candidate, stage);
    safety.validateData(candidate);
    safety.preserveMembership(liveAccounts, safety.readAccounts(path.join(candidate, "accounts.json")));
    safety.activateLocal(dataDir, candidate);
    return result;
  } finally { fs.rmSync(candidate, { recursive: true, force: true }); }
}

function mergeCandidate(dataDir, stage) {
  const added = { accounts: 0, posts: 0, media: 0 };
  const accountsFile = path.join(dataDir, "accounts.json");
  const accounts = safety.readAccounts(accountsFile);
  const oldAccounts = fs.existsSync(path.join(stage, "accounts.json")) ? safety.readJson(path.join(stage, "accounts.json")) : {};
  for (const [badge, account] of Object.entries(oldAccounts)) {
    if (account && account.hash && !Object.prototype.hasOwnProperty.call(accounts, badge)) {
      accounts[badge] = account;
      added.accounts += 1;
    }
  }
  if (added.accounts) writeJsonAtomic(accountsFile, accounts);

  const ideasFile = path.join(dataDir, "ideas.json");
  const ideas = safety.readJson(ideasFile);
  const live = Array.isArray(ideas) ? ideas : [];
  const oldIdeas = fs.existsSync(path.join(stage, "ideas.json")) ? safety.readJson(path.join(stage, "ideas.json")) : [];
  if (!Array.isArray(oldIdeas)) throw safety.fault("import_posts_schema");
  const ids = new Set(live.map((idea) => String(idea && idea.id)));
  const numbers = new Set(live.map((idea) => Number(idea && idea.number) || 0).filter(Boolean));
  let next = Math.max(0, ...numbers, ...(Array.isArray(oldIdeas) ? oldIdeas.map((idea) => Number(idea && idea.number) || 0) : [])) + 1;
  for (const idea of Array.isArray(oldIdeas) ? oldIdeas : []) {
    if (!idea || !idea.id || ids.has(String(idea.id))) continue;
    const copy = { ...idea };
    if (Number(copy.number) && numbers.has(Number(copy.number))) copy.number = next++;
    if (Number(copy.number)) numbers.add(Number(copy.number));
    live.push(copy);
    ids.add(String(copy.id));
    added.posts += 1;
  }
  if (added.posts) writeJsonAtomic(ideasFile, live);

  const oldMedia = path.join(stage, "media");
  if (fs.existsSync(oldMedia)) {
    for (const file of walk(oldMedia)) {
      const target = path.join(dataDir, "media", path.relative(oldMedia, file));
      if (fs.existsSync(target)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, `${target}.${process.pid}.tmp`);
      fs.renameSync(`${target}.${process.pid}.tmp`, target);
      added.media += 1;
    }
  }
  return added;
}

async function applyImport(client, request, log = console.log) {
  log("Vault: recovery_commit_unavailable; import request, key, archive and data preserved");
  return { ok: false, code: "recovery_commit_unavailable", type: "import", name: request.file };
}

module.exports = {
  IMPORT_DIR,
  IMPORT_REQUEST,
  INDEX,
  NAME,
  REQUEST,
  RESULT,
  applyImport,
  keyFrom,
  mergeInto,
  pendingImport,
  applyRestore,
  changed,
  checkDrop,
  localCounts,
  pendingRestore,
  readIndex,
  remoteCounts,
  remoteJson,
  snapshot,
  unpack,
};
