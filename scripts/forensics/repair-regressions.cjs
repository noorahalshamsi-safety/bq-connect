// Additional invariants. No SDK or production fixture access.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
module.exports = async function regressions(h) {
  const { test, makeCase, load, dataFile, summary, accounts, write, files, hash,
    launch, guarded, manifestFor, fixture, totp, totpSecret, password, token, children } = h;
  await test("R01", "Legitimate local dataset and HTTP compatibility", "Existing fixture keys, account data and sessions remain usable without rewrite", async () => {
    const c = await makeCase(), before = summary(c.app).integrity;
    const worker = await launch(c, { localOnly: true });
    const session = await worker.session();
    const ready = await fetch(`http://127.0.0.1:${worker.port}/health/ready`);
    await worker.stop();
    return { safe: session.status === 200 && ready.status === 200 && summary(c.app).integrity === before,
      observed: `Development session/readiness HTTP ${session.status}/${ready.status}; core/keys unchanged=${summary(c.app).integrity === before}` };
  });
  await test("R02", "Manifest identity, generation and same-count content", "Accept valid pinned fixture; reject another identity, old generation and altered membership", async () => {
    const c = await makeCase(), s = load(c, "persistence-safety"), m = manifestFor(c);
    s.validateManifest(m, m); s.verifyManifestFiles(dataFile(c, ""), m);
    const identity = guarded(() => s.validateManifest({ ...m, datasetId: "other" }, m), "dataset_identity_mismatch");
    const older = guarded(() => s.validateManifest({ ...m, generation: 1 }, m), "committed_generation_mismatch");
    const rows = accounts(c); rows["1101"] = rows["101"]; delete rows["101"];
    write(dataFile(c, "accounts.json"), rows);
    const content = guarded(() => s.verifyManifestFiles(dataFile(c, ""), m), "manifest_content_mismatch");
    return { safe: identity && older && content, observed: `Valid fixture accepted; identity/generation/same-count rejection=${identity}/${older}/${content}` };
  });
  await test("R03", "Unadopted dataset liveness/readiness", "Missing manifest must not auto-adopt legacy storage or expose the authenticated app", async () => {
    const c = await makeCase(), before = summary(c.app).integrity;
    const worker = await launch(c, { expectMaintenance: true });
    const live = await fetch(`http://127.0.0.1:${worker.port}/health/live`);
    const ready = await fetch(`http://127.0.0.1:${worker.port}/health/ready`);
    const session = await worker.session();
    await worker.stop(true);
    const adopted = (await c.client.exists("meta/dataset-manifest.json")).value;
    return { safe: live.status === 200 && ready.status === 503 && session.status === 503 && !adopted && summary(c.app).integrity === before,
      observed: `Liveness/readiness/session ${live.status}/${ready.status}/${session.status}; auto-adopted=${adopted}; keys/records unchanged=${summary(c.app).integrity === before}` };
  });
  await test("R04", "Valid manifest cannot fabricate a durable provider", "Valid pinned manifest must not bypass unavailable distributed commit", async () => {
    const c = await makeCase(), m = manifestFor(c);
    await c.client.uploadFromText("meta/dataset-manifest.json", JSON.stringify(m));
    const worker = await launch(c, { expectMaintenance: true, expectedManifest: m });
    await new Promise(resolve => setTimeout(resolve, 80));
    const ready = await fetch(`http://127.0.0.1:${worker.port}/health/ready`);
    const fenced = worker.output().includes("durable_commit_provider_unavailable");
    await worker.stop(true);
    return { safe: ready.status === 503 && fenced, observed: `Valid manifest fenced=${fenced}; readiness ${ready.status}; no mock capability bypass` };
  });
  await test("R05", "Deployment auth rejects local-only commits", "Reject acknowledgement before modifying disk without a durable backend", async () => {
    const c = await makeCase(), before = hash(fs.readFileSync(dataFile(c, "accounts.json")));
    const code = `require(${JSON.stringify(path.join(c.app, "auth.js"))}).setPassword("105","synthetic-only-password").then(()=>process.exit(8)).catch(e=>process.exit(e.code==="durable_commit_provider_unavailable"?0:9))`;
    const child = spawnSync(process.execPath, ["-e", code], { cwd: c.app, encoding: "utf8",
      env: { PATH: process.env.PATH || "", HOME: c.root, REPLIT_DEPLOYMENT: "1" } });
    return { safe: child.status === 0 && before === hash(fs.readFileSync(dataFile(c, "accounts.json"))),
      observed: `Acknowledgement rejected=${child.status === 0}; account bytes unchanged=${before === hash(fs.readFileSync(dataFile(c, "accounts.json")))}` };
  });
  await test("R06", "No session/backup key regeneration", "Missing keys remain missing; never manufacture a replacement secret", async () => {
    const c = await makeCase();
    fs.rmSync(dataFile(c, "session.key"));
    const session = guarded(() => load(c, "auth"), "critical_key_missing");
    fs.rmSync(dataFile(c, "backup.key"));
    let backup = false;
    try { await load(c, "backup").writeArchive(path.join(c.root, "forbidden.bqb")); } catch (e) { backup = e.code === "backup_key_missing_or_invalid"; }
    return { safe: session && backup && !fs.existsSync(dataFile(c, "session.key")) && !fs.existsSync(dataFile(c, "backup.key")),
      observed: `Session/backup creation refused=${session}/${backup}; both remain absent` };
  });
  await test("R07", "Offline activation rename failure", "Recover old complete local generation if candidate activation fails", async () => {
    const c = await makeCase(), s = load(c, "persistence-safety"), before = summary(c.app).integrity;
    const candidate = path.join(c.app, ".data-candidate-r07");
    fs.cpSync(dataFile(c, ""), candidate, { recursive: true });
    const rename = fs.renameSync;
    let rejected = false;
    try {
      fs.renameSync = (from, to) => { if (from === candidate && to === dataFile(c, "")) throw new Error("injected activation failure"); return rename(from, to); };
      try { s.activateLocal(dataFile(c, ""), candidate); } catch { rejected = true; }
    } finally { fs.renameSync = rename; }
    return { safe: rejected && summary(c.app).integrity === before,
      observed: `Rename failed=${rejected}; old core restored=${summary(c.app).integrity === before}; not a distributed transaction` };
  });
  await test("R08", "Interrupted offline activation journal", "Recover old committed data and retain candidate data in quarantine", async () => {
    const c = await makeCase(), s = load(c, "persistence-safety"), before = summary(c.app).integrity;
    const live = dataFile(c, ""), old = path.join(c.app, ".data-old-r08"), candidate = path.join(c.app, ".data-candidate-r08");
    fs.cpSync(live, candidate, { recursive: true });
    const changed = JSON.parse(fs.readFileSync(path.join(candidate, "accounts.json"), "utf8"));
    changed["101"].candidateOnly = true; write(path.join(candidate, "accounts.json"), changed);
    s.atomicWrite(path.join(c.app, ".persistence-journal.json"), JSON.stringify({ phase: "prepared", live, old, hadLive: true }));
    fs.renameSync(live, old); fs.renameSync(candidate, live);
    s.recoverDirectory(live);
    const kept = fs.readdirSync(c.app).filter(name => name.startsWith(".data-quarantine-"));
    return { safe: summary(c.app).integrity === before && kept.length === 1,
      observed: `Simulated interrupted process recovered=${summary(c.app).integrity === before}; candidate retained=${kept.length === 1}; not a power-loss test` };
  });
  await test("R09", "Partial offline import candidate failure", "Later post-write failure cannot leak candidate account changes into live data", async () => {
    const c = await makeCase(), before = summary(c.app).integrity, stage = path.join(c.root, "partial-stage");
    write(path.join(stage, "accounts.json"), { "105": accounts(c)["102"] });
    write(path.join(stage, "ideas.json"), [{ id: "new-import", number: 20, type: "post" }]);
    const rename = fs.renameSync;
    let rejected = false;
    try {
      fs.renameSync = (from, to) => { if (to.includes(".data-candidate-") && to.endsWith("/ideas.json")) throw new Error("injected candidate write failure"); return rename(from, to); };
      try { load(c, "vault").mergeInto(dataFile(c, ""), stage); } catch { rejected = true; }
    } finally { fs.renameSync = rename; }
    return { safe: rejected && summary(c.app).integrity === before,
      observed: `Candidate failed=${rejected}; live core unchanged=${summary(c.app).integrity === before}` };
  });
  await test("R10", "Matching-key 2FA import compatibility", "Same-key imported account keeps password and TOTP without reset", async () => {
    const c = await makeCase(), rows = accounts(c);
    delete rows["101"]; write(dataFile(c, "accounts.json"), rows);
    const stage = path.join(c.root, "same-key");
    fs.cpSync(path.join(fixture, "data"), stage, { recursive: true });
    load(c, "vault").mergeInto(dataFile(c, ""), stage);
    const auth = load(c, "auth"), pw = await auth.checkLogin("101", password, true) === "ok";
    const valid = auth.checkTwoFactor("101", totp(totpSecret, 1)) === "totp";
    return { safe: pw && valid && auth.twoFactorOn("101"), observed: `Matching-domain password/TOTP valid=${pw}/${valid}; 2FA remains enabled` };
  });
  await test("R11", "Frozen archive counts and full media", "Archive metadata describes captured bytes despite later local writes", async () => {
    const c = await makeCase(), archive = path.join(c.root, "full.bqb"), mediaName = files(dataFile(c, "media"))[0];
    const originalMedia = fs.readFileSync(dataFile(c, `media/${mediaName}`)), writing = load(c, "backup").writeArchive(archive);
    const changed = accounts(c); changed["105"] = { ...changed["102"] };
    write(dataFile(c, "accounts.json"), changed); write(dataFile(c, `media/${mediaName}`), "newer synthetic bytes");
    const result = await writing, entries = {};
    await load(c, "backup").openBackup(archive, async (name, bytes) => { entries[name] = Buffer.from(bytes); });
    const count = Object.values(JSON.parse(entries["accounts.json"])).filter(row => row.hash).length;
    const mediaMatches = entries[`media/${mediaName}`]?.equals(originalMedia);
    return { safe: result.counts.accounts === count && count === 4 && mediaMatches && result.includesMedia,
      observed: `Metadata/archive accounts=${result.counts.accounts}/${count}; live accounts=5; original media included=${mediaMatches}; no authoritative index publication` };
  });
  await test("R12", "Two actual local writer processes", "Every successful acknowledgement survives; conflicting writes are explicitly rejected", async () => {
    const c = await makeCase();
    const run = badge => new Promise(resolve => {
      const code = `require(${JSON.stringify(path.join(c.app, "auth.js"))}).setPassword(${JSON.stringify(badge)},"synthetic-password").then(()=>{}).catch(e=>{process.exitCode=e.code==="account_write_conflict"?2:9})`;
      const child = spawn(process.execPath, ["-e", code], { cwd: c.app,
        env: { PATH: process.env.PATH || "", HOME: c.root }, stdio: ["ignore", "ignore", "ignore"] });
      children.add(child);
      child.on("exit", status => { children.delete(child); resolve({ badge, status }); });
    });
    const commits = await Promise.all([run("105"), run("106")]), final = accounts(c);
    const safe = commits.some(r => r.status === 0) && commits.every(r => r.status === 0 ? Boolean(final[r.badge]?.hash) : r.status === 2);
    return { safe, observed: `Local successful acknowledgements=${commits.filter(r=>r.status===0).length}; all retained=${safe}; explicit conflicts=${commits.filter(r=>r.status===2).length}; shared-filesystem only, not multi-VM fencing` };
  });
  await test("R13", "Legacy KDF and session diagnostics", "Upgrade a legitimate legacy password without reset, key rotation or identity loss", async () => {
    const c = await makeCase(), rows = accounts(c), beforeKey = hash(fs.readFileSync(dataFile(c, "session.key")));
    rows["101"].hash = crypto.scryptSync(password, Buffer.from(rows["101"].salt, "hex"), 64, { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }).toString("hex");
    delete rows["101"].kdf; write(dataFile(c, "accounts.json"), rows);
    const auth = load(c, "auth"), valid = await auth.checkLogin("101", password, true) === "ok", accepted = auth.sessionStatus(token);
    auth.revokeSessions("101");
    const revoked = auth.sessionStatus(token);
    return { safe: valid && accounts(c)["101"].kdf === 2 && accepted === "accepted" && revoked === "version_revoked" && beforeKey === hash(fs.readFileSync(dataFile(c, "session.key"))),
      observed: `Legacy password/upgraded=${valid}/${accounts(c)["101"].kdf===2}; internal diagnosis=${accepted}/${revoked}; key unchanged` };
  });
  await test("R14", "Blocked recovery preserves all material", "Denied recovery/index publication changes no remote objects or live records", async () => {
    const c = await makeCase(), before = summary(c.app).integrity;
    const request = { file: "meta/import/synthetic.bqb", key: "meta/import/synthetic.key" };
    await c.client.uploadFromText(request.file, "synthetic-archive-placeholder");
    await c.client.uploadFromText(request.key, "synthetic-key-placeholder");
    await c.client.uploadFromText("meta/import-request.json", JSON.stringify(request));
    const writes = c.client.writes, result = await load(c, "vault").applyImport(c.client, request);
    let fenced = false;
    try { await load(c, "vault").snapshot(c.client, "test"); } catch (e) { fenced = e.code === "durable_commit_provider_unavailable"; }
    const retained = (await Promise.all([request.file, request.key, "meta/import-request.json"].map(name => c.client.exists(name)))).every(r=>r.value);
    return { safe: !result.ok && fenced && retained && c.client.writes === writes && summary(c.app).integrity === before,
      observed: `Request/key/archive retained=${retained}; index publication fenced=${fenced}; writes unchanged=${c.client.writes===writes}; functional activation still unavailable` };
  });
  await test("R15", "Uncommitted fresh activation", "Never silently activate an uncommitted first-generation candidate after a crash", async () => {
    const c = await makeCase(), s = load(c, "persistence-safety"), freshRoot = path.join(c.root, "fresh");
    const live = path.join(freshRoot, "data"), old = path.join(freshRoot, ".data-old-fresh");
    fs.mkdirSync(freshRoot); fs.cpSync(path.join(fixture, "data"), live, { recursive: true });
    s.atomicWrite(path.join(freshRoot, ".persistence-journal.json"), JSON.stringify({ phase: "prepared", live, old, hadLive: false }));
    const refused = guarded(() => s.recoverDirectory(live), "fresh_activation_uncommitted");
    return { safe: refused && !fs.existsSync(live) && fs.readdirSync(freshRoot).some(n=>n.startsWith(".data-quarantine-")),
      observed: `Uncommitted first generation refused=${refused}; candidate quarantined, no authoritative generation invented` };
  });
  await test("R16", "Corrupt authoritative index", "Never treat a corrupt index as a fresh empty integrity baseline", async () => {
    const c = await makeCase(), before = summary(c.app).integrity;
    await c.client.uploadFromText("vault/index.json", "{invalid");
    let rejected = false;
    try { await load(c, "vault").readIndex(c.client); } catch (e) { rejected = e.code === "authoritative_index_corrupt"; }
    return { safe: rejected && summary(c.app).integrity === before, observed: `Corrupt authority rejected=${rejected}; local data unchanged` };
  });
  await test("R17", "Pending 2FA key-domain import", "Pending setup secrets are protected as well as enabled TOTP", async () => {
    const c = await makeCase(), s = load(c, "persistence-safety"), stage = path.join(c.root, "foreign-domain");
    fs.mkdirSync(stage); write(path.join(stage, "session.key"), crypto.randomBytes(48).toString("hex"));
    const blocked = guarded(() => s.assertKeyDomain(dataFile(c, ""), stage, [{ totpSetup: { key: "synthetic-sealed-value" } }]), "import_2fa_key_domain_mismatch");
    return { safe: blocked, observed: `Pending sealed setup rejected across different keys=${blocked}; no 2FA disabled` };
  });
  await test("R18", "Explicit bucket binding", "Reject a wrong configured bucket before constructing the SDK client", async () => {
    const c = await makeCase(), s = load(c, "persistence-safety"), id = "synthetic-bucket-only", fp = hash(id).slice(0, 12);
    s.validateBucketBinding(id, fp);
    const rejected = guarded(() => s.validateBucketBinding("other-synthetic-bucket", fp), "bucket_binding_mismatch");
    return { safe: rejected, observed: `Matching synthetic configuration accepted; wrong configured bucket rejected=${rejected}; no SDK request` };
  });
  await test("R19", "Held writer lock and archive exclusion", "Conflicts are explicit, held locks are preserved, and operational locks never enter backups", async () => {
    const c = await makeCase(), before = hash(fs.readFileSync(dataFile(c, "accounts.json"))), lock = dataFile(c, "accounts.json.write-lock");
    write(lock, "synthetic-held-lock");
    let conflict = false;
    try { await load(c, "auth").setPassword("105", "synthetic-password"); } catch (e) { conflict = e.code === "account_write_conflict"; }
    const archive = path.join(c.root, "no-lock.bqb"), entries = [];
    await load(c, "backup").writeArchive(archive);
    await load(c, "backup").openBackup(archive, async (name) => { entries.push(name); });
    const untouched = before === hash(fs.readFileSync(dataFile(c, "accounts.json")));
    return { safe: conflict && untouched && fs.existsSync(lock) && !entries.some(name=>name.endsWith(".write-lock")),
      observed: `Conflict rejected=${conflict}; account bytes unchanged=${untouched}; held lock not stolen; archive excludes operational locks` };
  });
};
