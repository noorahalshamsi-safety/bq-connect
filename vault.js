// Encrypted snapshots of data/ kept in App Storage under vault/. That folder is outside the synced
// folders, so republishing, a broken deploy or an emptied data/ folder can never delete them.
// Media files are left out: they stay in App Storage on their own and would make every snapshot huge.
const fs = require("fs");
const os = require("os");
const path = require("path");
const backup = require("./backup");

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
  const list = await remoteJson(client, INDEX, []);
  return Array.isArray(list) ? list.filter((item) => item && NAME.test(String(item.name))) : [];
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
  const at = new Date();
  const name = `vault/bq-${stampOf(at)}-${reason}.bqb`;
  const temp = path.join(os.tmpdir(), `bq-vault-${process.pid}-${at.getTime()}.bqb`);
  const print = fingerprint();
  try {
    const result = await backup.writeArchive(temp, { skipMedia: true });
    const bytes = fs.readFileSync(temp);
    const sent = await client.uploadFromBytes(name, bytes);
    if (!sent.ok) throw new Error(`upload failed: ${sent.error && sent.error.message}`);
    const entry = { name, at: at.toISOString(), reason, size: bytes.length, files: result.files, counts: localCounts() };
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
  const result = { name: request.name, at: new Date().toISOString(), ok: false };
  try {
    await snapshot(client, "prerestore", log);
    const stage = await unpack(client, request.name);
    try {
      for (const file of walk(stage)) {
        const rel = path.relative(stage, file);
        const target = path.join(DATA_DIR, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const temp = `${target}.${process.pid}.tmp`;
        fs.copyFileSync(file, temp);
        fs.renameSync(temp, target);
      }
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
    result.ok = true;
    result.counts = localCounts();
    log(`Vault: restored ${request.name} (${result.counts.accounts} accounts, ${result.counts.posts} posts)`);
  } catch (error) {
    result.error = error.message;
    log(`Vault: restore of ${request.name} failed, data left as it was: ${error.message}`);
  }
  await client.uploadFromText(RESULT, JSON.stringify(result));
  await client.delete(REQUEST, { ignoreNotFound: true });
  return result;
}

module.exports = {
  INDEX,
  NAME,
  REQUEST,
  RESULT,
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
