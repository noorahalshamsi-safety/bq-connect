// Synthetic unit/transport tests only. No Production credentials/resources.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const vm = require("node:vm"), crypto = require("node:crypto"), { PassThrough, Readable } = require("node:stream");
const { capture, stage, hashFile, inspectIso } = require("../../deploy/fresh/media-ingress.cjs");
const { base } = require("../../deploy/fresh/config.cjs");
async function main() {
  const app = fs.readFileSync(path.join(base, "public/js/app.js"), "utf8");
  new vm.Script(require("../../deploy/fresh/mobile-client.cjs").transform(
    require("../../deploy/fresh/post-client.cjs").transform(app)));
  const store = new Map([["rd-session", JSON.stringify({ token: "SYNTHETIC_SESSION" })]]);
  let response, cleared = 0, calls = 0;
  const context = vm.createContext({ Response, AbortController, setTimeout, clearTimeout, Error, selectedPerson: null,
    localStorage: { getItem: k => store.get(k), removeItem: k => store.delete(k) },
    clearSession: () => { cleared++; store.delete("rd-session"); },
    fetch: async () => { calls++; if (response instanceof Error) throw response; return response; },
    window: { addEventListener() {} }, document: { addEventListener() {} } });
  vm.runInContext(fs.readFileSync("deploy/fresh/session-client.txt", "utf8"), context);
  for (const value of [new Error("offline"), new Response("{}", { status: 503 }),
    new Response("{}", { status: 429 }), new Response("{}", { status: 408 })]) {
    response = value; await assert.rejects(context.restoreSession());
    assert(store.has("rd-session")); assert.equal(cleared, 0);
  }
  response = new Response('{"person":{"pid":"synthetic"}}');
  assert.equal(await context.restoreSession(), true);
  assert.equal(context.selectedPerson.token, "SYNTHETIC_SESSION");
  response = new Response("{}", { status: 401 });
  assert.equal(await context.restoreSession(), false); assert.equal(cleared, 1);
  const requests = [];
  class XHR {
    constructor() { this.upload = {}; this.headers = {}; requests.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(k, v) { this.headers[k] = v; }
    send(blob) { this.blob = blob; }
  }
  const client = vm.createContext({ crypto, XMLHttpRequest: XHR,
    selectedPerson: { token: "SYNTHETIC_SESSION" }, clearSession() {} });
  vm.runInContext(fs.readFileSync("deploy/fresh/media-client.txt", "utf8"), client);
  const blob = { type: "video/mp4" }, fractions = [];
  for (const fraction of [0, .25, .41, .9, 1]) {
    const pending = client.uploadMedia(blob, part => fractions.push(part));
    const x = requests.at(-1); x.upload.onprogress({ lengthComputable: true, loaded: fraction * 100, total: 100 });
    x.onerror(); await assert.rejects(pending, { message: "media_uncertain" });
  }
  assert.equal(new Set(requests.map(x => x.headers["Idempotency-Key"])).size, 1);
  assert.deepEqual(fractions, [0, .25, .41, .9, 1]);
  const success = client.uploadMedia(blob);
  requests.at(-1).status = 201; requests.at(-1).response = { url: "/media/synthetic.mp4" };
  requests.at(-1).onload(); assert.equal(await success, "/media/synthetic.mp4");
  for (const [status, message] of [[409, "post_conflict"], [415, "media_format"], [413, "big"], [429, "post_limited"]]) {
    const pending = client.uploadMedia(blob);
    Object.assign(requests.at(-1), { status, response: {} }); requests.at(-1).onload();
    await assert.rejects(pending, { message });
  }
  function request(stream, size) {
    Object.assign(stream, { method: "POST", url: "/api/media", headers: {
      "content-type": "video/mp4", "content-length": size, "x-session": "SYNTHETIC_SESSION" } });
    return stream;
  }
  const atom = (kind, data) => {
    const b = Buffer.alloc(8 + data.length); b.writeUInt32BE(b.length); b.write(kind, 4); data.copy(b, 8); return b;
  };
  const mvhd = Buffer.alloc(20); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(1000, 16);
  const stsd = Buffer.concat([Buffer.from([0,0,0,0,0,0,0,1]), atom("avc1", Buffer.alloc(0))]);
  const movie = Buffer.concat([atom("ftyp", Buffer.alloc(8)),
    atom("moov", Buffer.concat([atom("mvhd", mvhd), atom("trak", atom("mdia", atom("minf", atom("stbl", atom("stsd", stsd)))))])),
    atom("free", Buffer.alloc(1024 * 1024))]);
  const captured = await capture(request(Readable.from([movie]), movie.length));
  try {
    assert(captured.bytes.length < 200); assert.equal(fs.statSync(captured.req.freshUpload.file).mode & 0o777, 0o600);
    const context = { media: new Map() };
    const url = await stage(captured.req.freshUpload, { context, owner: "synthetic",
      looksRight: (ext, head) => ext === "mp4" && head.toString("ascii", 4, 8) === "ftyp" });
    const row = context.media.get(url);
    assert(!row.bytes); assert.equal(row.size, movie.length); assert.equal(row.sha, await hashFile(row.file));
    assert.deepEqual(inspectIso(row.file), { seconds: 1, avc: true, hevc: false });
    const { ImmutableStore } = require(path.join(base, "deploy/staging/object-store.cjs"));
    const dataset = "staging-synthetic-" + crypto.randomUUID();
    let stored = false, writes = 0, corrupt = false, stall = false;
    const client = {
      exists: async () => ({ ok: true, value: stored }),
      uploadFromFilename: async () => { writes++; stored = true; return { ok: true, value: null }; },
      downloadAsStream: () => stall ? new PassThrough() : fs.createReadStream(corrupt ? __filename : row.file)
    };
    const objects = new ImmutableStore(client, { dataset, timeoutMs: 30 });
    assert.equal((await objects.putFile(row.id, row.file, row.sha)).state, "stored");
    assert.equal((await objects.putFile(row.id, row.file, row.sha)).state, "present");
    assert.equal(writes, 1);
    corrupt = true;
    await assert.rejects(objects.putFile(row.id, row.file, row.sha), { message: "object_corrupt" });
    corrupt = false; stall = true;
    await assert.rejects(objects.putFile(row.id, row.file, row.sha), { message: "object_store_timeout" });
    const hevc = Buffer.from(movie); hevc.write("hvc1", hevc.indexOf("avc1"));
    fs.writeFileSync(row.file, hevc);
    await assert.rejects(stage(captured.req.freshUpload, { context: { media: new Map() },
      looksRight: () => true, owner: "synthetic" }), { message: "bad_type" });
    const long = Buffer.from(movie);
    const mvhdAt = long.indexOf("mvhd") + 4; long.writeUInt32BE(61000, mvhdAt + 16);
    fs.writeFileSync(row.file, long);
    await assert.rejects(stage(captured.req.freshUpload, { context: { media: new Map() },
      looksRight: () => true, owner: "synthetic" }), { message: "video_too_long" });
  } finally { captured.cleanup(); }
  assert(!fs.existsSync(captured.req.freshUpload.file));
  await assert.rejects(capture(request(Readable.from([]), 31 * 1024 * 1024)), { message: "body_too_large" });
  for (const cut of [0, .25, .41, .9]) {
    const stream = request(new PassThrough(), movie.length);
    const pending = capture(stream, { idleMs: 100, totalMs: 1000 });
    stream.write(movie.subarray(0, movie.length * cut));
    stream.destroy(Error("synthetic_disconnect"));
    await assert.rejects(pending, { message: "body_aborted" });
  }
  const slow = request(new PassThrough(), 16);
  await assert.rejects(capture(slow, { idleMs: 15, totalMs: 100 }), { message: "body_timeout" });
  // A transfer longer than its idle window succeeds while bytes continue.
  const trickle = request(new PassThrough(), 32);
  const pending = capture(trickle, { idleMs: 100, totalMs: 1000 });
  trickle.write(Buffer.alloc(16)); await new Promise(r => setTimeout(r, 60));
  trickle.write(Buffer.alloc(16)); await new Promise(r => setTimeout(r, 60)); trickle.end();
  const complete = await pending; complete.cleanup();
  console.log(JSON.stringify({ result: "PASS", syntheticOnly: true,
    transientSessionPreserved: true, revokedSessionCleared: true,
    uploadProgressFailureFractions: [0, 25, 41, 90, 100], unchangedRetryKey: true,
    diskIngress: true, disconnectAndTimeoutCleanup: true, activeSlowTransfer: true,
    productionAccess: false, physicalIphoneTest: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
