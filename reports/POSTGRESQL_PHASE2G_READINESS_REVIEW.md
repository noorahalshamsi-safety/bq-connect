# BQ Connect — Phase 2G production-readiness review

Review date: 4 November 2026. **Development: CONDITIONAL, synthetic-only. Production: NO-GO. Stop for review.**

## 1. Scope, evidence lineage and consolidated conclusion

The employee platform must preserve accounts, content, media and compatible authentication through republishing. A PostgreSQL development adapter and useful synthetic evidence exist. An operational, supported production migration and recovery path do not. Passing local tests cannot bridge that difference.

This phase consolidates the initial production audit, P0 account forensics, P0 safety repair, transactional architecture, development integration and Phases 2B/2C/2D/2E/2F. The architecture companion is included. `generated-artifacts/phase2g/report-inventory.json` records all **11 earlier reports**, their hashes, headings and explicit caveats. Older reports are historical: the forensic diagram describes pre-repair behavior, not today's unfenced runtime. Phase 2B's corrected classification supersedes Phase 2's claim that reconnect established clean-host recovery.

Evidence vocabulary:

- **Current executable**: Phase 2G invented-data checks actually run this turn.
- **Prior executable**: retained results from earlier phases, not rerun or renamed as current passes.
- **Static**: inspected implementation, not end-to-end behavior.
- **Proposed**: recommended contract or acceptance gate, not implemented/approved.
- **NOT TESTED/BLOCKED**: no passing evidence; no implication of working production behavior.

No production database, bucket, endpoint, logs or employee records were accessed this turn. No imported `data/`, backups or secret values were opened. No production schema, key, auth stack, provider configuration, release fence, dependency, normal API/UI or canvas component was changed. No republish, provision, migration, native writer activation or next phase occurred. New files are review artifacts and isolated test scripts only. The pre-existing `.replit` workspace diff, including historical test-port mappings, is not a Phase 2G change.

### Decisions needed first

1. Authorize a **separate protected discovery/custody process**, not real employee import into this workspace.
2. Approve a release feature list, numerical RPO/RTO/retention and real-shaped dataset/concurrency/latency/resource envelope.
3. Decide media audience/privacy policy and translation/external-link disclosure policy.
4. Approve or reject the proposed feed contract before integration. Default original behavior stays intact.

## 2. Consolidated feature readiness matrix

Classifications apply to the **existing PostgreSQL development implementation**, not the live deployment. “IMPLEMENTED AND TESTED” is limited to the named synthetic invariant; it does not certify the entire subsystem.

| Feature/subsystem | Classification | Verified evidence / exact remaining boundary | Blocker |
|---|---|---|---|
| Password authentication / directory eligibility | IMPLEMENTED BUT PARTIALLY TESTED | H04/H06/H49, B07; legacy KDF/leading-zero identities and wrong/missing employee denial. Actual browser login and hosted abuse controls unverified. | REL-007/010/015 |
| Registration / join approval | IMPLEMENTED BUT PARTIALLY TESTED | H25/H26/H53, B11 fixture OTP, duplicate creation, approve/reject. Real delivery and browser enrollment not certified. | REL-009/015 |
| Signed sessions / individual and all-session revocation | IMPLEMENTED BUT PARTIALLY TESTED | H28/H38/H48, B23/B24; current G07 original-feed revocation denial. Hosted restart/escrow/overlap and browser retention outstanding. | REL-005/010/014 |
| TOTP, recovery codes and factor management | IMPLEMENTED BUT PARTIALLY TESTED | H04/H05/H25/H47, B05/B23. Matching invented domains; protected active/pending factor migration absent. | REL-001/007/014 |
| Password/email recovery | IMPLEMENTED BUT PARTIALLY TESTED | H29/B04 pending credential/email gates persist before response; only fixture receipts. | REL-009 |
| Employee directory / person lookups | IMPLEMENTED BUT PARTIALLY TESTED | Directory compatibility; Phase 2C native profile parity 9 groups. Full directory hydration and unknown protected source shapes remain. | REL-001/011/015 |
| Profiles / follows / department views | IMPLEMENTED BUT PARTIALLY TESTED | H07/H15/H51, B01/B08/B14. Ownership checks sampled; UI and complete variant matrix outstanding. | REL-007/015 |
| Posts, edits and delete | IMPLEMENTED BUT PARTIALLY TESTED | H08/H17/H37/H50, B08/B10; current G02/G04. No complete browser/type/action certification. | REL-007/015 |
| Stories / expiry / highlights | IMPLEMENTED BUT PARTIALLY TESTED | H13/H37, B14 and Phase 2F parity; global original story consumer and browser interactions not certified. | REL-007/011 |
| Polls / unique votes | IMPLEMENTED BUT PARTIALLY TESTED | H14, exact nested Phase 2F parity. UI/concurrent authorization combinations incomplete. | REL-007/015 |
| Comments / nested replies / reactions / ratings | IMPLEMENTED BUT PARTIALLY TESTED | H09/H10, B10; original writer behavior retained. Complete role/object/sink matrix unexecuted. | REL-007/015 |
| Bookmarks / views / repost / events / acknowledgment | IMPLEMENTED BUT PARTIALLY TESTED | H10/H16, related Phase 2F public-field parity. Peek/pin/engagement coverage gaps remain. | REL-015 |
| Local synthetic media lifecycle | IMPLEMENTED AND TESTED | H11/H12/H35, B13 verify intents, immutable bytes/hash, ready attachments, missing/corrupt rejection, Range/HEAD within fixtures. Actual playback/camera not certified. | REL-004/007 |
| Hosted media durability | NOT IMPLEMENTED | SQL implementation still uses owned local fixture objects, not certified durable hosted storage. | REL-004 |
| Media audience policy | BLOCKED | Current G05 reproduces anonymous known-URL GET/HEAD; employee/group-private policy not approved. | REL-008 |
| Groups / membership / group visibility | IMPLEMENTED BUT PARTIALLY TESTED | H15/B12, Phase 2F fresh membership/denial parity. Group discovery/deep-link and full browser matrix outstanding. | REL-007/008/015 |
| Search | IMPLEMENTED BUT PARTIALLY TESTED | B01 directory/action search; original client Arabic fold/all-word haystack inspected. Global paginated Arabic search is explicitly blocked 422. | REL-007/011 |
| Original full-feed API/UI | IMPLEMENTED BUT PARTIALLY TESTED | Prior full-feed tests work at measured small/5k/10k scopes; 20k full workflow not accepted. Current G01 confirms normal route/auth/headers. | REL-011 |
| Bounded versioned feed pagination | PROTOTYPE ONLY | Private Phase 2F worker/UI, signed cursors and 24 role/scope comparisons; not activated normal app. 20k page benchmark is not full-app capacity. | REL-011 |
| Moderation / conduct | IMPLEMENTED BUT PARTIALLY TESTED | H19/H20, B09/B23; synthetic hide/restore/dismiss/ban paths. All UI and action variants not certified. | REL-007/015 |
| Administrator functions | IMPLEMENTED BUT PARTIALLY TESTED | H18/H52/B02/B03/B10/B11/B23; current G02 role sample. Full screen/alias/object matrix outstanding. | REL-007/015 |
| Notifications / outbox | IMPLEMENTED BUT PARTIALLY TESTED | H10/H24/B26 transactional fixture receipts and retry/crash tests. External push/email/SMS not delivery certification. | REL-009 |
| External delivery | NOT TESTED | SMTP/SMS/web-push implementations present; no live/sandbox provider action this turn. | REL-009 |
| Arabic/English translation | IMPLEMENTED BUT PARTIALLY TESTED | Prior B22 real model HTTP; new engine fixture tests plus one actual punctuation-heavy output. Probe killed by RSS guard; ordinary preview disabled. | REL-012 |
| Encrypted frozen synthetic backup export | IMPLEMENTED AND TESTED | H34 frozen 28-entity/media export, hash/count/decryptability with concurrent writer; not hosted DB/PITR recovery. | REL-002 |
| Operational SQL recovery/adoption | NOT IMPLEMENTED | No complete restore/promotion/rollback operator command or clean-host drill. | REL-002 |
| Protected importer/cutover | NOT IMPLEMENTED | Lossless fixture codec is not an operational complete importer or authoritative source inventory. | REL-001/005 |
| Hosted database / TLS / least privilege / PITR | NOT TESTED | Official supported platform categories checked; no provision or tenant configuration examined. | REL-003 |
| Commit-before-success / retry / fail-stop isolation | IMPLEMENTED AND TESTED | H21–H23/H32/H38 plus B16–B19/B27 and Phase 2D background fault tests. Limited to cooperating synthetic adapter workers. | REL-005/013 for hosted release |
| Browser / mobile touch / RTL / PWA updates | NOT TESTED | Public screenshots only; standard runner fails before navigation. No authenticated action executed. | REL-007 |

## 3. One prioritized release-blocker register

**Authoritative register: `reports/POSTGRESQL_PHASE2G_BLOCKERS.json`.** Its 18 entries contain unique ID, P0/P1/P2/P3 priority, mandatory flag, accountable role, evidence, affected files, current state, impact, dependencies, exact acceptance, tests, production relevance and implementation order. There is no second recommendation backlog. The downloadable report appends each entry verbatim from that source.

- **15 mandatory release gates**: six P0 (REL-001/002/003/004/005/014), nine P1 (REL-006–013 and REL-015).
- **Three optional enhancements**: REL-016 P2 preview-only advisory, REL-017 P2 broader native writers, REL-018 P3 visual variants.
- A P1 gate can block release as firmly as P0; priority orders urgency, not permission to skip.
- Owner fields assign recommended **roles**, not named staffing commitments. No project tasks or automatic next phase were created.
- Preview zod remediation becomes mandatory if affected preview code is shipped. Native-writer conversion and visual exploration are not automatically prerequisites for a bounded, certified release.
- “Resolve or formally disposition” means a documented, separately approved risk exception, not acceptance already granted. This review grants none.

## 4. Verified security findings and scope limits

### Current dependency audit

Fresh Replit dependency scan: **0 critical, 2 high, 0 moderate/low**.

1. **HIGH, OPEN — production dependency `uuid@9.0.1`**, GHSA-w5hq-g745-h8pq. The advisory concerns v3/v5/v6 caller-supplied buffer bounds. Installed storage graph includes gaxios/teeny-request and paginator paths. Current reviewed multipart call sites use v4; this is narrow reduced-reachability evidence, not a fix or a complete call graph. Registry metadata still reports object-storage SDK 1.0.0 → storage `^7.7.0`; latest storage 8.4.0 is outside range. No supported parent fix established, no major override applied. `npm ls` also reports installed extraneous/invalid edges; clean isolated lockfile reproducibility belongs to REL-006.
2. **HIGH, OPEN — isolated preview `zod@3.25.76`**, GHSA-mrhx-c7xc-m3w5. Scanner reports oversized-array validation resource exhaustion and proposes 4.6.6, a major change. It is a direct artifact devDependency; no zod imports were found under artifact `src`. No exploit demonstrated. Keep it excluded from production; assess applicability/reachability before changing packages (REL-016). Root app and preview exposure are not interchangeable.

Audit findings are not synonymous with proven remote exploitability. Neither advisory was silently downgraded or marked fixed.

### Authorization, identity and privilege

- **Current G02** denies cross-owner post PATCH/DELETE and ordinary employee admin-users access; permitted administrator read succeeds.
- **Current G07** denies original-feed reads after logout-all. Earlier H/B tests cover eligibility, password/2FA/recovery concurrency, individual session revoke and sampled admin/moderator boundaries.
- **Current G05** confirms existing unauthenticated media GET/HEAD by known URL. This is an actual exposure observation; whether it violates policy requires REL-008's explicit audience decision. Post visibility alone does not protect that URL.
- Complete method/action/object/role coverage remains REL-015. No “BOLA-free” claim is made from a small sample.

### CSRF, XSS, rendering and retention

- G03 real HTTP Origin/Fetch-Metadata rejection leaves no sentinel post. The adapter accepts no-Origin bearer API clients intentionally. Origin validation compares host, and proxy trust behavior needs explicit certification. This is not an actual browser cross-origin attack test.
- G04 stores an invented markup payload unchanged and returns JSON. It does **not** execute DOM rendering and cannot establish stored-XSS safety. Reviewed translated output uses `textContent` and `dir=auto`; several icon SVG `innerHTML` sites contain constants. This does not certify every other renderer.
- CSP currently restricts script/connect to self and disallows object/base injection; style permits inline and Google Fonts. CSP is defense in depth, not proof of safe sinks. Original browser session token storage is localStorage; no cookie-auth migration was attempted.
- G01 verifies original feed `no-store` and security headers. Earlier B05/B06/B20 verify no-response policy for sensitive endpoints, encrypted replay/control/outbox and bounded/redacted retention. Repository cleanup expires encrypted response payloads after five minutes and removes request rows after 24 hours when cleanup executes; delivered outbox payloads are redacted. Idle cleanup guarantees, backup copies, access policy and production logs remain REL-010.
- Rate limits span serialized SQL-backed maps in development (prior B24). Root legacy process maps alone do not provide fleet-wide continuity. Trusted forwarding, restart persistence and hosted multi-instance abuse limits remain unverified.

### Scanner boundaries

The dependency scanner ran against package metadata. **Fresh SAST and HoundDog: BLOCKED / NOT RUN**: documented callbacks expose no source allowlist/exclusion controls in this session; a whole-workspace source/dataflow scan cannot be certified to exclude imported private employee/config data. The explicit user privacy boundary takes precedence. Scoped manual review covered only named source files; no imported data, keys, `.env` or employee snapshots were scanned. Initial audit's historical zero findings are not a fresh clean scan. A source-only exported allowlist or supported scoped scanner is an executable future prerequisite within REL-007/010/015, not permission to run an unrestricted scan now.

## 5. Browser certification status

Official Replit App Testing documentation supports real browser testing of Full Stack JavaScript/Streamlit apps and manual login takeover. No working authenticated interaction callback is available in this session. The existing installed Playwright standard launch was attempted **once**, without custom loaders or config invention, and failed before navigation:

`chrome-headless-shell: error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file` (exit 127).

Earlier Phase 2F custom library/loader attempts also encountered glibc ABI and libexpat failures. They were not retried or presented as supported. No packages/toolchains or auth bypass were added.

**Authenticated browser actions executed: 0. All browser acceptance actions: NOT TESTED.** `reports/POSTGRESQL_PHASE2G_BROWSER_CHECKLIST.md` supplies safe setup, 22 exact action/acceptance rows, evidence capture and sign-off across employee login/2FA, recovery, feed/interactions, profile/uploads, groups, moderation/admin, Arabic/English, mobile/touch, stored markup, PWA update/cache and the distinct preview. Manual execution in the supported authenticated preview is an acceptable next certification route; this phase does not pretend it happened.

A public landing screenshot, if rendered, proves only basic public serving. It cannot show signed-in UI, touch behavior or browser memory.

## 6. Proposed feed product contract — recommendations, NOT approval

Preserve current full-feed API and original interface by default. Keep the Phase 2F legacy-order prototype isolated; its `legacy` mode is **not equivalent** to the original main feed's default `new` client ordering. Unsupported prototype global operations remain 422.

| Decision | Recommended backward-compatible behavior | Required acceptance |
|---|---|---|
| Newest / oldest / top | Versioned opt-in only. Main-feed newest follows original timestamp descending. Top follows existing `(likes-dislikes)` descending, then likes descending, then timestamp descending. Hub oldest/newest remains a distinct existing client behavior, not a silently changed main-feed sort. | Compare the entire globally ordered visible result against original JS reference on invented data, not sorting each page locally. Include negative/missing rating values and zero ties. |
| Stable ties / invalid dates | For comparable equal keys preserve original stable source ordinal within a revision. Do not substitute UUID lexical order. Existing NaN/invalid-date comparator behavior can be non-total; reject or retain a reference-compatible version for those datasets until explicit normalization policy is approved. | Equal timestamps, leading-zero IDs, duplicate-looking/invalid/missing dates across boundaries; no omission/duplication or false claim that SQL ordering matches a non-total comparator. |
| Arabic search | Global server-side equivalent of current haystack, Arabic diacritic/letter/digit fold and all-word matching, combined with existing chips and visibility before paging. No page-only filtering or database collation approximation. | Exact IDs/order against original helper for mixed Arabic/English/names/hashtags/digits, unknown fields, zero results and scope changes. |
| Global widgets / stories | Independent authorized global projections for stats, complete eligible stories, pins/alerts/hot/ranking and any collection-wide consumers. Page length is never total count. Original raw-post statistics remain exact even when visibility/scope differs. | Match original values/visibility/expiry for each role/scope and post mutation; widget payloads have independent bounds, revisions and errors. |
| Live changes while scrolling | Recommend conservative revision fence initially: no silent mixed-generation append. On relevant mutation return 409 and offer “new updates / refresh”; do not auto-jump or freeze a stale authorization snapshot. Fresh session/ban/group and live story/today eligibility every request. | Insert/edit/delete/rating/role/membership/expiry between pages; client clears stale protected cache and restarts intentionally. If a frozen snapshot is preferred, it needs separate retention and auth design. |
| Cursor expiry / restart | Retain proposed fixed two-minute lifetime unless product approves another. 410 means explicit restart; 409 revision restart; 401/403 clear protected state. Deduplicate retries. Deployment/key continuity uses separately approved secure custody, never existing-key regeneration or implicit fixture-session adoption. | Refresh/reset visibly recovers, no automatic infinite loops; expired/tampered/cross-actor/scope/revoked tokens deny without data. Cross-restart tests under approved key lifecycle. |
| Group deep links | Resolve ID only through current authorization and explicit group context. Unknown/forbidden response must not enumerate private groups; offer authorized navigation/reload instead of global discovery. | Member/nonmember/removed member/admin/empty group and off-window deep links. Product approves exact missing-vs-forbidden disclosure. |
| Browser cache | Use bounded cards/records/seen IDs, disclose eviction and preserve a return anchor/refetch path; do not silently lose saved/engagement state. Proposed preview caps 80 cards/320 seen IDs are review inputs, not production defaults. Do not let eviction truncate global widget state. | Actual long-scroll DOM/heap/cache measurement, return navigation, Arabic/mobile, refresh/retry/revoke clearing, save/reaction mutations through existing safe writers. |

Approval gate: product signs semantics and UX; security signs scope/restart/cursor custody; engineering integrates real frontend/API consumers; QA executes exact parity, browser and sustained load. No integration was performed in Phase 2G.

## 7. Translation quality, reliability and privacy assessment

The current local implementation uses OPUS Arabic↔English Transformers models. It is not an external translation API. Default development workflow disables model execution; earlier private B22 enabled it and demonstrated actual authenticated translations, edited-source cache changes, unauthorized denial and unchanged stored source. Those prior positive samples do not establish model quality.

### Executed now

- G06: normal worker returns 401 for anonymous translation and explicit 503 `translate_off` for signed-in user; invented stored posts unchanged.
- G08/G09: exact engine source with only the library import replaced by a deterministic invented fixture validates seven multilingual/name/URL/hashtag/emoji/newline inputs, content-keyed edits/cache, model-load/inference error rejection, recovery on retry and empty output. **This is orchestration testing, not real model output or browser presentation.**
- G10: controlled hanging fixture stays pending for 50 ms, demonstrating absence of an engine-owned deadline, not a measured real-model timeout. Original compatibility handler fail-stop policy remains in place. A 500-character unbroken token becomes 380 characters before inference; information loss is reproducible. No fix guessed because URL/long-input policy and translation release behavior need explicit disposition.
- G11: actual frontend heuristic classifies `مرحبا https://example.invalid/long/url` as English due to Latin-letter count; `OK` yields no language. `textContent` and `dir=auto` are present, but RTL/LTR visual behavior is NOT TESTED.

Actual local model probe, existing public cached weights, eight planned invented samples:

| Observation | Result |
|---|---|
| Completed actual samples | 1 of 8 |
| Arabic source | `صباح الخير. المشروع جاهز.` |
| English output | `Good morning........... Project's ready............` |
| First sample duration | 5,480.9 ms, includes load/queue; not HTTP latency or warm-inference p95 |
| Punctuation quality | Excessive punctuation reproduced; no formal bilingual quality score assigned |
| Termination | 768 MiB RSS guard, sampled peak about 776.4 MiB, SIGKILL |
| English→Arabic, mixed scripts, names, URLs/hashtags, emojis, edited text in actual new model run | NOT COMPLETED / NOT CERTIFIED |

Guard overshoot is sampled RSS, not an enforced kernel ceiling. No larger budget or repeated workload was tried. Fixture tests for those categories do not convert the missing actual model results into passes. Prior B22 English→Arabic evidence remains **prior**, not erased by this partial probe and not promoted into complete corpus certification. No real employee text was used or sent to AI services.

Privacy finding: `webTranslateLink` builds a Google Translate URL containing source text (up to 4,000 characters), visible only after local/browser translation failure. This is a **user-initiated external disclosure path**, not an automatic server fallback. No link was opened. Employee-content consent/policy must be approved before release; model offline behavior alone does not close this issue.

Performance/reliability: server translation holds the compatibility transaction/advisory lock; engine queue has no own timeout/cancellation, browser translator waits 8 seconds and server fetch aborts after 45 seconds. Frontend timeout does not cancel server inference. Keep fail-stop protections; a translation-specific redesign is not authorized here. REL-012 requires actual bilingual corpus review, latency/resource limits, failure/timeout behavior, original preservation, explicit overlong handling and UI certification, or an explicitly approved feature deferral.

## 8. Hosted infrastructure requirements

Official Replit documentation was consulted this turn. It confirms production/development database separation, durable App Storage, production data recovery/PITR options, encrypted Secrets, deployment types and App Testing. Documentation describes supported capabilities; it **does not verify this project's plan, region, retention, TLS role permissions, RPO/RTO or provisioned resources**.

| Requirement | Current gap / recommended evidence | Isolated hosted fixture possible? / authorization |
|---|---|---|
| Production PostgreSQL | Current launcher provisions owned local test cluster and is deliberately deployment-fenced. Select supported managed production DB, supported schema workflow and reviewed relational design; no startup DDL shortcut. | Yes, after separate fixture provisioning approval. Real production schema/credentials/cutover require separate authorization. |
| Dedicated identities / TLS | Separate app, schema/migration and recovery identities; certify actual grants, TLS certificate/hostname checks and network/connection policy. Do not infer least privilege merely from a connection string or docs. | Invented hosted roles and denied-operation/TLS tests first. Real roles/config require approval. |
| Backup/PITR / restore | Verify available retention/cadence and chosen recovery window in actual plan, independent recovery material and media/key coordination; sign numerical RPO/RTO. A documented PITR feature is not a passed restore. | Clean-host invented restore/fault drill possible with approval. Protected recovery materials and real restoration separately authorized. |
| App Storage / media | Durable cloud bucket instead of deployment filesystem; app-level audience policy, immutable/reference protocol, retention/GC and restored hashes. Private bucket alone does not make public application media routes private. | New isolated fixture bucket CRUD/fault/restore tests, separately approved. No existing bucket read/copy/change. |
| Secret/key custody | Use secure configuration/escrow without rotating original key domains. Scope access, log redaction and recovery ceremony. No secrets in Git/HTML/evidence. | Invented keys demonstrate protocol; custodian-only actual domain validation needs authorization. |
| Topology and background jobs | Existing configured VM/`node start.js` remains unchanged and release-fenced. Always-on reserved VM aligns with in-process scheduling, but is not automatically safe for restart/overlap. Autoscale is inappropriate without reviewed stateless jobs/shared coordination changes. | Hosted fixture overlap/restart/supervision can be certified; topology change and production publish require separate approval. |
| Monitoring / alerting | Readiness, saturation/RSS, worker retirement, outbox lag, storage/checksum errors and backup-age alerts with owner/runbook. | Fixture incidents and actual alert reception possible with approval; no production log access this turn. |
| Email/SMS/push | Fixture receipts prove transaction/outbox only. Approved provider sandbox, destinations, retry/idempotency and browser/device permission behavior required. | Provider sandbox/test-device authorization first; real employee destinations and production credentials excluded. |
| Safe overlap | Freeze/drain all old writers, consistent authority epoch and current-state rollback build; retain serialization/fail-stop until replacement verified. | Two fixture deployments/builds and CLI attempts; real freeze/cutover is separately authorized. |

Sources consulted:

- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/sql-database
- https://docs.replit.com/features/data-and-storage/connection-details
- https://docs.replit.com/features/data-and-storage/data-recovery
- https://docs.replit.com/features/data-and-storage/object-storage
- https://docs.replit.com/features/publishing/deployment-types
- https://docs.replit.com/core-concepts/project-editor/app-setup/secrets
- https://docs.replit.com/features/agent/app-testing

No production deployment metadata or production logs were needed or queried; prior audit deployment observations must not be treated as current health.

## 9. Migration prerequisites and absent capabilities

The 59-table design and later lossless compatibility mapping are not an approved production schema lifecycle. The SQL adapter is useful application integration, but fixture initialization/export helpers do not constitute an operational real-data importer.

| Capability | Current state | Exit criterion / owner register |
|---|---|---|
| Complete importer | NOT IMPLEMENTED; 28 known mappings preserve invented unknown attributes/null/order, opaque mail/messages still need protected domain inventory | Full source/path/type inventory; deterministic lossless candidate and reverse validation, no silent default/drop; REL-001 |
| Protected source inventory | BLOCKED, authorization absent | Authoritative membership/content/media/key-domain manifest with no employee copy into workspace; REL-001 |
| Immutable independent backup | Synthetic frozen encrypted export tested; protected immutable source and hosted backup/PITR drill absent | Independent tamper-evident source plus restore proof and numerical RPO/RTO; REL-001/002 |
| Media reconciliation | Local selected/reference hashes tested, hosted/frozen complete inventory absent | Every live/retained reference, object digest/version and unknown/orphan disposition reconciled; REL-004 |
| Session/2FA compatibility | Matching invented domains and active flows tested; protected active/pending domains and supported import absent | No rotation, foreign-domain rejection and matching active/pending/session/recovery drill; REL-014 |
| Old-writer freeze | Cooperative SQL epochs/locks tested; old HTTP/CLI/mirror/deployment freeze absent | Enumerate/stop/fence/drain all old authorities before final reconciliation; REL-005 |
| Final reconciliation | NOT IMPLEMENTED as protected cutover procedure | Frozen identity/field/relationship/media equality with signed exception-free result; REL-001/005 |
| Authority cutover | BLOCKED, no approved operational activation | Explicit epoch activation journal, resume/refusal on interruption and fresh readiness; REL-005 |
| Post-cutover application rollback | Design only; no certified current-SQL-state rollback build | Old application build on current authority without data rollback; stale JSON refusal; REL-002/005 |
| Operator recovery | NOT IMPLEMENTED as complete supported command/runbook | Clean-host restore, interrupted retry, escrow/media/catalog validation, recorded operator drill; REL-002/013/014 |

Approval of this review is not approval to copy records, run `restore.js`, create production manifests, change keys, remove fences or start a migration.

## 10. Tests completed versus not executed

### Current Phase 2G execution

- **11 targeted checks PASS, 0 FAIL**, `generated-artifacts/phase2g/targeted-tests.json`. G01–G07 use actual original handlers/SQL in a fresh owned invented-data fixture; G08–G11 use exact source with controlled engine/import fixtures or pure frontend helper inspection. Passing diagnostic checks assert known limitations as well as controls; they do not mean those limitations are fixed.
- Actual model probe: **partial**, 1/8 samples, guard stopped workload; quality not certified.
- Browser environment probe: **BLOCKED**, zero authenticated actions, all acceptance rows NOT TESTED.
- Fresh dependency audit: **2 high OPEN**, not a passing security certificate.
- Source/report preservation: baseline and post-review hash check retained separately; no protected application change intended.

### Prior evidence retained, NOT rerun this turn

- 56 original HTTP + 27 hardening + 9 profile parity + 11 background checks = **103 prior passes**.
- Phase 2F: 24 exact role/scope pairs; 17 recorded passing entries (one is a coverage record, not 17 independent scenarios).
- Private enriched-page measurements: 20k synthetic posts about 139 MiB sampled worker RSS, with full directory/global scalar work still present; fifty distinct simultaneous fixture sessions yielded 32 accepted and 18 admission rejections, not fifty successes.
- Reference full-hydration page comparator at 20k exceeded the 384 MiB guard; that is not a certified 20k original-client workflow.
- Earlier object-store/forensic repair results remain historical/adapted, not native hosted PostgreSQL restore passes.

### Not executed / not certified

Authenticated browser/touch/PWA/markup execution; full role/action coverage; full actual multilingual corpus/timeout/RTL UI quality; fresh scoped SAST/HoundDog; hosted PostgreSQL TLS/least privilege/failover/PITR; hosted storage and delivery; real-data inventory/import/reconcile/cutover; actual escrow/key compatibility; current-state post-cutover rollback; supported hosted overlapping builds; sustained complete original-client capacity. **No production test ran.**

Reproduce only isolated checks:

```text
node scripts/postgres/phase2g/tests.cjs
node scripts/postgres/phase2g/browser-environment.cjs
node scripts/postgres/phase2g/model-probe.cjs
node scripts/postgres/phase2g/evidence.cjs verify
node scripts/postgres/phase2g/export.cjs
```

Model probe is bounded and may terminate partially; do not raise limits to manufacture a pass. Baseline creation refuses overwrite. Generated evidence is ignored from Git/deployment; retained source scripts and reports are the reproducible deliverables.

## 11. Exact minimum remaining release work and approval sequence

This is an execution sequence referencing the **single register**, not a new backlog or authorization.

1. **Gate A — scope and policy approval:** data/product/security owners approve source authority process, media policy (REL-008), included feature list, translation disclosure/deferral, numerical recovery and workload/SLO budgets. Protected discovery approval needed for REL-001/014; do not access data merely because plan is approved.
2. **Gate B — supported isolated hosted foundation:** explicitly authorize invented hosted fixtures; satisfy REL-003/004/014 and build recovery/rollback tooling REL-002, operational monitoring REL-013. Demonstrate provider-realistic faults, not mocks. No production resources touched.
3. **Gate C — application/security closure:** satisfy REL-006/009/010/015, resolve included translation behavior REL-012, and run all browser acceptance REL-007. Use supported scoped scanners or source-only export. A risk exception/feature deferral needs named sign-off, expiry/mitigations and no hidden core-workflow loss.
4. **Gate D — actual integrated capacity:** REL-011 certifies original app under the approved enforced envelope, or separately approved versioned feed/frontend integration. Private paging cannot satisfy this by itself. Broad native writers are not automatically required.
5. **Gate E — protected rehearsal authorization:** only after earlier gates, authorize protected source inventory, immutable backup, complete import/round-trip/media/key reconciliation, old-writer freeze and interrupted cutover/rollback rehearsal (REL-001/002/005/014). No real employee dataset enters ordinary development.
6. **Gate F — controlled production release authorization:** data/security/operations/QA sign mandatory register evidence, recovery/capacity results, final frozen reconciliation, rollback build, monitoring and operator window. Separate explicit schema/data/authority/traffic/publish approvals remain required. Keep release fences until the approved replacement is proven. Stop on any unexplained mismatch.

Minimum means complete mandatory gates for the approved feature/envelope, not every optional redesign. REL-016/017/018 can stay deferred only under their stated exposure/scope conditions. No estimate, staffing commitment, automatic task creation or next phase is implied.

## 12. Separate verdicts and stop

**Development — CONDITIONAL GO for existing isolated synthetic workflows and further specifically approved certification.** Known original functionality works within recorded tests; partial translation quality/resource results and browser/hosted gaps are explicit. This is not an end-to-end feature, security or operational certification. The existing application and pagination preview remain separate.

**Production — NO-GO.** Operational importer, protected authority/custody, hosted durable DB/media, recovery/rollback, delivery, complete security/browser/feature and capacity evidence remain mandatory gaps. No synthetic pass removes them. No deployment, republish, production schema/data access, real import, key rotation, storage migration, native-writer conversion or fence removal was performed.

**Stop for review. No automatic next phase.**
