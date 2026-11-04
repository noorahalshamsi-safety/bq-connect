# BQ Connect — release delivery report (release candidate 1)

Date: 2026-11-04. Workstation: Windows 11 with WSL2 Ubuntu 24.04.4, Node v22.23.4, npm 10.9.9, PostgreSQL 16.15, OpenSSL 3.0.13.
Scope: invented fixture data only. No production data, keys, media, credentials, Replit backups or provider accounts were accessed, copied or provisioned.

**Verdicts (section 18):**
- LOCAL DEVELOPMENT READY: **YES**, with the caveats listed.
- STAGING DEPLOYMENT READY: **NO**. The staging configuration, gate, roles, migrations and media adapter are built and tested locally, but the hosted runtime wiring is not implemented, and provisioning has not been authorized.
- PRODUCTION READY: **NO-GO**.

Evidence levels used throughout:
- **EXECUTED**: run here, with the observed result.
- **IMPLEMENTED**: code written and covered by the stated tests.
- **NOT TESTED**: not run.
- **BLOCKED**: needs an authorization or resource that is not available.

---

## 1. Branch and commit

| Item | Value |
|---|---|
| Repository | `github.com/noorahalshamsi-safety/bq-connect` (public) |
| Release-candidate branch | `release-candidate/2026-11-04-rc1` |
| Created from | `handoff/replit-rel001-2026-11-04` at `c1a37e1c352eae541c18f877892c1904205273dd` (remote handoff branch unchanged) |
| `main` | untouched, remote `d64050c` |
| Head | the commit containing this report. The pushed SHA and tree are verified against `git ls-remote` after the push and reported alongside the compare link. |
| Merge / force-push / deploy | none |

## 2. Files and commits

| Commit | Summary | Files |
|---|---|---|
| `5666875` | Extract runtime DDL statements so versioned migrations reuse the exact same SQL. Runtime behaviour unchanged. | `development/postgres/native-profile.cjs`, `development/postgres/repository.cjs` |
| `d7175ed` | REL-003: staging least-privilege roles, versioned checksummed migrations, TLS role matrix | `deploy/staging/roles.sql`, `deploy/staging/migrate.cjs`, `scripts/staging/role-matrix.cjs` |
| `6583f14` | Staging activation gate: explicit identity, provider binding and reviewed approval | `deploy/staging/gate.cjs`, `approvals.json`, `production-identity.json`, `start-staging.cjs`, `scripts/staging/gate-test.cjs` |
| `321e436` | REL-004: immutable, verified object-store adapter | `deploy/staging/object-store.cjs`, `scripts/staging/object-store-test.cjs` |
| `730ce4d` | REL-012: bounded translation queue depth and caller wait | `translate.js`, `scripts/translation/regression.cjs`, `scripts/postgres/phase2g/tests.cjs` |
| `4b2bfb7` | Staging configuration guide; production cutover runbook (not executed) | `deploy/staging/README.md`, `reports/PRODUCTION_CUTOVER_RUNBOOK.md` |
| `8189ccf` | The model fetch helper waits for the first download beyond the new caller deadline. Found in the clean-clone run: the helper reported "empty result" even though the models were cached. | `development/local/fetch-models.cjs` |
| this commit | This report | `reports/RELEASE_DELIVERY_REPORT.md` |

Not modified:
- `start.js`
- `server.js`
- `.replit`
- `replit.md`
- the isolation fence
- the production deployment configuration
- any `data/` file (none is tracked)

## 3. Build results (EXECUTED, clean clone of `4b2bfb7`)

| Step | Result |
|---|---|
| `git clone --branch release-candidate/2026-11-04-rc1` into an empty WSL folder | HEAD `4b2bfb72304ac7c9a812ba58215f994b513b4391` |
| Root `npm ci` | 146 packages, public registry |
| Preview `npm ci` | 248 packages |
| Preview `vite build` | succeeded. The Replit artifact config requires `PORT` and `BASE_PATH`; the build ran with `PORT=5173 BASE_PATH=/`. |
| Preview typecheck | not runnable: `typescript` is not in the preview graph (unchanged, REL-016 note) |
| `development/postgres/launch.cjs`, minimal environment (`PATH`, `HOME` and `LANG` only) | Printed the synthetic-only banner. `/health/ready` returned 200 on 5000 and on the 4173 alias. Unauthenticated `POST /api/session` returned 401. The fixture credential file has mode 600. SIGTERM gave launcher exit 0 and stopped the cluster. No tracked file changed. |
| `development/local/fetch-models.cjs` from a cold cache, after `8189ccf` | `ar>en ready`, `en>ar ready` (88 s) |

## 4. Test matrix

The **Clean clone** column was run on a fresh clone of `4b2bfb7` (and on `8189ccf` for the model fetch). The **Working mirror** column was run in the WSL mirror of the same source during this release pass.

| Suite | Clean clone | Working mirror |
|---|---|---|
| Staging gate `scripts/staging/gate-test.cjs` | 22/22 | 22/22 |
| Object-store adapter `scripts/staging/object-store-test.cjs` | 12/12 | 12/12 |
| Role / TLS / migration matrix `scripts/staging/role-matrix.cjs` | 19/19 | 19/19 |
| REL-001 migration tests | 24/24 | 24/24 |
| REL-001 boundary tests | 7/7 | 7/7 |
| HTTP compatibility `scripts/postgres/e2e.cjs` | 56/56 | 56/56 |
| REL-001 compatibility e2e / parity | — | 56/56, 9/9 |
| Hardening | 27/27, after the public model weights were fetched; 26/27 before, with B22 returning 503 because no model was cached | 27/27 |
| Native profile parity | 9/9 | 9/9 |
| Background reliability | both modes ready, 0 refusals | same |
| Phase 2D / 2F / 2G | — / — / 11/11 | 11/11, 16/16, 11/11 |
| Architecture validation | — | 20/20 |
| Translation regression | unit 4/4, ar→en 8/8, en→ar 6/6 | same |
| Security coverage gaps / forwarded IP | — | 4/4, 9/9 |
| Native feed load (`phase2c-load native`) | — | 100, 500 and 1000 concurrent: 5000 posts completed. 20000 posts stopped by the isolated memory/wall guard or by connection failure under that guard. This is the known REL-011 limit, not a pass. |

Not re-run in this pass:
- The persistence harness. Its code paths are unchanged; the last result is the documented baseline of 43 PASS, 1 FAIL (T18) and 9 BLOCKED.
- The Phase 2C two-model engine probe, historically BLOCKED by its 768 MiB guard.
- Phase 2E.

No assertion was weakened. Phase 2G G10 was made stronger: it previously only demonstrated a hang, and now proves the caller is released by the deadline.

## 5. Vulnerabilities (EXECUTED, clean clone)

| Graph | Result | Status |
|---|---|---|
| Root | 6 moderate, 0 high, 0 critical. All are `uuid` < 11.1.1 (GHSA-w5hq-g745-h8pq) under `@replit/object-storage` → `@google-cloud/storage`. `npm audit` reports "No fix available". | **REL-006 OPEN**. No major version forced. Needs a supported upstream release or a signed exception. |
| Preview | 0 | — |
| Secret scan of every added line in `c1a37e1..HEAD` | 3 rule hits, all reviewed false positives: two hits on the PostgreSQL advisory-lock constant, and one on the deliberately wrong password literal in the R06 rejection test. No banned paths, no file over 1 MiB, no `data/` path, no `.env`, key, certificate or credential file tracked. | clean |

## 6. PostgreSQL status

**IMPLEMENTED and EXECUTED locally (stand-in for the hosted provider):**
- **Roles** (`deploy/staging/roles.sql`, idempotent):

  | Role | Configuration |
  |---|---|
  | `bq_owner` | NOLOGIN; owns the schema |
  | `bq_migrator` | NOINHERIT, connection limit 2; must `SET ROLE` |
  | `bq_app` | NOINHERIT, limit 8, DML only; statement/lock/idle timeouts 20 s / 12 s / 60 s |
  | `bq_backup` | read-only, limit 2 |

  `PUBLIC` loses database and schema access.
- **Migrations** (`deploy/staging/migrate.cjs`): `0001_base`, `0002_request_expiry_and_fault_points` and `0003_native_profile_indexes`.
  - Checksummed, applied in one transaction under an advisory lock, as `bq_owner` through `SET LOCAL ROLE`.
  - Refuses an unversioned schema, an edited (checksum) migration, a sequence gap and a schema newer than the release.
  - `requireCurrent` refuses a pending migration.
  - `bq_app` cannot write `schema_migrations`.
- **Role matrix R01–R19 on a TLS-only PostgreSQL 16 with a throwaway CA:**
  - verify-full TLS 1.3 accepted; foreign CA, hostname mismatch, plaintext (28000) and wrong password (28P01) refused
  - migrations, no-op rerun, interrupted migration rolled back then retried, and unversioned/edited/newer schemas refused
  - app DML allowed; 14 DDL statements and 9 privilege escalations refused (42501); no privileged attributes
  - backup read-only; migrator NOINHERIT; connection limit enforced (53300); role timeouts set
  - server restart: in-flight use fails closed (57P01), the pool reconnects and committed rows survive

**Preserved behaviour (existing suites):**
- dev/staging/prod separation by fences
- commit-before-success with actual fault points (B16–B19)
- missing-state refusal (B21, e2e H56)
- idempotent retries and session/2FA compatibility (B05, B06, B23)
- transactional outbox (B26)
- bounded pool and lock timeouts (B25)

No PostgreSQL error falls back to JSON authority.

**NOT IMPLEMENTED (blocks a staging deployment):**
- the hosted runtime connecting as `bq_app` with the gate's TLS settings
- skipping runtime DDL in favour of `requireCurrent`
- moving the provision receipt to the staging bucket so a lost database cannot be re-seeded

**BLOCKED (authorization):**
- the real provider endpoint, certificate and failover (REL-003)
- PITR and restore drills (REL-002)

The production schema is not created and production accounts are not reset or seeded.

## 7. Media status

**IMPLEMENTED, EXECUTED against the filesystem stand-in only.** `deploy/staging/object-store.cjs`:
- Immutable content-addressed keys of the form `<synthetic dataset>/immutable/<uuid>/<sha256>`.
- Verify-after-write.
- An idempotent retry never overwrites.
- Distinct errors for corrupt, missing, outage and timeout.
- Verified cold-start restore: temporary file, then rename, mode 600, bounded concurrency, fail-closed.
- No delete method.

Tests O01–O12 PASS. The Replit SDK has no create-if-absent operation, so immutability rests on content keys plus verification. This is recorded as a design limit.

**NOT IMPLEMENTED:** committing uploads through the adapter before `ready`, and restore at runtime start.
**NOT TESTED:** the real bucket, including Range/HEAD (REL-004).
**Unchanged:** media visibility. Known-URL access is current behaviour until the REL-008 policy is approved.

## 8. Authentication and 2FA

No authentication code changed. EXECUTED this pass:
- hardening B04/B05/B06/B20/B23/B24 (email OTP gate, 2FA management, encrypted replay restrictions, admin 2FA reset and session revoke, cross-process rate limits)
- e2e 56/56
- REL-001 suites with active and pending 2FA preserved
- forwarded-IP 9/9

Browser BR-01 (Arabic, desktop) passed in the previous pass. The two configuration risks remain open under REL-010:
- loopback is always trusted as a proxy hop
- `TRUST_PROXY` must equal the exact hosted hop count

Real SMTP and SMS delivery is NOT TESTED (REL-009).

## 9. Feed and search

The feed contract is unchanged, and the private pagination prototype is not the default. Phase 2D 11/11, Phase 2F 16/16 and parity 9/9 passed. Load: 5000 posts complete at concurrency 100, 500 and 1000. 20000 posts is stopped by guards (REL-011 open; no signed envelope).

## 10. Translation (REL-012)

**IMPLEMENTED (`730ce4d`):**
- At most 6 jobs pending. Further requests return immediately with HTTP 503 `translate_failed` instead of queueing without bound.
- A caller is released after 45 s. The model job still completes and fills the cache, so a retry is fast.
- Model errors still propagate.
- Models run locally (OPUS-MT), with no external service.

**EXECUTED:** regression A91 (5 concurrent requests against a bound of 2 → 3 immediate refusals, 2 completed) and A92 (1 ms deadline releases the caller; the engine stays usable); hardening B22 (actual model over HTTP); Phase 2G G10 deadline.

**Open:**
- No bilingual reviewer has scored quality.
- The external translate-link policy is undecided.
- The browser translation rows BR-17/BR-21 are NOT TESTED.

## 11. Browser and mobile (REL-007)

Real browser interactions in Cursor's built-in browser against the local launcher, with invented accounts.

| Row | Status | Executed |
|---|---|---|
| BR-01 | PASS (Arabic, desktop) | Previous pass: password, 2FA, wrong factor, recovery-code reuse denial |
| BR-05 | PARTIAL | Previous pass: create, edit and delete with reload; cross-user edit/delete denied (403); edit-title defect fixed |
| BR-06 | **PARTIAL** | This pass: a real double-click on reply produced exactly one comment; comment like; post like and bookmark persisted after reload. **Observation (unconfirmed):** the detail view did not show the like/bookmark as active until reload. Nested reply, rating, repost, views, cross-user notifications and network retry were not run. |
| BR-15 | PARTIAL | Previous pass: posts and bio payloads inert |
| BR-18 | PARTIAL | Previous pass: 390×844 emulated viewport (not a real device) |
| BR-02–04, 07–14, 16, 17, 19–22 | NOT TESTED | |

Screenshots and HTTP responses are not counted as interactions. No real device or PWA install was tested.

## 12. Staging configuration (IMPLEMENTED, not provisioned)

`deploy/staging/README.md` defines a separate Repl, database, bucket, keys, secrets and dataset that share nothing with production:

| Resource | How staging is kept separate |
|---|---|
| App | Different `REPL_ID` and origin; recorded production fingerprints refused |
| Database | `bq_staging_*` names; recorded production hosts refused; CA fingerprint bound |
| Bucket | Explicit `bucketId`; the `.replit` `defaultBucketID` (production) refused |
| Keys | Fresh staging keys bound by fingerprint |
| Secrets | Refused if SMTP, Twilio, SMS or production storage-binding secrets are present |
| Data | `staging-synthetic-<uuid>` only; refused if legacy `data/` employee files exist |

The gate (`deploy/staging/gate.cjs`) requires a reviewed `approvals.json` entry bound to the SHA-256 of the canonical manifest, with operations, a named approver and an expiry. Tests G01–G22 PASS, including the case where the development fence still refuses inside a deployment.

The committed state refuses everything (`production_identity_unrecorded`). `start-staging.cjs` refuses with `staging_runtime_not_integrated` even when approved. No generic bypass flag exists, and no existing fence was weakened.

Fork hazard: a Repl created from this repository inherits the production `defaultBucketID` and `run = "node start.js"`. The README lists the replacements required before anything runs.

## 13. Staging results

**NOT EXECUTED.** Staging provisioning and deployment were not authorized. No Repl, database, bucket or secret was created. The post-authorization test list is in `deploy/staging/README.md`. No staging scenario is marked PASS.

## 14. Migration and rollback runbook

`reports/PRODUCTION_CUTOVER_RUNBOOK.md` has 14 stages:
1. dataset identification
2. protected inventory
3. membership reconciliation
4. immutable backup
5. key custody
6. media reconciliation
7. writer freeze
8. frozen comparison
9. import and validation
10. authority activation
11. traffic cutover
12. monitoring
13. post-verification
14. rollback/recovery

Each stage has an owner, inputs, go evidence and an abort path. Rollback after accepted writes is a restore to SQL state, never to the old JSON. **NOT EXECUTED**, and no repository command performs it. REL-001 operator steps remain in `reports/REL001_OPERATOR_RUNBOOK.md`.

## 15. Updated 18-item register

These are proposed statuses. The authoritative `reports/POSTGRESQL_PHASE2G_BLOCKERS.json` is unchanged; owners confirm.

| ID | Prio | Status | Change in this release candidate |
|---|---|---|---|
| REL-001 | P0 | OPEN – approval-gated | none |
| REL-002 | P0 | OPEN – approval-gated | runbook stages 4 and 14 defined |
| REL-003 | P0 | OPEN – hosted certification blocked | roles, TLS and migration lifecycle 19/19 locally; runtime wiring not implemented |
| REL-004 | P0 | OPEN – hosted certification blocked | immutable verified adapter 12/12 on stand-in; runtime wiring not implemented |
| REL-005 | P0 | OPEN – approval-gated | runbook stages 7 and 8 defined |
| REL-006 | P1 | OPEN | 6 moderate `uuid`, no fix available |
| REL-007 | P1 | OPEN | BR-06 PARTIAL added |
| REL-008 | P1 | OPEN – policy decision | none |
| REL-009 | P1 | OPEN – provider sandbox | none |
| REL-010 | P1 | OPEN | none |
| REL-011 | P1 | OPEN – envelope sign-off | load re-measured; 20000 guarded |
| REL-012 | P1 | OPEN – bilingual review and policy | queue and wait bounded (A91, A92) |
| REL-013 | P1 | OPEN – hosted operations | runbook stage 12 defined |
| REL-014 | P0 | OPEN – custody authorization | staging key fingerprints in the gate |
| REL-015 | P1 | OPEN – full role matrix | database-role matrix added; route matrix unchanged |
| REL-016 | P2 | Ready to close pending preview typecheck | none |
| REL-017 | P2 | NOT STARTED (optional) | none |
| REL-018 | P3 | NOT STARTED (optional) | none |

All 15 mandatory items (REL-001 to REL-015) remain open. None is labelled closed.

## 16. Outstanding approvals

| Approval | Owner | Unblocks |
|---|---|---|
| Review the RC branch; decide merge to `main` | Repository owner | release line |
| Staging provisioning (separate Repl, database, bucket) and deployment | Platform owner | sections 12–13, REL-003/004 hosted |
| Record production identity fingerprints in `production-identity.json` | Release owner | any gate operation |
| Staging approval entry (`approvals.json`, reviewed PR) | Release + security owner | staging migrate/activate |
| Protected inventory and authoritative dataset | Data owner | REL-001 |
| RPO/RTO, independent backup target | Operations | REL-002 |
| Writer-freeze window | Release owner | REL-005 |
| Key custody ceremony | Security custodian | REL-014 |
| Media audience policy | Data owner | REL-008 |
| Mail/SMS/push sandboxes | Platform | REL-009 |
| `uuid` fix or signed exception | Security | REL-006 |
| Feed/load envelope | Product + operations | REL-011 |
| Bilingual reviewer, translate-link policy | Product | REL-012 |
| Hosted alerting and on-call | Operations | REL-013 |
| Each production cutover stage | Per runbook | production |

## 17. Release-candidate URL

- Branch: `https://github.com/noorahalshamsi-safety/bq-connect/tree/release-candidate/2026-11-04-rc1`
- Compare against the handoff branch: `https://github.com/noorahalshamsi-safety/bq-connect/compare/handoff/replit-rel001-2026-11-04...release-candidate/2026-11-04-rc1`
- Compare against `main`, for a pull request only after review; do not merge automatically: `https://github.com/noorahalshamsi-safety/bq-connect/compare/main...release-candidate/2026-11-04-rc1`

## 18. Verdicts

| Outcome | Verdict | Basis |
|---|---|---|
| LOCAL DEVELOPMENT READY | **YES** | Clean clone installs from the public registry, builds, launches and passes the suites in section 4. Caveats: model weights must be fetched once; the preview needs `PORT`/`BASE_PATH`; no preview typecheck; browser checklist incomplete. |
| STAGING DEPLOYMENT READY | **NO** | Hosted runtime wiring is not implemented (section 6 and 7), and provisioning has not been authorized. The configuration, gate, roles, migrations and adapter are ready for that work. |
| PRODUCTION READY | **NO-GO** | REL-001 to REL-005 and REL-014 need protected resources and approvals; REL-006 to REL-013 and REL-015 remain open. |

### Minimum next operator actions

1. Repository owner: review the RC branch with the handoff compare link. Do not merge to `main` until the review is complete.
2. Platform owner: decide whether to authorize staging provisioning. If authorized, create a new Repl, database and bucket per `deploy/staging/README.md` (replace the `.replit` bucket; copy no `data/`).
3. Engineering: implement the hosted runtime wiring listed in section 6 and 7, then rerun the role matrix and adapter tests against the real staging endpoints.
4. Release and security owners: record production fingerprints and add the staging approval through a reviewed PR.
5. QA: continue BR-02 to BR-22 on a real browser and device.
6. Owners in section 16: provide the approvals, starting with REL-001, REL-002 and REL-014.
