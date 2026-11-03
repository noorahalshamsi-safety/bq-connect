# BQ Connect — Initial Production Audit

**Scope:** Read-only repository and configuration review, static security scans, and isolated development-preview startup. No employee/account data was opened, no production endpoint was tested, no production records were changed, and no publish or redeploy was performed.

## Executive summary

The project is a custom Node.js HTTP application with a plain JavaScript frontend. It stores application records as JSON files rather than in a relational database. The checked-in deployment configuration targets a Replit VM, runs `node start.js`, and links Replit App Storage. The startup code restores files from App Storage before loading the server and creates encrypted snapshots in the same storage service.

The repository shows a deliberate persistence and recovery design, including guards against empty storage and unexpected decreases in key record counts. The reported “accounts disappear after republish” root cause is **NOT YET VERIFIED**: this review cannot establish which production bucket/data generation was restored at the time of an incident, or whether users experienced lost accounts versus invalidated sessions. Replit documents that deployment filesystem data is not persistent across republishing; the App Storage restore path is therefore critical.

The deployment service currently reports a public VM deployment with a successful build. This audit did not request its URL or inspect runtime logs or employee-facing production responses.

**Most urgent:** preserve the current production configuration and data; verify the production bucket identity and restore/snapshot counts using an approved, read-only procedure; resolve the high-severity `uuid` advisory in a separate reviewed change.

## Verified architecture

| Area | Evidence |
|---|---|
| Runtime | Node.js 22; built-in `http` server; no framework or SQL database dependency declared. |
| Frontend | Static HTML, CSS, JavaScript, and PWA service worker under `public/`. |
| Authentication | Application-managed employee/password accounts in JSON files; scrypt password hashes; HMAC-signed sessions; session and 2FA state are tied to a local key file restored through App Storage. |
| Application data | JSON files under `data/`; media is under `data/media/`. These local files are excluded from Git. |
| Deployment | `.replit` specifies VM, `node start.js`, and a build-time `npm install --omit=dev`. Deployment metadata confirms VM, successful build, public visibility. |
| Persistence | `start.js` restores from App Storage before loading the server; `storage-sync.js` mirrors data/backups while published. `vault.js` stores encrypted snapshots in App Storage. |
| Translation | Local Transformers pipelines for Arabic/English, with model files downloaded at runtime; no external translation API call was found in `translate.js`. The isolated preview disables translation. |
| Email/SMS/push | SMTP settings are file/environment-backed; SMS providers and web push are implemented. Their live credentials and end-to-end delivery were not checked. |
| Tests and migrations | No README, automated test suite, or database migration files were found in the project root. The data model is JSON-file based. |

Replit's current documentation says deployment filesystem data does not persist across republishing; persistent application data should use a database or App Storage. The configured App Storage path is present in code, but its production contents and history were not inspected.

## Republish/account-loss investigation

**Result: NOT YET VERIFIED.**

Evidence from the repository:

- `server.js` defines local JSON paths for employee/account and social data.
- `.replit` configures the `vm` target, runs `node start.js`, and links an App Storage bucket.
- `start.js` only loads `server.js` directly when storage syncing is disabled; for published deployments it restores App Storage first, checks for pending recovery/import requests and count drops, then starts syncing and the server.
- `storage-sync.js` only enables mirroring in a published deployment. It restores remote files before serving and protects critical files from some replacement/deletion cases.
- `vault.js` creates encrypted snapshots and compares account/employee/post counts to detect certain drops. The archive explicitly excludes media; media depends on the ordinary App Storage sync.
- The development workspace contains ignored `data/` files. Their contents were deliberately not inspected or copied into the development preview.
- Replit deployment metadata confirms the current deployment target is VM and the current build is successful; it does not identify the historical bucket or data loaded during a prior republish.

What remains unknown: the historical bucket ID and contents at the time of reported loss; whether the production process restored the expected bucket; whether the latest vault snapshot contains the affected records; whether only the session key/session records changed; and whether media was affected. No evidence in this workspace proves account deletion, bucket mismatch, or session invalidation as the root cause.

**Safe next evidence to gather:** in the production Repl, use an authorized read-only review of the linked bucket ID, storage marker, newest vault index/counts, and deployment logs around one reported incident. Compare counts only; do not print employee identifiers, credentials, or record contents. Confirm the identity of the bucket before any restore or sync action. Do not set data-drop override flags or run restore/import commands during investigation.

## Security findings

### SEC-01 — High — vulnerable transitive `uuid` dependency

- **Evidence:** Replit dependency audit reports `uuid@9.0.1`, advisory `GHSA-w5hq-g745-h8pq`, high severity. Scanner indicates a fix is available at `11.1.1`, requiring a major-version update.
- **Impact:** A vulnerable dependency is present in the installed dependency graph. The exact import path and runtime exposure should be confirmed before upgrading.
- **Status:** Open; no dependency was changed during this audit.
- **Recommended action:** Identify the direct parent in the lockfile, review compatibility, update the parent or dependency in a dedicated change, then run dependency audit and app-level regression tests.
- **Regression test:** dependency audit is clean and the affected feature path passes tests after the major-version change.

### SEC-02 — Medium — deployment data depends on successful App Storage restore/sync

- **Evidence:** Replit deployment filesystem is not a durable source across republishing; the app stores records in local JSON files and relies on startup restore/sync.
- **Impact:** A wrong/empty bucket, failed restore, or incorrect recovery operation could make accounts appear missing or restore a different generation. The code has several guardrails, but production configuration and historical behavior were not verified.
- **Status:** Risk verified; incident cause unverified.
- **Recommended action:** Verify the production bucket and recovery inventory read-only, then conduct a synthetic restore/restart/republish-equivalent test in an isolated environment.
- **Regression test:** synthetic employee/account/post/media fixtures survive restart and storage restore using the same test bucket.

### SEC-03 — Low/Medium — in-memory abuse limits reset on restart

- **Evidence:** IP and per-account attempt/rate-limit maps are process memory in `server.js`; they are cleared on process restart.
- **Impact:** Repeated restarts or multiple instances can weaken rate-limit continuity. This is not proof of a bypass in the current single-VM deployment.
- **Status:** Static observation; not tested against production.
- **Recommended action:** If threat modeling or scale requires limits across restarts/instances, persist counters in a shared store with expiry and consistent proxy-IP handling.
- **Regression test:** synthetic login and API load tests across process restart and multiple instances.

### Positive controls observed

- Passwords use Node.js `scrypt` and timing-safe comparison; missing accounts take a dummy-hash path.
- Sessions are signed, expire, have an idle timeout, and are tied to per-account session entries and a key file.
- Server responses add CSP, `nosniff`, frame denial, referrer, permissions, cross-origin, and HSTS headers.
- API requests have rate limits; login failures have additional account/IP tracking.
- Storage sync uses atomic temp-file replacement during restore and has guards for critical files and unexpected count drops.
- SAST and HoundDog scans completed with no findings reported.

These observations are code review evidence, not proof that every authorization path or user-controlled rendering path is safe.

## Feature inventory (static; not end-to-end verified)

| Feature | Frontend | Backend | Storage | Authorization | Tested |
|---|---|---|---|---|---|
| Employee sign-in, registration, password recovery, 2FA, sessions | Present | Present | JSON account records | Token/session checks in handlers | No; requires test identities and mail configuration |
| Employee directory and profiles | Present | Present | JSON employee/profile files | Role/identity checks exist in code | No |
| Posts, comments, reactions, polls, reports, bookmarks, follows | Present | Present | Multiple JSON files | Per-handler checks present; not exhaustively reviewed | No |
| Media and avatars | Present | Upload/download routes | Local files mirrored by App Storage | Upload limits/type checks found; authorization and persistence not end-to-end tested | No |
| Notifications and push | Present | Present | JSON and push-key files | Session-dependent routes | No live delivery test |
| Admin/moderation | Present | Present | JSON configuration/audit files | Server-side role checks present; all endpoints not tested | No |
| Arabic/English translation | Present | Local model pipeline | In-memory bounded cache | Authenticated route and per-user limit | No model warm/download or quality test |
| Daily prompts/sparks | Present | Local generation | JSON | Authenticated route | No |
| PWA/mobile layout | Manifest/service worker and responsive frontend files present | Static assets | Browser cache | N/A | Desktop preview only |
| Backups/recovery | No user-facing UI assessment | Encrypted snapshots and restore helpers | App Storage | Operational actions not exercised | No |

## Scan and test results

| Check | Result | Evidence |
|---|---|---|
| Dependency audit | **1 high** | `uuid@9.0.1`, `GHSA-w5hq-g745-h8pq`; major upgrade reported as available |
| SAST | **No findings reported** | Replit static scanner |
| HoundDog privacy/security scan | **No findings reported** | Replit scanner |
| Existing automated tests | **Not present** | No test/spec files found |
| Production account persistence | **BLOCKED / NOT TESTED** | Requires approved read-only access to production storage/history; no production records were read |
| Isolated development preview | **PASS** | Started from a temporary source copy with an empty data directory; it does not use workspace `data/` or `backups/` |
| Authenticated end-to-end tests | **BLOCKED** | Safe synthetic employee/account fixtures and test mail/SMS services are not configured |

## Remediation roadmap

1. **P0 — Establish the account-loss cause:** read-only production bucket/snapshot/deployment-history review; distinguish missing account rows from invalidated sessions; no restore or migration before approval.
2. **P1 — Close the dependency advisory:** trace `uuid` to its parent, review the major upgrade, and add regression coverage before updating.
3. **P1 — Prove durability safely:** build an isolated test harness with synthetic identities, posts, and media; test restart, restore, sync lag, and redeploy-equivalent startup.
4. **P1 — Authorization and media tests:** exercise ownership/admin checks with synthetic accounts and direct API requests; verify that media is preserved and access rules are correct.
5. **P2 — Reliability and privacy:** test translation failure behavior, notification delivery, mobile breakpoints, backup recovery, and rate-limit behavior across restarts.
6. **P3 — Scale planning:** consider a transactional database only if multi-instance/concurrent-write requirements justify a reviewed, lossless migration. No database migration is proposed or performed here.

## Controlled implementation proposals

- **Production investigation (approval required):** read-only verification of the bucket and latest snapshot counts, plus deployment-log correlation. No data mutation. Rollback is not applicable.
- **Dependency update (separate approval/change):** update the vulnerable dependency path, run scanners and regression checks, and revert the lockfile/package change if tests fail.
- **Synthetic durability harness:** add fixtures and automated restart/restore tests in an isolated directory/bucket. It must never import production data or use production secrets.
- **Database migration:** deferred. Requires an approved schema and lossless migration plan, tested backups, relationship/count validation, and explicit authorization before any production operation.
