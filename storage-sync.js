// Mirrors data/ (and the backup folder) to Replit App Storage so nothing is lost when the app is republished.
// Only runs inside a published Replit deployment; the workspace and local runs keep using plain files.
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const INTERVAL_MS = 5000;
const SETTLE_MS = 1500;
// Losing any of these locks every user out, so local copies may never replace or delete them remotely.
const CRITICAL = new Set(["data/accounts.json", "data/session.key", "data/backup.key", "data/employees.json", "data/push-keys.json"]);
// New keys would silently break every existing push subscription, so a remote copy is never overwritten.
const WRITE_ONCE = new Set(["data/push-keys.json"]);
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
    else if (entry.isFile() && !entry.name.endsWith(".tmp") && !entry.name.endsWith(".part")) out.push(full);
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
    return names.filter((name) => !name.endsWith("/"));
  }

  async function restore() {
    const names = await remoteNames();
    const hasData = names.some((name) => name.startsWith("data/"));
    if (!hasData) {
      const found = await client.exists(MARKER);
      if (!found.ok) throw new Error(`marker check failed: ${found.error && found.error.message}`);
      if (found.value && process.env.BQ_ALLOW_EMPTY_BUCKET !== "1") {
        throw new Error("App Storage held data before but data/ is now empty; staying in maintenance so the bundled copy cannot replace it");
      }
    }
    let restored = 0;
    for (const name of names) {
      const file = localPath(name);
      if (keepLocal.has(name) && fs.existsSync(file)) continue;
      const { ok, value, error } = await client.downloadAsBytes(name);
      if (!ok) throw new Error(`download failed for ${name}: ${error && error.message}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, bytesOf(value), { mode: 0o600 });
      fs.renameSync(temp, file);
      synced.set(name, stamp(fs.statSync(file)));
      if (CRITICAL.has(name) && name.endsWith(".json")) counts.set(name, entryCount(bytesOf(value)));
      restored += 1;
    }
    if (hasData) await markSeeded();
    log(names.length ? `App Storage: restored ${restored} files` : "App Storage: empty bucket, uploading the bundled data");
    return restored;
  }

  async function pushOnce(force = false) {
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
          log(`App Storage: upload failed for ${name}: ${error && error.message}`);
          continue;
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
    for (const name of missing) {
      const { ok } = await client.delete(name, { ignoreNotFound: true });
      if (ok) synced.delete(name);
    }
  }

  function queue(task) {
    running = running.then(task).catch((error) => log(`App Storage: ${error.message}`));
    return running;
  }

  return {
    restore,
    flush: () => queue(() => pushOnce(true)),
    start() {
      queue(() => pushOnce());
      timer = setInterval(() => queue(() => pushOnce()), INTERVAL_MS);
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
  const { Client } = await import("@replit/object-storage");
  return new Client();
}

module.exports = { enabled, connect, createSync };
