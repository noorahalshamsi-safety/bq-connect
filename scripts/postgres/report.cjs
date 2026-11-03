const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const codec=require("../../development/postgres/codec.cjs");
const root=path.resolve(__dirname,"../.."),out=path.join(root,"generated-artifacts/phase2");
const http=JSON.parse(fs.readFileSync(path.join(out,"http-results.json")));
const old=JSON.parse(fs.readFileSync(path.join(root,"generated-artifacts/repair/test-results.json")));
const byId=new Map(http.results.map(r=>[r.id,r]));
const adaptations={
 T01:["H01,H02","Approved synthetic provision only"],T02:["H32","Process restart"],
 T03:["H32,H33","Cold process plus cluster reconnect; not a new hosted machine"],
 T04:["H41","Stale/malformed local files cannot override SQL"],
 T05:[null,"BLOCKED: operational SQL restore/promotion runner is not implemented"],
 T06:["H33","Database unreachable: unavailable rather than empty"],
 T07:["H54,H56","Lost schema/cluster cannot authorize fresh provision"],
 T08:["H42","Missing critical SQL entity refuses readiness"],
 T09:[null,"NOT TESTED: backup catalog corruption/recovery drill"],
 T10:["H44,H55","Missing or foreign signing key cannot be replaced at startup"],
 T11:[null,"BLOCKED: adopting an older SQL recovery generation is not implemented"],
 T12:["H43","Wrong populated dataset binding"],
 T13:["H43,H54","Wrong/empty SQL authority and prior provision receipt"],
 T14:[null,"NOT TESTED: independent account membership/shrink baseline"],
 T15:[null,"NOT TESTED: gradual account shrink baseline"],
 T16:["H26,H27","Concurrent registration/password mutation"],
 T17:["H38","Concurrent app processes and request deduplication"],
 T18:["H08,H32","Acknowledged posts survive process death; no periodic JSON sync"],
 T19:["H35","Missing and corrupt referenced object bytes"],
 T20:["H44","Same-length foreign signing/backup keys rejected"],
 T21:[null,"BLOCKED: operator add-only SQL import is not implemented"],
 T22:[null,"BLOCKED: import/merge preview counts not implemented"],
 T23:[null,"BLOCKED: foreign-domain import/adoption not implemented"],
 T24:["H34","Concurrent write and frozen encrypted backup counts/hash"],
 T25:[null,"BLOCKED: offline recovery promotion not implemented"],
 T26:[null,"BLOCKED: offline import promotion not implemented"],
 T27:[null,"NOT TESTED: malformed restored SQL account record; stale local JSON is separately tested"],
 T28:["H44","Missing and foreign backup key startup"],
 T29:["H27","Async password changes serialized before cache refresh"],
 T30:[null,"BLOCKED: startup retry of operational recovery not implemented"],
 T31:[null,"BLOCKED: startup after operational recovery promotion not implemented"],
 T32:["H49","Unlisted employee cannot authenticate; account is not silently removed"],
 T33:["H28,H48","Version and individual-session revocation"],
 T34:[null,"BLOCKED: old/lower-count recovery adoption not implemented"],
 R01:["H01,H02,H08","UI/API compatibility in approved synthetic mode"],
 R02:[null,"NOT TESTED: complete generation/content baseline; dataset/keys/epoch mismatch is tested separately"],
 R03:["H54","Lost authority cannot silently become fresh"],
 R04:["H46","Generic verified flag cannot redirect database host"],
 R05:["H45,H22","Deployment activation refused; failed commit cannot acknowledge"],
 R06:["H44,H55","No automatic missing-key replacement"],
 R07:[null,"BLOCKED: offline SQL activation rename equivalent not implemented"],
 R08:[null,"BLOCKED: offline SQL activation journal not implemented"],
 R09:[null,"BLOCKED: offline SQL import candidate activation not implemented"],
 R10:["H04,H05,H25,H30,H47","Invented matching-key auth round-trip and factor/recovery login"],
 R11:["H34,H35","Frozen all-entity archive, full media and integrity validation"],
 R12:["H38","Two actual HTTP server processes"],
 R13:["H06,H28,H49","Absent KDF, leading-zero identity and eligibility/revocation"],
 R14:[null,"BLOCKED: blocked recovery material preservation not yet exercised by a new SQL tool"],
 R15:["H54,H56","Provision receipt prevents silent replacement after state loss"],
 R16:["H43","Corrupt dataset/seal authority refuses readiness"],
 R17:[null,"NOT TESTED: pending-factor cross-key-domain import"],
 R18:["H43","Isolated SQL dataset binding; actual hosted bucket binding remains BLOCKED"],
 R19:["H34,H38","Writer serialization and backup snapshot exclusion"]
};
const legacy=old.results.map(r=>{
 const [ids,note]=adaptations[r.id]||[null,"NOT TESTED: no recorded adaptation"];
 const tests=ids?.split(",")||[];
 const status=tests.length?(tests.every(id=>byId.get(id)?.status==="PASS")?"PASS":"FAIL"):(note.startsWith("BLOCKED")?"BLOCKED":"NOT TESTED");
 return {id:r.id,scenario:r.scenario,previousStatus:r.status,status,evidence:tests,note:note.replace(/^(BLOCKED|NOT TESTED): /,"")};
});
fs.writeFileSync(path.join(out,"legacy-regression-matrix.json"),JSON.stringify({scope:"Adaptations are not claims that legacy object-store restoration was exercised",results:legacy},null,2));
const source=fs.readFileSync(path.join(root,"server.js"),"utf8");
const paths=[...new Set([...source.matchAll(/urlPath === "(\/api\/[^"]+)"/g)].map(m=>m[1]))];
const actions=[...new Set([...source.matchAll(/action === "([^"]+)"/g)].map(m=>m[1]))].filter(a=>!["POST","GET"].includes(a));
const matrix=paths.map(url=>({endpoint:url,scope:"Existing route in isolated SQL-backed handler",checks:http.requests.filter(r=>r.url===url)}));
const actionMatrix=actions.map(action=>({action,checks:http.requests.filter(r=>r.action===action||r.url.endsWith("/"+action))}));
const rows=(items,fn)=>items.map(fn).join("\n");
const summary=items=>Object.fromEntries([...new Set(items.map(r=>r.status))].map(s=>[s,items.filter(r=>r.status===s).length]));
const protectedFiles=[...new Set([...Object.keys(old.codeFingerprint||{}),"server.js","auth.js"])];
const fingerprints=Object.fromEntries(protectedFiles.map(f=>{
 const full=crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex");
 return [f,{sha256:full,previousPrefix:old.codeFingerprint?.[f]||null,unchanged:old.codeFingerprint?.[f]?full.startsWith(old.codeFingerprint[f]):null}];
}));
fs.writeFileSync(path.join(out,"production-source-fingerprints.json"),JSON.stringify(fingerprints,null,2));
const report=`# BQ Connect — PostgreSQL development integration review

Generated: ${http.at}. Scope: **invented data, development only**.

## Verdict

The actual imported application now has an isolated PostgreSQL-authoritative development entrypoint. The current HTTP suite reports **${http.totals.PASS} PASS / ${http.totals.FAIL} FAIL**. These are real HTTP requests to the existing handlers, not SQL-only smoke tests.

**This is not a production-ready certification or a claim that every Phase 2 verification requirement is complete.** The full legacy adaptation matrix is ${JSON.stringify(summary(legacy))}; blocked restore/adoption paths and untested behavior are listed explicitly. No production publish, production connection/schema/data change, real employee import, live key rotation, or root release-fence removal was performed.

Validation boundaries: H22 injects an exception after persistence but **before** the COMMIT statement; it is not a server-side COMMIT rejection/network-fault drill. H23 drops the HTTP response after successful COMMIT. In-flight database COMMIT transport ambiguity remains NOT TESTED. The public language-selection screen was visually checked in the running preview; signed-in screens were exercised through HTTP contracts but were **not visually verified**.

## Changed-file inventory

- development/postgres/isolation.cjs — private synthetic root, reproducible local PostgreSQL cluster, key-domain/dataset seal, deployment refusal.
- development/postgres/launch.cjs — development-only provision/start; no generic production URL or activation flag.
- development/postgres/fixtures.cjs — invented employees, accounts, keys, sessions and provider settings.
- development/postgres/codec.cjs — all 28 JSON value mappings, ${codec.tables.size} relational node tables plus transactional control tables.
- development/postgres/repository.cjs — parameterized SQL, bounded pool, transactions, revisions, immutable media intents, independent provision receipt and fixture outbox.
- development/postgres/virtual-fs.cjs — transaction-local compatibility projections; never authoritative business JSON on disk.
- development/postgres/runtime.cjs — original-handler adaptation, cache refresh, commit-gated responses, request deduplication, synthetic transports and encrypted dev backup.
- scripts/postgres/e2e.cjs — repeatable actual-HTTP synthetic integration suite.
- scripts/postgres/report.cjs — reproducible entity/API/legacy matrices and this review.
- package.json/package-lock.json — pg driver; .replit — development workflow and PostgreSQL tooling only. Production entry command/deployment section retained.
- development/postgres/README.md, reports/POSTGRESQL_DEVELOPMENT_INTEGRATION.md and project context — review/operation notes.

## Repository and transaction architecture

1. A private, newly created synthetic directory is the only permitted bootstrap location. An independent provision receipt is fsynced before initialization and marked committed only after the SQL seed transaction. Lost schema/cluster, missing manifest, incomplete provision, foreign key-domain seal or dataset/epoch mismatch refuse operation; they never trigger fresh accounts over an existing provision.
2. Each request begins a PostgreSQL transaction, acquires a cross-process advisory transaction lock and locks entity revisions. Every original process-local graph/cache is refreshed from SQL. Existing synchronous helpers operate only on transaction-scoped in-memory projections.
3. Known records and nested collections are stored as separate relational rows with parent/file foreign keys and stable logical identifiers; scalar/unknown attributes are preserved in per-record JSONB. Shapes distinguish absent/null/empty collections, object keys retain leading zeros and array order is explicit. This is **not a whole-file JSON ledger**. mail.json/messages.json remain intentionally opaque because their business schema is unknown.
4. All staged changes, session/recovery state, audit and notifications, replay/OTP/rate maps, outbox and idempotent response records are committed together. The actual HTTP response is buffered until COMMIT succeeds. Failure rolls back; retry with the same actor/key/body reconciles a lost response without another mutation. The isolated HTML gains only a same-origin transport shim assigning a stable key across a network retry.
5. The pool is bounded to four clients per process, with connection/statement/lock timeouts. Static table identifiers come from the closed codec registry; values use parameters. No failed database operation falls back to local JSON.

### Development-schema versus reviewed design

The prior 59-table DDL remains an unchanged design prototype. The executable **dev** schema is a compatibility-oriented refinement with ${codec.tables.size} node tables and control tables. It prioritizes lossless original shapes and existing route behavior. It has parent/file foreign keys, stable ID uniqueness, session/rating/repost uniqueness and selected generated-column/check constraints. It does **not** yet provide all proposed typed domain columns, cross-person foreign keys, least-privilege database roles, migration lifecycle, hosted HA/PITR or production-scale query plans. This refinement requires review; it is not silent approval of a new production schema.

### Serialization and security limits

The global request transaction deliberately serializes legacy mutable graphs across workers, preventing lost writes while keeping original behavior. It reloads all mapped entities and rewrites changed collection projections; media reference validation hashes objects. This is correctness-first **development** code, not an efficient production repository implementation. Slow body/handler work can hold serialization; load/slow-client/queue-exhaustion testing, narrower asynchronous repositories and robust cancellation remain prerequisites. HTTP response caches can include sensitive auth responses: production retention/encryption/access policy is not certified.

## Entity mapping

All 28 mappings were deep round-tripped using invented values, including unknown fields, missing/null, nested order, historical highlight snapshots and leading-zero identities. Stable item IDs are carried unchanged; relational row IDs are deterministic logical paths, not newly invented employee identities.

| Original path under data/ | Relational root | Mapping / evidence |
|---|---|---|
${rows(Object.entries(codec.specs),([file,s])=>`| ${file} | dev.${s.table} | ${["mail.json","messages.json"].includes(file)?"Opaque legacy value; no invented schema":"Records/children with lossless per-record attributes"}; H30 |`)}

The manifest, provision receipt and synthetic credential configuration live outside the application's data directory. They are bootstrap metadata, not business JSON authority. H31/H41 prove actual handlers use SQL even if stale/malformed local files exist.

## Authentication compatibility

Verified: body-token API contract; existing signed sessions; directory eligibility; leading-zero badge; legacy missing-KDF upgrade; password login/tickets; TOTP enrollment/verification; one-time recovery and concurrent consumption; SMS registration challenge; email linking; remembered device/session metadata; concurrent password changes; logout-all and individual revocation; password-reset pending state; no key replacement; both key domains bound at startup.

SMS/mail/push events are durable fixture events only. No real mailbox, SMS provider, browser push delivery, real authenticator migration or production credential was used. Pending-factor cross-key-domain import is **NOT TESTED**; operational import/adoption is absent.

## Media, notification, moderation and backup

- Upload intents are committed independently before immutable bytes are written. File and directory fsync plus read-back hash precede ready-state commit. Attachment references require SQL-ready media and verified bytes. Failed uploads can leave inspectable pending intents/orphans; automatic deletion is deliberately absent.
- Legacy /media/ URLs remain accessible with the same public visibility and range behavior. Images/video metadata fixtures, story archive/highlight retention and deleting a source story were exercised. Actual video playback/transcoding was not certified.
- Notifications/moderation retain original handlers. Their mutations and outbox enqueue are transactional. A background worker uses SKIP LOCKED and idempotent synthetic receipts. This proves local queue behavior, **not real provider delivery**.
- The actual admin backup route encrypts a frozen 28-entity + media export in PostgreSQL; concurrent write, ciphertext hash, counts and decryptability were checked. A development scheduler exists but timed scheduling itself is **NOT TESTED**.
- This export is not a full hosted database/PITR backup or a certified legacy .bqb archive. Restore/adoption tooling, independent recovery generation/shrink evidence, custody and retention drills are **BLOCKED/not implemented**.
- Real durable Object Storage is the intended future media provider. Current objects are private-root immutable **local synthetic storage**; hosted upload semantics, credentials, bucket binding, network failure recovery, GC and storage durability are not certified.

## API compatibility matrix

All routes load the original source handlers through the SQL transaction boundary. A row with no HTTP observation is NOT TESTED, not a claim of full positive-path coverage. HTTP observation includes denial/validation responses; see detailed test cases for positive behavior.

| Endpoint | Recorded requests | Observed HTTP statuses |
|---|---:|---|
${rows(matrix,r=>`| ${r.endpoint} | ${r.checks.length||"NOT TESTED"} | ${[...new Set(r.checks.map(x=>x.status))].join(", ")||"—"} |`)}

| Social/action branch | Recorded requests | Observed statuses |
|---|---:|---|
${rows(actionMatrix,r=>`| ${r.action} | ${r.checks.length||"NOT TESTED"} | ${[...new Set(r.checks.map(x=>x.status))].join(", ")||"—"} |`)}

Dynamic post routes, media and PWA assets are recorded individually in http-results.json. Existing admin read actions were exercised; not every positive administrative mutation, joins approval/rejection, moderation appeal/ban threshold, terms/email-management variant, geocoding or dashboard/export variant has been certified.

## Actual HTTP integration results

| Test | Scenario | Result | Requests |
|---|---|---|---:|
${rows(http.results,r=>`| ${r.id} | ${r.feature} | ${r.status} | ${r.httpRequests?.length||0} |`)}

## Original 34 plus 19 regression adaptations

Previous results are retained unchanged. The following is an explicit adaptation, **not** a rerun of old object-store restore procedures against PostgreSQL. BLOCKED means the operational equivalent is not yet implemented/available. NOT TESTED means the stated invariant has not been demonstrated by this new path.

| Original | Original scenario | Previous | PG adaptation | Evidence / limitation |
|---|---|---|---|---|
${rows(legacy,r=>`| ${r.id} | ${r.scenario} | ${r.previousStatus} | ${r.status} | ${r.evidence.join(", ")} ${r.note} |`)}

## Readiness and required review

| Scope | Verdict |
|---|---|
| Start/use the actual app with invented data on this Replit development workflow | Working; HTTP suite above |
| All 28 value mappings / SQL-only app authority | Verified within synthetic coverage |
| Complete positive-path parity for every existing feature/admin action | NOT TESTED; matrix explicitly incomplete |
| Operational recovery/import, stale snapshot adoption and shrink baseline | BLOCKED / not implemented |
| Hosted PostgreSQL/Object Storage, actual provider delivery, load/HA/PITR/security certification | BLOCKED / not certified |
| Production migration, deployment or removal of release fences | **NO-GO; not authorized or performed** |

Before production consideration: approve the refined schema and narrower repository strategy; complete remaining HTTP/admin variants and legacy regression equivalents; implement independent generation/account-membership evidence and reviewed operator import/restore; select approved hosted PostgreSQL and Object Storage; establish least privilege, TLS/network access, secret custody, safe idempotency retention, provider outbox receipts, backup/PITR/restore drills, media GC/retention, load/slow-client tests, monitoring and rollback gates. Only then consider a separately authorized adoption using real records. No such action is part of this delivery.

## Reproduce and evidence

- Start development: node development/postgres/launch.cjs (never node start.js for preview).
- Actual HTTP suite: node scripts/postgres/e2e.cjs.
- Refresh review: node scripts/postgres/report.cjs.
- generated-artifacts/phase2/http-results.json — detailed results/statuses; no real credentials.
- generated-artifacts/phase2/legacy-regression-matrix.json — all 53 adapted requirements.
- generated-artifacts/phase2/production-source-fingerprints.json — unchanged protected-source comparison evidence.
- Existing root start/auth/storage/backup/recovery fences and previous reports remain intact. Do not publish this development fixture service.
`;
fs.mkdirSync(path.join(root,"reports"),{recursive:true});
fs.writeFileSync(path.join(root,"reports/POSTGRESQL_DEVELOPMENT_INTEGRATION.md"),report);
console.log(JSON.stringify({http:http.totals,legacy:summary(legacy),entities:Object.keys(codec.specs).length,nodeTables:codec.tables.size}));
