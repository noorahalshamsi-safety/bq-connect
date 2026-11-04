# BQ Connect — RC1 hosted staging runtime completion

Date: 2026-11-04. Base: `release-candidate/2026-11-04-rc1` at `04075bc`. Branch: `development/staging-runtime-2026-11-04`.

**Verdicts:** staging runtime engineering complete and verified locally. **STAGING: BLOCKED** on deployment-only prerequisites (authorization, provider capability check, production fingerprints, approval entry). **PRODUCTION: NO-GO** (unchanged from RC1).

Nothing in this work touched production: no production Repl, database, bucket, Secrets, employee records or deployment were opened, copied, changed or republished. Every result below comes from local stand-ins: a disposable TLS-only PostgreSQL 16 with a throwaway CA, and a filesystem stand-in for App Storage. None of it is hosted-provider certification.

## What changed

| Area | Change |
|---|---|
| PostgreSQL runtime | The repository has a staging mode: `bq_app` only, verify-full TLS, pool max 6 (configurable down), connect/statement/lock/idle timeouts. Runtime DDL and provisioning throw (`runtime_ddl_forbidden`, `runtime_provisioning_forbidden`). Startup runs `requireCurrent` and verifies authority, seal and the bucket receipt. There is no JSON fallback: the durable-commit fence is satisfied only by an active SQL transaction in the isolated copy, and the original `auth.js` is unchanged. |
| Provisioning | `seed.cjs` is a separate approved operation (`staging-seed`) as `bq_migrator`. It creates random credentials, a create-once intent and receipt in the bucket, and refuses whenever the bucket or database shows prior provisioning. The runtime never seeds. |
| Media | Uploads write a pending row, are stored in the immutable bucket (verify-after-write) and then cached. Cold start restores and hash-verifies every object. Cache gaps are refilled from the bucket. Existing `/uploads/...` URLs are unchanged. There is no delete path. |
| Startup | `start-staging.cjs` runs the gate, then supervises `runtime.cjs` (exponential backoff, gives up after 5 restarts in 5 minutes). `replit.staging.toml` has no production bucket and no `node start.js`. |
| Gate | Refuses recorded production bucket fingerprints, and a `.replit` bucket other than the approved one (a Repl created from this repository inherits the production bucket). Seal is bound to dataset and key domains. |
| Operator tools | `preflight.cjs` (read-only binding check and state fingerprint), `backup.cjs` (encrypted `pg_dump` as `bq_backup`; restore into an empty database only), `fixture-outbox.cjs` (OTP codes for testers; staging never sends real mail or SMS). |
| Docs | `deploy/staging/README.md`: exact Replit setup, republish, backup and restore steps. |

## Local staging-equivalent startup

The real `deploy/staging/runtime.cjs` ran inside a simulated deployment (`REPLIT_DEPLOYMENT=1`, approved invented `REPL_ID`):

- The gate passed. The worker connected as `bq_app` over TLSv1.3 with verify-full against the throwaway CA (1 connection at idle, at most 3 under 8 concurrent requests, bound 4).
- Schema was `0003_native_profile_indexes`, checked by `requireCurrent`, with 0 DDL commands recorded after migration.
- Media was restored from the bucket and verified. `{"staging":"ready",...}` was logged and `/health/ready` returned 200.
- Before provisioning, the worker refused `staging_not_provisioned`. When the database stopped, readiness returned 503, writes returned 503 and nothing committed; the worker recovered without restarting.
- The supervisor restarted a killed worker and stopped after repeated `28P01` credential failures.

## Regression matrix (local)

| Suite | Result |
|---|---|
| `scripts/staging/runtime-e2e.cjs` | 26/26 PASS |
| `scripts/staging/gate-test.cjs` | 25/25 PASS |
| `scripts/staging/object-store-test.cjs` | 13/13 PASS (stand-in) |
| `scripts/staging/role-matrix.cjs` | 19/19 PASS |
| `scripts/migration/rel001/tests.cjs`, `boundary-tests.cjs` | 24/24, 7/7 PASS |
| `scripts/migration/rel001/compatibility.cjs e2e`, `parity` | 56/56, 9/9 PASS |
| `scripts/postgres/e2e.cjs`, `hardening.cjs` | 56/56, 27/27 PASS |
| `scripts/postgres/phase2c-parity.cjs`, `phase2c-background.cjs` | 9/9 PASS; both modes ready, no refusals |
| `scripts/postgres/phase2d-tests.cjs`, `phase2f/tests.cjs`, `phase2g/tests.cjs` | 11/11, 16/16, 11/11 PASS |
| `scripts/architecture/validate.cjs` | 20/20 PASS |
| `scripts/translation/regression.cjs` | PASS both directions |
| `scripts/security/forwarded-ip.cjs`, `coverage-gaps.cjs`, `route-inventory.cjs` | 9/9, 4/4 PASS; 97/97 routes referenced |

Runtime e2e scenarios, by requirement:

| Requirement | Scenario | Local | Hosted |
|---|---|---|---|
| Registration and login | S06, S07, S25 | PASS | NOT TESTED |
| Password, session, 2FA persistence | S06, S08, S13 | PASS | NOT TESTED |
| Text and image posts | S09 | PASS | NOT TESTED |
| Comments, likes, bookmarks | S10 | PASS | NOT TESTED |
| Restart and reconnection | S13, S16 | PASS | NOT TESTED |
| Cold start without local business data | S13, S14 | PASS | NOT TESTED |
| Media hash integrity | S09, S15, S23, S24 | PASS | NOT TESTED |
| Database interruption and recovery | S16 | PASS | NOT TESTED |
| Duplicate request and commit reconciliation | S11 | PASS | NOT TESTED |
| Gate refusal for every production identity | S19, gate G01–G25 | PASS | NOT TESTED |
| Readiness and supervision | S05, S16, S20 | PASS | NOT TESTED |
| No startup DDL, migration refusals | S17, S22 | PASS | NOT TESTED |
| TLS and credential refusals | S18 | PASS | NOT TESTED |
| One-time seed, no reseeding | S01–S04 | PASS | NOT TESTED |
| Backup and restore | S26 | PASS | NOT TESTED |
| Range/HEAD on real App Storage | — | — | BLOCKED (needs bucket) |
| Republish persistence | — | — | BLOCKED (needs publish authorization) |

## Deployment-only blockers

1. Authorization to create the staging Repl, its App Storage bucket and a managed PostgreSQL 16 database (paid), and later to publish.
2. Provider capability: `roles.sql` (CREATE ROLE) and verify-full TLS with a downloadable CA. The Replit-managed database is not supported by this runbook, because the workspace shell and the published app use different databases.
3. Production fingerprints (`REPL_ID`, URL, bucket IDs) recorded by the release owner, plus a reviewed approval entry for the staging binding.
4. Hosted tests on the published staging app (table above), including the role matrix against the real endpoint and Range/HEAD against the real bucket.
5. Real SMTP/SMS remain fixture-only in staging by design.

## Production

NO-GO, unchanged. Production still uses the JSON authority with the durable-commit fence. No migration, cutover, key rotation, freeze, restore or republish was performed or authorized.
