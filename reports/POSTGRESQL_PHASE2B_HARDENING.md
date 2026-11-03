# BQ Connect — Phase 2B development hardening

## 1. Verdict and scope

**Production NO-GO. Full feature/security/browser/operations certification is NOT achieved. Stop for review.**

This is a hardened development compatibility adapter, not a production migration. All integration data and credentials were invented. No imported employee records, root data/backups/key files or environment secret values were opened. No production database, provider, deployment, entrypoint or release fence was changed. Local public model weights were downloaded; invented text was translated locally, not sent to a translation API.

Final regression results: **{"PASS":56,"FAIL":0}**. Additional hardening results: **{"PASS":27,"FAIL":0}**. These totals describe individual checks, not a production-readiness percentage.

## 2. Changed-file inventory

| Files | Purpose |
|---|---|
| development/postgres/repository.cjs | Additive development-control retention metadata, encrypted transient state/outbox, credential-shape guard, pg error handling, actual transaction metrics and fixture receipt cleanup |
| development/postgres/runtime.cjs | Safe request ingress, bounded queue, protected replay, real COMMIT-fault hooks, fail-stop deadline, encrypted map refresh/persistence, isolated ESM model import resolution |
| development/postgres/ingress.cjs | Body-before-transaction buffering, size/deadline/admission limits, same-origin unsafe request guard, static bypass |
| development/postgres/sealed.cjs | Dataset/context-bound AES-GCM and keyed request/actor digests |
| scripts/postgres/e2e.cjs | Preserve original Phase 2 output; use a separate Phase 2B output and decrypt fixture events only inside the private test controller |
| scripts/postgres/harness.cjs | Disposable clusters and owned-process startup/shutdown checks; no ready-port adoption |
| scripts/postgres/benchmark.cjs | Reproducible before/after load, SQL plans, adapter transaction timings and bounded waits |
| scripts/postgres/hardening.cjs | Feature, security, concurrency, actual transaction and failure tests |
| scripts/postgres/translation-probe.cjs | Existing local models, invented bilingual samples, cache/edit/concurrency probe |
| scripts/postgres/report-phase2b.cjs | Rebuild this report and structured matrices from evidence |
| reports/POSTGRESQL_PHASE2B_HARDENING.md | Review report; prior reports and evidence remain intact |

The 59-table design prototype and 107 model-table development mapping were not redesigned. The nine development control tables remain, with three additive request-retention columns and extended private fault constraints. Legacy plaintext cached response bodies are retired, not returned. No business account/post/media data is deleted by that cache migration. Runtime maps and outbox envelopes are encrypted in place within the synthetic dataset.

## 3. Maintainability and performance

The compatibility layer still refreshes full object graphs and serializes requests across workers using the PostgreSQL advisory lock. A load reads **107 model tables**, then hydrates media; collection mutations may rewrite their normalized subtrees. This is correct under the tested synthetic concurrency, but is not a scalable native repository or SQL feed pagination design. A larger connection pool cannot fix serialized application work.

| Measurement | Before | After |
|---|---:|---:|
| Static response p95, 8 requests | 64.50 ms | 16.42 ms |
| Readiness while a 600 ms partial body is pending | 654.70 ms | 39.93 ms |
| Feed p95 with 500 invented posts | 80.06 ms | 60.78 ms |

Small local samples demonstrate removal of avoidable static/slow-body blocking, not a capacity guarantee. The 1/100/500-post feed/search samples and actual EXPLAIN ANALYZE/BUFFERS JSON are preserved in performance-before.json and performance-after.json. The latter includes actual worker pool/advisory-lock/load/queue/transaction durations. SQL roundtrip count is not reduced. Key lookups have an indexed access path; full-feed loads remain full scans/materialization, with planner choices recorded rather than forced.

Pool exhaustion is measured on the private controller's instance of the same adapter pool, **not** claimed as exhaustion of the live HTTP worker pool. Advisory lock timeout and the 64-request admission burst are actual HTTP observations. A real PostgreSQL 40P01 deadlock is forced with two controller transactions and followed by HTTP readiness recovery; normal globally serialized HTTP mutations do not independently demonstrate a native concurrent-handler deadlock.

Retain serialization until all legacy process-global mutable graphs/callbacks are request-scoped. A timed-out legacy handler cannot be safely cancelled by abandoning its promise; the development worker refuses new HTTP/background contexts and exits. This is a safety measure, not a production HA/restart design.

## 4. API and business-feature matrix

Structured api-matrix.json records method/path/action/op, positive/negative counts and the exact passing evidence cases. A 400/401/403/404/409/429/503 alone never certifies successful functionality. The complete cases and redacted request metadata are in hardening-results.json and regression/http-results.json.

| Route/action | Positive | Negative | Evidence |
|---|---:|---:|---|
| DELETE /api/ideas/:id | 1 | 1 | H37, B08 |
| GET / | 1 | 0 | H01 |
| GET /api/ideas | 4 | 0 | H32, H41, B15, B26 |
| GET /api/spark | 2 | 1 | B01, B03 |
| GET /health/live | 3 | 0 | H33, H55, H56 |
| GET /health/ready | 38 | 39 | H33, H36, H42, H43, H45, H46, H54, B21, B25, B27 |
| GET /media/:id | 5 | 0 | H11, H12, H37, B13 |
| GET /sw.js | 1 | 0 | H01 |
| HEAD /media/:id | 1 | 0 | B13 |
| PATCH /api/ideas/:id | 1 | 2 | H17, B08 |
| POST /api/2fa | 1 | 0 | B05 |
| POST /api/2fa recovery | 1 | 1 | B05 |
| POST /api/email confirm | 1 | 1 | B04 |
| POST /api/email send | 1 | 1 | B04 |
| POST /api/forgot | 1 | 0 | H29 |
| POST /api/ideas | 27 | 12 | H03, H08, H11, H12, H13, H14, H16, H20, H21, H22, H23, H34, H36, H38, H50, B06, B07, B10, B13, B15, B16, B17, B18, B19, B26, B27 |
| POST /api/ideas/:id/ack | 1 | 0 | H16 |
| POST /api/ideas/:id/bookmark | 1 | 0 | H10 |
| POST /api/ideas/:id/comment-like | 1 | 0 | H09 |
| POST /api/ideas/:id/comments | 4 | 1 | H09, H24, B10 |
| POST /api/ideas/:id/engagement | 0 | 0 |  |
| POST /api/ideas/:id/peek | 0 | 0 |  |
| POST /api/ideas/:id/pin | 0 | 0 |  |
| POST /api/ideas/:id/poll | 2 | 0 | H14 |
| POST /api/ideas/:id/rating | 2 | 0 | H09, B10 |
| POST /api/ideas/:id/report | 1 | 0 | B09 |
| POST /api/ideas/:id/repost | 1 | 0 | H10 |
| POST /api/ideas/:id/rsvp | 1 | 0 | H16 |
| POST /api/join | 3 | 0 | H53, B11 |
| POST /api/login | 7 | 21 | H04, H05, H06, H47, H49, H51, B07, B24 |
| POST /api/login-2fa | 8 | 3 | H04, H05, H25, H47, H51 |
| POST /api/logout-all | 1 | 0 | H28 |
| POST /api/media | 4 | 2 | H11, H12, B13 |
| POST /api/notifications | 1 | 0 | H10 |
| POST /api/notifications/read | 1 | 0 | H10 |
| POST /api/password | 2 | 2 | H27, B24 |
| POST /api/place-name | 0 | 0 |  |
| POST /api/push | 1 | 0 | H24 |
| POST /api/register | 4 | 1 | H25, H26 |
| POST /api/session | 12 | 6 | H02, H28, H30, H32, H33, H35, H38, H39, H41, H42, H44, H48, B20, B21, B23, B24 |
| POST /api/sessions | 2 | 0 | H48 |
| POST /api/social achievement | 1 | 0 | H51 |
| POST /api/social achievement-review | 1 | 1 | H51 |
| POST /api/social admin-achievements | 1 | 0 | H18 |
| POST /api/social admin-add-employee | 1 | 1 | H52 |
| POST /api/social admin-backup | 1 | 0 | H34 |
| POST /api/social admin-conduct | 1 | 0 | H18 |
| POST /api/social admin-content | 1 | 0 | H18 |
| POST /api/social admin-delete-comment | 1 | 1 | B10 |
| POST /api/social admin-delete-post | 1 | 0 | B10 |
| POST /api/social admin-join | 2 | 2 | B11 |
| POST /api/social admin-joins | 2 | 0 | H18, H53 |
| POST /api/social admin-log | 1 | 0 | H18 |
| POST /api/social admin-post | 1 | 0 | B10 |
| POST /api/social admin-posts | 1 | 0 | H18 |
| POST /api/social admin-remove-like | 1 | 0 | B10 |
| POST /api/social admin-sessions | 3 | 0 | H18, B23 |
| POST /api/social admin-spark clear | 1 | 0 | B03 |
| POST /api/social admin-spark set | 1 | 1 | B03 |
| POST /api/social admin-summary | 1 | 1 | H03, H18 |
| POST /api/social admin-unban | 1 | 0 | B23 |
| POST /api/social admin-user admin-off | 1 | 1 | B23 |
| POST /api/social admin-user admin-on | 1 | 1 | B23 |
| POST /api/social admin-user reset-2fa | 1 | 1 | B23 |
| POST /api/social admin-user revoke | 1 | 0 | B23 |
| POST /api/social admin-user unban | 1 | 0 | B23 |
| POST /api/social admin-user unlock | 1 | 1 | B23 |
| POST /api/social admin-users | 1 | 0 | H18 |
| POST /api/social create-group | 2 | 0 | H15, B12 |
| POST /api/social dashboard | 1 | 1 | B02 |
| POST /api/social department | 1 | 0 | B01 |
| POST /api/social export | 1 | 1 | B02 |
| POST /api/social follow | 1 | 0 | H15 |
| POST /api/social follow-department | 1 | 0 | H15 |
| POST /api/social groups | 1 | 0 | H15 |
| POST /api/social highlight-delete | 2 | 0 | B14 |
| POST /api/social highlight-save | 3 | 1 | H13, B14 |
| POST /api/social join-group | 4 | 1 | H15, B12 |
| POST /api/social mod-action | 5 | 1 | H19, B09 |
| POST /api/social mod-queue | 1 | 1 | H03, H19 |
| POST /api/social person | 2 | 0 | H07, H31 |
| POST /api/social profile | 2 | 0 | H07, B08 |
| POST /api/social profile-meta | 1 | 0 | B01 |
| POST /api/social search | 2 | 0 | B01, B07 |
| POST /api/social story-archive | 1 | 0 | H13 |
| POST /api/terms | 1 | 0 | B01 |
| POST /api/translate | 5 | 2 | H40, B22 |
| POST /api/views | 1 | 0 | H10 |

Successful checks include email change and OTP gating, 2FA recovery management, terms, spark read/set/clear, search/department/profile, dashboard/export permissions, moderation decisions, join approval/rejection, admin role/session/account operations, scoped comments/ratings/admin removals, groups/join/leave, highlights, image upload/read/HEAD/Range and the previous regression features. Legacy tests additionally exercise registration/login factor transitions, polls, announcements, achievements, complaints, password/session invalidation, push fixture registration and encrypted backup creation.

**Not exhaustive:** every malformed-body variant, type-specific post/edit/status/pin branch, every comment/poll combination, every role/type combination and full media replacement/retention/GC lifecycle are NOT certified. Successful provider-backed place-name lookup remains BLOCKED; a validation error is not successful geocoding. Physical deleted-post restoration is not implemented as a new API. Existing moderation hide/restore is what is exercised.

## 5. Security assessment by severity

### HIGH — FIXED IN DEVELOPMENT
Plaintext cached responses could retain bearer tokens, recovery codes and OTP setup output.

Evidence/limit: B05/B06/B20; no auth response replay; zero-byte sensitive tombstones, AES-GCM ordinary responses, 5-minute TTL, 24-hour deduplication tombstones, state-revision and current-session replay checks.

### HIGH — FIXED IN DEVELOPMENT
Auth/transient maps and fixture mail/SMS outbox payloads were plaintext JSONB.

Evidence/limit: B20; dataset/context-bound AES-GCM and delivered-payload redaction. Pending delivery stays encrypted. No real-provider delivery tested.

### HIGH — FIXED IN DEVELOPMENT
Checked-out pg client error event could crash the worker after an actual committed but unacknowledged transaction.

Evidence/limit: B18; query errors still reject; unhealthy client discarded; same-key retry reconciles exactly once.

### HIGH — FIXED NARROWLY; NOT COMPLETE CORRUPTION PROTECTION
An active account could lose credential attributes while session children survived.

Evidence/limit: B21 now rejects this state. Complete/gradual account deletion and same-count malicious data replacement are NOT certified.

### MEDIUM — FIXED IN DEVELOPMENT
Slow request bodies occupied the SQL transaction/global serialization slot.

Evidence/limit: Before/after slow-body benchmark; body read precedes SQL; size/deadline/admission bounds; static GET/HEAD bypasses SQL.

### MEDIUM — FIXED IN DEVELOPMENT
Cross-site unsafe requests lacked an explicit origin fence in the compatibility adapter.

Evidence/limit: B07; mismatched Origin/Sec-Fetch-Site denied. Existing bearer API with no Origin remains supported. This is not a full browser CSRF assessment.

### HIGH — OPEN; NO-GO
uuid 9.0.1 dependency advisory requires a major-version update.

Evidence/limit: dependency-audit.json; fixed version reported as 11.1.1. No unreviewed major SDK/dependency replacement was made. The new SQL adapter uses node:crypto.randomUUID, not uuid buffer APIs; full dependency reachability is NOT certified.

### HIGH — OPEN; NO-GO
Global serialization, full relational reloads and whole-collection rewrites limit availability and scale.

Evidence/limit: Measured benchmark and plans; 107 model-table reads remain per load. No unsafe lock removal or schema collapse.

### HIGH — OPEN; NO-GO
Hosted PostgreSQL roles/TLS/failover/PITR and real media/provider delivery are not validated.

Evidence/limit: Only invented local PostgreSQL and immutable local objects; no production credentials or operations.

### MEDIUM — NOT TESTED
Executable stored/reflected XSS and authenticated desktop/mobile rendering are not browser-certified.

Evidence/limit: B15 checks JSON handling only. The documented browser tester returned Unknown config kind: testing; no authenticated journey completed.

### UNASSESSED — BLOCKED
Whole-project SAST/privacy scan could read imported private records and credentials.

Evidence/limit: Only dependency audit and scoped source/HTTP review performed. No claim of a clean SAST or privacy scan.


Authentication/factor/recovery and session behavior is verified through real HTTP in the regression suite. B07/B08/B10/B23/B24 add injection-as-data, enumeration response parity (not statistical timing resistance), origin checks, object/reply scope, impersonation, role escalation denials and shared cross-worker rate/version state. Media URLs are deliberately public under the unchanged application contract; unauthenticated upload is denied, but a public image GET is not mislabeled a BOLA failure. SVG payloads are rejected rather than executed.

Cached ordinary responses are capped at 256 KiB plaintext and encrypted for up to five minutes; sensitive auth endpoints never replay response bodies. Same-key sensitive retries return a reauthentication/refetch conflict rather than re-exposing secrets. Ordinary replay requires the same keyed actor/request digest, a currently eligible session and unchanged entity revisions. Expired bodies are redacted, and deduplication tombstones expire after 24 hours; no exactly-once claim is made beyond that horizon. Delivered fixture payloads are redacted after their retention window; pending events remain encrypted. AES keys are domain-separated from the existing synthetic signing material; no new production secret or key rotation was introduced.

## 6. Actual Arabic/English translation

The existing OPUS models ran locally. Probe status: **PASS**. Successful authenticated HTTP translations in B22 are separate from the previous disabled-service 503 checks. Arabic→English, English→Arabic, edited text, concurrent requests, unchanged stored source and unauthenticated denial were asserted. The isolated worker now resolves the already-installed ESM library rather than attempting package resolution from its temporary application directory.

Observed invented sample results:

- ar→en: صباح الخير. المشروع جاهز. → Good morning........... Project's ready............ (14420.00 ms, first local model use)
- en→ar: Good morning. The project is ready. → صباح الخير المشروع جاهز (9793.83 ms, first local model use)

Repeated cached output took 0.30 ms in the direct local-engine probe. The edited English sample produced a different Arabic result. Local-engine concurrency and HTTP concurrency were both exercised; the HTTP compatibility adapter still serializes transactions, so these are not parallel production throughput measurements.

**Quality is not availability:** the Arabic→English sample added excessive punctuation. Two simple semantic samples do not certify translation quality. Mixed scripts, names, URLs, markup, emoji, multiline formatting, network/model failure/timeout and browser cache invalidation are NOT comprehensively tested. Source detection is an existing client-side Arabic/Latin character-count heuristic, not a newly added server auto-detector; it needs real mixed-content testing. The default development preview keeps translation disabled; positive model HTTP tests used a private enabled synthetic worker. No external translation provider was integrated.

## 7. Actual transaction, outage and concurrency evidence

| Case | What was actually exercised |
|---|---|
| B16 | Exception before COMMIT, no acknowledged data; real HTTP retry writes once |
| B17 | Deferred foreign-key violation raised by PostgreSQL COMMIT itself, rollback and subsequent HTTP retry |
| B18 | Client socket paused during COMMIT; independent server witness sees committed request; connection destroyed before caller receives COMMIT outcome; 503 followed by same-key recovery, one row |
| B19 | Response destroyed after successful COMMIT; same-key retry recovers one persisted post |
| B21 | Live SQL credential-shape corruption; readiness fails closed, exact private fixture restored, existing session works |
| B24 | Two actual workers share rate limits and account versions; competing password changes cannot both succeed |
| B25 | Bounded controller pool wait, real HTTP advisory-lock timeout, HTTP queue overload and actual PostgreSQL deadlock followed by recovery |
| B26 | Kill after acknowledged write, restart same private dataset, read acknowledged post; fixture outbox receipts settle |
| B27 | Actual handler deadline response and worker retirement; restart does not persist timed-out post |
| Regression H32/H33 and key-domain cases | Process/database outage and restart, schema/manifest/cluster loss refusal, wrong/missing metadata and no reseeding |

Fault hooks exist only in the independently guarded development adapter. They are not exposed as production request controls. No untested HTTP behavior is certified solely because a direct SQL statement succeeded.

## 8. Original 53-scenario revalidation

Classification in legacy-regression-matrix.json: **{"PASS":32,"BLOCKED":16,"NOT TESTED":5}**. Each original scenario retains its prior status separately, with explicit adaptation evidence and limitations. T03 is conservatively reclassified BLOCKED: a cold reconnect is not a clean new-host restore. T27 records B21's live SQL guard while leaving the original restore-promotion scenario BLOCKED. Interrupted restore/import promotion, offline activation/adoption journals, hosted-provider restoration and pending foreign-key-domain adoption have no operational command and are not promoted to PASS.

Gradual account shrink and same-count generation/content corruption remain unvalidated. SQL ACID commits do not by themselves provide independent backup/adoption/membership attestation. No empty-state observation authorizes fresh provisioning or new keys.

## 9. Media and delivery lifecycle

HTTP checks cover authenticated uploads, unsupported payload rejection, concurrent distinct immutable objects, exact hash/readback, ready metadata, public read/HEAD/Range, association with stories/highlights, ownership-sensitive changes and earlier missing-object refusal. Pending intents are written before immutable object publication; rollback may intentionally leave tracked pending/retained objects. This is not certified orphan garbage collection or hosted object-store durability. Video/transcoding, complete replacement/deletion/reference-count cleanup, large-upload timeouts and hosted lifecycle recovery are NOT comprehensively tested.

Outbox event IDs and synthetic receipt deduplication are exercised, including restart. There is no actual SMTP/SMS/WebPush delivery certification or external-provider crash-window proof. Provider acknowledgements and provider-level deduplication remain required. Current encrypted application snapshot creation is not an approved native SQL/PITR restore procedure and does not certify operational restoration of every control/outbox/media domain.

## 10. Browser/UI evidence

**Authenticated employee/admin desktop/mobile journeys: NOT TESTED.** The documented browser testing agent was requested and the environment returned **Unknown config kind: testing**. No alternate agent/config was guessed, no authentication bypass added and no signed-in screen was represented as tested.

The public 1280×720 language-selector screenshot loads successfully. It is only public landing-page evidence. Browser warnings mention an unsupported bluetooth Permissions-Policy feature and form/accessibility structure. Post rendering/XSS, navigation, dialogs, camera/uploads, Arabic/English RTL/LTR, persistence across browser reload and signed-in mobile overflow remain unverified. HTTP assertions are not substitutes for these browser journeys.

## 11. Isolation and preserved production behavior

Protected original startup/storage/auth/server/backup/translation source fingerprints: **all unchanged**. Production startup remains the original VM/start.js path with its durable-provider fences. The only serving workflow is the guarded invented-data PostgreSQL development launcher. Test-created automatic port mappings must be removed before delivery; no deployment is requested or authorized.

Prior audit, persistence forensic/repair, architecture, Phase 2 reports, the 59-table prototype, original 53-scenario evidence and Phase 2 test output were not overwritten. New assets/models/results stay under ignored generated-artifacts/phase2b.

## 12. Remaining prerequisites before any production work

1. Provide a working browser tester and complete real employee/admin desktop/mobile journeys, including stored-markup execution checks, terms/login/2FA, moderation, uploads and Arabic/English layout.
2. Resolve the high dependency advisory through a reviewed compatible dependency change and repeat security checks; run scoped SAST/privacy scanning without reading imported private material.
3. Design a native request-scoped data layer and measured read/query/pagination strategy. Do not remove serialization while legacy mutable process-wide graphs remain.
4. Define independent dataset membership/generation/content attestations and an operator-approved adoption/recovery protocol; validate shrink, same-count corruption and foreign/pending-2FA domains.
5. Provide a hosted development-equivalent PostgreSQL provider with least-privilege roles, TLS, connection budgets, monitoring, backups/PITR/failover and tested unknown-commit reconciliation.
6. Implement and exercise isolated restore/promotion/adoption commands with fencing, rollback journals, validated keys/epochs and native SQL/media backup completeness.
7. Validate durable object storage, hashes, reference recovery and reviewed retention/garbage collection on a disposable hosted fixture. Current pending/retained objects are not a production GC solution.
8. Validate provider-level delivery idempotency, retries and crash recovery for email/SMS/push against approved test providers; fixture receipts do not certify real delivery.
9. Expand translation quality/formatting/mixed-text/links/names/emoji and model-failure/timeout tests. Review client-side heuristic detection and cache invalidation in a real browser.
10. Obtain explicit architecture/security/operations review and separate authorization for any later production migration or deployment. Keep existing release fences.

## 13. Final release decision and reproduction

**NO-GO. Development checks are evidence for review, not permission to migrate, adopt, rotate keys, alter storage or publish.**

Reproduction commands (invented private clusters only):

- node scripts/postgres/hardening.cjs
- node scripts/postgres/e2e.cjs phase2b
- node scripts/postgres/benchmark.cjs after
- node scripts/postgres/translation-probe.cjs
- node scripts/postgres/report-phase2b.cjs

The historical before benchmark and previous-phase evidence should be preserved, not overwritten to manufacture a new baseline. Review structured JSON, actual plans and request/fault evidence alongside this report.
