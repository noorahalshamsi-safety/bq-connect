/*
 * Reproducible forensic experiments, not production remediation.
 * Uses only copied source, invented records, loopback HTTP and FileStorage.
 * Exit 1 means a safety expectation failed; it does not mean production was tested.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const net = require("node:net");
const { spawn, spawnSync } = require("node:child_process");
const { FileStorage, files } = require("./file-storage.cjs");

const workspace = path.resolve(__dirname, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bq-forensics-"));
const sourceFiles = ["start.js", "storage-sync.js", "vault.js", "auth.js", "backup.js",
  "server.js", "moderation.js", "push.js", "spark-agent.js", "translate.js", "persistence-safety.js"];
const baselineName = "vault/bq-20260101-000000-start.bqb";
const password = "SyntheticOnly-password-123";
const children = new Set();
const observedContexts = new Map();
const results = [];
const selected = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7).split(",");
// Documented invariant adaptations: rejection BEFORE activation/write is now
// correct for these negative scenarios. Unlisted exceptions remain BLOCKED.
// Provider-dependent positive scenarios are NOT converted into passing tests.
const expectedGuards = {
  T08: ["critical_json_missing_or_corrupt"], T09: ["critical_json_missing_or_corrupt", "authoritative_index_unavailable"],
  T10: ["critical_key_missing"], T11: ["account_generation_rollback"],
  T12: ["account_membership_loss"], T13: ["dataset_provisioning_requires_approval"],
  T14: ["durable_commit_provider_unavailable"], T15: ["durable_commit_provider_unavailable"],
  T19: ["referenced_media_missing"], T23: ["import_2fa_key_domain_mismatch"],
  T27: ["critical_json_missing_or_corrupt"], T28: ["backup_key_missing_or_invalid"],
  T34: ["account_membership_loss"],
};
let sequence = 0;
let fixture;
let token;
let totpSecret;

const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value), { mode: 0o600 });
}
const dataFile = (context, name) => path.join(context.app, "data", name);
const accounts = (context) => json(dataFile(context, "accounts.json"));
const load = (context, module) => {
  observe(context);
  return require(path.join(context.app, `${module}.js`));
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function codeCopy(destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const name of sourceFiles) fs.copyFileSync(path.join(workspace, name), path.join(destination, name));
}

function inventory(app) {
  const root = path.join(app, "data");
  const names = ["accounts.json", "employees.json", "ideas.json", "session.key", "backup.key",
    ...files(path.join(root, "media")).map((name) => `media/${name}`)];
  const hashes = Object.fromEntries(names.map((name) => [name,
    fs.existsSync(path.join(root, name)) ? hash(fs.readFileSync(path.join(root, name))) : null]));
  const read = (name) => {
    try { return json(path.join(root, name)); } catch { return null; }
  };
  const accountRows = read("accounts.json");
  const employees = read("employees.json");
  const posts = read("ideas.json");
  return {
    accounts: accountRows ? Object.values(accountRows).filter((row) => row?.hash).length : null,
    employees: Array.isArray(employees) ? employees.length : null,
    posts: Array.isArray(posts) ? posts.filter((row) => row?.type !== "story").length : null,
    stories: Array.isArray(posts) ? posts.filter((row) => row?.type === "story").length : null,
    media: files(path.join(root, "media")).length, hashes, integrity: hash(JSON.stringify(hashes)),
  };
}

function observe(context) {
  if (!observedContexts.has(context.app)) {
    observedContexts.set(context.app, { context, before: {
      local: inventory(context.app), persistent: inventory(context.objects),
    } });
  }
}

function evidence() {
  return [...observedContexts.values()].map(({ context, before }, index) => {
    const after = { local: inventory(context.app), persistent: inventory(context.objects) };
    return {
      fixture: `synthetic-${index + 1}`, before, after,
      localUnchanged: before.local.integrity === after.local.integrity,
      persistentUnchanged: before.persistent.integrity === after.persistent.integrity,
    };
  });
}

function summary(app) {
  const root = path.join(app, "data");
  const accountRows = json(path.join(root, "accounts.json"));
  const posts = json(path.join(root, "ideas.json"));
  return {
    accounts: Object.values(accountRows).filter((row) => row?.hash).length,
    employees: json(path.join(root, "employees.json")).length,
    posts: posts.filter((row) => row.type !== "story").length,
    stories: posts.filter((row) => row.type === "story").length,
    media: files(path.join(root, "media")).length,
    integrity: hash(["accounts.json", "employees.json", "ideas.json", "session.key",
      ...files(path.join(root, "media")).map((name) => `media/${name}`)]
      .map((name) => `${name}:${hash(fs.readFileSync(path.join(root, name)))}`).join("|")),
  };
}

function totp(secret, offset = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = Buffer.from((bits.match(/.{8}/g) || []).map((part) => parseInt(part, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const digest = crypto.createHmac("sha1", bytes).update(counter).digest();
  const start = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(start) & 0x7fffffff) % 1000000).padStart(6, "0");
}

async function makeFixture() {
  const app = path.join(temp, "fixture");
  codeCopy(app);
  write(path.join(app, "data/session.key"), crypto.randomBytes(48).toString("hex"));
  write(path.join(app, "data/accounts.json"), {});
  write(path.join(app, "data/backup.key"), crypto.randomBytes(32).toString("hex"));
  write(path.join(app, "data/employees.json"), [101, 102, 103, 104].map((badge) => ({
    badge: String(badge), name: `Synthetic employee ${badge}`, department: "Synthetic test", position: "Test only",
  })));
  const mediaId = "00000000-0000-4000-8000-000000000001";
  write(path.join(app, `data/media/${mediaId}.png`), Buffer.from("synthetic media, not a production image"));
  write(path.join(app, "data/ideas.json"), [
    ...[1, 2, 3].map((number) => ({ id: `synthetic-post-${number}`, number, type: "post",
      title: "Synthetic post", badge: "101", media: { url: `/media/${mediaId}.png` } })),
    { id: "synthetic-story", number: 4, type: "story", badge: "101" },
  ]);
  const auth = require(path.join(app, "auth.js"));
  for (const badge of ["101", "102", "103", "104"]) {
    await auth.setPassword(badge, password, { email: `synthetic-${badge}@example.invalid` });
  }
  const setup = auth.beginTwoFactor("101");
  totpSecret = setup.secret;
  assert.ok(auth.confirmTwoFactor("101", totp(totpSecret)));
  token = auth.signSession("101", { device: {} });
  assert.equal(auth.readSession(token), "101");
  fixture = app;
}

async function makeCase({ remote = true, local = true } = {}) {
  const root = path.join(temp, `case-${++sequence}`);
  const context = { root, app: path.join(root, "app"), objects: path.join(root, "objects") };
  codeCopy(context.app);
  if (local) fs.cpSync(path.join(fixture, "data"), path.join(context.app, "data"), { recursive: true });
  context.client = new FileStorage(context.objects);
  if (remote) {
    for (const name of files(path.join(fixture, "data"))) {
      await context.client.uploadFromBytes(`data/${name}`, fs.readFileSync(path.join(fixture, "data", name)));
    }
    await context.client.uploadFromText("meta/bq-storage-seeded", new Date().toISOString());
    await context.client.uploadFromText("vault/index.json", JSON.stringify([{
      name: baselineName, at: "2026-01-01T00:00:00Z", reason: "start",
      counts: { accounts: 4, posts: 3, employees: 4 },
    }]));
  }
  observe(context);
  return context;
}

function mirror(context, client = context.client) {
  return load(context, "storage-sync").createSync({
    root: context.app, client, dirs: ["data", "backups"], log: () => {},
  });
}

function manifestFor(context) {
  return { version: 1, datasetId: "synthetic-dataset", generation: 2, bucketFingerprint: "deadbeef1234",
    files: Object.fromEntries(files(dataFile(context, "")).map((name) => [name, hash(fs.readFileSync(dataFile(context, name)))])) };
}
function guarded(run, expected) {
  try { run(); return false; } catch (error) { return error.code === expected; }
}

async function test(id, scenario, expectation, run) {
  if (selected && !selected.includes(id)) return;
  observedContexts.clear();
  try {
    const result = await run();
    const row = { id, scenario, expectation, status: result.safe ? "PASS" : "FAIL", observed: result.observed, evidence: evidence() };
    results.push(row);
    console.log(`${row.status} ${id}: ${scenario} — ${row.observed}`);
  } catch (error) {
    if (expectedGuards[id]?.includes(error.code)) {
      const proof = evidence();
      if (["T14", "T15"].includes(id)) assert.ok(proof.every((row) => row.persistentUnchanged), "A rejected shrink still changed persistent data");
      results.push({ id, scenario, expectation, status: "PASS", observed: `Rejected before unsafe activation/commit: ${error.code}`, evidence: proof,
        adaptation: "Fail-closed rejection replaces the original unsafe continuation; expected security invariant unchanged. This does not establish functional recovery or distributed durability." });
      console.log(`PASS ${id}: expected guard ${error.code}`);
      return;
    }
    results.push({ id, scenario, expectation, status: "BLOCKED", observed: error.message, evidence: evidence() });
    console.log(`BLOCKED ${id}: ${scenario} — ${error.message}`);
  }
}

async function availablePort() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

async function launch(context, options = {}) {
  observe(context);
  const port = await availablePort();
  const settings = JSON.stringify({
    app: context.app, objects: context.objects,
    connectionFailure: Boolean(options.connectionFailure), storageOptions: options.storageOptions || {},
    failPromotion: options.failPromotion,
    localOnly: Boolean(options.localOnly),
  });
  const processChild = spawn(process.execPath, [path.join(__dirname, "startup-worker.cjs"), settings], {
    cwd: context.app,
    env: { PATH: process.env.PATH || "", HOME: context.root, TMPDIR: os.tmpdir(), HOST: "127.0.0.1",
      PORT: String(port), REPL_ID: "synthetic-forensics", REPLIT_DEPLOYMENT: options.localOnly ? "" : "1",
      ...(options.expectedManifest ? { BQ_EXPECTED_DATASET_ID: options.expectedManifest.datasetId,
        BQ_EXPECTED_GENERATION: String(options.expectedManifest.generation),
        BQ_EXPECTED_BUCKET_FINGERPRINT: options.expectedManifest.bucketFingerprint } : {}),
      BQ_TRANSLATE: "0", BACKUP_DIR: path.join(context.app, "backups") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(processChild);
  let output = "";
  let maintenanceSeen = false;
  processChild.stdout.on("data", (bytes) => { output += bytes.toString(); });
  processChild.stderr.on("data", (bytes) => { output += bytes.toString(); });
  const worker = {
    process: processChild, port, output: () => output,
    maintenanceSeen: () => maintenanceSeen,
    async session() {
      const response = await fetch(`http://127.0.0.1:${port}/api/session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }), signal: AbortSignal.timeout(800),
      });
      return { status: response.status, contentType: response.headers.get("content-type"), text: await response.text() };
    },
    async stop(force = false) {
      if (processChild.exitCode !== null || processChild.signalCode !== null) return;
      const exited = new Promise((resolve) => processChild.once("exit", resolve));
      processChild.kill(force ? "SIGKILL" : "SIGTERM");
      const timer = setTimeout(() => processChild.kill("SIGKILL"), 5000);
      timer.unref();
      await exited;
      clearTimeout(timer);
      children.delete(processChild);
    },
  };
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processChild.exitCode !== null) throw new Error(`Synthetic startup exited ${processChild.exitCode}: ${output.slice(-800)}`);
    try {
      const response = await worker.session();
      if (response.text.includes("maintenance")) maintenanceSeen = true;
      if ((options.connectionFailure || options.expectMaintenance) && response.text.includes("maintenance")) return worker;
      if (response.contentType?.includes("application/json") && response.status === (options.expectedSessionStatus || 200)) {
        for (let wait = 0; !options.localOnly && wait < 60 && !output.includes("Vault: saved"); wait += 1) await delay(50);
        return worker;
      }
    } catch {}
    await delay(50);
  }
  await worker.stop(true);
  throw new Error("Synthetic startup did not reach the expected state");
}

async function main() {
  await makeFixture();
  const fixtureState = summary(fixture);
  let normal;
  await test("T01", "Fresh provisioned startup", "Invented accounts, session, posts and media remain intact", async () => {
    normal = await makeCase({ remote: false });
    const worker = await launch(normal);
    const response = await worker.session();
    await worker.stop();
    return { safe: response.status === 200 && summary(normal.app).integrity === fixtureState.integrity,
      observed: `Real start.js/server.js returned synthetic session HTTP ${response.status}; core integrity unchanged=${summary(normal.app).integrity === fixtureState.integrity}` };
  });
  await test("T02", "Application restart", "Same key and persisted synthetic session remain usable", async () => {
    assert.ok(normal);
    const worker = await launch(normal);
    const response = await worker.session();
    await worker.stop();
    return { safe: response.status === 200 && summary(normal.app).integrity === fixtureState.integrity,
      observed: `Restart HTTP ${response.status}; core byte integrity unchanged=${summary(normal.app).integrity === fixtureState.integrity}` };
  });
  await test("T03", "Clean rebuild and persistent restore", "New source tree without local data recovers all fixtures", async () => {
    const app = path.join(normal.root, "rebuilt");
    codeCopy(app);
    const rebuilt = { ...normal, app };
    const worker = await launch(rebuilt);
    const response = await worker.session();
    await worker.stop();
    return { safe: response.status === 200 && summary(app).integrity === fixtureState.integrity,
      observed: `Clean tree restored; HTTP ${response.status}; accounts/posts/media/key integrity equal=${summary(app).integrity === fixtureState.integrity}` };
  });
  await test("T04", "Republish-equivalent stale bundle", "Remote canonical data replaces stale bundled accounts/key", async () => {
    const app = path.join(normal.root, "republished");
    codeCopy(app);
    fs.cpSync(path.join(fixture, "data"), path.join(app, "data"), { recursive: true });
    write(path.join(app, "data/accounts.json"), {});
    write(path.join(app, "data/session.key"), crypto.randomBytes(48).toString("hex"));
    const republished = { ...normal, app };
    const worker = await launch(republished);
    await worker.stop();
    return { safe: summary(app).integrity === fixtureState.integrity,
      observed: `Canonical data restored over empty bundled account file and different test key; integrity equal=${summary(app).integrity === fixtureState.integrity}` };
  });
  await test("T05", "Interrupted object restore", "Failure does not mutate remote data; retry restores complete fixture", async () => {
    const context = await makeCase();
    const client = context.client;
    client.options.failAtDownload = 3;
    const sync = mirror(context);
    const writes = client.writes;
    let threw = false;
    try { await sync.restore(); } catch { threw = true; }
    const remoteUntouched = client.writes === writes;
    client.options.failAtDownload = null;
    await sync.restore();
    return { safe: threw && remoteUntouched && summary(context.app).integrity === fixtureState.integrity,
      observed: `Restore threw=${threw}; no remote writes before retry=${remoteUntouched}; retry integrity=${summary(context.app).integrity === fixtureState.integrity}; partial local files can exist before retry` };
  });
  await test("T06", "Unavailable storage connection", "Do not load the actual app while storage cannot connect", async () => {
    const context = await makeCase();
    const before = summary(context.app).integrity;
    const worker = await launch(context, { connectionFailure: true });
    const response = await worker.session();
    const loaded = worker.output().includes("BQ Connect: http");
    await worker.stop(true);
    return { safe: !loaded && summary(context.app).integrity === before,
      observed: `Maintenance HTML HTTP ${response.status}; app loaded=${loaded}; fixture integrity unchanged=${summary(context.app).integrity === before}` };
  });
  await test("T07", "Seeded bucket loses all data objects", "Refuse restore when marker exists but data prefix is empty", async () => {
    const context = await makeCase();
    fs.rmSync(path.join(context.objects, "data"), { recursive: true });
    let blocked = false;
    try { await mirror(context).restore(); } catch { blocked = true; }
    return { safe: blocked, observed: `Empty seeded bucket blocked=${blocked}` };
  });
  await test("T08", "Missing account object with valid baseline", "Count drop blocks serving", async () => {
    const context = await makeCase({ local: false });
    await context.client.delete("data/accounts.json");
    await mirror(context).restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    return { safe: Boolean(reason), observed: `Count-drop check blocked=${Boolean(reason)}; missing accounts do not by themselves make restore() fail` };
  });
  await test("T09", "Unreadable snapshot index", "An unreadable integrity baseline must fail closed", async () => {
    const context = await makeCase({ local: false });
    await context.client.delete("data/accounts.json");
    await mirror(context).restore();
    context.client.options.failDownload = "vault/index.json";
    const reason = await load(context, "vault").checkDrop(context.client);
    load(context, "auth");
    const absent = !fs.existsSync(dataFile(context, "accounts.json"));
    return { safe: Boolean(reason), observed: `Baseline download fails; checkDrop returns no objection=${!reason}; account file absent=${absent}` };
  });
  await test("T10", "Missing session key", "Refuse startup rather than regenerate a production authentication key", async () => {
    const context = await makeCase({ local: false });
    await context.client.delete("data/session.key");
    await mirror(context).restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    const auth = load(context, "auth");
    const accepted = auth.readSession(token) === "101";
    const count = Object.values(accounts(context)).filter((row) => row.hash).length;
    return { safe: Boolean(reason) || accepted, observed: `No count objection=${!reason}; replacement key generated=${fs.existsSync(dataFile(context, "session.key"))}; old session accepted=${accepted}; accounts still=${count}` };
  });
  await test("T11", "Same-count older generation", "Detect stale account/session contents even with identical totals", async () => {
    const context = await makeCase();
    const stale = accounts(context);
    stale["101"].ver -= 1;
    stale["101"].sessions = [];
    await context.client.uploadFromText("data/accounts.json", JSON.stringify(stale));
    await mirror(context).restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    return { safe: Boolean(reason), observed: `Same account/employee/post counts accepted=${!reason}; synthetic session valid=${load(context, "auth").readSession(token) === "101"}` };
  });
  await test("T12", "Wrong populated bucket", "Bind restoration to expected dataset identity, not totals alone", async () => {
    const context = await makeCase();
    const wrong = Object.fromEntries(Object.entries(accounts(context)).map(([id, row]) => [`other-${id}`, row]));
    await context.client.uploadFromText("data/accounts.json", JSON.stringify(wrong));
    await mirror(context).restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    return { safe: Boolean(reason), observed: `Different synthetic account identities with equal totals accepted=${!reason}; original synthetic account present=${Boolean(accounts(context)["101"])}` };
  });
  await test("T13", "Wrong empty unmarked bucket", "Do not automatically provision a wrong bucket from bundled data", async () => {
    const context = await makeCase({ remote: false });
    const sync = mirror(context);
    await sync.restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    await sync.flush();
    return { safe: Boolean(reason), observed: `Unmarked empty storage accepted=${!reason}; bundled synthetic accounts uploaded=${(await context.client.exists("data/accounts.json")).value}` };
  });
  await test("T14", "Large empty-account shrink", "Protect populated account object from immediate empty overwrite", async () => {
    const context = await makeCase();
    const sync = mirror(context);
    await sync.restore();
    write(dataFile(context, "accounts.json"), {});
    await sync.flush();
    const remaining = Object.keys(json(path.join(context.objects, "data/accounts.json"))).length;
    return { safe: remaining === 4, observed: `Remote account count after local 4→0 write=${remaining}` };
  });
  await test("T15", "Gradual account shrink", "Any unintended account removal must be blocked", async () => {
    const context = await makeCase();
    const sync = mirror(context);
    await sync.restore();
    const original = accounts(context);
    write(dataFile(context, "accounts.json"), Object.fromEntries(Object.entries(original).slice(0, 2)));
    await sync.flush();
    write(dataFile(context, "accounts.json"), {});
    await sync.flush();
    const remaining = Object.keys(json(path.join(context.objects, "data/accounts.json"))).length;
    return { safe: remaining === 4, observed: `Two allowed local shrinks 4→2→0 leave remote count=${remaining}` };
  });
  await test("T16", "Concurrent account writers", "Two independent writers must not overwrite each other's new account", async () => {
    const context = await makeCase();
    fs.copyFileSync(path.join(context.app, "auth.js"), path.join(context.app, "auth-other.cjs"));
    const first = load(context, "auth");
    const second = require(path.join(context.app, "auth-other.cjs"));
    await Promise.all([first.setPassword("105", password), second.setPassword("106", password)]);
    const count = Object.keys(accounts(context)).length;
    return { safe: count === 6, observed: `Two independent module caches each add one account; expected=6, actual=${count}` };
  });
  await test("T17", "Concurrent sync conflict", "Stale replica must not erase another replica's committed account", async () => {
    const context = await makeCase();
    const replicaApp = path.join(context.root, "replica");
    codeCopy(replicaApp);
    fs.cpSync(path.join(fixture, "data"), path.join(replicaApp, "data"), { recursive: true });
    const replica = { ...context, app: replicaApp };
    const a = mirror(context);
    const b = mirror(replica);
    await a.restore();
    await b.restore();
    await load(context, "auth").setPassword("105", password);
    await a.flush();
    const stale = accounts(replica);
    stale["101"].deviceNote = "synthetic stale replica mutation";
    write(dataFile(replica, "accounts.json"), stale);
    await b.flush();
    const final = json(path.join(context.objects, "data/accounts.json"));
    return { safe: Boolean(final["105"]), observed: `First replica commits account 105; stale replica flush retains it=${Boolean(final["105"])}` };
  });
  await test("T18", "Crash before periodic sync", "An acknowledged local account must survive a clean restore", async () => {
    const context = await makeCase();
    await mirror(context).restore();
    await load(context, "auth").setPassword("105", password);
    const recoveredApp = path.join(context.root, "after-crash");
    codeCopy(recoveredApp);
    const recovered = { ...context, app: recoveredApp };
    await mirror(recovered).restore();
    return { safe: Boolean(accounts(recovered)["105"]), observed: `Local password/account write completed; without flush, cold restore retains new account=${Boolean(accounts(recovered)["105"])}` };
  });
  await test("T19", "Missing remote media", "Missing post media must be detected before serving a clean deployment", async () => {
    const context = await makeCase({ local: false });
    fs.rmSync(path.join(context.objects, "data/media"), { recursive: true });
    await mirror(context).restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    const count = files(dataFile(context, "media")).length;
    return { safe: Boolean(reason), observed: `Account/post counts unchanged; missing media count=${count}; count gate blocks=${Boolean(reason)}` };
  });
  await test("T20", "Explicit session-key mismatch", "Distinguish rejected sessions from physically missing accounts", async () => {
    const context = await makeCase();
    write(dataFile(context, "session.key"), crypto.randomBytes(48).toString("hex"));
    const auth = load(context, "auth");
    const present = Boolean(auth.accountOf("101")?.hash);
    const accepted = auth.readSession(token) === "101";
    return { safe: present && !accepted, observed: `Account still present=${present}; old signed session accepted=${accepted}` };
  });
  await test("T21", "Add-only merge duplicate handling", "Keep existing account/post/media; add missing IDs and renumber collisions", async () => {
    const context = await makeCase();
    const stage = path.join(context.root, "older");
    const original = accounts(context);
    write(path.join(stage, "accounts.json"), { "101": { hash: "synthetic-older-hash" }, "105": original["102"] });
    write(path.join(stage, "ideas.json"), [{ id: "synthetic-post-1", number: 99, type: "post" },
      { id: "new-synthetic-post", number: 1, type: "post" }]);
    const mediaName = files(dataFile(context, "media"))[0];
    write(path.join(stage, "media", mediaName), "older synthetic bytes");
    const mediaBefore = hash(fs.readFileSync(dataFile(context, `media/${mediaName}`)));
    const added = load(context, "vault").mergeInto(dataFile(context, ""), stage);
    const merged = accounts(context);
    const posts = json(dataFile(context, "ideas.json"));
    const safe = merged["101"].hash === original["101"].hash && Boolean(merged["105"])
      && posts.find((row) => row.id === "synthetic-post-1").number === 1
      && posts.find((row) => row.id === "new-synthetic-post").number !== 1
      && hash(fs.readFileSync(dataFile(context, `media/${mediaName}`))) === mediaBefore;
    return { safe, observed: `Added accounts/posts/media=${added.accounts}/${added.posts}/${added.media}; existing records preserved=${safe}` };
  });
  await test("T22", "Merge post-count arithmetic", "Explain all-type additions versus non-story snapshot totals without reading production posts", async () => {
    const context = await makeCase();
    write(dataFile(context, "ideas.json"), [1, 2].map((id) => ({ id: `current-${id}`, number: id, type: "post" })));
    const stage = path.join(context.root, "older");
    write(path.join(stage, "ideas.json"), Array.from({ length: 18 }, (_, i) => ({
      id: `import-${i}`, number: 10 + i, type: i < 15 ? "post" : "story",
    })));
    const added = load(context, "vault").mergeInto(dataFile(context, ""), stage);
    const counts = load(context, "vault").localCounts();
    return { safe: added.posts === 18 && counts.posts === 17,
      observed: `Synthetic merge +${added.posts} all-type entries produces ${counts.posts} non-story posts from baseline 2` };
  });
  await test("T23", "Imported account with foreign session key", "Imported passwords/2FA should remain usable under the live key", async () => {
    const context = await makeCase();
    const live = accounts(context);
    delete live["101"];
    write(dataFile(context, "accounts.json"), live);
    write(dataFile(context, "session.key"), crypto.randomBytes(48).toString("hex"));
    const stage = path.join(context.root, "old-data");
    fs.cpSync(path.join(fixture, "data"), stage, { recursive: true });
    load(context, "vault").mergeInto(dataFile(context, ""), stage);
    const liveAuth = load(context, "auth");
    const oldApp = path.join(context.root, "old-app");
    codeCopy(oldApp);
    fs.cpSync(path.join(fixture, "data"), path.join(oldApp, "data"), { recursive: true });
    const oldAuth = require(path.join(oldApp, "auth.js"));
    const code = totp(totpSecret, 1);
    const oldTotp = oldAuth.checkTwoFactor("101", code);
    const liveTotp = liveAuth.checkTwoFactor("101", code);
    const passwordOk = await liveAuth.checkLogin("101", password, true);
    assert.equal(oldTotp, "totp");
    return { safe: passwordOk === "ok" && liveTotp === "totp",
      observed: `Imported account/password present and valid=${passwordOk === "ok"}; TOTP valid under old key=${oldTotp === "totp"}; valid under live key=${liveTotp === "totp"}; 2FA remains flagged enabled=${liveAuth.twoFactorOn("101")}` };
  });
  await test("T24", "Snapshot archive/count coherence during writes", "Published index counts must describe the encrypted archive itself", async () => {
    const context = await makeCase();
    context.client.beforeUpload = async (name) => {
      if (name.startsWith("vault/") && name.endsWith(".bqb")) {
        const changed = accounts(context);
        changed["105"] = { ...changed["102"] };
        write(dataFile(context, "accounts.json"), changed);
      }
    };
    const entry = await load(context, "vault").snapshot(context.client, "forensic", () => {});
    const extracted = path.join(context.root, "extracted");
    fs.mkdirSync(extracted);
    await load(context, "backup").openBackup(path.join(context.objects, entry.name), async (name, bytes) => {
      write(path.join(extracted, name), bytes);
    });
    const inside = load(context, "vault").localCounts(extracted);
    return { safe: entry.counts.accounts === inside.accounts,
      observed: `Published index accounts=${entry.counts.accounts}; authenticated archive accounts=${inside.accounts}; concurrent change inserted after archive creation` };
  });
  await test("T25", "Partial restore promotion failure", "Failed restore must leave all live files unchanged", async () => {
    const context = await makeCase();
    const baselineAccounts = accounts(context);
    baselineAccounts["101"].forensicGeneration = "new-live";
    write(dataFile(context, "accounts.json"), baselineAccounts);
    const before = hash(fs.readFileSync(dataFile(context, "accounts.json")));
    const archive = path.join(context.root, "synthetic.bqb");
    await require(path.join(fixture, "backup.js")).writeArchive(archive);
    await context.client.uploadFromBytes(baselineName, fs.readFileSync(archive));
    await context.client.uploadFromText("meta/restore-request.json", JSON.stringify({ name: baselineName }));
    const rename = fs.renameSync;
    let result;
    try {
      fs.renameSync = (from, to) => {
        if (to === dataFile(context, "ideas.json")) throw new Error("injected promotion interruption");
        return rename(from, to);
      };
      result = await load(context, "vault").applyRestore(context.client, { name: baselineName }, () => {});
    } finally { fs.renameSync = rename; }
    const unchanged = hash(fs.readFileSync(dataFile(context, "accounts.json"))) === before;
    const pending = (await context.client.exists("meta/restore-request.json")).value;
    return { safe: unchanged && pending, observed: `Restore result ok=${result.ok}; account file unchanged=${unchanged}; failed request retained=${pending}` };
  });
  await test("T26", "Partial import promotion failure", "Failed multi-file merge must not leave committed partial changes", async () => {
    const context = await makeCase();
    const oldApp = path.join(context.root, "old-app");
    codeCopy(oldApp);
    fs.cpSync(path.join(fixture, "data"), path.join(oldApp, "data"), { recursive: true });
    const extra = json(path.join(oldApp, "data/accounts.json"));
    extra["105"] = { ...extra["102"] };
    write(path.join(oldApp, "data/accounts.json"), extra);
    write(path.join(oldApp, "data/ideas.json"), [{ id: "import-only-post", number: 20, type: "post" }]);
    const archive = path.join(context.root, "import.bqb");
    await require(path.join(oldApp, "backup.js")).writeArchive(archive);
    const request = { file: "meta/import/synthetic.bqb", key: "meta/import/synthetic.key" };
    await context.client.uploadFromBytes(request.file, fs.readFileSync(archive));
    await context.client.uploadFromText(request.key, fs.readFileSync(path.join(oldApp, "data/backup.key"), "utf8"));
    await context.client.uploadFromText("meta/import-request.json", JSON.stringify(request));
    const rename = fs.renameSync;
    let result;
    try {
      fs.renameSync = (from, to) => {
        if (to === dataFile(context, "ideas.json")) throw new Error("injected import interruption");
        return rename(from, to);
      };
      result = await load(context, "vault").applyImport(context.client, request, () => {});
    } finally { fs.renameSync = rename; }
    const partial = Boolean(accounts(context)["105"]);
    const retained = (await context.client.exists("meta/import-request.json")).value;
    return { safe: !partial && retained, observed: `Import ok=${result.ok}; new account nevertheless committed=${partial}; failed request retained=${retained}` };
  });
  await test("T27", "Malformed restored account JSON", "Reject invalid critical JSON before auth creates/writes a fallback store", async () => {
    const context = await makeCase();
    await context.client.uploadFromText("data/accounts.json", "{synthetic malformed JSON");
    await mirror(context).restore();
    const auth = load(context, "auth");
    const present = Boolean(auth.accountOf("101"));
    await auth.setPassword("105", password);
    const count = Object.keys(accounts(context)).length;
    return { safe: present && count === 5, observed: `Corrupt remote JSON accepted by restore; original account loaded=${present}; fallback store after new account write has ${count} account(s)` };
  });
  await test("T28", "Missing backup key", "Fail rather than silently generate a key incompatible with existing archives", async () => {
    const context = await makeCase();
    const archive = path.join(context.root, "old.bqb");
    const backup = load(context, "backup");
    await backup.writeArchive(archive);
    const before = hash(fs.readFileSync(dataFile(context, "backup.key")));
    fs.rmSync(dataFile(context, "backup.key"));
    await backup.writeArchive(path.join(context.root, "new.bqb"));
    const changed = hash(fs.readFileSync(dataFile(context, "backup.key"))) !== before;
    let oldOpens = true;
    try { await backup.openBackup(archive, async () => {}); } catch { oldOpens = false; }
    return { safe: !changed && oldOpens, observed: `Missing backup key regenerated=${changed}; old synthetic archive opens with new current key=${oldOpens}` };
  });
  await test("T29", "Post-auth reload races an async password change", "A concurrent reload must not detach the account being updated", async () => {
    const context = await makeCase();
    const auth = load(context, "auth");
    const pending = auth.setPassword("101", "Different-synthetic-password-456");
    const fresh = accounts(context);
    fresh["102"].note = "Synthetic external write";
    write(dataFile(context, "accounts.json"), fresh);
    const future = new Date(Date.now() + 1000);
    fs.utimesSync(dataFile(context, "accounts.json"), future, future);
    auth.linkEmail("102", "another-synthetic@example.invalid");
    await pending;
    const newWorks = await auth.checkLogin("101", "Different-synthetic-password-456", true);
    return { safe: newWorks === "ok", observed: `Password change promise completed; new password actually persisted=${newWorks === "ok"}` };
  });
  await test("T30", "Actual startup retries interrupted restore", "Remain in maintenance until all objects restore, then recover the complete fixture", async () => {
    const context = await makeCase({ local: false });
    const worker = await launch(context, { storageOptions: { failAtDownload: 3 } });
    const response = await worker.session();
    const maintenance = worker.maintenanceSeen();
    await worker.stop();
    const intact = summary(context.app).integrity === fixtureState.integrity;
    return { safe: maintenance && response.status === 200 && intact,
      observed: `Maintenance observed during retry=${maintenance}; recovered synthetic session HTTP ${response.status}; full core integrity equal=${intact}` };
  });
  await test("T31", "Actual startup after failed restore promotion", "A failed recovery must not release maintenance or serve a mixed generation", async () => {
    const context = await makeCase();
    const newer = accounts(context);
    newer["101"].forensicGeneration = "newer live synthetic account";
    write(dataFile(context, "accounts.json"), newer);
    await context.client.uploadFromText("data/accounts.json", JSON.stringify(newer));
    const archive = path.join(context.root, "old-generation.bqb");
    await require(path.join(fixture, "backup.js")).writeArchive(archive);
    await context.client.uploadFromBytes(baselineName, fs.readFileSync(archive));
    await context.client.uploadFromText("meta/restore-request.json", JSON.stringify({ name: baselineName }));
    const worker = await launch(context, { failPromotion: "ideas.json" });
    const response = await worker.session();
    const failed = worker.output().includes("data left as it was");
    const served = worker.output().includes("BQ Connect: http");
    await worker.stop();
    const retained = Boolean(accounts(context)["101"].forensicGeneration);
    return { safe: !served && retained, observed: `Injected restore failure logged=${failed}; actual app served session HTTP ${response.status}; newer account field retained=${retained}` };
  });
  await test("T32", "Directory mismatch versus account loss", "Diagnose an existing loaded account rejected by employee identity lookup", async () => {
    const context = await makeCase();
    const directory = json(dataFile(context, "employees.json")).map((row) => ({ ...row, badge: `other-${row.badge}` }));
    await context.client.uploadFromText("data/employees.json", JSON.stringify(directory));
    const worker = await launch(context, { expectedSessionStatus: 401 });
    const response = await worker.session();
    await worker.stop();
    const auth = load(context, "auth");
    const loaded = Boolean(auth.accountOf("101")?.hash);
    const session = auth.readSession(token) === "101";
    return { safe: loaded && session && response.status === 401,
      observed: `Account loaded=${loaded}; signed session valid=${session}; employee-directory mismatch yields HTTP ${response.status}; account count=${Object.keys(accounts(context)).length}` };
  });
  await test("T33", "Session revocation versus account loss", "Revoked sessions must not be mistaken for deleted accounts", async () => {
    const context = await makeCase();
    const auth = load(context, "auth");
    auth.revokeSessions("101");
    const present = Boolean(auth.accountOf("101")?.hash);
    const session = auth.readSession(token) === "101";
    const passwordWorks = await auth.checkLogin("101", password, true) === "ok";
    return { safe: present && !session && passwordWorks, observed: `Account present=${present}; old session accepted=${session}; password still valid=${passwordWorks}` };
  });
  await test("T34", "Older generation with lower account count", "Reject a generation whose account count is below the indexed baseline", async () => {
    const context = await makeCase();
    const older = accounts(context);
    delete older["104"];
    await context.client.uploadFromText("data/accounts.json", JSON.stringify(older));
    await mirror(context).restore();
    const reason = await load(context, "vault").checkDrop(context.client);
    return { safe: Boolean(reason), observed: `Older synthetic generation has 3 accounts versus indexed 4; count gate blocks=${Boolean(reason)}` };
  });
}

const codeFingerprint = Object.fromEntries(sourceFiles.map((name) =>
  [name, hash(fs.readFileSync(path.join(workspace, name))).slice(0, 12)]));

main().then(() => require("./repair-regressions.cjs")({
  test, makeCase, load, dataFile, summary, accounts, write, files, hash,
  launch, guarded, manifestFor, fixture, totp, totpSecret, password, token, children,
})).catch((error) => {
  results.push({ id: "HARNESS", scenario: "Harness execution", status: "BLOCKED", observed: error.message });
}).finally(async () => {
  for (const child of children) child.kill("SIGKILL");
  const sourceUnchanged = sourceFiles.every((name) =>
    hash(fs.readFileSync(path.join(workspace, name))).slice(0, 12) === codeFingerprint[name]);
  const destination = path.join(workspace, "generated-artifacts/repair");
  let combined = results;
  let previousRunAt;
  if (selected && fs.existsSync(path.join(destination, "test-results.json"))) {
    const previous = json(path.join(destination, "test-results.json"));
    if (JSON.stringify(previous.codeFingerprint) !== JSON.stringify(codeFingerprint)) {
      throw new Error("Cannot combine evidence from different production source versions");
    }
    previousRunAt = previous.at;
    combined = [...previous.results.filter((row) => !selected.includes(row.id)), ...results]
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }
  const output = {
    at: new Date().toISOString(), sourceUnchanged, codeFingerprint,
    previousRunAt, rerunIds: selected,
    isolation: "Only invented records in os.tmpdir()/bq-forensics-*; filesystem mock; loopback HTTP; no SDK, production data, archive or credentials accessed",
    totals: { PASS: combined.filter((row) => row.status === "PASS").length,
      FAIL: combined.filter((row) => row.status === "FAIL").length,
      BLOCKED: combined.filter((row) => row.status === "BLOCKED").length },
    results: combined,
  };
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, "test-results.json"), JSON.stringify(output, null, 2));
  fs.rmSync(temp, { recursive: true, force: true });
  console.log(JSON.stringify({ totals: output.totals, sourceUnchanged }));
  process.exitCode = output.totals.FAIL || output.totals.BLOCKED || !sourceUnchanged ? 1 : 0;
});
