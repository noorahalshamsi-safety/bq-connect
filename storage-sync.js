// Mirrors data/ (and the backup folder) to Replit App Storage so nothing is lost when the app is republished.
// Only runs inside a published Replit deployment; the workspace and local runs keep using plain files.
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const INTERVAL_MS = 5000;
const SETTLE_MS = 1500;

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
    else if (entry.isFile() && !entry.name.endsWith(".tmp")) out.push(full);
  }
  return out;
}

function bytesOf(value) {
  return Array.isArray(value) ? value[0] : value;
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
  const keepLocal = new Set(preferLocal.map((name) => `data/${name}`));
  const synced = new Map();
  let timer = null;
  let running = Promise.resolve();

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
    let restored = 0;
    for (const name of names) {
      if (keepLocal.has(name)) continue;
      const { ok, value, error } = await client.downloadAsBytes(name);
      if (!ok) throw new Error(`download failed for ${name}: ${error && error.message}`);
      const file = localPath(name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, bytesOf(value), { mode: 0o600 });
      fs.renameSync(temp, file);
      synced.set(name, stamp(fs.statSync(file)));
      restored += 1;
    }
    log(names.length ? `App Storage: restored ${restored} files` : "App Storage: empty bucket, uploading the bundled data");
    return restored;
  }

  async function pushOnce() {
    const now = Date.now();
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
        const { ok, error } = await client.uploadFromBytes(name, bytes);
        if (!ok) {
          log(`App Storage: upload failed for ${name}: ${error && error.message}`);
          continue;
        }
        synced.set(name, current);
      }
    }
    for (const name of [...synced.keys()]) {
      if (seen.has(name)) continue;
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
    flush: () => queue(pushOnce),
    start() {
      queue(pushOnce);
      timer = setInterval(() => queue(pushOnce), INTERVAL_MS);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      await queue(pushOnce);
    },
  };
}

async function connect() {
  const { Client } = await import("@replit/object-storage");
  return new Client();
}

module.exports = { enabled, connect, createSync };
