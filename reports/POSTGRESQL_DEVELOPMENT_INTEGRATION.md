# BQ Connect — PostgreSQL development integration review

Generated: 2026-11-03T12:17:05.377Z. Scope: **invented data, development only**.

## Verdict

The actual imported application now has an isolated PostgreSQL-authoritative development entrypoint. The current HTTP suite reports **56 PASS / 0 FAIL**. These are real HTTP requests to the existing handlers, not SQL-only smoke tests.

**This is not a production-ready certification or a claim that every Phase 2 verification requirement is complete.** The full legacy adaptation matrix is {"PASS":33,"BLOCKED":14,"NOT TESTED":6}; blocked restore/adoption paths and untested behavior are listed explicitly. No production publish, production connection/schema/data change, real employee import, live key rotation, or root release-fence removal was performed.

Validation boundaries: H22 injects an exception after persistence but **before** the COMMIT statement; it is not a server-side COMMIT rejection/network-fault drill. H23 drops the HTTP response after successful COMMIT. In-flight database COMMIT transport ambiguity remains NOT TESTED. The public language-selection screen was visually checked in the running preview; signed-in screens were exercised through HTTP contracts but were **not visually verified**.

## Changed-file inventory

- development/postgres/isolation.cjs — private synthetic root, reproducible local PostgreSQL cluster, key-domain/dataset seal, deployment refusal.
- development/postgres/launch.cjs — development-only provision/start; no generic production URL or activation flag.
- development/postgres/fixtures.cjs — invented employees, accounts, keys, sessions and provider settings.
- development/postgres/codec.cjs — all 28 JSON value mappings, 107 relational node tables plus transactional control tables.
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

The prior 59-table DDL remains an unchanged design prototype. The executable **dev** schema is a compatibility-oriented refinement with 107 node tables and control tables. It prioritizes lossless original shapes and existing route behavior. It has parent/file foreign keys, stable ID uniqueness, session/rating/repost uniqueness and selected generated-column/check constraints. It does **not** yet provide all proposed typed domain columns, cross-person foreign keys, least-privilege database roles, migration lifecycle, hosted HA/PITR or production-scale query plans. This refinement requires review; it is not silent approval of a new production schema.

### Serialization and security limits

The global request transaction deliberately serializes legacy mutable graphs across workers, preventing lost writes while keeping original behavior. It reloads all mapped entities and rewrites changed collection projections; media reference validation hashes objects. This is correctness-first **development** code, not an efficient production repository implementation. Slow body/handler work can hold serialization; load/slow-client/queue-exhaustion testing, narrower asynchronous repositories and robust cancellation remain prerequisites. HTTP response caches can include sensitive auth responses: production retention/encryption/access policy is not certified.

## Entity mapping

All 28 mappings were deep round-tripped using invented values, including unknown fields, missing/null, nested order, historical highlight snapshots and leading-zero identities. Stable item IDs are carried unchanged; relational row IDs are deterministic logical paths, not newly invented employee identities.

| Original path under data/ | Relational root | Mapping / evidence |
|---|---|---|
| accounts.json | dev.account_root | Records/children with lossless per-record attributes; H30 |
| employees.json | dev.employee_root | Records/children with lossless per-record attributes; H30 |
| ideas.json | dev.post_root | Records/children with lossless per-record attributes; H30 |
| notifications.json | dev.notification_root | Records/children with lossless per-record attributes; H30 |
| bookmarks.json | dev.bookmark_root | Records/children with lossless per-record attributes; H30 |
| views.json | dev.view_root | Records/children with lossless per-record attributes; H30 |
| follows.json | dev.follow_root | Records/children with lossless per-record attributes; H30 |
| profiles.json | dev.profile_root | Records/children with lossless per-record attributes; H30 |
| groups.json | dev.group_root | Records/children with lossless per-record attributes; H30 |
| daily-sparks.json | dev.spark_settings | Records/children with lossless per-record attributes; H30 |
| dept-profiles.json | dev.department_root | Records/children with lossless per-record attributes; H30 |
| announcements.json | dev.announcement_root | Records/children with lossless per-record attributes; H30 |
| announce-seen.json | dev.seen_root | Records/children with lossless per-record attributes; H30 |
| highlights.json | dev.highlight_root | Records/children with lossless per-record attributes; H30 |
| moderators.json | dev.moderator_settings | Records/children with lossless per-record attributes; H30 |
| security.json | dev.security_settings | Records/children with lossless per-record attributes; H30 |
| security-log.json | dev.audit_settings | Records/children with lossless per-record attributes; H30 |
| sms.json | dev.sms_settings | Records/children with lossless per-record attributes; H30 |
| smtp.json | dev.smtp_settings | Records/children with lossless per-record attributes; H30 |
| backup-status.json | dev.backup_status | Records/children with lossless per-record attributes; H30 |
| mail.json | dev.opaque_mail | Opaque legacy value; no invented schema; H30 |
| messages.json | dev.opaque_messages | Opaque legacy value; no invented schema; H30 |
| conduct.json | dev.conduct_settings | Records/children with lossless per-record attributes; H30 |
| join-requests.json | dev.join_root | Records/children with lossless per-record attributes; H30 |
| push-keys.json | dev.push_keys | Records/children with lossless per-record attributes; H30 |
| push-subs.json | dev.push_root | Records/children with lossless per-record attributes; H30 |
| backup.json | dev.backup_settings | Records/children with lossless per-record attributes; H30 |
| vault-status.json | dev.vault_status | Records/children with lossless per-record attributes; H30 |

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
| /api/login-2fa | 11 | 200, 401 |
| /api/email | NOT TESTED | — |
| /api/2fa | NOT TESTED | — |
| /api/join | 1 | 200 |
| /api/login | 8 | 200, 401 |
| /api/register | 5 | 200, 401 |
| /api/forgot | 1 | 200 |
| /api/translate | 1 | 503 |
| /api/views | 1 | 200 |
| /api/password | 2 | 200, 401 |
| /api/logout-all | 1 | 200 |
| /api/terms | NOT TESTED | — |
| /api/sessions | 2 | 200 |
| /api/session | 14 | 200, 401, 503 |
| /api/place-name | NOT TESTED | — |
| /api/push | 1 | 200 |
| /api/notifications | 1 | 200 |
| /api/notifications/read | 1 | 200 |
| /api/spark | NOT TESTED | — |
| /api/ideas | 24 | 401, 201, 422, 409, 503, 200 |
| /api/social | 31 | 403, 200, 201 |
| /api/media | 2 | 201 |

| Social/action branch | Recorded requests | Observed statuses |
|---|---:|---|
| search | NOT TESTED | — |
| department | NOT TESTED | — |
| achievement | 1 | 201 |
| achievement-review | 2 | 403, 200 |
| follow | 1 | 200 |
| person | 2 | 200 |
| follow-department | 1 | 200 |
| profile | 1 | 200 |
| profile-meta | NOT TESTED | — |
| story-archive | 1 | 200 |
| highlight-save | 1 | 200 |
| highlight-delete | NOT TESTED | — |
| mod-queue | 2 | 403, 200 |
| mod-action | 2 | 200 |
| admin-summary | 2 | 403, 200 |
| admin-joins | 2 | 200 |
| admin-join | NOT TESTED | — |
| admin-add-employee | 2 | 403, 200 |
| admin-conduct | 1 | 200 |
| admin-unban | NOT TESTED | — |
| admin-backup | 1 | 200 |
| admin-posts | 1 | 200 |
| admin-content | 1 | 200 |
| admin-delete-post | NOT TESTED | — |
| admin-delete-comment | NOT TESTED | — |
| admin-remove-like | NOT TESTED | — |
| admin-post | NOT TESTED | — |
| admin-users | 1 | 200 |
| admin-user | NOT TESTED | — |
| admin-sessions | 1 | 200 |
| admin-achievements | 1 | 200 |
| admin-log | 1 | 200 |
| admin-spark | NOT TESTED | — |
| dashboard | NOT TESTED | — |
| export | NOT TESTED | — |
| groups | 1 | 200 |
| create-group | 1 | 201 |
| join-group | 1 | 200 |
| report | NOT TESTED | — |
| rating | 1 | 200 |
| bookmark | 1 | 200 |
| peek | NOT TESTED | — |
| comment-like | 1 | 200 |
| engagement | NOT TESTED | — |
| repost | 1 | 200 |
| ack | 1 | 200 |
| pin | NOT TESTED | — |
| rsvp | 1 | 200 |
| poll | 2 | 200 |
| comments | 3 | 201 |

Dynamic post routes, media and PWA assets are recorded individually in http-results.json. Existing admin read actions were exercised; not every positive administrative mutation, joins approval/rejection, moderation appeal/ban threshold, terms/email-management variant, geocoding or dashboard/export variant has been certified.

## Actual HTTP integration results

| Test | Scenario | Result | Requests |
|---|---|---|---:|
| H01 | Unchanged UI/PWA and development request-key transport | PASS | 2 |
| H02 | Existing signed session resolves employee and directory | PASS | 1 |
| H03 | Unauthorized mutation and admin access are denied | PASS | 3 |
| H04 | Password login, 2FA verification and ticket replay rejection | PASS | 3 |
| H05 | Recovery code is accepted once through HTTP | PASS | 4 |
| H06 | Leading-zero badge and absent-KDF legacy login | PASS | 1 |
| H07 | Profile update and public profile read | PASS | 2 |
| H08 | Text post creation and response contract | PASS | 1 |
| H09 | Comment, nested reply, comment-like and reaction | PASS | 4 |
| H10 | Bookmark, repost, views and notifications | PASS | 5 |
| H11 | Image upload intent, immutable bytes, read and attachment | PASS | 3 |
| H12 | Video upload and post HTTP lifecycle | PASS | 3 |
| H13 | Stories, archive and highlights retain media | PASS | 3 |
| H14 | Poll creation and unique vote update | PASS | 3 |
| H15 | Groups, membership, follows and department follows | PASS | 5 |
| H16 | Events, announcements, RSVP and acknowledgements | PASS | 4 |
| H17 | Ownership enforcement and post edit | PASS | 2 |
| H18 | Admin read functions use SQL projection | PASS | 9 |
| H19 | Moderator hide/restore and role denial | PASS | 3 |
| H20 | Moderation warnings persist transactionally | PASS | 1 |
| H21 | Idempotent post retry has one committed mutation | PASS | 3 |
| H22 | Failed COMMIT never acknowledges or persists social state | PASS | 1 |
| H23 | Commit-response loss and HTTP retry reconcile | PASS | 1 |
| H24 | Push subscription and transactional fixture outbox | PASS | 2 |
| H25 | Synthetic registration OTP, TOTP setup and email linking | PASS | 6 |
| H26 | Concurrent account creation has one HTTP winner | PASS | 3 |
| H27 | Concurrent password changes retain only authoritative winner | PASS | 2 |
| H28 | Logout-all revokes the existing signed session | PASS | 2 |
| H29 | Password recovery persists pending credential before HTTP success | PASS | 1 |
| H30 | All 28 entity codecs round-trip unknown/null/missing/order | PASS | 1 |
| H31 | SQL changes are immediately authoritative to the real HTTP route | PASS | 1 |
| H32 | Application crash and cold process preserve social/session data | PASS | 2 |
| H33 | Database disconnection/readiness and reconnect fail closed | PASS | 3 |
| H34 | Admin encrypted database backup includes all entities and media | PASS | 2 |
| H35 | Media missing/corruption is rejected rather than silently detached | PASS | 3 |
| H36 | Authority epoch mismatch blocks real application writes | PASS | 2 |
| H37 | Post delete retains original media and archived highlight | PASS | 2 |
| H38 | Multiple app processes share authoritative sessions and social state | PASS | 3 |
| H39 | SQL constraint failure rolls back without losing data | PASS | 1 |
| H40 | Public translation interface remains available | PASS | 1 |
| H41 | Stale/malformed local JSON cannot override PostgreSQL | PASS | 2 |
| H42 | Missing critical SQL entity is unavailable, not empty provision | PASS | 2 |
| H43 | Wrong dataset and binding seal are refused | PASS | 3 |
| H44 | Missing synthetic signing key refuses a new process without generation | PASS | 1 |
| H45 | Deployment simulation cannot enable development activation | PASS | 1 |
| H46 | A generic verified flag cannot redirect the database host | PASS | 1 |
| H47 | Concurrent recovery-code consumption has one HTTP winner | PASS | 4 |
| H48 | Individual session revocation and device memory persist | PASS | 3 |
| H49 | Account presence alone cannot bypass employee eligibility | PASS | 1 |
| H50 | Remaining idea/suggestion/complaint/article post types | PASS | 4 |
| H51 | Department achievement submit/review and department policy | PASS | 5 |
| H52 | Administrator employee creation preserves leading-zero badge | PASS | 2 |
| H53 | Synthetic join request persists before acknowledgement | PASS | 2 |
| H54 | Actual launcher refuses a lost SQL schema rather than reseeding | PASS | 1 |
| H55 | Actual launcher cannot regenerate a missing manifest/key | PASS | 1 |
| H56 | Lost cluster directory is not initialized over prior provision | PASS | 1 |

## Original 34 plus 19 regression adaptations

Previous results are retained unchanged. The following is an explicit adaptation, **not** a rerun of old object-store restore procedures against PostgreSQL. BLOCKED means the operational equivalent is not yet implemented/available. NOT TESTED means the stated invariant has not been demonstrated by this new path.

| Original | Original scenario | Previous | PG adaptation | Evidence / limitation |
|---|---|---|---|---|
| T01 | Fresh provisioned startup | BLOCKED | PASS | H01, H02 Approved synthetic provision only |
| T02 | Application restart | BLOCKED | PASS | H32 Process restart |
| T03 | Clean rebuild and persistent restore | BLOCKED | PASS | H32, H33 Cold process plus cluster reconnect; not a new hosted machine |
| T04 | Republish-equivalent stale bundle | BLOCKED | PASS | H41 Stale/malformed local files cannot override SQL |
| T05 | Interrupted object restore | PASS | BLOCKED |  operational SQL restore/promotion runner is not implemented |
| T06 | Unavailable storage connection | PASS | PASS | H33 Database unreachable: unavailable rather than empty |
| T07 | Seeded bucket loses all data objects | PASS | PASS | H54, H56 Lost schema/cluster cannot authorize fresh provision |
| T08 | Missing account object with valid baseline | PASS | PASS | H42 Missing critical SQL entity refuses readiness |
| T09 | Unreadable snapshot index | PASS | NOT TESTED |  backup catalog corruption/recovery drill |
| T10 | Missing session key | PASS | PASS | H44, H55 Missing or foreign signing key cannot be replaced at startup |
| T11 | Same-count older generation | PASS | BLOCKED |  adopting an older SQL recovery generation is not implemented |
| T12 | Wrong populated bucket | PASS | PASS | H43 Wrong populated dataset binding |
| T13 | Wrong empty unmarked bucket | PASS | PASS | H43, H54 Wrong/empty SQL authority and prior provision receipt |
| T14 | Large empty-account shrink | PASS | NOT TESTED |  independent account membership/shrink baseline |
| T15 | Gradual account shrink | PASS | NOT TESTED |  gradual account shrink baseline |
| T16 | Concurrent account writers | PASS | PASS | H26, H27 Concurrent registration/password mutation |
| T17 | Concurrent sync conflict | BLOCKED | PASS | H38 Concurrent app processes and request deduplication |
| T18 | Crash before periodic sync | FAIL | PASS | H08, H32 Acknowledged posts survive process death; no periodic JSON sync |
| T19 | Missing remote media | PASS | PASS | H35 Missing and corrupt referenced object bytes |
| T20 | Explicit session-key mismatch | PASS | PASS | H44 Same-length foreign signing/backup keys rejected |
| T21 | Add-only merge duplicate handling | PASS | BLOCKED |  operator add-only SQL import is not implemented |
| T22 | Merge post-count arithmetic | PASS | BLOCKED |  import/merge preview counts not implemented |
| T23 | Imported account with foreign session key | PASS | BLOCKED |  foreign-domain import/adoption not implemented |
| T24 | Snapshot archive/count coherence during writes | BLOCKED | PASS | H34 Concurrent write and frozen encrypted backup counts/hash |
| T25 | Partial restore promotion failure | PASS | BLOCKED |  offline recovery promotion not implemented |
| T26 | Partial import promotion failure | PASS | BLOCKED |  offline import promotion not implemented |
| T27 | Malformed restored account JSON | PASS | NOT TESTED |  malformed restored SQL account record; stale local JSON is separately tested |
| T28 | Missing backup key | PASS | PASS | H44 Missing and foreign backup key startup |
| T29 | Post-auth reload races an async password change | PASS | PASS | H27 Async password changes serialized before cache refresh |
| T30 | Actual startup retries interrupted restore | BLOCKED | BLOCKED |  startup retry of operational recovery not implemented |
| T31 | Actual startup after failed restore promotion | BLOCKED | BLOCKED |  startup after operational recovery promotion not implemented |
| T32 | Directory mismatch versus account loss | BLOCKED | PASS | H49 Unlisted employee cannot authenticate; account is not silently removed |
| T33 | Session revocation versus account loss | PASS | PASS | H28, H48 Version and individual-session revocation |
| T34 | Older generation with lower account count | PASS | BLOCKED |  old/lower-count recovery adoption not implemented |
| R01 | Legitimate local dataset and HTTP compatibility | PASS | PASS | H01, H02, H08 UI/API compatibility in approved synthetic mode |
| R02 | Manifest identity, generation and same-count content | PASS | NOT TESTED |  complete generation/content baseline; dataset/keys/epoch mismatch is tested separately |
| R03 | Unadopted dataset liveness/readiness | PASS | PASS | H54 Lost authority cannot silently become fresh |
| R04 | Valid manifest cannot fabricate a durable provider | PASS | PASS | H46 Generic verified flag cannot redirect database host |
| R05 | Deployment auth rejects local-only commits | PASS | PASS | H45, H22 Deployment activation refused; failed commit cannot acknowledge |
| R06 | No session/backup key regeneration | PASS | PASS | H44, H55 No automatic missing-key replacement |
| R07 | Offline activation rename failure | PASS | BLOCKED |  offline SQL activation rename equivalent not implemented |
| R08 | Interrupted offline activation journal | PASS | BLOCKED |  offline SQL activation journal not implemented |
| R09 | Partial offline import candidate failure | PASS | BLOCKED |  offline SQL import candidate activation not implemented |
| R10 | Matching-key 2FA import compatibility | PASS | PASS | H04, H05, H25, H30, H47 Invented matching-key auth round-trip and factor/recovery login |
| R11 | Frozen archive counts and full media | PASS | PASS | H34, H35 Frozen all-entity archive, full media and integrity validation |
| R12 | Two actual local writer processes | PASS | PASS | H38 Two actual HTTP server processes |
| R13 | Legacy KDF and session diagnostics | PASS | PASS | H06, H28, H49 Absent KDF, leading-zero identity and eligibility/revocation |
| R14 | Blocked recovery preserves all material | PASS | BLOCKED |  blocked recovery material preservation not yet exercised by a new SQL tool |
| R15 | Uncommitted fresh activation | PASS | PASS | H54, H56 Provision receipt prevents silent replacement after state loss |
| R16 | Corrupt authoritative index | PASS | PASS | H43 Corrupt dataset/seal authority refuses readiness |
| R17 | Pending 2FA key-domain import | PASS | NOT TESTED |  pending-factor cross-key-domain import |
| R18 | Explicit bucket binding | PASS | PASS | H43 Isolated SQL dataset binding; actual hosted bucket binding remains BLOCKED |
| R19 | Held writer lock and archive exclusion | PASS | PASS | H34, H38 Writer serialization and backup snapshot exclusion |

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
