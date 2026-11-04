# BQ Connect — isolated staging

Status: **runtime complete and verified locally; not provisioned, not published.** In the committed state every staging command refuses (`production_identity_unrecorded`, then `staging_approval_missing`). Hosted staging needs the external prerequisites in "Deployment-only blockers" and explicit authorization for each provisioning step.

## What staging never shares with production

| Resource | Production | Staging | Enforced by |
|---|---|---|---|
| App / deployment | the existing Repl and URL | a **separate** Repl (own `REPL_ID`) and URL | `gate.cjs`: `REPL_ID` must equal the approved id; production `REPL_ID`/origin fingerprints refused |
| Database | none (JSON authority) | dedicated PostgreSQL 16 database `bq_staging_*` with the `roles.sql` identities | gate name rule and production host fingerprints; runtime connects only as `bq_app` over verify-full TLS; `preflight.cjs` refuses a privileged identity |
| Media bucket | the production `defaultBucketID` | a new bucket created in the staging Repl's App Storage | gate refuses recorded production bucket fingerprints, and refuses when `.replit` names a bucket other than the approved one |
| Keys | production key domains | fresh `BQ_STAGING_SESSION_KEY` (96 hex) and `BQ_STAGING_BACKUP_KEY` (64 hex) | fingerprints in the approved manifest |
| Secrets | SMTP / Twilio / SMS / storage-binding | none present | gate refuses `production_secret_present` |
| Accounts / data | `data/` employee files | invented `staging-synthetic-<uuid>` dataset, random credentials | gate refuses `employee_dataset_present`; seed refuses a non-empty database or an existing bucket receipt |

## Components

| File | Purpose |
|---|---|
| `gate.cjs` | The staging fence. Every command verifies the manifest, identities, keys, CA and a reviewed approval naming the exact binding and operation. |
| `roles.sql` | Least-privilege identities (`bq_owner`, `bq_migrator`, `bq_app`, `bq_backup`); run once by the provider administrator. |
| `migrate.cjs` | Versioned, checksummed migrations as `bq_migrator` (operation `staging-migrate`). The runtime only runs `requireCurrent` and cannot execute DDL. |
| `seed.cjs` | One-time invented dataset as `bq_migrator` (operation `staging-seed`). Writes random credentials to `generated-artifacts/staging/seed-credentials.json` (mode 600, gitignored) and create-once intent/receipt objects in the bucket, so a lost database is never silently re-seeded. |
| `runtime.cjs` | The worker (operation `staging-activate`). Connects as `bq_app` with verify-full TLS and a bounded pool; verifies schema, authority and receipt; restores and hash-verifies media from the bucket; serves with no JSON fallback, no startup DDL and no fault injection; readiness fails closed when the database is unavailable. |
| `start-staging.cjs` | Deployment entry point. Runs the gate, then supervises the worker (exponential backoff, gives up after 5 restarts in 5 minutes). |
| `object-store.cjs` | Immutable content-addressed bucket adapter: verify-after-write, verified reads, no delete path. |
| `preflight.cjs` | Read-only binding check for the staging shell. `--verify-media` re-reads every object; prints identities, counts and a state fingerprint only. |
| `backup.cjs` | Encrypted `pg_dump` as `bq_backup` (operation `staging-backup`); restore as `bq_migrator` into an empty database only. |
| `fixture-outbox.cjs` | Staging never sends real mail or SMS. This prints the one-time codes from the last 5 minutes of the encrypted outbox for testers. |
| `replit.staging.toml` | The `.replit` for the staging Repl. |

## Exact Replit setup

Do each numbered step only after the release owner authorizes it. Never open, copy from or modify the production Repl, its Secrets, its bucket or its deployment. Generated values are typed or pasted only into the staging Repl's Secrets tool; never into chat, commits or tickets.

### 1. Separate staging Repl

1. In Replit, use **Create App → Import from GitHub**, pick this repository and the reviewed staging branch, and name it e.g. `bq-connect-staging`. Do not Remix or Fork the production Repl.
2. Before pressing Run: replace `.replit` with `deploy/staging/replit.staging.toml` (`cp deploy/staging/replit.staging.toml .replit`). Confirm no `data/` directory exists (`ls data` must fail).
3. Do not add a Replit Database to this Repl; staging uses the external database from step 3.

### 2. Staging App Storage bucket

1. In the staging Repl, open **App Storage** (Object Storage), **Create new bucket**, name it `bq-staging-media`.
2. Copy its **Bucket ID** from the bucket settings. Put it in `.replit` `[objectStorage] defaultBucketID` and later in the manifest `bucket`. Commit this `.replit` change only to the staging Repl, never to the production branch.
3. App Storage buckets belong to one Repl and are shared by its workspace and its published app, so the shell tools and the deployment see the same objects.

### 3. Staging PostgreSQL

Requirements: PostgreSQL 16; the administrator can run `CREATE ROLE`; TLS with a CA certificate you can download for verify-full; reachable from Replit (password and TLS required, no plaintext). A dedicated managed PostgreSQL service meets these; creating it is paid infrastructure and needs approval. The Replit-managed database is **not supported** by this runbook: the published app uses a different database from the workspace shell, so migrate, seed and preflight would target the wrong database, and CREATE ROLE and pinnable-CA TLS are unverified.

1. Create database `bq_staging_<suffix>` (for example `bq_staging_rc1`).
2. As the provider administrator, connected to that database only: `psql "<admin connection string>" -v ON_ERROR_STOP=1 -f deploy/staging/roles.sql`. Use a temporary connection string; do not save it as a Secret.
3. Set the three login passwords interactively in the same `psql` session (`\password bq_migrator`, `\password bq_app`, `\password bq_backup`); they are not echoed or logged. Use long random values.
4. Download the provider CA certificate (PEM).

### 4. Keys, secrets and manifest

In the staging Repl shell, generate the key material (each command prints one value; paste it straight into Secrets, then run `clear`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # BQ_STAGING_SESSION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # BQ_STAGING_BACKUP_KEY
node -e "console.log('staging-synthetic-'+require('crypto').randomUUID())" # manifest dataset
echo "$REPL_ID"                                                            # manifest app.replId
```

Secrets (staging Repl Secrets tool only):

| Secret | Content | When |
|---|---|---|
| `BQ_STAGING_SESSION_KEY`, `BQ_STAGING_BACKUP_KEY` | the generated keys | always |
| `BQ_STAGING_DB_CA` | the provider CA PEM, verbatim | always |
| `BQ_STAGING_APP_PASSWORD` | `bq_app` password | always |
| `BQ_STAGING_MANIFEST` | the JSON below | always |
| `BQ_STAGING_MIGRATOR_PASSWORD` | `bq_migrator` password | only during migrate/seed/restore; the runtime and preflight refuse while it exists |
| `BQ_STAGING_BACKUP_DB_PASSWORD` | `bq_backup` password | only during a backup |

Fingerprints for the manifest (run after the Secrets exist; prints hashes only):

```bash
node -e "const s=v=>require('crypto').createHash('sha256').update(v).digest('hex');const e=process.env;console.log(JSON.stringify({session:s(e.BQ_STAGING_SESSION_KEY),backup:s(e.BQ_STAGING_BACKUP_KEY),caSha256:s(e.BQ_STAGING_DB_CA)}))"
```

Manifest (one line in the Secret; values are placeholders):

```json
{"kind":"BQ_STAGING_SYNTHETIC","dataset":"staging-synthetic-<uuid>",
 "app":{"replId":"<staging REPL_ID>","origin":"https://<staging app name>.replit.app"},
 "database":{"host":"<provider host>","port":5432,"name":"bq_staging_<suffix>","caSha256":"<caSha256>"},
 "bucket":"<staging Bucket ID>","keys":{"session":"<session>","backup":"<backup>"},
 "approval":"STG-<id>"}
```

`app.origin` is the staging URL chosen in the publishing settings. If the final URL differs, update the manifest and get a new approval.

### 5. Production fingerprints and approval (reviewed pull requests)

1. The release owner records the identities staging must never match in `deploy/staging/production-identity.json`: `replIdSha256` (SHA-256 of the production `REPL_ID`), `originSha256` (of the lower-case production URL), `bucketSha256s` (of every production Bucket ID, including the one in the production `.replit`), and `databaseHostSha256s` (empty while production has no database). Hashes only: `printf %s '<value>' | sha256sum`.
2. In the staging shell, compute the binding: `node -e "console.log(require('./deploy/staging/gate.cjs').binding(JSON.parse(process.env.BQ_STAGING_MANIFEST)))"`.
3. Add an approval to `deploy/staging/approvals.json` through a reviewed pull request: `{"id":"STG-<id>","operations":["staging-migrate","staging-seed","staging-activate","staging-backup"],"approvedBy":"<name>","approvedAt":"<ISO time>","expires":"<ISO time>","binding":"<binding>"}`. Pull it into the staging Repl. Any manifest change invalidates it.

### 6. Migrate, seed and verify bindings (staging shell)

```bash
npm ci --omit=dev
# add Secret BQ_STAGING_MIGRATOR_PASSWORD, then open a new shell
node deploy/staging/migrate.cjs          # prints {"ran":[...],"version":"0003_native_profile_indexes"}
node deploy/staging/seed.cjs             # once; refuses if the database or bucket was ever provisioned
# delete Secret BQ_STAGING_MIGRATOR_PASSWORD, then open a new shell
node deploy/staging/preflight.cjs --verify-media
```

Preflight must show the approved dataset, bucket and database, `role: "bq_app"`, a TLS version, schema `0003_native_profile_indexes`, and `mediaVerified` equal to `media`. Any refusal stops the rollout. Hand `seed-credentials.json` to testers through an approved channel; it never leaves the staging Repl otherwise. If `seed.cjs` stopped after the database commit but before the receipt, rerun with `--finish-receipt`; it never re-seeds. If it failed before the commit, the bucket intent still blocks reuse of that dataset: generate a new dataset id, update the manifest and get a new approval.

### 7. Publish (only with explicit authorization)

1. **Publish → Reserved VM**, one instance. Build and run come from `.replit` (`npm ci --omit=dev`, `node deploy/staging/start-staging.cjs`). Confirm no production Secrets are present and `BQ_STAGING_MIGRATOR_PASSWORD` is absent.
2. After publishing: the deployment log shows `{"staging":"ready",...}`; `https://<staging URL>/health/ready` returns 200; `/health/live` returns 200.
3. Run the hosted test list below with the seeded invented accounts. Use `node deploy/staging/fixture-outbox.cjs` in the staging shell to read registration and email codes.

### 8. Republish persistence

1. In the shell, run `node deploy/staging/preflight.cjs` and note `files`, `media` and `state`. Log in on a phone and note one post and one image.
2. Republish without changes. Preflight again: `state` must be identical (if testers were active, `files` may have advanced but nothing may disappear). The same login session must still be valid, and the post and image must open with identical bytes.

### 9. Backup and restore rehearsal

1. Add Secret `BQ_STAGING_BACKUP_DB_PASSWORD`, then run `node deploy/staging/backup.cjs backup /tmp/staging.bqbackup`. The file is encrypted with the backup key and bound to the dataset. Delete the Secret afterwards. Use the provider's point-in-time recovery as the primary backup if it offers it.
2. Provider administrator: create an empty database `bq_staging_restore_<date>` and run `roles.sql` in it.
3. Make a temporary manifest that differs only in `database.name` and `approval`; it needs its own reviewed approval for `staging-migrate` and `staging-activate`. With that manifest and `BQ_STAGING_MIGRATOR_PASSWORD`: `node deploy/staging/backup.cjs restore /tmp/staging.bqbackup`. It refuses a non-empty database.
4. Remove the migrator Secret and run `node deploy/staging/preflight.cjs --verify-media` with the restore manifest. `state` must equal the source preflight taken at backup time. Restore the live manifest afterwards; the restore database is dropped only by the release owner.
5. Bucket objects are immutable and never deleted by this code, but App Storage offers no versioning: an independent media copy is outside this runbook.

## Hosted test list (none PASS until executed on the staging deployment)

Health and readiness; invented registration, password login, 2FA, recovery and logout; session persistence across restart and republish; text and image posts, comments, likes, bookmarks, reposts and delete; media upload, Range/HEAD and cold-start restore; database interruption (provider restart or failover) with fail-closed readiness and recovery; duplicate submissions; backup and restore rehearsal; bounded load; every production identity refused (the gate fails closed when given a production `REPL_ID`, bucket or URL).

## Verified locally (stand-ins, not hosted certification)

Disposable TLS-only PostgreSQL 16 with a throwaway CA, and a filesystem stand-in for App Storage. See `reports/STAGING_RUNTIME_COMPLETION_REPORT.md` for the full matrix.

| Suite | Scope |
|---|---|
| `scripts/staging/runtime-e2e.cjs` | Real worker inside a simulated deployment, as `bq_app` over TLS: seed, logins, registration, password change, posts, media, comments, likes, bookmarks, idempotency, pool bound, restart and cold start, no local business data, cache refill, corrupt/missing media, database outage and recovery, pending/edited migrations, TLS and credential refusals, production identities, supervisor, fences, no DDL, preflight, outbox tool, encrypted backup and restore |
| `scripts/staging/role-matrix.cjs` | TLS refusals, migrations, `bq_app` DDL/escalation refusals, backup read-only, connection limits, timeouts, server restart |
| `scripts/staging/gate-test.cjs` | One approved invented binding accepted; every deviation refused |
| `scripts/staging/object-store-test.cjs` | Immutable keys, verify-after-write, corrupt/missing/outage distinction, verified restore, create-once control records |

## Deployment-only blockers

- Authorization to create the staging Repl, bucket and paid managed PostgreSQL, and to publish.
- Provider capability check: `roles.sql` succeeds and verify-full TLS works against the provider CA (role matrix rerun against the real endpoint).
- Real App Storage behaviour (verify-after-write, Range/HEAD, latency) via the hosted tests.
- Production fingerprints recorded and an approval entry merged by the release owner.
- Real SMTP/SMS stay fixture-only in staging by design.
