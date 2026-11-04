// Legacy polling mirror, NOT a durable acknowledgement or distributed commit.
// Critical changes are fenced until a verified provider protocol is implemented.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const safety = require("./persistence-safety");

const ROOT = __dirname;
const INTERVAL_MS = 5000;
const SETTLE_MS = 1500;
// Losing any of these locks every user out, so local copies may never replace or delete them remotely.
const CRITICAL = new Set(["data/accounts.json", "data/session.key", "data/backup.key", "data/employees.json", "data/push-keys.json"]);
// New keys would silently break every existing push subscription, so a remote copy is never overwritten.
const WRITE_ONCE = new Set(["data/push-keys.json", "data/session.key", "data/backup.key"]);
// Lives outside the synced folders, so it is never deleted and proves the bucket once held real data.
const MARKER = "meta/bq-storage-seeded";
const MASS_DELETE = 25;

function enabled() {
  return Boolean(process.env.REPLIT_DEPLOYMENT) && process.env.BQ_STORAGE_SYNC !== "0";
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && !entry.name.endsWith(".tmp") && !entry.name.endsWith(".part") && !entry.name.endsWith(".write-lock")) out.push(full);
  }
  return out;
}

function bytesOf(value) {
  return Array.isArray(value) ? value[0] : value;
}

function entryCount(bytes) {
  try {
    const value = JSON.parse(Buffer.from(bytes).toString("utf8"));
    if (Array.isArray(value)) return value.length;
    return value && typeof value === "object" ? Object.keys(value).length : -1;
  } catch {
    return -1;
  }
}

function createSync({ client, dirs, preferLocal = [], log = console.log, root = ROOT }) {
  const objectName = (file) => path.relative(root, file).split(path.sep).join("/");
  const localPath = (name) => {
    const file = path.resolve(root, ...name.split("/"));
    if (!file.startsWith(root + path.sep)) throw new Error(`unsafe object name: ${name}`);
    return file;
  };
  const roots = dirs.map((dir) => path.resolve(root, dir));
  const prefixes = roots.map((dir) => `${objectName(dir)}/`);
  const keepLocal = new Set(preferLocal.map((name) => `data/${name}`).filter((name) => {
    if (CRITICAL.has(name)) log(`App Storage: BQ_PREFER_LOCAL ignored for ${name}; App Storage always wins for it`);
    return !CRITICAL.has(name);
  }));
  const synced = new Map();
  const counts = new Map();
  const committedHashes = new Map();
  let seeded = false;
  let warned = "";
  let timer = null;
  let running = Promise.resolve();

  async function markSeeded() {
    const found = await client.exists(MARKER);
    if (found.ok && !found.value) await client.uploadFromText(MARKER, new Date().toISOString());
    seeded = found.ok;
  }

  const stamp = (stat) => `${stat.size}:${stat.mtimeMs}`;

  async function remoteNames() {
    const names = [];
    for (const prefix of prefixes) {
      const { ok, value, error } = await client.list({ prefix });
      if (!ok) throw new Error(`list failed: ${error && error.message}`);
      value.forEach((item) => names.push(item.name));
    }
    return names.filter((name) => !name.endsWith("/") && !name.endsWith(".write-lock"));
  }

  async function restore() {
    safety.recoverDirectory(path.join(root, "data"));
    const names = await remoteNames();
    const hasData = names.some((name) => name.startsWith("data/"));
    if (!hasData) {
      const found = await client.exists(MARKER);
      if (!found.ok) throw new Error(`marker check failed: ${found.error && found.error.message}`);
      throw safety.fault("dataset_provisioning_requires_approval");
    }
    const candidate = path.join(root, `.data-candidate-${crypto.randomUUID()}`);
    const other = path.join(root, `.sync-candidate-${crypto.randomUUID()}`);
    fs.mkdirSync(candidate, { mode: 0o700 });
    fs.mkdirSync(other, { mode: 0o700 });
    let restored = 0;
    try {
    for (const name of names) {
      if (name.includes("\\") || name.split("/").some((part) => !part || part === "." || part === "..")) throw safety.fault("unsafe_object_name");
      const live = localPath(name);
      const file = name.startsWith("data/") ? path.join(candidate, name.slice(5)) : path.join(other, name);
      if (keepLocal.has(name) && fs.existsSync(live)) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.copyFileSync(live, file);
        continue;
      }
      const { ok, value, error } = await client.downloadAsBytes(name);
      if (!ok) throw new Error(`download failed for ${name}: ${error && error.message}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, bytesOf(value), { mode: 0o600 });
      fs.renameSync(temp, file);
      restored += 1;
    }
    safety.validateData(candidate);
    const accountFile = path.join(root, "data/accounts.json");
    if (fs.existsSync(accountFile)) safety.preserveMembership(safety.readAccounts(accountFile), safety.readAccounts(path.join(candidate, "accounts.json")));
    safety.activateLocal(path.join(root, "data"), candidate);
    if (fs.existsSync(path.join(other, "backups"))) fs.cpSync(path.join(other, "backups"), path.join(root, "backups"), { recursive: true });
    for (const name of names) {
      const file = localPath(name);
      if (!fs.existsSync(file)) continue;
      synced.set(name, stamp(fs.statSync(file)));
      if (CRITICAL.has(name)) committedHashes.set(name, safety.digest(file));
      if (CRITICAL.has(name) && name.endsWith(".json")) counts.set(name, entryCount(fs.readFileSync(file)));
    }
    seeded = true;
    log(`App Storage: restored ${restored} files`);
    return restored;
    } finally {
      fs.rmSync(candidate, { recursive: true, force: true });
      fs.rmSync(other, { recursive: true, force: true });
    }
  }

  async function pushOnce(force = false) {
    safety.validateData(path.join(root, "data"));
    for (const name of CRITICAL) {
      const file = localPath(name);
      if (safety.digest(file) !== (committedHashes.get(name) || null)) {
        // A polling mirror cannot acknowledge durable critical-file commits.
        safety.requireDurableBackend();
      }
    }
    const now = force ? Infinity : Date.now();
    const seen = new Set();
    for (const root of roots) {
      for (const file of walk(root)) {
        const name = objectName(file);
        seen.add(name);
        let stat;
        try {
          stat = fs.statSync(file);
        } catch {
          continue;
        }
        const current = stamp(stat);
        if (synced.get(name) === current || now - stat.mtimeMs < SETTLE_MS) continue;
        const bytes = fs.readFileSync(file);
        if (file.endsWith(".json")) {
          try {
            JSON.parse(bytes.toString("utf8"));
          } catch {
            continue;
          }
        }
        if (WRITE_ONCE.has(name)) {
          const found = synced.has(name) ? { ok: true, value: true } : await client.exists(name);
          if (!found.ok) continue;
          if (found.value) {
            if (warned !== `once:${name}`) log(`App Storage: not uploading ${name}, App Storage already holds it (safety stop)`);
            warned = `once:${name}`;
            continue;
          }
        }
        const count = CRITICAL.has(name) && name.endsWith(".json") ? entryCount(bytes) : -1;
        const before = counts.get(name) || 0;
        if (count >= 0 && before >= 4 && count < before / 2) {
          if (warned !== `${name}:${count}`) log(`App Storage: not uploading ${name}, it shrank from ${before} to ${count} entries (safety stop)`);
          warned = `${name}:${count}`;
          continue;
        }
        const { ok, error } = await client.uploadFromBytes(name, bytes);
        if (!ok) {
          throw safety.fault("storage_upload_failed");
        }
        synced.set(name, current);
        if (count >= 0) counts.set(name, count);
        if (!seeded && name.startsWith("data/")) await markSeeded();
      }
    }
    const missing = [...synced.keys()].filter((name) => !seen.has(name) && !CRITICAL.has(name));
    const dataFiles = [...seen].filter((name) => name.startsWith("data/")).length;
    if (missing.length && (dataFiles === 0 || missing.length > MASS_DELETE)) {
      if (warned !== `delete:${missing.length}`) log(`App Storage: ${missing.length} files vanished locally at once; keeping them in App Storage (safety stop)`);
      warned = `delete:${missing.length}`;
      return;
    }
    // Missing local objects are retained remotely until an approved,
    // generation-fenced tombstone protocol exists. Never infer deletion.
  }

  function queue(task) {
    running = running.catch(() => {}).then(task);
    return running;
  }

  return {
    restore,
    // After an owner-requested restore the smaller files are intended, so the shrink stop must let them through.
    trust: () => { throw safety.fault("recovery_commit_unavailable"); },
    flush: () => queue(() => pushOnce(true)),
    start() {
      queue(() => pushOnce()).catch((error) => log(`App Storage: ${error.code || "sync_failed"}`));
      timer = setInterval(() => queue(() => pushOnce()).catch((error) => log(`App Storage: ${error.code || "sync_failed"}`)), INTERVAL_MS);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      await queue(() => pushOnce(true));
    },
  };
}

async function connect() {
  let bucketId;
  try {
    const config = fs.readFileSync(path.join(ROOT, ".replit"), "utf8");
    bucketId = config.match(/^\s*defaultBucketID\s*=\s*"([^"]+)"\s*$/m)?.[1];
  } catch {}
  safety.validateBucketBinding(bucketId, process.env.BQ_EXPECTED_BUCKET_FINGERPRINT);
  const { Client } = await import("@replit/object-storage");
  return new Client({ bucketId });
}

module.exports = { enabled, connect, createSync };
