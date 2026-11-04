# BQ Connect — production database preparation

**Date:** 2026-11-04. **Scope:** the existing BQ Connect application and URL, not a new employee-facing product.

## 1. Existing production identity and storage

The publishing metadata confirms a public, successfully built Reserved VM deployment at **https://bq-connect.replit.app**. The original deployment configuration remains `node start.js`, with the existing install build command.

The workspace and supplied source have the same configured App Storage bucket fingerprint:
`ce11c603901c2550295d04cf9a5898200348ff8d29086744a88ee73d8f8716ec`.
This is configuration evidence, **not an attestation of the deployed process's actual bucket, authoritative generation or signing keys**. The supplied state identifies JSON/App Storage as the live account authority. Its exact live authority was not independently established by the available publishing metadata.

No live bucket contents, employee files, signing keys, backup keys or database credentials were downloaded, revealed or copied into development. Production secret checks examined presence only. A runtime-managed DATABASE_URL being present does not identify a production database.

## 2. GitHub and source verification

- Original workspace HEAD: `44b91cbfae69bd793246c6fe462f53659ec50c13`; original application sources were not replaced.
- Requested source: `5a5a7d7564158c45ff47b34f90a3a0e739c52068`.
- A live read-only `git ls-remote` confirmed that exact commit at `development/staging-runtime-2026-11-04` in the specified GitHub repository.
- The supplied `/home/runner/bq-connect-new-source` directory was absent, although its old worktree registration remained.
- A fresh detached worktree was created at `generated-artifacts/production-preparation/source`, pinned to the requested commit. The stale registration was not pruned or overwritten.
- Preparation changes are uncommitted in that isolated worktree, **not deployed or activated in the original app**. A separate patch retains them for review and later application to the verified source. No commit, push, merge or publication was performed.

## 3. Provider capabilities: observed versus documented

**Observed development database:** a read-only metadata query returned PostgreSQL **16.10**, database `heliumdb`, role `postgres`, server SSL **off**, **0** visible non-system tables, and role creation capability. This is the development resource, not a suitable verified-TLS production destination. Nothing was provisioned into it.

**Observed production metadata:** the production database service returned **“This project has no production database.”** This establishes no Replit-managed production database was available to that service. It does not rule out an external database or establish that any workspace connection is production.

**Documented Replit-managed path:**

- Development and production are separate. Current Helium-based projects create production during Publish when the development database contains data; legacy Neon setup has separate create/copy choices.
- Production schema changes use Publish's generated diff, validation and explicit approval. Application startup/build must not run schema DDL.
- Publish does not carry grants, functions, procedures or triggers and has limited role support. Therefore a successful table migration would not prove BQ Connect's restricted-role setup.
- Production PITR and scheduled backups are documented. Core supports up to 7 days; Pro/Enterprise up to 28, with 7 days initially. Actual project settings and a restore rehearsal have **not** been verified.
- Do not enable development-data copying or “copy development database schema & data to production.” Do not seed this empty development database merely to trigger production creation.

**Concrete alternative if the managed path cannot meet the reviewed requirements:** an explicitly approved, separately owned external **Neon PostgreSQL 16** project/database, connected to the same existing Replit app. Neon documents custom SQL-created restricted roles, verified TLS, external migration workflows and history-based recovery. Roles made through its Console/API/CLI receive `neon_superuser`; those are **not** suitable application identities. Restricted application roles must be created through the reviewed SQL privilege workflow.

Neon recommends `verify-full` with the system trust store/ISRG Root X1. This is not permission to set `rejectUnauthorized:false`. Its documented restore window is plan-dependent (Free 6 hours, Launch maximum 7 days, Scale maximum 30); no selected resource, plan, region, retention or provider restore has been tested here. Provider documentation is capability evidence, not resource certification.

**Decision:** provider selection/provisioning remains BLOCKED on separate approval and a verified target. No connection, role, schema or production recovery claim is inferred from local PostgreSQL success.

References:

- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/publish-database-changes
- https://docs.replit.com/features/data-and-storage/data-recovery
- https://docs.replit.com/features/data-and-storage/connection-details
- https://neon.com/docs/manage/roles
- https://neon.com/docs/connect/connect-securely
- https://neon.com/docs/introduction/history-window

## 4. Provisioning status

**NOT PROVISIONED.** No database, role, table, bucket, production secret or provider setting was created or changed. All database writes made for validation used disposable local clusters with invented credentials and dedicated synthetic identities.

The empty development database must remain empty unless a separately approved development task needs it. Empty metadata is not permission to adopt an authority, generate replacement keys or initialize accounts.

## 5. Runtime integration status and implemented changes

The supplied staging runtime is executable and passed integration tests. It uses verified TLS, a restricted pooled application role, checksum-verified versioned schema, immutable media keys, database-backed state and cold-cache reconstruction. It refuses pending/edited migrations, missing receipts, mismatched authority, production identities and migrator credentials at runtime. It executed **zero DDL commands after migration** in the runtime test.

Changes made in the isolated candidate:

1. Object reads now reject other dataset namespaces **before** contacting storage.
2. Cold restoration validates UUIDs, hashes, exact dataset/object bindings and duplicate IDs before writing; it refuses symlink/hardlink cache entries and symlink cache directories.
3. Recovery validation now independently reconstructs all 28 business documents and compares **every row of all 117 SQL tables**, using keyed fingerprints. It recovers from a separate media copy, validates existing sessions, then proves a newly accepted write survives restart.
4. REL-001 now includes a pure protected-membership evidence helper. It emits only a domain, count, algorithm and HMAC; requires an independently held audit key; binds source identity and generation; rejects duplicate/coerced identities; and preserves case and leading zeros. Its tests use invented identities only.

**Production integration remains incomplete, deliberately fail-closed.** The current staging gate is not a production activation gate. REL-001's isolated import target and media escrow are not an approved production runtime authority. A reviewed source-to-runtime adoption package is still required: schema installation through the selected provider's permitted mechanism, media escrow-to-object mapping, original signing/backup-key custody, operational-state treatment, authority/receipt attestation and explicit activation approval. No generic “production=true” switch, seed-based adoption or identity bypass was added.

The three original application workflows were not replaced or reconfigured. The existing public landing page was visually checked; signed-in UI rendering was not verified. Synthetic HTTP tests, rather than a real employee login, verified the backend paths.

## 6. Existing live inventory

**BLOCKED / not executed.** No separately authorized protected environment or exact authoritative live generation was supplied. Real account/content/media counts are unknown, not zero.

The protected operator inventory must cover accounts, employees, passwords and versions, sessions, pending login/registration, TOTP/recovery material, groups and memberships, posts/stories, nested comments/replies, polls, reactions, notifications, audit, profiles/settings, push state, unknown historical fields, all media references/bytes and any in-flight operational state.

For membership evidence, use a separate custody-held random audit key of at least 32 bytes. Bind the same source fingerprint, frozen generation and domain on both source and destination comparisons. Do not use the destination's identity as a different comparison context. Emit counts and keyed fingerprints only, not raw identifiers or unsalted hashes of small identity sets. The new helper is an implementation primitive, not authorization or a production inventory CLI.

## 7. REL-001 compatibility

**PASS for synthetic preservation tooling; real-source suitability BLOCKED.**

The supplied importer, independent reconciler, reverse reconstruction, escrow verification, interrupted-import handling and boundary checks were exercised on the requested source revision. They do not authorize importing real employees.

The synthetic suite verifies exact semantic reconstruction across all 28 supported documents, stable relationship ordering, credential/factor fields and unknown historical fields; original bytes remain separately escrowed. Missing/incomplete source, missing/corrupt media, mismatched identities, equal-count membership substitution, unsafe number precision, unsupported input and inconsistent/replayed receipts are refused rather than normalized or replaced.

Real-source dry-run procedure:

1. Obtain separate protected read/export approval and attest live app, bucket, authority mode, generation and key fingerprints.
2. Use a protected environment that cannot be mistaken for development. Keep source data and all custody material there.
3. Inventory every entity, relationship and object; validate the supported-source contract before opening a destination transaction. Preserve original bytes independently.
4. Bind approval to source digest/generation, destination resource, reviewed importer/build and expiry. A successful earlier run is not approval for a changed source.
5. Import into an isolated candidate of the selected provider, never the live authority. Do not seed or fabricate identities.
6. Independently compare all documents and references, membership HMACs, all credential/session/factor semantics and exact media bytes/hashes. Reverse reconstruction must independently pass.
7. Test the approved runtime adoption path on that candidate, including original-key compatibility, authorization and side-effect isolation.
8. Repeat against the final frozen source under separate cutover approval. Retain both dry-run and final evidence.

There is currently **no approved production command** for steps 5–8. Existing development/staging CLIs must not be pointed at production or have their fences removed.

## 8. Backup and recovery readiness

**Local logical recovery PASS; provider recovery BLOCKED.**

The strengthened rehearsal stopped the synthetic writer, encrypted a `bq_backup` logical dump, restored it through `bq_migrator` into an empty separate database, and independently matched all 28 reconstructed files and 117 SQL tables, including runtime/control state. Overwrite and wrong-key attempts were refused.

A separately copied media stand-in restored verified bytes into a fresh cache; existing synthetic sessions authenticated in the restored runtime. A post accepted there survived another restart. Outage, crash supervision, missing/corrupt object, interrupted import and duplicate-request recovery also passed.

Limits:

- The media provider was a filesystem stand-in, not live App Storage.
- The logical restore used the same disposable local PostgreSQL cluster with a separate database, not a provider disaster-recovery region or PITR timeline.
- Local read-only escrow/checksums are not certified provider WORM retention.
- Synthetic key continuity was tested; real key custody, independent escrow access and disaster key recovery were not.
- A graceful local writer stop is not a proven freeze across production HTTP, background jobs and every live writer.
- Restarting a compatible build on current restored SQL was tested. An older release binary, production schema compatibility and production rollback routing were not certified.
- Backup streaming/resource bounds and restore times at actual production volume remain unmeasured.

After SQL accepts writes, rollback must keep that **current SQL authority**. Do not restore an old JSON generation. If an approved prior build cannot consume current SQL, remain in maintenance/read-only mode and fix forward or execute a separately rehearsed current-state recovery.

## 9. Actual synthetic validation

- Staging identity/approval gates: **25/25 PASS**.
- Restricted-role, TLS and migration matrix: **19/19 PASS**.
- Media/object adapter, including new boundary tests: **16/16 PASS**.
- Staging runtime integration, including strengthened recovery: **26/26 PASS**.
- REL-001 primary import/reconciliation suite: **24/24 PASS**.
- REL-001 boundary suite: **7/7 PASS**.
- Compatibility application suite: **56/56 PASS**.
- Native-profile/authorization parity: **9/9 PASS**.
- Protected membership evidence primitive: **10/10 PASS**.

**192 checks PASS, 0 FAIL.** Unchanged gate/role results came from the baseline pass; affected object/runtime and REL-001/compatibility results are the completed preparation pass, not added twice.

Coverage includes password/TOTP and registration/email confirmation, original-session persistence, password changes, account restart persistence, posts/images/comments/replies/reactions/bookmarks, media GET/ranges, restricted authorization, request replay/conflict, bounded pool, database outage/recovery, process supervision, migration drift and startup refusal. All identities, keys, credentials, content and media used were synthetic.

Reproduction, from the isolated worktree:

```sh
cd /home/runner/workspace/generated-artifacts/production-preparation/source
node scripts/staging/gate-test.cjs
node scripts/staging/role-matrix.cjs
node scripts/staging/object-store-test.cjs
node scripts/staging/runtime-e2e.cjs
node scripts/migration/rel001/tests.cjs
node scripts/migration/rel001/boundary-tests.cjs
node scripts/migration/rel001/compatibility.cjs e2e
node scripts/migration/rel001/compatibility.cjs parity
node scripts/migration/rel001/membership-evidence-test.cjs
```

These are isolated tests, not provisioning, migration or release commands.

## 10. Exact unresolved blockers

- Actual deployed authority, generation, bucket ownership/binding and original key fingerprints are unattested.
- No approved, identified production PostgreSQL destination exists.
- Selected-provider version, verified certificate chain/hostname, restricted-role privileges, migration support and retention have not been measured on a real target.
- Real inventory, supported-record assessment and source-to-destination reconciliation are unavailable.
- Production source-to-runtime adoption/activation implementation and its provider-specific integration remain outstanding.
- Immutable independent backup/media custody, provider PITR/restore and real-key recovery remain untested.
- Production-wide write freeze/drain and old-build/current-SQL rollback compatibility are unproven.
- No approved resource/cost/region/retention choice or live cutover approval exists.

## 11. Required operator approvals

Separate approvals are required for:

1. Protected live identity/inventory/export and custody access, with exact environment and data boundaries.
2. Provider, region, cost, retention and creation of a dedicated persistent destination.
3. Restricted roles and reviewed schema installation through the selected provider's permitted path.
4. Protected real-data dry run, runtime adoption implementation and candidate restore rehearsal.
5. Final source freeze, final import/reconciliation, authority activation and update of the **existing** published app.
6. A specific rollback plan/build and recovery evidence.

Secret values must be supplied through scoped Secrets/provider controls, never chat, a report or command-line arguments.

## 12. Minimum safe remaining operator actions

**Inspection only, no approval implied:**

1. Open Publishing for the existing app and verify the existing URL/Reserved VM configuration.
2. Open Database → production selector/settings. Confirm whether a production resource exists; do not treat the workspace Helium connection as it.
3. Review the candidate patch against the verified source revision.

**After explicit provisioning approval, choose one path:**

- **Managed Replit:** inspect Publishing → Adjust settings → Production database settings where available. Review schema-only/data-copy behavior and role/grant limitations. Do not click Publish, enable copying, or populate development merely to create production. If there is no supported provisioning-only path that preserves the existing live deployment and meets the required controls, stop this path and obtain approval for the external option. Any later managed schema migration must use the reviewed Publish diff; no custom production DDL/startup hook.
- **External Neon:** the operator creates a dedicated PostgreSQL 16 project/database in the approved region after cost approval, with no import/branch from existing production. Record sanitized project/endpoint/database identity. Configure history retention and a restricted-role strategy; do not use Console-created administrator roles as the app identity. Test full certificate/hostname verification and exact role privileges on this new target before considering it eligible. Only then approve and implement its reviewed external migration package.

Use production-scoped Secrets for approved app-only credentials and approved CA configuration. Keep migrator/admin credentials out of the runtime. Preserve original signing/backup keys through protected custody; absence is a blocker, never permission to generate replacements.

**Stop before runtime adoption/import or any Publish action.** An approved provider choice alone does not resolve the other blockers or authorize live employee migration.

## 13. Complete production cutover checklist

- [ ] Verify existing published app/URL and immutable source build; preserve the original application.
- [ ] Independently attest live bucket, generation, source membership and all writer paths.
- [ ] Approve and inventory the full protected source; reject incomplete/unsupported data.
- [ ] Establish independently retained exact source backup, full media backup and key custody; verify read-back and access from recovery.
- [ ] Identify the approved dedicated SQL destination; verify provider/version/TLS/restricted privileges.
- [ ] Install reviewed schema through the permitted provider mechanism; no seeds or startup DDL.
- [ ] Complete production runtime adoption and receipt/authority attestation; preserve original keys and stable identifiers.
- [ ] Run a protected real-source dry run; independently reconcile semantics/memberships/media and reverse export.
- [ ] Rehearse provider restore/PITR, media loss, key recovery, interrupted import and new-write recovery.
- [ ] Test an approved rollback build against current SQL, not an older JSON copy; bind it to the release plan.
- [ ] Approve a maintenance window and freeze every source writer, including scheduled/background jobs; drain acknowledged operations and handle in-flight queues explicitly.
- [ ] Prove freeze, record final generation, take and verify final independent backups.
- [ ] Import the final frozen source into the approved SQL candidate; never mutate the authoritative source.
- [ ] Reconcile every entity/relationship, credential/session/factor, membership HMAC, reference and media checksum; stop on any discrepancy.
- [ ] Rehearse candidate startup and original-session authorization in the protected environment with external side effects disabled.
- [ ] Obtain final activation/publication approval for that exact source, destination, backup, reconciliation and rollback evidence.
- [ ] Activate the attested SQL authority and update the existing app at its existing URL through the approved publication process.
- [ ] Check readiness, original-account login/session compatibility, authorization, media and durable canary writes; monitor error/outbox/pool/replay behavior.
- [ ] Keep the frozen legacy source retained and non-authoritative. Never let a fallback or restart reseed SQL or resume old JSON writers.
- [ ] If recovery is needed after new SQL writes, preserve current SQL and use only the approved compatible rollback/fix-forward process.

**Abort before activation** for any identity drift, incomplete source/media, custody failure, unsupported record, privilege/TLS failure, changed migration checksum, incomplete freeze, reconciliation mismatch or expired approval. After activation, enter maintenance on authority uncertainty; do not silently fall back to JSON.

## 14. Separate readiness verdicts

- **LOCAL: PASS** — requested source and preparation changes passed 192 isolated checks. Original app remains available; only its public landing page was visually checked.
- **DATABASE: BLOCKED** — no verified persistent production target; development Helium is not a substitute.
- **MIGRATION: SYNTHETIC PASS / REAL BLOCKED** — lossless tooling and local recovery are verified on invented state; protected source, provider and adoption evidence remain required.
- **PRODUCTION: NO-GO** — no live import, activation, traffic switch or publication performed or authorized.
