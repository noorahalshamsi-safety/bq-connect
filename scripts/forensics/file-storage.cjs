// Filesystem-only App Storage stand-in. It cannot connect to a network service.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function assertTemporary(root) {
  const resolved = path.resolve(root);
  if (!resolved.startsWith(path.join(os.tmpdir(), "bq-forensics-"))) {
    throw new Error("Forensic fixtures must be under a dedicated temporary directory");
  }
  return resolved;
}

function files(root, base = root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? files(file, base) : [path.relative(base, file).split(path.sep).join("/")];
  }).sort();
}

class FileStorage {
  constructor(root, options = {}) {
    this.root = assertTemporary(root);
    fs.mkdirSync(this.root, { recursive: true });
    this.options = options;
    this.downloads = 0;
    this.writes = 0;
    this.beforeUpload = null;
  }

  file(name) {
    const file = path.resolve(this.root, name);
    if (!file.startsWith(this.root + path.sep)) throw new Error("Unsafe fixture object name");
    return file;
  }

  async list({ prefix }) {
    if (this.options.failList) return { ok: false, error: { message: "injected list failure" } };
    return { ok: true, value: files(this.root).filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
  }

  async exists(name) {
    return { ok: true, value: fs.existsSync(this.file(name)) };
  }

  async downloadAsBytes(name) {
    this.downloads += 1;
    if (this.options.failDownload === name || this.options.failAtDownload === this.downloads) {
      return { ok: false, error: { message: "injected download failure" } };
    }
    try {
      return { ok: true, value: fs.readFileSync(this.file(name)) };
    } catch {
      return { ok: false, error: { message: "fixture object missing" } };
    }
  }

  async downloadAsText(name) {
    const result = await this.downloadAsBytes(name);
    return result.ok ? { ok: true, value: result.value.toString("utf8") } : result;
  }

  async uploadFromBytes(name, bytes) {
    if (this.beforeUpload) await this.beforeUpload(name, bytes);
    const file = this.file(name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    this.writes += 1;
    return { ok: true };
  }

  async uploadFromText(name, text) {
    return this.uploadFromBytes(name, Buffer.from(text));
  }

  async delete(name) {
    fs.rmSync(this.file(name), { force: true });
    this.writes += 1;
    return { ok: true };
  }
}

module.exports = { FileStorage, assertTemporary, files };
