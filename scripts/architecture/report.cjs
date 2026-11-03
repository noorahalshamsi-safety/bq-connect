// Assemble a documentation deliverable from source inventory and synthetic results.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),dir=path.join(root,"generated-artifacts/architecture");
const read=n=>fs.readFileSync(path.join(root,n),"utf8"),sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const previous=JSON.parse(read("generated-artifacts/repair/test-results.json"));
const validation=JSON.parse(read("generated-artifacts/architecture/validation-results.json"));
assert.equal(previous.results.length,53);
assert.equal(validation.designSchemaSha256,sha(read("design/persistence/schema.sql")),"DDL changed since validation");
assert.equal(validation.validatorSha256,sha(read("scripts/architecture/validate.cjs")),"Validator changed since validation");
assert.equal(validation.applicationSourceUnchanged,true);
const adaptations={
  T01:"Provision expected DB dataset/schema/key domains; positive readiness only after adoption; never seed accounts implicitly.",
  T02:"Restart app with same DB/key configuration; SID, credentials, directory and content survive without a local data directory.",
  T03:"Cold build connects to durable DB and media; no JSON restore/bootstrap is required.",
  T04:"Stale bundle cannot publish a stale schema/epoch, import bundled JSON or overwrite current records.",
  T05:"Interrupted protected staging import transaction leaves active DB untouched; no half-activated data.",
  T06:"DB or required media storage unavailable: writes/readiness fail closed; liveness remains available.",
  T07:"Missing expected dataset/schema/recovery metadata is not an empty dataset to initialize; media loss blocks affected readiness/restore.",
  T08:"Missing account rows versus frozen manifest/ledger block adoption; no accounts defaulted to an empty map.",
  T09:"Corrupt recovery manifest/index or unavailable protected recovery point must not become a fresh baseline.",
  T10:"Missing expected signing-key domain blocks authenticated readiness; never generate a replacement.",
  T11:"Same-count old dataset/epoch or different membership/content is rejected by authority and reconciliation.",
  T12:"Wrong populated DB identity or media bucket fails expected dataset/binding checks before reads/writes are admitted.",
  T13:"Wrong empty DB/bucket remains unavailable until separately approved provisioning; no automatic adoption.",
  T14:"Unauthorized mass account deletion is prevented by privileges/transaction policy; no shrink upload path exists.",
  T15:"Gradual removal/version rollback is caught by audit/reconciliation and authorization; counts alone are insufficient.",
  T16:"Multiple real app processes register/change credentials with unique keys, row locks, revisions and explicit conflicts.",
  T17:"Concurrent DB writers/idempotency retries and worker epochs serialize safely; no mutable JSON sync heads.",
  T18:"Kill app immediately after acknowledged COMMIT and before any periodic worker; cold reader must see credential commit.",
  T19:"Missing/corrupt referenced object blocks publication or protected restore; hash/size closure includes all media owners.",
  T20:"Signing-key mismatch refuses compatibility/adoption; DB data is not reset and 2FA is not disabled.",
  T21:"Staged import duplicate identity handling has explicit non-destructive resolution and immutable source ledger.",
  T22:"Reconcile all ten content types, expired stories, nested children and membership, not just a single total.",
  T23:"Foreign TOTP/signing key-domain records remain quarantined; no import-induced 2FA reset.",
  T24:"Consistent PostgreSQL backup snapshot/restore point is bound to frozen retained media/key manifest and independently restored.",
  T25:"Failure before DB authority activation leaves old active state; failed promotion does not clear recovery evidence.",
  T26:"Failed staged import is rolled back/quarantined; live DB and protected source remain unchanged.",
  T27:"Malformed source account JSON/duplicate keys/schema variants produce blocked reconciliation, not empty defaults.",
  T28:"Missing/wrong backup decryption key blocks recovery; no replacement key is generated.",
  T29:"Pause password KDF then race another update; expected revision/hash and pending identity are rechecked after await.",
  T30:"Actual app startup/retry after DB interruption uses readiness/authority checks, not the old object restore loop.",
  T31:"Actual app startup after failed activation never admits uncommitted staging or falls back to stale JSON.",
  T32:"Separate directory-only, account-only/system, unresolved employee identity, banned/not-ready and lost-account diagnostics.",
  T33:"Session version/SID revoke, expiry/idle and key failures remain distinct from account loss across processes.",
  T34:"Lower-generation/lower-membership recovery cannot activate without approved current-state reconciliation.",
  R01:"Full PostgreSQL HTTP adapter login/session/social compatibility and health; synthetic direct SQL is not sufficient.",
  R02:"Expected dataset/epoch/schema plus membership and content hashes reject equal-count substitutions.",
  R03:"Unadopted DB/key domains give live 200/ready and authenticated routes 503; no seed/rotation.",
  R04:"Do not remove provider/release guard until the supported transactional adapter and hosted durability gates pass.",
  R05:"Credential success requires COMMIT in the authoritative DB; no local-only write acknowledgement.",
  R06:"Missing signing/backup key domains fail explicitly without regeneration.",
  R07:"Legacy offline candidate rename failure remains a frozen migration-reader test; DB activation failure separately leaves authority unchanged.",
  R08:"Keep the original journal recovery test for legacy evidence; add transactional staging crash/activation recovery tests.",
  R09:"Legacy import candidate failure remains isolated; SQL importer cannot leak any partial graph into the active dataset.",
  R10:"Exact same-key TOTP ciphertext/recovery and pending setup survive normalized export and the SQL-backed API.",
  R11:"DB-consistent backup metadata matches actual restored graph and all media; no live reread counts during snapshot.",
  R12:"Replace shared-file writer assumptions with independent app/SQL processes, same/different identities and epoch overlap.",
  R13:"Legacy absent-KDF upgrade CAS and detailed session diagnoses work through the actual database repository.",
  R14:"Blocked/unapproved recovery preserves source bundles, request records, keys and indexes; no destructive cleanup.",
  R15:"First database activation has a committed recovery point/authority; uncommitted initial dataset is not served.",
  R16:"Corrupt authoritative recovery metadata is an error, never a fresh-empty baseline.",
  R17:"Pending encrypted TOTP setup uses unchanged key domain and expiry; foreign-domain staging is refused.",
  R18:"Explicitly pinned database identity and media bucket binding are verified before admission.",
  R19:"Replace held-file-lock contention with SQL lock timeout/stale revision/epoch conflict; legacy lock files remain excluded from protected imports.",
};
const sourceTests=previous.results.map(r=>{
  assert(adaptations[r.id],`Missing adaptation ${r.id}`);
  return {id:r.id,originalScenario:r.scenario,previousResult:r.status,postgresAdaptation:adaptations[r.id],adapterStatus:"PLANNED_NOT_RUN"};
});
assert.equal(new Set(sourceTests.map(x=>x.id)).size,53);
const md="# Persistence regression adaptation matrix\n\nThe 53 prior results are preserved, not rerun/reclassified by this design assignment. Every database-backed application scenario below remains planned until an adapter exists. New prototype A-tests provide narrower SQL/format evidence only.\n\n| ID | Existing scenario | Prior repair result | PostgreSQL adaptation | New adapter result |\n|---|---|---|---|---|\n"+
  sourceTests.map(r=>`| ${r.id} | ${r.originalScenario} | ${r.previousResult} | ${r.postgresAdaptation} | NOT RUN |`).join("\n");
fs.writeFileSync(path.join(dir,"test-matrix.md"),md);
fs.writeFileSync(path.join(dir,"test-matrix.json"),JSON.stringify({legacyScenarioCount:53,sourceTests,prototype:validation},null,2));
const resultsMd="# Actual isolated prototype validation\n\n"+
  `**${validation.totals.passed} PASS / ${validation.totals.failed} FAIL.** ${validation.postgresVersion}. Production operations: ${validation.productionOperations}. Application/configuration fingerprints unchanged: ${validation.applicationSourceUnchanged}.\n\n`+
  "These are prototype checks, not 20 completed application-adapter regressions or a production durability certification.\n\n| ID | Scenario | Result | Evidence/limits |\n|---|---|---|---|\n"+
  validation.results.map(r=>`| ${r.id} | ${r.scenario} | ${r.status} | ${typeof r.evidence==="object"?JSON.stringify(r.evidence):r.evidence} |`).join("\n");
const report=read("reports/TRANSACTIONAL_PERSISTENCE_ARCHITECTURE.md")+
  "\n\n---\n\n# Appendix A — file-by-file inventory\n\n"+read("generated-artifacts/architecture/data-inventory.md")+
  "\n\n---\n\n# Appendix B — original 53-scenario adaptation matrix\n\n"+md+
  "\n\n---\n\n# Appendix C — actual prototype results\n\n"+resultsMd+
  "\n\n---\n\n# Appendix D — full proposed SQL schema (design only)\n\nThis is not an approved production migration. Only the isolated synthetic harness applies this DDL to its newly created temporary database.\n\n```sql\n"+
  read("design/persistence/schema.sql")+"\n```\n";
assert.equal(validation.totals.failed,0,"Do not describe failed validation as passing");
fs.writeFileSync(path.join(dir,"BQ_CONNECT_TRANSACTIONAL_ARCHITECTURE.md"),report);
console.log(JSON.stringify({report:path.relative(root,path.join(dir,"BQ_CONNECT_TRANSACTIONAL_ARCHITECTURE.md")),legacyScenarios:53,prototypePass:validation.totals.passed,schemaTables:validation.results[0].evidence.tables,bytes:Buffer.byteLength(report)}));
