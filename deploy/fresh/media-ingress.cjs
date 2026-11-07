// Fresh-only disk ingress. No database lock is held while the phone uploads.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const crypto = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const limits = {
  "image/jpeg": ["jpg", 4 * 1024 * 1024], "image/png": ["png", 4 * 1024 * 1024],
  "image/webp": ["webp", 4 * 1024 * 1024], "video/mp4": ["mp4", 30 * 1024 * 1024],
  "video/webm": ["webm", 30 * 1024 * 1024], "video/quicktime": ["mov", 30 * 1024 * 1024]
};
async function hashFile(file) {
  const h = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
async function capture(req, { idleMs = 30000, totalMs = 180000 } = {}) {
  const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  const kind = limits[mime];
  if (!kind) throw Error("bad_type");
  if (Number(req.headers["content-length"]) > kind[1]) throw Error("body_too_large");
  if (!req.headers["x-session"]) throw Error("employee_required");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bq-upload-"));
  fs.chmodSync(dir, 0o700);
  const file = path.join(dir, "body"), controller = new AbortController();
  let size = 0, idle, reason = "body_timeout";
  const reset = () => { clearTimeout(idle); idle = setTimeout(() => controller.abort(), idleMs); };
  const total = setTimeout(() => controller.abort(), totalMs);
  const meter = new Transform({ transform(chunk, encoding, done) {
    size += chunk.length; reset();
    if (size > kind[1]) { reason = "body_too_large"; done(Error(reason)); }
    else done(null, chunk);
  } });
  reset();
  try {
    await pipeline(req, meter, fs.createWriteStream(file, { flags: "wx", mode: 0o600 }),
      { signal: controller.signal });
    const checksum = await hashFile(file);
    // A collision-resistant body commitment, not the whole body in RAM.
    const bytes = Buffer.from(JSON.stringify({ mime, size, checksum }));
    const { Readable } = require("node:stream");
    const replay = Readable.from([]);
    for (const key of ["method", "url", "headers", "rawHeaders", "httpVersion", "socket"]) replay[key] = req[key];
    replay.freshUpload = { file, size, mime, ext: kind[0] };
    return { req: replay, bytes, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw Error(error.message === "body_too_large" ? error.message :
      controller.signal.aborted ? reason : "body_aborted");
  } finally { clearTimeout(idle); clearTimeout(total); }
}
// Preserve the old privacy rule without reading a 30MiB movie into memory.
function scrubIso(file) {
  const fd = fs.openSync(file, "r+"), end = fs.fstatSync(fd).size;
  const header = Buffer.alloc(16);
  function boxes(start, stop, visit) {
    for (let at = start; at + 8 <= stop;) {
      fs.readSync(fd, header, 0, Math.min(16, stop - at), at);
      let size = header.readUInt32BE(0), length = 8;
      const type = header.toString("latin1", 4, 8);
      if (size === 1) { const big = header.readBigUInt64BE(8); if (big > BigInt(Number.MAX_SAFE_INTEGER)) return; size = Number(big); length = 16; }
      if (!size) size = stop - at;
      if (size < length || at + size > stop) return;
      visit(type, at, length, size); at += size;
    }
  }
  try { boxes(0, end, (type, at, length, size) => {
    if (type === "moov") boxes(at + length, at + size, (child, pos) => {
      if (child === "udta" || child === "meta") fs.writeSync(fd, Buffer.from("free"), 0, 4, pos + 4);
    });
  }); } finally { fs.closeSync(fd); }
}
// Inspect the declared ISO container, not its filename/MIME. No transcoder
// runs on the server; HEVC is not silently advertised as cross-browser AVC.
function inspectIso(file) {
  const fd = fs.openSync(file, "r"), total = fs.fstatSync(fd).size;
  let seconds = null, avc = false, hevc = false, visited = 0;
  function walk(start, end, depth = 0) {
    if (depth > 8) throw Error("bad_type");
    const head = Buffer.alloc(16);
    for (let at = start; at + 8 <= end;) {
      if (++visited > 10000) throw Error("bad_type");
      fs.readSync(fd, head, 0, Math.min(16, end - at), at);
      let size = head.readUInt32BE(), h = 8;
      const kind = head.toString("ascii", 4, 8);
      if (size === 1) { const n = head.readBigUInt64BE(8); if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("bad_type"); size = Number(n); h = 16; }
      if (!size) size = end - at;
      if (size < h || at + size > end) throw Error("bad_type");
      if (kind === "mvhd") {
        const b = Buffer.alloc(Math.min(32, size - h));
        fs.readSync(fd, b, 0, b.length, at + h);
        const version = b[0], offset = version === 1 ? 20 : 12;
        if (b.length < offset + (version === 1 ? 12 : 8) || ![0, 1].includes(version)) throw Error("bad_type");
        const scale = b.readUInt32BE(offset);
        seconds = scale ? Number(version === 1 ? b.readBigUInt64BE(offset + 4) : b.readUInt32BE(offset + 4)) / scale : null;
      } else if (kind === "stsd") {
        const b = Buffer.alloc(8);
        if (size < h + 8) throw Error("bad_type");
        fs.readSync(fd, b, 0, 8, at + h);
        const count = b.readUInt32BE(4);
        let pos = at + h + 8;
        if (count > 256) throw Error("bad_type");
        for (let i = 0; i < count; i++) {
          if (pos + 8 > at + size) throw Error("bad_type");
          fs.readSync(fd, b, 0, 8, pos);
          const length = b.readUInt32BE(), codec = b.toString("ascii", 4, 8);
          if (length < 8 || pos + length > at + size) throw Error("bad_type");
          avc ||= ["avc1", "avc3"].includes(codec);
          hevc ||= ["hvc1", "hev1"].includes(codec); pos += length;
        }
      } else if (["moov", "trak", "mdia", "minf", "stbl"].includes(kind)) walk(at + h, at + size, depth + 1);
      at += size;
    }
  }
  try { walk(0, total); } finally { fs.closeSync(fd); }
  return { seconds, avc, hevc };
}
async function stage(upload, { context, owner, looksRight, stripMetadata }) {
  const head = Buffer.alloc(16), fd = fs.openSync(upload.file, "r");
  try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
  if (upload.size < 16 || !looksRight(upload.ext, head)) throw Error("bad_type");
  if (["mov", "mp4"].includes(upload.ext)) {
    const info = inspectIso(upload.file);
    if (info.hevc || !info.avc || !Number.isFinite(info.seconds) || info.seconds <= 0) throw Error("bad_type");
    if (info.seconds > 60.5) throw Error("video_too_long");
    scrubIso(upload.file);
  }
  // Images retain the existing metadata sanitizer, bounded to the old 4MiB limit.
  else if (upload.mime.startsWith("image/"))
    fs.writeFileSync(upload.file, stripMetadata(upload.ext, fs.readFileSync(upload.file)), { mode: 0o600 });
  const id = crypto.randomUUID(), legacy = `/media/${id}.${upload.ext}`;
  context.media.set(legacy, { new: true, id, legacy, file: upload.file,
    sha: await hashFile(upload.file), size: fs.statSync(upload.file).size, mime: upload.mime, owner });
  return legacy;
}
module.exports = { capture, stage, hashFile, scrubIso, inspectIso, limits };
