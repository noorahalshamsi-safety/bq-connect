# BQ Connect — Replit-managed PostgreSQL implementation

Date: 2026-11-04. Scope: the existing BQ Connect application, not a replacement product.

## 1. Verified platform capabilities

The actual development database was initially empty: PostgreSQL 16.10,
`heliumdb`, role `postgres`, SSL off, zero visible user tables. The platform again
reported no Replit-managed production database. Publishing metadata confirms the
existing public Reserved VM application at https://bq-connect.replit.app.
No published runtime authority/generation or original signing key was accessed.

Official documentation confirms separate development/production DATABASE_URL
values; the workspace URL is not production. Current Helium projects create
production during Publishing when development contains data. Legacy Neon-backed
projects instead expose a Create production database choice with an optional
development-data copy. This project must use Replit-managed PostgreSQL; no
external account or paid external resource was created or recommended.

Publish compares actual schemas, reviews ambiguous changes, validates a diff and
requires approval. Tables, columns, indices, constraints, generated expressions
and their exact resulting definitions must be reviewed. Grants, functions,
procedures and triggers are not copied; roles are not created/changed/removed.
Normal schema updates do not copy data rows. Initial creation/copy behavior must
be verified in this project's actual UI before approval, not assumed.

Managed production PITR/scheduled backups are documented: Core up to 7 days,
Pro/Enterprise up to 28 with 7 initially. Actual resource retention/permissions,
PITR execution, recovery region and independent media backup are unverified.
No production database was created and no Publish/Republish action was executed.

Sources:
- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/publish-database-changes
- https://docs.replit.com/features/data-and-storage/connection-details
- https://docs.replit.com/help/troubleshooting/databases
- https://docs.replit.com/features/data-and-storage/data-recovery

## 2. Implementation and changed files

In the preserved isolated candidate:

- `deploy/managed/config.cjs`: platform URL consumption without disclosure;
  separate deployment/endpoint identities, strict production TLS, bounded pool,
  key/permission contracts and bound activation approvals.
- `deploy/managed/schema.cjs`: managed development schema and read-only structural
  attestation; schema-only Publish compatibility without requiring copied ledger rows.
- `deploy/managed/development.cjs`: explicit one-time empty-development install;
  invented data only, independent durable provision intent, private key custody
  and source-to-SQL semantic reconstruction.
- `deploy/managed/runtime.cjs`: managed repository/media integration, readiness
  and no startup schema changes/reset/seed/fallback. Real production activation
  remains explicitly blocked pending real delivery qualification.
- `deploy/managed/production-approvals.json`: empty; no production permission.
- `deploy/managed/README.md`: operation, migration and residual-risk instructions.
- `development/postgres/repository.cjs`: separate verified managed transport;
  existing staging/local gates retained; same transactions, revision checks,
  idempotency, encrypted controls and immutable-media lifecycle.
- `deploy/staging/migrate.cjs`: exports existing checksum validator for reuse;
  staging behavior unchanged.
- `scripts/managed/{config-test,live-test,schema-test,test-child,preview}.cjs`:
  configuration tests, actual Helium integration, rollback-only catalog probes,
  explicit test-only outage injection/SQL audit and temporary preview.
- This report.

Previous media safety, stronger full-state recovery and REL-001 evidence changes
were preserved in their own development checkpoint. No blind merge into the
original workspace and no production-setting replacement was performed.

## 3. Development/production separation and permission differences

Development uses only the internal Helium endpoint in a non-published process,
an invented `staging-synthetic` identity, private invented signing/backup keys and
an isolated filesystem media mock. SQL and external receipt/intent must agree.
Missing/lost metadata cannot regenerate keys or reseed a database. Actual test
rows remain in the managed DEVELOPMENT database; they were not copied anywhere
near production or erased after validation.

Production configuration cannot consume this manifest in a published process.
It requires a different approved endpoint identity, original key fingerprints,
schema/release/capability contracts, no mock storage, full TLS certificate and
hostname verification, and source/freeze/backup/reconciliation/custody/rollback
evidence bound to a reviewed unexpired approval. None exists.

**Observed privilege risk:** actual development connections use `postgres` with
superuser/schema-create privileges. No custom bq_app role was installed and no
database-enforced least privilege is claimed. Code-only DDL avoidance does not
remove owner privileges. Production capability testing and explicit security
approval remain required if provider-supported credential isolation cannot
establish a restricted role. Development credentials are not implicitly approved
for production.

## 4. Schema lifecycle and compatibility

All 28 codecs, relationships, IDs, historical JSONB attributes, ordering, checks,
unique/expression/partial indices and generated columns remain represented.
Managed parent/child foreign keys are immediate rather than initially deferred:
an explicitly stronger constraint, tested against actual parent-first saves and
orphan refusal. No dependency on custom triggers/functions/grants/roles was added.

The original version/checksum chain is validated when ledger rows exist.
Because Publish copies structure, not those rows, an empty ledger requires an
exact independently reviewed schema fingerprint plus managed release checksum.
Unknown versions, edited checksums, missing columns/schema, extra views,
unexpected RLS or unsupported functions/triggers fail validation.

The actual development catalog has 117 tables. The eventual Publish-generated
SQL has NOT been generated/applied or provider-certified. It must preserve every
required constraint/index/default/generated expression, not just table counts.
Any altered integrity/authorization behavior blocks release.

There is no production schema CLI or build/startup DDL. The explicit development
installer refuses existing user tables and any prior external setup evidence.

## 5. Authentication/session/2FA preservation

The original handlers, KDF formats, session signing operations, TOTP and pending
registration data continue through the same codec/repository transactions.
Actual Helium tests exercised password+TOTP login, registration/SMS fixture,
TOTP enrollment, email fixture confirmation and persisted sessions/accounts
across a fresh worker/cache.

This validates invented data, not live original-key/account continuity. A real
source needs protected custody and independent reconciliation of all hashes,
salts/KDF parameters, versions, sessions, active/pending factors and unknown
historical fields. Missing keys must stop adoption, never regenerate identities.

## 6. Replit App Storage integration

The existing reviewed immutable adapter is reused with explicit dataset/bucket
binding, hash-verified read-back, pending/ready records and cache reconstruction.
Actual development application tests used a filesystem stand-in only; no real
bucket was read, written, overwritten or deleted. Media URLs/SQL references
survived worker/cache restart. Previous object tests still cover corruption,
timeouts, cross-dataset refusal, traversal, symlinks and no deletion capability.

Actual App Storage retention, existing story/highlight/profile media bytes and
production bucket ownership are BLOCKED pending protected inventory. GitHub and
the deployment filesystem are not treated as authoritative media backups.

## 7. Actual test results and classification

**Actual Replit DEVELOPMENT:** 20 integration checks PASS. These cover platform
connection, 117-table/28-document reconstruction, truthful owner-privilege
reporting, login/TOTP, registration/enrollment/email fixture, post create/edit/
delete, comments/reactions, upload/hash/read-back, duplicate replay/conflict,
bounded pool, client-loss readiness/write refusal/reconnection, forged-session
refusal, immediate FK integrity, empty-ledger contract, edited checksum, missing
schema, invalid authority, restart persistence, zero audited runtime DDL and
refusal to re-seed.

**Actual Replit DEVELOPMENT rollback-only probes:** 4 PASS — RLS, unexpected
view, extra column and permission-fingerprint mismatch all refused. Every catalog
probe rolled back; final catalog matched the original contract.

**Managed configuration:** 20 PASS — profile/app/database/key/storage isolation,
forged proof refusal, production evidence/approval checks, pool bound and strict
certificate/hostname TLS configuration. Production TLS handshake itself was
NOT TESTED because no production resource exists.

**Applicable existing synthetic regressions:** 192 PASS:
25 gates, 19 role/TLS/migration checks, 16 storage checks, 26 runtime checks,
24 REL-001 imports, 7 boundary checks, 56 application regressions, 9 native
authorization/profile checks and 10 keyed-membership checks.

**Total: 236 PASS, 0 FAIL in completed suites.** An initial test-loader typo was
fixed before database setup; it is not counted as an application pass.

Important distinctions:

- Connection loss on actual Helium was injected into the application client;
  the provider service was NOT stopped. Real managed-service outage behavior is
  NOT TESTED. The existing disposable-server outage test remains PASS.
- Empty-ledger testing used a rolled-back local row removal. It is NOT a
  completed Publish/schema-copy test.
- Original logical-backup/full-media recovery tests use disposable local
  PostgreSQL and a filesystem provider stand-in, NOT managed production PITR.
- The managed application's public landing page was visually checked on the
  temporary actual-Helium-backed preview; signed-in UI rendering was NOT TESTED.
  Backend authenticated flows were tested through HTTP.

## 8. Remaining provider-specific and implementation limits

BLOCKED:

1. Managed production creation and actual schema-only initial provisioning.
2. Actual published TLS, runtime principal permissions and provider-generated diff.
3. Protected authoritative source generation, complete live inventory and custody.
4. Approved real-data REL-001-to-managed-authority adoption and media mapping.
5. **Real production email/SMS/push delivery:** the inherited bridge still uses
   fixture sinks. Runtime enforces `managed_production_side_effects_not_certified`;
   removing this check is not an approved implementation.
6. Provider PITR, independent immutable source/media recovery and real-key restore.
7. Production-wide writer freeze/drain and compatible rollback with current SQL.

No paid subscription status is treated as permission to create resources or
publish. No fake least-privilege, provider recovery or production compatibility
PASS is substituted for these missing results.

## 9. Source, branch and commit

Live GitHub read-only verification confirmed reviewed source
`5a5a7d7564158c45ff47b34f90a3a0e739c52068` remains the tip of
`development/staging-runtime-2026-11-04`.

Implementation branch: `development/replit-managed-2026-11-04`, in
`generated-artifacts/production-preparation/source`.
Preservation checkpoint: `3b4f177` (previous reviewed safeguards).
The managed implementation is committed separately after validation; its exact
hash is recorded in the handoff response. No push was authorized or performed,
no merge to main occurred, and the original application remains untouched.

Ignored generated fixtures/keys/credentials, SQL labs, snapshots and mock media
are excluded from commits. A review patch is retained outside the ignored
worktree as a recovery/handoff artifact.

## 10. Exact remaining Replit UI steps

These are operator steps for LATER, not actions performed in this assignment.

1. Open the existing app's Publishing settings. Confirm Reserved VM, existing
   URL and current deployment; do not change them to a new product.
2. Open Database, use its database selector and inspect Production. No resource
   was available during this assignment. The workspace development connection
   is not evidence otherwise.
3. Complete the blocked production worker/adoption and security reviews first.
   Obtain explicit approval for production creation, expected usage, target
   identity and the exact schema/data-copy behavior.
4. After that separate approval, enter Publishing's supported production setup:
   current Helium infrastructure creates production through Publish when
   development has data. Legacy interfaces expose Production database settings
   → Create production database. If offered, leave “Set up your production
   database with your current development data” OFF.
5. For current Helium, do not assume a legacy checkbox exists or guarantees
   schema-only initial creation. Confirm the actual current UI offers the
   required no-copy behavior. If that cannot be verified, STOP before approval.
   Development now contains invented test rows; they must never become
   production employee accounts.
6. Review Development database changes detected, all ambiguity/rename prompts,
   and the complete generated SQL. Reject destructive operations, row clearing,
   fixture/data copying, missing constraints or loss of generated/index semantics.
   Never select “Copy your development database schema & data to production.”
7. Require migration validation and a protected preview where supported. A
   preview containing real data must remain protected; do not export it here.
8. Before authority activation, separately verify the actual production endpoint,
   role capabilities, full TLS and exact catalog contract, with counts/keyed
   evidence only. Runtime startup must still refuse absent adoption evidence.
9. Only after source/backup/custody/freeze/import/reconciliation/rollback evidence
   and a release-ready production worker are approved, select Approve and publish
   to update the existing app. No staging migrator, startup DDL or seed is used.

Opening an approval/provision flow can create a production resource. Do not
click Publish/Republish “just to inspect” without the separate authorization.

## 11. Backup, migration and cutover readiness

The existing REL-001 foundation remains valid for synthetic 28-path preservation,
independent reconciliation, original-byte escrow, media checks and interrupted
import/replay refusal. It is not a live managed adoption CLI.

Remaining protected sequence:

1. Attest exact JSON/App Storage source and all writer paths.
2. Inventory every account/employee/entity/relationship, media object and pending
   operational item, retaining original bytes independently.
3. Prove signing/backup/2FA custody and independent access; rehearse provider and
   media recovery with accepted-write continuity.
4. Review schema-only managed production creation and actual security capability.
5. Run an approved protected candidate import/reconciliation and reverse check,
   preserving all 28 paths and unknown historical fields without normalization.
6. Complete real durable delivery, authority adoption and production runtime tests.
7. Approve final freeze; drain every writer/queue, capture the frozen generation,
   back it up, import and independently reconcile before activation.
8. Approve publication to the existing URL; verify real-account/session continuity,
   media, durable canary writes and monitoring.
9. Retain frozen JSON non-authoritatively and keep rollback on **current SQL**.
   Never restore an older JSON generation over newer accepted writes.

Abort on identity/custody drift, incomplete source/media, unsupported records,
unverified copy behavior, TLS/permission/schema mismatch, failed recovery,
unproven freeze, reconciliation mismatch or expired approval.

## 12. Release verdict

- **Replit-managed DEVELOPMENT: VERIFIED**, with invented state in the actual
  managed database, not merely a local PostgreSQL mock.
- **Production schema/TLS/permissions/recovery: BLOCKED**, not provider-certified.
- **Lossless real-data adoption: BLOCKED** pending protected evidence/approval.
- **PRODUCTION: NO-GO.** No production resource, live import, authority activation,
  traffic switch or Publish/Republish was executed.
