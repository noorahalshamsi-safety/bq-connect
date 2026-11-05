// Real HTTP + PostgreSQL, invented data only, private temporary socket/database.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const assert = require("node:assert/strict"), crypto = require("node:crypto"), net = require("node:net");
const { fork } = require("node:child_process");
const { base, canonical, sha } = require("../../deploy/fresh/config.cjs");
const I = require("../../deploy/fresh/installation.cjs"), S = require("../../deploy/fresh/directory.cjs");
const { prepare } = require("../../development/postgres/isolation.cjs");
const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
const schema = require(path.join(base, "deploy/managed/schema.cjs"));
const { code } = require("../../development/postgres/fixtures.cjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "bq-pg-dev-fresh-"));
let proof, repo, child, port, token, stage = "setup";
const events = [], controls = new Map();
const store = { readControl: async k => controls.get(k) || null,
  createControl: async (k, v) => { assert(!controls.has(k)); controls.set(k, v); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
function unbase32(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = ""; for (const ch of s.toUpperCase().replace(/=+$/, "")) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2))).toString("hex");
}
async function boot(off = false) {
  const reservation = net.createServer();
  await new Promise(r => reservation.listen(0, "127.0.0.1", r));
  port = reservation.address().port; await new Promise(r => reservation.close(r));
  const logs = [];
  child = fork(path.join(__dirname, "fixture-server.cjs"), [root, off ? "providers-off" : "providers-on"], {
    env: { ...proof.childEnv, PORT: String(port), HOST: "127.0.0.1" }, silent: true });
  child.stdout.on("data", b => logs.push(b.toString()));
  child.stderr.on("data", b => logs.push(b.toString()));
  child.on("message", m => events.push(m));
  for (let i = 0; i < 300; i++) {
    if (events.some(m => m.kind === "ready" && m.port === port)) return;
    if (child.exitCode !== null || events.some(m => m.kind === "blocked")) {
      fs.writeFileSync(path.join(root, "fixture-error.log"), logs.join(""), { mode: 0o600 });
      throw Error("fixture_start_failed");
    }
    await delay(100);
  }
  throw Error("fixture_start_timeout");
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode) return;
  const current = child;
  const exit = new Promise(r => current.once("exit", r));
  current.kill("SIGTERM");
  const timer = setTimeout(() => current.kill("SIGKILL"), 10000);
  await exit; clearTimeout(timer); child = null;
}
async function request(url, body = {}, options = {}) {
  const r = await fetch(`http://127.0.0.1:${port}${url}`, { method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(),
      "X-Forwarded-For": options.ip || "192.0.2.31" },
    body: JSON.stringify({ ...(options.anonymous ? {} : token ? { token } : {}), ...body }),
    signal: AbortSignal.timeout(30000) });
  const text = await r.text(); let json = {};
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
}
function ok(r, status = 200) { assert.equal(r.status, status, `http_${r.status}_${r.json.error || "unexpected"}`); return r.json; }
async function event(kind, start) {
  for (let i = 0; i < 300; i++) {
    const row = events.slice(start).find(e => e.kind === kind);
    if (row) return row; await delay(100);
  }
  throw Error("fixture_delivery_timeout");
}
async function main() {
  stage = "new installation binding";
  const cfg = require(path.join(base, "deploy/managed/config.cjs"));
  const planned = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../deploy/fresh/production.json"), "utf8"));
  const proposed = { ...planned, endpoint: { hostname: "synthetic.invalid", port: "5432",
    database: "neondb", role: "synthetic", schema: "dev" },
    directorySha256: sha("invented-directory"), permissionsFingerprint: sha("invented-permissions"),
    permissionApproval: "reviewed-managed-runtime-capabilities",
    initialAdminBadge: "101", emailDomains: ["example.invalid"] };
  const env = { REPLIT_DEPLOYMENT: "1", REPL_ID: "not-the-workspace-identity",
    DATABASE_URL: "postgresql://synthetic:synthetic@synthetic.invalid/neondb?sslmode=require",
    BQ_FRESH_SESSION_KEY: crypto.randomBytes(48).toString("hex"),
    BQ_FRESH_BACKUP_KEY: crypto.randomBytes(32).toString("hex"),
    BQ_FRESH_INSTALL_KEY: crypto.randomBytes(32).toString("hex"),
    BQ_FRESH_BINDING_SHA256: sha(canonical(proposed)) };
  const issued = cfg.verifyFresh({ env, manifest: proposed });
  assert(issued.freshInstall && cfg.poolOptions(issued).ssl.rejectUnauthorized);
  for (const key of ["BQ_FRESH_SESSION_KEY", "BQ_FRESH_BACKUP_KEY", "BQ_FRESH_INSTALL_KEY",
    "BQ_FRESH_BINDING_SHA256"]) assert.throws(() => cfg.verifyFresh({
      env: { ...env, [key]: "" }, manifest: proposed }));
  assert.throws(() => cfg.verifyFresh({ env: { ...env, REPLIT_DEPLOYMENT: "0" }, manifest: proposed }));
  assert.throws(() => cfg.verifyFresh({ env: { ...env,
    DATABASE_URL: env.DATABASE_URL.replace("synthetic.invalid", "other.invalid") }, manifest: proposed }));
  assert.throws(() => cfg.verifyFresh({ env: { ...env,
    DATABASE_URL: env.DATABASE_URL.replace("sslmode=require", "sslmode=no-verify") }, manifest: proposed }));
  assert.throws(() => cfg.verify({ env, manifest: { kind: "BQ_REPLIT_MANAGED_V1",
    environment: "production", appFingerprint: sha("different-pinned-id") } }),
  error => error.code === "managed_app_identity_mismatch");
  stage = "isolated schema";
  proof = prepare(root); repo = new Repository(proof);
  for (const statement of schema.statements) await repo.pool.query(statement);
  const people = Array.from({ length: 6311 }, (_, i) => {
    const badge = String(i + 101), h = v => crypto.createHmac("sha256", "bq-rd-ideas-2026").update(v).digest("hex");
    return { badge, id: "synthetic-" + badge, name: "Synthetic Employee " + badge,
      department: "Synthetic Engineering", position: "Engineer", extra: { preserved: true },
      check: h(`${badge}:1234`), phone: h(`phone:${badge}:512345678`) };
  });
  people[5].badge = "00106";
  people[5].check = crypto.createHmac("sha256", "bq-rd-ideas-2026").update("00106:1234").digest("hex");
  people[5].phone = crypto.createHmac("sha256", "bq-rd-ideas-2026").update("phone:00106:512345678").digest("hex");
  const raw = JSON.stringify(people), source = S.validate(raw);
  assert.throws(() => S.validate(JSON.stringify([...people, people[0]])));
  const duplicate = structuredClone(people); duplicate[1].badge = duplicate[0].badge;
  assert.throws(() => S.validate(JSON.stringify(duplicate)));
  const duplicateId = structuredClone(people); duplicateId[1].id = duplicateId[0].id;
  assert.throws(() => S.validate(JSON.stringify(duplicateId)));
  assert.throws(() => S.validate('{"accounts":{}}'));
  const manifest = { employees: 6311, directorySha256: source.sha256, initialAdminBadge: "101",
    emailDomains: ["example.invalid"] };
  stage = "employee-only initialization";
  const c = await repo.pool.connect();
  try {
    const result = await I.initialize({ c, proof, manifest, source, store, verifySourceUnchanged: async () => {} });
    assert.equal(result.initialAccounts, 0);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM dev.employees")).rows[0].n, 6311);
    assert.equal((await c.query("SELECT count(*)::int AS n FROM dev.accounts")).rows[0].n, 0);
    assert((await I.initialize({ c, proof, manifest, source, store, verifySourceUnchanged: async () => {} })).replayed);
    await assert.rejects(I.initialize({ c, proof, manifest, source,
      store: { ...store, readControl: async () => null }, verifySourceUnchanged: async () => {} }));
  } finally { c.release(); }
  fs.writeFileSync(path.join(root, "provision-receipt.json"), JSON.stringify({
    dataset: proof.dataset, seal: proof.seal, state: "committed" }), { mode: 0o600 });
  const premature = await repo.pool.connect();
  try { await assert.rejects(require("../../deploy/fresh/admin.cjs").bootstrap({
    c: premature, proof, manifest,
    approval: "bootstrap:" + sha(canonical([sha(canonical(manifest)), "101"])) })); }
  finally { premature.release(); }
  stage = "registration ownership guard";
  await boot(true);
  ok(await request("/api/register", { badge: "101", code: "1234", mobile: "512345678",
    password: "FreshSynthetic!Password2026" }, { anonymous: true }), 503);
  assert.equal((await repo.pool.query("SELECT count(*)::int AS n FROM dev.accounts")).rows[0].n, 0);
  await stop(); events.length = 0;
  stage = "verified registration";
  await boot();
  const body = { badge: "101", code: "1234", mobile: "512345678",
    password: "FreshSynthetic!Password2026", admin: true, role: "admin" };
  const smsStart = events.length;
  assert(ok(await request("/api/register", body, { anonymous: true })).needOtp);
  const sms = await event("sms", smsStart);
  const otp = (new URLSearchParams(sms.body).get("Body") || sms.body).match(/\b\d{6}\b/)?.[0];
  assert(otp);
  const reg = ok(await request("/api/register", { ...body, otp }, { anonymous: true }));
  assert(reg.registered);
  const securityClient = await repo.pool.connect();
  try { assert.deepEqual((await repo.load(securityClient, ["security.json"])).get("security.json").value.admins, []); }
  finally { securityClient.release(); }
  const setup = ok(await request("/api/login-2fa", { op: "setup", ticket: reg.ticket }, { anonymous: true }));
  const totp = unbase32(setup.secret);
  const enrolled = ok(await request("/api/login-2fa", { op: "enroll", ticket: reg.ticket,
    code: code(totp) }, { anonymous: true }));
  assert(enrolled.needEmail);
  const mailStart = events.length;
  ok(await request("/api/login-2fa", { op: "email", ticket: enrolled.ticket,
    email: "synthetic101@example.invalid" }, { anonymous: true }));
  const mail = await event("mail", mailStart), mailOtp = mail.text.match(/\b\d{6}\b/)?.[0]; assert(mailOtp);
  token = ok(await request("/api/login-2fa", { op: "email-confirm", ticket: enrolled.ticket, code: mailOtp },
    { anonymous: true })).token; assert(token);
  stage = "real login and permissions";
  assert(ok(await request("/api/login", { badge: "101", password: body.password }, { anonymous: true })).needTotp);
  const failed = await request("/api/login", { badge: "101", password: "incorrect" }, { anonymous: true });
  assert.equal(failed.status, 401);
  ok(await request("/api/terms", { accepted: true }));
  const profile = ok(await request("/api/session"));
  assert(!profile.person.admin);
  ok(await request("/api/social", { action: "admin-summary" }), 403);
  stage = "operator-only administrator bootstrap";
  const { bootstrap } = require("../../deploy/fresh/admin.cjs");
  const adminClient = await repo.pool.connect();
  const approval = "bootstrap:" + sha(canonical([sha(canonical(manifest)), "101"]));
  try {
    await assert.rejects(bootstrap({ c: adminClient, proof, manifest, approval: "wrong" }));
    await bootstrap({ c: adminClient, proof, manifest, approval });
    await assert.rejects(bootstrap({ c: adminClient, proof, manifest, approval }));
  } finally { adminClient.release(); }
  stage = "directory lookup and new post";
  ok(await request("/api/social", { action: "person", pid: profile.person.pid }));
  ok(await request("/api/ideas", { type: "post", text: "Synthetic fresh SQL post" }), 201);
  assert((await repo.pool.query("SELECT count(*)::int AS n FROM dev.posts")).rows[0].n >= 1);
  ok(await request("/api/push", { action: "subscribe" }), 503);
  ok(await request("/api/media", {}), 503);
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const r = await request("/api/register", { ...body, badge: "102", code: "0000" },
      { anonymous: true, ip: "192.0.2.80" });
    if (r.status === 429) { limited = true; break; }
  }
  assert(limited);
  stage = "restart and durable account";
  await stop(); events.length = 0; await boot();
  assert(ok(await request("/api/login", { badge: "101", password: body.password }, { anonymous: true })).needTotp);
  ok(await request("/api/register", { ...body, badge: "102", code: "0000" },
    { anonymous: true, ip: "192.0.2.80" }), 429);
  const account = (await repo.pool.query("SELECT attrs FROM dev.accounts WHERE entry_key=$1", ["101"])).rows[0].attrs;
  assert(account.hash && !JSON.stringify(account).includes(body.password));
  const client = await repo.pool.connect();
  try { await I.reconcile(client, proof, manifest, controls.get("provision-receipt.json")); }
  finally { client.release(); }
  console.log(JSON.stringify({ result: "PASS", employees: 6311, initialAccounts: 0,
    employeeOnlyImport: "PASS", idempotency: "PASS", ownership: "PASS", realRegistration: "PASS",
    mfaEmail: "PASS", login: "PASS", bootstrapConsumed: "PASS", directory: "PASS",
    post: "PASS", restart: "PASS", rateLimitingAcrossRestart: "PASS",
    unavailableProvidersRefused: "PASS", newBindingAndOriginalGuard: "PASS", productionAccess: false }));
}
main().catch(error => {
  console.error(JSON.stringify({ result: "BLOCKED", stage, error: String(error.message).slice(0, 180), root }));
  process.exitCode = 1;
}).finally(async () => {
  await stop(); await repo?.pool.end().catch(() => {});
  try { proof?.stop(); } catch {}
  if (process.exitCode !== 1) fs.rmSync(root, { recursive: true, force: true });
});
