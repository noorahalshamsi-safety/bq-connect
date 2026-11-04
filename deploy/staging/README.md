# BQ Connect — isolated staging configuration

Status: **prepared, not provisioned, not deployed.** Every staging operation is refused in the committed state (`production_identity_unrecorded`, then `staging_approval_missing`). Even with an approval, `start-staging.cjs` refuses with `staging_runtime_not_integrated`, because the hosted runtime wiring is not built yet (see "Remaining engineering").

## What staging must never share with production

| Resource | Production | Staging requirement | Enforced by |
|---|---|---|---|
| Application / deployment identity | the existing Repl and its deployment URL | a **separate** Repl (new `REPL_ID`) and its own deployment URL | `gate.cjs`: `REPL_ID` must equal the approved staging id; production `REPL_ID` and origin fingerprints refused |
| Database | none today (JSON authority) | a new provider database named `bq_staging_*` | `gate.cjs` name rule, recorded production host fingerprints refused; `roles.sql` identities |
| Object Storage bucket | `defaultBucketID` in `.replit` | a **new** bucket, passed explicitly as `bucketId` | `gate.cjs` reads `.replit` and refuses that bucket |
| Signing / backup keys | production key domains | new random staging keys (`BQ_STAGING_SESSION_KEY` 96 hex, `BQ_STAGING_BACKUP_KEY` 64 hex) | fingerprints bound in the manifest and approval |
| Secrets | SMTP / Twilio / SMS / storage-binding secrets | none of them may be present | `gate.cjs` refuses `production_secret_present` |
| Employee accounts / data | `data/` employee files | invented `staging-synthetic-<uuid>` dataset only | `gate.cjs` refuses when `data/accounts.json`, `employees.json`, `posts.json` or `security.json` exist |

A Repl forked or imported from this repository inherits `.replit`, including the production `defaultBucketID` and `run = "node start.js"`. In the staging Repl, before anything runs:

1. Replace the `[objectStorage]` section with the new staging bucket (or remove it), and **do not** copy any `data/` directory.
2. Set the deployment `run` to `["node", "deploy/staging/start-staging.cjs"]` and `build` to `["npm", "ci", "--omit=dev"]`. Never use `node start.js` or `development/postgres/launch.cjs` in staging: both refuse inside a deployment by design, and neither may be weakened.

## Staging secrets (set in the staging Repl's Secrets panel only)

| Secret | Content |
|---|---|
| `BQ_STAGING_MANIFEST` | JSON binding (below) |
| `BQ_STAGING_SESSION_KEY`, `BQ_STAGING_BACKUP_KEY` | fresh random hex keys generated for staging; never production values |
| `BQ_STAGING_DB_CA` | provider CA certificate (PEM) used for verify-full TLS |
| `BQ_STAGING_MIGRATOR_PASSWORD` | password of `bq_migrator` (only while migrating) |
| `BQ_STAGING_APP_PASSWORD` | password of `bq_app` (runtime) |

Manifest shape (values invented):

```json
{"kind":"BQ_STAGING_SYNTHETIC","dataset":"staging-synthetic-<uuid v4>",
 "app":{"replId":"<staging REPL_ID>","origin":"https://<staging deployment host>"},
 "database":{"host":"<provider host>","port":5432,"name":"bq_staging_<suffix>","caSha256":"<sha256 of BQ_STAGING_DB_CA>"},
 "bucket":"<staging bucket id>","keys":{"session":"<sha256 of session key>","backup":"<sha256 of backup key>"},
 "approval":"STG-<id>"}
```

## Approval workflow (the separate gate)

1. Record production identities that staging must differ from in `production-identity.json`. This needs SHA-256 of the production `REPL_ID`, of the lower-case production origin, and of any production database hosts.
2. Compute the binding with `node -e "const g=require('./deploy/staging/gate.cjs');console.log(g.binding(JSON.parse(process.env.BQ_STAGING_MANIFEST)))"`, run inside the staging Repl shell.
3. Add an entry to `approvals.json` through a reviewed pull request: `{id, operations:["staging-migrate","staging-activate"], approvedBy, approvedAt, expires, binding}`. Any change to the manifest (bucket, host, keys, app) invalidates the binding.

## Provisioning order (each step needs explicit authorization)

1. Create the staging Repl, database and bucket. Record their identities only in the staging manifest.
2. As the provider administrator, run `roles.sql` against the staging database. Then set the `bq_migrator`, `bq_app` and `bq_backup` passwords in the provider console.
3. Run `node deploy/staging/migrate.cjs` with `BQ_STAGING_MIGRATOR_PASSWORD`. It is versioned and checksummed, runs in one transaction, and refuses an unversioned, edited or newer schema. Remove the migrator password secret afterwards.
4. Deploy. The run command is `deploy/staging/start-staging.cjs`, which currently refuses (see below).

## Verified locally (stand-ins, not hosted certification)

| Suite | Result | Scope |
|---|---|---|
| `scripts/staging/role-matrix.cjs` | 19/19 | TLS-only local PostgreSQL 16 with throwaway CA; verify-full, foreign CA, hostname mismatch, plaintext and wrong-password refusals; migrations incl. interruption, unversioned, edited and newer schema; app identity DML allowed, 14 DDL and 9 escalation attempts refused; backup read-only; connection limit; role timeouts; server restart with fail-closed in-flight use and reconnect |
| `scripts/staging/gate-test.cjs` | 22/22 | one approved invented binding accepted; every single deviation refused; development fence still refuses inside a deployment |
| `scripts/staging/object-store-test.cjs` | 12/12 | immutable content keys, verify-after-write, idempotent retry, corrupt/missing/outage/timeout distinction, cold-start verified restore with bounded concurrency, no delete path; filesystem stand-in of the SDK |

## Remaining engineering before a staging deployment can serve

- **Hosted runtime wiring (NOT IMPLEMENTED).** The repository must connect as `bq_app` with the gate's TLS settings. Runtime DDL (`hardenControls`, native-profile indexes) must be skipped in favour of `requireCurrent`. The provision receipt must move to the staging bucket so that a lost database cannot be re-seeded. Media must be committed through `ImmutableStore.put` before `ready`, and restored to the local cache at cold start.
- **Hosted certification (BLOCKED, needs authorization).** Rerun the role matrix against the real provider endpoint and certificate. Run the adapter against the real bucket, including Range/HEAD. Exercise network-loss and failover behaviour.

## Staging tests to run once provisioning is authorized

Health and readiness; invented registration, password login, 2FA enrolment, recovery and session restart; restart and redeploy persistence; post, comment, like, repost and delete; group membership; announcement permissions; media upload, Range/HEAD, cold-start restore and integrity check; stories, highlights and retention; feed/search/profile at the agreed envelope; translation both directions; logout and session revocation; backup and synthetic restore; bounded load; and a rollback rehearsal. All of these use invented employees only. None of them are PASS until they are executed on the staging deployment.
