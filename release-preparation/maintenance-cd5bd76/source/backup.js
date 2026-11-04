// Encrypted backups of the data folder (AES-256-GCM over gzip).
//   node backup.js                 make a backup now
//   node backup.js verify <file>   check that a backup opens and is intact
//   node backup.js restore <file>  extract into a new folder next to data (never overwrites data)
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { Readable, Writable } = require("stream");
const { pipeline } = require("stream/promises");
const safety = require("./persistence-safety");

const DATA_DIR = path.join(__dirname, "data");
const KEY_FILE = path.join(DATA_DIR, "backup.key");
const CONFIG_FILE = path.join(DATA_DIR, "backup.json");
const STATUS_FILE = path.join(DATA_DIR, "backup-status.json");
const MAGIC = Buffer.from("BQB1");
const HEAD_BYTES = MAGIC.length + 12;
const TAG_BYTES = 16;
const SKIP = new Set(["backup.key", "backup-status.json"]);
const NAME = /^bq-backup-\d{8}-\d{6}\.bqb$/;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

function config() {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) || {};
  } catch {}
  return {
    dir: path.resolve(String(process.env.BACKUP_DIR || cfg.dir || path.join(os.homedir(), "Documents", "BQ-Connect-Backups"))),
    keep: Math.min(365, Math.max(3, Number(cfg.keep) || 30)),
    hour: Number.isInteger(cfg.hour) && cfg.hour >= 0 && cfg.hour <= 23 ? cfg.hour : 3,
  };
}

function loadKey(create) {
  try {
    const value = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (/^[0-9a-f]{64}$/.test(value)) return Buffer.from(value, "hex");
  } catch {}
  if (!create) return null;
  throw safety.fault("backup_key_missing_or_invalid");
}

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeStatus(patch) {
  const next = { ...readStatus(), ...patch };
  const temp = `${STATUS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(next, null, 2));
  fs.renameSync(temp, STATUS_FILE);
  return next;
}

function savedBackups(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => NAME.test(name)).sort().reverse();
  } catch {
    return [];
  }
}

function vaultStatus() {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "vault-status.json"), "utf8")) || {};
    return saved.lastAt ? { lastAt: String(saved.lastAt), kept: Number(saved.kept) || 0 } : null;
  } catch {
    return null;
  }
}

function status() {
  const saved = readStatus();
  const kept = savedBackups(config().dir).length;
  return {
    vault: vaultStatus(),
    lastAt: saved.lastAt || "",
    size: Number(saved.lastSize) || 0,
    files: Number(saved.files) || 0,
    kept,
    failed: Boolean(saved.failedAt && (!saved.lastAt || saved.failedAt > saved.lastAt)),
    keyReady: Boolean(loadKey(false)),
  };
}

function listFiles(dir, out = [], skipMedia = false) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!(skipMedia && dir === DATA_DIR && entry.name === "media")) listFiles(full, out, skipMedia);
    } else if (entry.isFile() && !entry.name.endsWith(".tmp") && !entry.name.endsWith(".write-lock") && !(dir === DATA_DIR && SKIP.has(entry.name))) {
      out.push(path.relative(DATA_DIR, full).split(path.sep).join("/"));
    }
  }
  return out;
}

async function* archive(files, counter, root = DATA_DIR) {
  for (const rel of files) {
    const data = await fs.promises.readFile(path.join(root, rel));
    const head = Buffer.from(JSON.stringify({ p: rel, s: data.length }));
    const size = Buffer.alloc(4);
    size.writeUInt32BE(head.length);
    counter.files += 1;
    yield Buffer.concat([size, head]);
    yield data;
  }
}

function stampOf(date) {
  const two = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
}

async function writeArchive(file, options = {}) {
  const key = loadKey(true);
  if (!key) throw new Error("key");
  safety.validateData(DATA_DIR);
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "bq-backup-stage-"));
  fs.chmodSync(stage, 0o700);
  const names = listFiles(DATA_DIR, [], Boolean(options.skipMedia));
  const hashes = {};
  try {
    // Freeze this process's bytes before any await; external writers are not
    // made transactional by this copy. Validate the source did not change.
    for (const rel of names) {
      const bytes = fs.readFileSync(path.join(DATA_DIR, rel));
      hashes[rel] = safety.sha(bytes);
      const target = path.join(stage, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, bytes, { mode: 0o600 });
    }
    if (JSON.stringify(names) !== JSON.stringify(listFiles(DATA_DIR, [], Boolean(options.skipMedia)))
      || names.some((rel) => safety.digest(path.join(DATA_DIR, rel)) !== hashes[rel])) throw safety.fault("snapshot_source_changed");
    const frozenCounts = safety.counts(stage);
    const temp = `${file}.part`;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const counter = { files: 0 };
    try {
      fs.writeFileSync(temp, Buffer.concat([MAGIC, iv]), { mode: 0o600 });
      await pipeline(Readable.from(archive(names, counter, stage)), zlib.createGzip({ level: 6 }), cipher, fs.createWriteStream(temp, { flags: "a" }));
      fs.appendFileSync(temp, cipher.getAuthTag());
      fs.renameSync(temp, file);
    } catch (error) {
      fs.rmSync(temp, { force: true });
      throw error;
    }
    return { file, size: fs.statSync(file).size, files: counter.files, counts: frozenCounts, contentHashes: hashes, includesMedia: !options.skipMedia };
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}

async function createBackup() {
  const cfg = config();
  fs.mkdirSync(cfg.dir, { recursive: true });
  let result;
  try {
    result = await writeArchive(path.join(cfg.dir, `bq-backup-${stampOf(new Date())}.bqb`));
  } catch (error) {
    writeStatus({ failedAt: new Date().toISOString() });
    throw error;
  }
  savedBackups(cfg.dir).slice(cfg.keep).forEach((name) => fs.rmSync(path.join(cfg.dir, name), { force: true }));
  writeStatus({ lastAt: new Date().toISOString(), lastFile: path.basename(result.file), lastSize: result.size, files: result.files });
  return result;
}

async function openBackup(file, onEntry, givenKey) {
  const key = givenKey || loadKey(false);
  if (!key) throw new Error("no_key");
  const total = fs.statSync(file).size;
  if (total < HEAD_BYTES + TAG_BYTES + 1) throw new Error("too_small");
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(HEAD_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  fs.readSync(fd, head, 0, HEAD_BYTES, 0);
  fs.readSync(fd, tag, 0, TAG_BYTES, total - TAG_BYTES);
  fs.closeSync(fd);
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("not_backup");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, head.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  let pending = Buffer.alloc(0);
  let entry = null;
  const result = { files: 0, bytes: 0 };
  const parser = new Writable({
    async write(chunk, encoding, done) {
      pending = Buffer.concat([pending, chunk]);
      try {
        for (;;) {
          if (!entry) {
            if (pending.length < 4) break;
            const size = pending.readUInt32BE(0);
            if (size > 4096) throw new Error("bad_entry");
            if (pending.length < 4 + size) break;
            entry = JSON.parse(pending.subarray(4, 4 + size).toString("utf8"));
            pending = pending.subarray(4 + size);
          }
          if (pending.length < entry.s) break;
          await onEntry(String(entry.p), pending.subarray(0, entry.s));
          result.files += 1;
          result.bytes += entry.s;
          pending = pending.subarray(entry.s);
          entry = null;
        }
        done();
      } catch (error) {
        done(error);
      }
    },
    final(done) {
      done(entry || pending.length ? new Error("truncated") : null);
    },
  });
  await pipeline(fs.createReadStream(file, { start: HEAD_BYTES, end: total - TAG_BYTES - 1 }), decipher, zlib.createGunzip(), parser);
  return result;
}

function verifyBackup(file) {
  return openBackup(file, async () => {});
}

async function restoreBackup(file) {
  const target = path.join(__dirname, `data-restored-${stampOf(new Date())}`);
  const temp = `${target}.part`;
  fs.mkdirSync(temp, { recursive: true });
  try {
    const result = await openBackup(file, async (rel, data) => {
      const out = path.resolve(temp, rel);
      if (!out.startsWith(temp + path.sep)) throw new Error("bad_path");
      await fs.promises.mkdir(path.dirname(out), { recursive: true });
      await fs.promises.writeFile(out, data, { mode: 0o600 });
    });
    fs.renameSync(temp, target);
    return { ...result, folder: target };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

function schedule(onResult) {
  let running = null;
  const run = () => {
    if (!running) {
      running = createBackup()
        .then((result) => {
          if (onResult) onResult(null, result);
          return result;
        }, (error) => {
          if (onResult) onResult(error);
          throw error;
        })
        .finally(() => {
          running = null;
        });
    }
    return running;
  };
  const tick = () => {
    const saved = readStatus();
    const now = Date.now();
    const last = Date.parse(saved.lastAt) || 0;
    const failed = Date.parse(saved.failedAt) || 0;
    if (now - failed < HOUR_MS) return;
    const atHour = new Date(now).getHours() === config().hour && now - last > WEEK_MS - 2 * HOUR_MS;
    const overdue = now - last > WEEK_MS + DAY_MS;
    if (atHour || overdue) run().catch(() => {});
  };
  setTimeout(tick, 60 * 1000).unref();
  setInterval(tick, 10 * 60 * 1000).unref();
  return run;
}

module.exports = { createBackup, openBackup, restoreBackup, schedule, status, verifyBackup, writeArchive };

if (require.main === module) {
  const [command, file] = process.argv.slice(2);
  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const fail = (error) => {
    const known = { no_key: "data/backup.key is missing. Put the saved key file back first.", not_backup: "This is not a BQ Connect backup file.", too_small: "The file is too small to be a backup." };
    console.log(`FAILED: ${known[error && error.message] || "the file is damaged or the key does not match."}`);
    process.exit(1);
  };
  if (!command) {
    createBackup().then((result) => {
      console.log(`Backup saved: ${result.file}`);
      console.log(`${result.files} files, ${mb(result.size)}`);
    }, () => {
      console.log("FAILED: could not write the backup. Check the backup folder in data/backup.json.");
      process.exit(1);
    });
  } else if ((command === "verify" || command === "restore") && file) {
    const task = command === "verify" ? verifyBackup(path.resolve(file)) : restoreBackup(path.resolve(file));
    task.then((result) => {
      console.log(`OK: ${result.files} files, ${mb(result.bytes)}`);
      if (result.folder) console.log(`Restored into: ${result.folder}\nStop the server, then swap this folder with data to use it.`);
    }, fail);
  } else {
    console.log("Usage: node backup.js | node backup.js verify <file> | node backup.js restore <file>");
    process.exit(1);
  }
}
