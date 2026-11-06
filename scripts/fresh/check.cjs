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
let proof, repo, child, port, token, adminPolicy, adminEnv, stage = "setup";
const events = [], controls = new Map();
const store = { readControl: async k => controls.get(k) || null,
  createControl: async (k, v) => { assert(!controls.has(k)); controls.set(k, v); } };
const delay = ms => new Promise(r => setTimeout(r, ms));
function unbase32(s) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = ""; for (const ch of s.toUpperCase().replace(/=+$/, "")) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2))).toString("hex");
}
async function boot(off = false, adminApproved = true, fault = "") {
  const reservation = net.createServer();
  await new Promise(r => reservation.listen(0, "127.0.0.1", r));
  port = reservation.address().port; await new Promise(r => reservation.close(r));
  const logs = [];
  child = fork(path.join(__dirname, "fixture-server.cjs"), [root, off ? "providers-off" : "providers-on"], {
    env: { ...proof.childEnv, PORT: String(port), HOST: "127.0.0.1",
      BQ_TEST_STARTUP_FAULT:fault,
      BQ_TEST_ADMIN_POLICY: JSON.stringify({ ...adminPolicy, approved: adminApproved && adminPolicy.approved }) }, silent: true });
  child.stdout.on("data", b => logs.push(b.toString()));
  child.stderr.on("data", b => logs.push(b.toString()));
  child.on("message", m => events.push(m));
  if(fault){
    for(let i=0;i<100&&!events.some(m=>m.kind==="gateway"&&m.port===port);i++)await delay(20);
    for(let i=0;i<200&&!logs.join("").includes('"status":"BLOCKED"');i++)await delay(25);
    assert(logs.join("").includes('"status":"BLOCKED"'),"startup_failure_must_be_bounded");
    assert(!logs.join("").includes("SYNTHETIC_PRIVATE_VALUE_MUST_NOT_APPEAR"));
    assert(!logs.join("").includes("private_synthetic_value"));
    if(fault==="timeout"){
      for(let i=0;i<100&&child.exitCode===null;i++)await delay(25);
      assert.equal(child.exitCode,1,"timed_out_worker_must_retire");
    }else{
      const response=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(2000)});
      assert.equal(response.status,200);assert.equal((await response.json()).ready,false);
      const health=await fetch(`http://127.0.0.1:${port}/health/ready`,{signal:AbortSignal.timeout(2000)});
      assert.equal(health.status,503);assert.equal((await health.json()).ready,false);
      const api=await fetch(`http://127.0.0.1:${port}/api/register`,{method:"POST",signal:AbortSignal.timeout(2000)});
      assert.equal(api.status,503);
      assert(logs.join("").includes('"FRESH_RUNTIME":"BLOCKED"'),"failure_must_reach_gateway");
    }
    return;
  }
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
async function event(kind, start, predicate = () => true) {
  for (let i = 0; i < 300; i++) {
    const row = events.slice(start).find(e => e.kind === kind && predicate(e));
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
  const ownership = require("../../deploy/fresh/email-ownership.cjs");
  proposed.ownershipCompatibilityApproval = ownership.approval(proposed);
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
  stage = "provider activation gates";
  const vm = require("node:vm");
  const originalServer = fs.readFileSync(path.join(base, "server.js"), "utf8");
  const takeSource = originalServer.slice(originalServer.indexOf("function takeEmailCode("),
    originalServer.indexOf("const MAIL_ERRORS"));
  const pendingEmail = new Map(), emailCodeHash = (key, value) => sha(key + ":" + value);
  const take = vm.runInNewContext(takeSource + ";takeEmailCode", { pendingEmail, emailCodeHash, crypto, Buffer });
  pendingEmail.set("expired", { exp: Date.now() - 1, tries: 0, hash: emailCodeHash("expired", "123456") });
  assert.equal(take("expired", "123456").error, "code_expired");
  pendingEmail.set("attempts", { exp: Date.now() + 60000, tries: 4,
    hash: emailCodeHash("attempts", "123456") });
  assert.equal(take("attempts", "654321").error, "bad_code");
  assert.equal(take("attempts", "123456").error, "code_expired");
  const providerPolicy = require("../../deploy/fresh/providers.cjs");
  const providerFixture = { "smtp.json": { host: "smtp.company.test", port: 465,
    user: "operator@company.test", pass: "InventedPasswordOnly2026" },
    "sms.json": { provider: "twilio", sid: "AC" + "1".repeat(32),
      token: "InventedTokenOnly2026", from: "+15550000000" } };
  assert.equal(providerPolicy.review(providerFixture).smtp.status, "CONFIGURATION_READY");
  const existingProviderFallback = require("../../deploy/fresh/runtime-policy.cjs").providers({
    SMTP_HOST: providerFixture["smtp.json"].host, SMTP_PORT: "465",
    SMTP_USER: providerFixture["smtp.json"].user, SMTP_PASS: providerFixture["smtp.json"].pass,
    SMS_TOKEN: providerFixture["sms.json"].token, TWILIO_SID: providerFixture["sms.json"].sid,
    TWILIO_FROM: providerFixture["sms.json"].from });
  assert.equal(providerPolicy.review(existingProviderFallback).smtp.status, "CONFIGURATION_READY");
  assert.equal(providerPolicy.review(existingProviderFallback).sms.status, "CONFIGURATION_READY");
  assert.throws(() => providerPolicy.requireReady({}, {}, proposed));
  assert.throws(() => providerPolicy.requireReady(providerFixture, {}, proposed));
  providerPolicy.requireReady(providerFixture, {
    BQ_FRESH_DELIVERY_APPROVAL: "delivery-tested:" + sha(canonical(proposed)) }, proposed);
  providerPolicy.requireReady({ "smtp.json": providerFixture["smtp.json"] }, {
    BQ_FRESH_DELIVERY_APPROVAL: "delivery-tested:" + sha(canonical(proposed)) }, proposed);
  assert.equal(providerPolicy.review({ ...providerFixture,
    "smtp.json": { ...providerFixture["smtp.json"], port: 587 } }).smtp.status, "BLOCKED");
  assert.equal(providerPolicy.review({ ...providerFixture,
    "sms.json": { ...providerFixture["sms.json"], provider: "mock" } }).sms.status, "BLOCKED");
  const writes = [];
  function smtpSocket(refuse = false) {
    return options => {
      assert(options.rejectUnauthorized && options.minVersion === "TLSv1.2");
      const socket = new (require("node:events").EventEmitter)();
      socket.authorized = true;
      const responses = ["250 accepted", "334 username", "334 password",
        refuse ? "535 rejected" : "235 accepted"];
      socket.destroy = () => {};
      socket.write = value => { writes.push(value); setImmediate(() => socket.emit("data",
        Buffer.from(responses.shift() + "\r\n"))); };
      socket.end = value => writes.push(value);
      setImmediate(() => { socket.emit("secureConnect"); socket.emit("data", Buffer.from("220 ready\r\n")); });
      return socket;
    };
  }
  assert.equal((await providerPolicy.probeSmtp(providerFixture["smtp.json"], smtpSocket())).status,
    "AUTHENTICATED_NO_MESSAGE");
  assert.equal((await providerPolicy.probeSmtp(providerFixture["smtp.json"], smtpSocket(true))).reason, "AUTH");
  assert(writes.every(v => !/^(MAIL FROM|RCPT TO|DATA)/.test(v)));
  const generator = require("node:child_process").spawnSync("python3",
    [path.resolve(__dirname, "../../deploy/fresh/owner-key-clipboard.py"), "BQ_FRESH_SESSION_KEY"],
    { env: { PATH: process.env.PATH, REPL_ID: "synthetic-workspace" }, encoding: "utf8" });
  assert.equal(generator.status, 1);
  assert(generator.stderr.includes("trusted owner workstation"));
  assert.equal(generator.stdout, "");
  stage = "isolated schema";
  proof = prepare(root); repo = new Repository(proof);
  for (const statement of schema.statements) await repo.pool.query(statement);
  const people = Array.from({ length: 6311 }, (_, i) => {
    const badge = String(i + 101), h = v => crypto.createHmac("sha256", "bq-rd-ideas-2026").update(v).digest("hex");
    return { badge, id: "synthetic-" + badge, name: "Synthetic Employee " + badge,
      department: "Synthetic Engineering", position: "Engineer", extra: { preserved: true },
      email: `synthetic${badge}@binquraya.com`,
      check: h(`${badge}:1234`), phone: h(`phone:${badge}:512345678`) };
  });
  delete people[2].phone;
  people[3].check = people[4].check; // Ambiguous ownership hashes must fail closed.
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
    emailDomains: ["binquraya.com"] };
  adminEnv = { BQ_FRESH_ADMIN_EMAIL: "synthetic101@binquraya.com",
    BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: "register-admin:" + sha(canonical([
      sha(canonical(manifest)), "101", "synthetic101@binquraya.com"])) };
  adminPolicy = ownership.adminPolicy(manifest, adminEnv);
  assert(ownership.matches(people, people[0], "١٢٣٤", "+966512345678"));
  assert(!ownership.matches(people, people[0], "991234", "512345678"));
  assert(!ownership.matches(people, people[2], "1234", "512345678"));
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
  const beforeFailedBoot=sha(canonical(await repo.exportSynthetic()));
  const beforeRuntimeState=(await repo.pool.query("SELECT count(*)::int AS n FROM dev.runtime_state")).rows[0].n;
  for(const fault of ["syntax","refresh","persist","commit","timeout"]){
    await boot(false,true,fault);
    await stop();events.length=0;
    assert.equal((await repo.pool.query("SELECT count(*)::int AS n FROM dev.accounts")).rows[0].n,0);
    assert.equal((await repo.pool.query("SELECT count(*)::int AS n FROM dev.employees")).rows[0].n,6311);
    assert.equal(sha(canonical(await repo.exportSynthetic())),beforeFailedBoot,"failed_boot_must_roll_back_all_entities");
    assert.equal((await repo.pool.query("SELECT count(*)::int AS n FROM dev.runtime_state")).rows[0].n,beforeRuntimeState);
  }
  await boot(true);
  ok(await request("/api/register", { badge: "101", code: "1234", mobile: "512345678",
    email: "synthetic101@binquraya.com",
    password: "FreshSynthetic!Password2026" }, { anonymous: true }), 503);
  assert.equal((await repo.pool.query("SELECT count(*)::int AS n FROM dev.accounts")).rows[0].n, 0);
  await stop(); events.length = 0;
  stage = "verified registration";
  await boot(false, false);
  ok(await request("/api/register", { badge: "101", code: "1234", mobile: "512345678",
    email: "synthetic101@binquraya.com", password: "FreshSynthetic!Password2026" },
    { anonymous: true }), 403);
  await stop(); events.length = 0;
  await boot();
  const clientJs = await (await fetch(`http://127.0.0.1:${port}/js/secure.js`)).text();
  assert(clientJs.includes("freshRegistrationTicket"));
  new vm.Script(clientJs);
  const body = { badge: "101", code: "1234", mobile: "512345678", email: "synthetic101@binquraya.com",
    password: "FreshSynthetic!Password2026", admin: true, role: "admin" };
  for (const attack of [
    { ...body, code: "0000" },
    { ...body, mobile: "500000000" },
    { ...body, email: "synthetic101@binquraya.com.evil.test" },
    { ...body, badge: "103" },
    { ...body, badge: "104" },
    { ...body, email: "arbitrary@binquraya.com" }
  ]) ok(await request("/api/register", attack, { anonymous: true, ip: "192.0.2.93" }), 403);
  assert.equal((await repo.pool.query("SELECT count(*)::int AS n FROM dev.accounts")).rows[0].n, 0);
  const mailStart = events.length;
  const challenge = ok(await request("/api/register", body, { anonymous: true }));
  assert(challenge.needEmailCode && !challenge.token && !challenge.needSetup);
  const mail = await event("mail", mailStart), mailOtp = mail.text.match(/\b\d{6}\b/)?.[0]; assert(mailOtp);
  assert.equal(mail.to, body.email);
  assert(!events.some(e => e.kind === "sms"));
  // Pending email codes and their rate limits must survive a process restart.
  await stop(); events.length = 0; await boot();
  const wrongCode = mailOtp === "000000" ? "000001" : "000000";
  ok(await request("/api/register", { ...body, emailCode: wrongCode, ticket: challenge.ticket },
    { anonymous: true }), 401);
  const concurrent = await Promise.all([1, 2].map(() => request("/api/register",
    { ...body, emailCode: mailOtp, ticket: challenge.ticket }, { anonymous: true })));
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  const reg = ok(concurrent.find(r => r.status === 200));
  assert(reg.registered && reg.token && !reg.needSetup && !reg.needTotp);
  token = reg.token;
  ok(await request("/api/register", { ...body, emailCode: mailOtp, ticket: challenge.ticket },
    { anonymous: true }), 409);
  assert(!events.some(e => e.kind === "sms"));
  const securityClient = await repo.pool.connect();
  try { assert.deepEqual((await repo.load(securityClient, ["security.json"])).get("security.json").value.admins, []); }
  finally { securityClient.release(); }
  const loginMailStart = events.length;
  assert(ok(await request("/api/login", { badge: "101", password: body.password }, { anonymous: true })).token);
  const loginNotice = await event("mail", loginMailStart);
  assert(loginNotice.to === body.email && loginNotice.text.includes("BQ Connect login successful"));
  ok(await request("/api/terms", { accepted: true }));
  ok(await request("/api/session"));
  ok(await request("/api/social", { action: "admin-summary" }), 403);
  // Administrator escalation still requires the existing stronger MFA gate.
  const beforeMfa = await repo.pool.connect();
  try { await assert.rejects(require("../../deploy/fresh/admin.cjs").bootstrap({
    c: beforeMfa, proof, manifest,
    approval: "bootstrap:" + sha(canonical([sha(canonical(manifest)), "101"])) })); }
  finally { beforeMfa.release(); }
  const setup = ok(await request("/api/2fa", { op: "setup", password: body.password }));
  const totp = unbase32(setup.secret);
  const enrolled = ok(await request("/api/2fa", { op: "enroll", password: body.password, code: code(totp) }));
  assert(enrolled.status.enabled);
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
    await assert.rejects(bootstrap({ c: adminClient, proof, manifest, approval: "wrong", env: adminEnv }));
    const otherDomain = { ...manifest, emailDomains: ["other.invalid"] };
    await assert.rejects(bootstrap({ c: adminClient, proof, manifest: otherDomain,
      approval: "bootstrap:" + sha(canonical([sha(canonical(otherDomain)), "101"])) }),
    error => error.code === "fresh_admin_must_register_verify_company_email_and_mfa");
    await assert.rejects(bootstrap({ c: adminClient, proof, manifest, approval, env: {} }),
      error => error.code === "fresh_owner_confirmed_admin_identity_required");
    await bootstrap({ c: adminClient, proof, manifest, approval, env: adminEnv });
    await assert.rejects(bootstrap({ c: adminClient, proof, manifest, approval, env: adminEnv }));
  } finally { adminClient.release(); }
  ok(await request("/api/social", { action: "admin-summary" }));
  stage = "directory lookup and new post";
  ok(await request("/api/social", { action: "person", pid: profile.person.pid }));
  ok(await request("/api/ideas", { type: "post", text: "Synthetic fresh SQL post" }), 201);
  assert((await repo.pool.query("SELECT count(*)::int AS n FROM dev.posts")).rows[0].n >= 1);
  ok(await request("/api/push", { action: "subscribe" }), 503);
  ok(await request("/api/media", {}), 503);
  stage = "verified-email password recovery";
  const second = { badge: "102", code: "1234", mobile: "512345678",
    email: "entered102@binquraya.com", password: "SecondSynthetic!Password2026" };
  const secondMailStart = events.length;
  const secondChallenge = ok(await request("/api/register", second, { anonymous: true }));
  const secondMail = await event("mail", secondMailStart, e => /\b\d{6}\b/.test(e.text));
  const secondRegistered = ok(await request("/api/register", { ...second,
    ticket: secondChallenge.ticket, emailCode: secondMail.text.match(/\b\d{6}\b/)[0] }, { anonymous: true }));
  assert(secondRegistered.token);
  const secondSetup = ok(await request("/api/2fa", { token: secondRegistered.token,
    op: "setup", password: second.password }));
  const secondEnrolled = ok(await request("/api/2fa", { token: secondRegistered.token,
    op: "enroll", password: second.password, code: code(unbase32(secondSetup.secret)) }));
  const staleLogin = ok(await request("/api/login", { badge: "102", password: second.password }, { anonymous: true }));
  const resetStart = events.length;
  const genericKnown = ok(await request("/api/forgot", { badge: "102", email: "attacker@binquraya.com" },
    { anonymous: true }));
  const resetMail = await event("mail", resetStart, e => /\b\d{6}\b/.test(e.text));
  assert.equal(resetMail.to, second.email);
  const genericUnknown = ok(await request("/api/forgot", { badge: "9999999999" }, { anonymous: true }));
  assert.deepEqual(genericKnown, genericUnknown);
  const resetCode = resetMail.text.match(/\b\d{6}\b/)[0], newPassword = "RecoveredSynthetic!Password2026";
  await stop(); events.length = 0; await boot();
  ok(await request("/api/forgot", { badge: "102", op: "confirm",
    code: resetCode === "000000" ? "000001" : "000000", newPassword }, { anonymous: true }), 400);
  ok(await request("/api/forgot", { badge: "102", op: "confirm", code: resetCode, newPassword },
    { anonymous: true }));
  ok(await request("/api/forgot", { badge: "102", op: "confirm", code: resetCode, newPassword },
    { anonymous: true }), 400);
  ok(await request("/api/session", { token: secondRegistered.token }), 401);
  ok(await request("/api/login", { badge: "102", password: second.password }, { anonymous: true }), 401);
  const recoveredLogin = ok(await request("/api/login", { badge: "102", password: newPassword }, { anonymous: true }));
  assert(recoveredLogin.needTotp && !recoveredLogin.token);
  ok(await request("/api/login-2fa", { ticket: staleLogin.ticket,
    code: secondEnrolled.recovery[0] }, { anonymous: true }), 401);
  assert(ok(await request("/api/login-2fa", { ticket: recoveredLogin.ticket,
    code: secondEnrolled.recovery[0] }, { anonymous: true })).token);
  assert(events.filter(e => e.kind === "mail").every(e =>
    !e.text.includes(newPassword) && !e.text.includes(second.password)));
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
    optionalTotp: "PASS", originalCodeMobileHashes: "PASS", ownerGatedAdmin: "PASS",
    loginEmailNotifications: "PASS", smsNotRequired: "PASS",
    gatewayStartupAndReadiness:"PASS",generatedModuleSyntaxFailure:"PASS",
    bootRefreshPersistCommitFailure:"PASS",startupDeadlineRetiresWorker:"PASS",
    failedStartupMaintenanceAndRollback:"PASS",
    emailRecovery: "PASS", recoverySingleUseAndRestart: "PASS",
    recoveryRevokesSessionsAndPendingTickets: "PASS", recoveryPreservesTotp: "PASS",
    recoveryDoesNotEmailPasswords: "PASS",
    singleUseEmailCode: "PASS", emailExpiryAndAttempts: "PASS",
    pendingChallengeRestart: "PASS", concurrentUniqueRegistration: "PASS", clientServingAndSyntax: "PASS",
    login: "PASS", bootstrapConsumed: "PASS", directory: "PASS",
    post: "PASS", restart: "PASS", rateLimitingAcrossRestart: "PASS",
    unavailableProvidersRefused: "PASS", newBindingAndOriginalGuard: "PASS",
    activationProviderGate: "PASS", smtpAuthWithoutMessage: "PASS", companyEmailAdminGate: "PASS",
    ownerKeyGenerationRefusedInWorkspace: "PASS", productionAccess: false }));
  if (process.argv.includes("--preview")) {
    console.log(JSON.stringify({ previewPort: port }));
    await new Promise(resolve => process.once("SIGTERM", resolve));
  }
}
main().catch(error => {
  console.error(JSON.stringify({ result: "BLOCKED", stage, error: String(error.message).slice(0, 180), root }));
  process.exitCode = 1;
}).finally(async () => {
  await stop(); await repo?.pool.end().catch(() => {});
  try { proof?.stop(); } catch {}
  if (process.exitCode !== 1) fs.rmSync(root, { recursive: true, force: true });
});
