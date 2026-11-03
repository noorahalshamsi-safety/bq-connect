# BQ Connect — Phase 2C development review

Development: **CONDITIONAL GO: native profile code review only; runtime progression blocked**.
Production: **NO-GO**. No deployment or production migration was initiated.

## 1. Architecture dependency map

The existing reference runtime remains operational. Every dynamic operation still
uses its serialized queue, independent dataset/key-domain attestation, transaction,
global advisory lock, revision fences and commit-before-response boundary.

```text
HTTP -> bounded ingress -> serial queue -> pool / BEGIN / advisory lock
     -> authenticated original handler
     -> profile slice: 30 dependency tables + target/follow SQL
        OR reference: all 107 model tables + full media graph
     -> original session-touch writer if due / shared rate maps / replay
     -> COMMIT -> response
Background work -> same serialized and fail-stop boundary
```

The detailed operation dependency table, read-only projection guarantees and future
write proof obligations are included in the architecture appendix below.

## 2. Original performance baseline

Before means the unchanged compatibility handler on the current development
adapter, selected by the private test controller's reference mode. After means the
same handler/authentication/session/writer contract with the narrow profile SQL
slice enabled. Both use separate fresh invented PostgreSQL fixtures and identical
load-controller source, admission limits and resource guards.

Requested fixture matrix: 100/500/1,000 employees × 5,000/20,000 posts × 10/25/50
simultaneous requests. Seeded post counts were checked in SQL. Each concurrency
has one burst, not a sustained capacity or statistically reliable p99 study.
Different actor sessions were used; profile target was the same invented employee.
Load fixtures contain minimal posts and no large engagement/follower histories.
Functional follower/media edge cases are covered separately by parity tests.

## 3. Changed-file inventory

- .agents/memory/MEMORY.md
- development/postgres/repository.cjs
- development/postgres/runtime.cjs
- .agents/memory/dependency-upgrade-boundaries.md
- development/postgres/native-profile.cjs
- reports/POSTGRESQL_PHASE2C_ARCHITECTURE.md
- reports/POSTGRESQL_PHASE2C_REVIEW.md
- scripts/postgres/phase2c-background.cjs
- scripts/postgres/phase2c-dependency.cjs
- scripts/postgres/phase2c-load.cjs
- scripts/postgres/phase2c-parity.cjs
- scripts/postgres/phase2c-regressions.cjs
- scripts/postgres/phase2c-report.cjs
- scripts/postgres/phase2c-support.cjs
- scripts/postgres/phase2c-translation-findings.cjs
- scripts/postgres/phase2c-translation.cjs

This report itself is an additional generated documentation file. Ignored evidence
and the downloadable report are under generated-artifacts/phase2c. Production
source fingerprints, original suite bytes and selected Phase 2B reports/results
all match their baselines. Temporary test-port configuration was removed;
the complete .replit configuration matches its checkpoint baseline.

No package/lockfile, original production server/auth/storage source, frontend
branding/UX or production provider fence was changed.

## 4. Native repository implementation coverage

| Path | Implementation | Authorization/writes |
| --- | --- | --- |
| Employee profile | Native target profile + follower/following queries; original public-ID/avatar/card helpers | Original session, eligibility, ban, directory and rate gates; complete accounts retained |
| Unusual legacy follower arrays / nonnumeric badge domains | Conservative full-reference fallback | No changed denial or approximate coercion |
| Feed / post detail | Reference only | Visibility, groups, reports, ownership, global statistics unchanged |
| Notifications / announcements | Reference only | Legacy/generated merge and seen-state parity not yet proved |
| Search / departments | Reference only | Arabic/Unicode folding, rank and directory order unchanged |
| All entity writers | Reference only | No native collection writer, lock removal or schema redesign |

Four development indexes were added. The original 107-table model remains.
Native profile hydration loads 30 tables; it is not a fully request-scoped,
lock-free or independently scalable repository.

## 5. Exact API compatibility comparison

Original HTTP checks: **56 PASS / 0 FAIL**.
Original hardening checks: **27 PASS / 0 FAIL**.
Dedicated parity groups: **9 PASS / 0 FAIL**.

The original suites were executed byte-for-byte; only output writes/directories
were redirected externally to preserve the existing Phase 2B evidence.
Profile comparisons assert status, exact decoded response bytes, JSON values and
content-type/cache-control/vary/content-encoding headers against the reference
worker. Volatile transport headers such as Date are not compared.

- PASS: Employee/system/leading-zero profiles and actor matrix
- PASS: Profile photo, bio and duplicate/numeric/null follower parity
- PASS: Complex legacy follower coercion safely falls back
- PASS: Unknown, injection-shaped, empty and forged PID
- PASS: Unsupported employee shapes and nonnumeric domains use reference behavior
- PASS: Ban, session revocation, factor loss and deleted employee fail closed
- PASS: Cross-worker idempotency and profile-change replay fence
- PASS: Unchanged original session-touch writer preserves every account
- PASS: Native profile reads preserve existing media links and business state

Coverage includes a 6-actor × 6-target profile matrix; system and leading-zero
identities; original avatar hashing; duplicate/numeric/null legacy follows;
array-coercion fallback; forged/unknown target IDs; missing/banned/revoked/unready
actors; cross-worker replay; changed-profile replay invalidation; due session
touch preserving all other accounts; and nonempty existing media-reference
preservation. Other malformed datasets, every Unicode badge domain and all
unrelated repository semantics are not newly exhaustively certified.

The signed-in browser UI was not verified. No frontend source was changed.
The public language-selection screen was visually checked and the development
readiness endpoint returned live/ready true.

## 6. Before/after load-test results

Latency is successful-request p95 in milliseconds. Success counts are shown so
fast overload rejections cannot be mistaken for good read performance.

| Employees | Posts | Concurrency | Before p95 ms | After p95 ms | Before successes | After successes |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 5000 | 10 | 1151.8 | 168.6 | 10/10 | 10/10 |
| 100 | 5000 | 25 | 2755.2 | 302.1 | 25/25 | 25/25 |
| 100 | 5000 | 50 | 3809.4 | 392.2 | 32/50 | 32/50 |
| 100 | 20000 | 10 | NOT COMPLETED | NOT COMPLETED | 0/10 | NOT RUN |
| 100 | 20000 | 25 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 100 | 20000 | 50 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 500 | 5000 | 10 | 1294.0 | 160.2 | 10/10 | 10/10 |
| 500 | 5000 | 25 | 2949.2 | 345.2 | 25/25 | 25/25 |
| 500 | 5000 | 50 | 3870.2 | 418.4 | 32/50 | 32/50 |
| 500 | 20000 | 10 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 500 | 20000 | 25 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 500 | 20000 | 50 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 1000 | 5000 | 10 | 1238.9 | 188.7 | 10/10 | 10/10 |
| 1000 | 5000 | 25 | 3168.0 | 378.8 | 25/25 | 25/25 |
| 1000 | 5000 | 50 | 4082.8 | 482.4 | 32/50 | 32/50 |
| 1000 | 20000 | 10 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 1000 | 20000 | 25 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |
| 1000 | 20000 | 50 | NOT COMPLETED | NOT COMPLETED | NOT RUN | NOT RUN |

All six 20,000-post runs were safety-stopped around bootstrap/session setup.
Observed worker RSS exceeded the configured 384 MiB threshold (100 ms sampling
allows a small overshoot); some resulting errors are recorded as fetch failures.
No usable profile-load latency is claimed for those cases. Limits were not raised.
Remaining concurrency levels in stopped fixtures were not run.

| Employees | Posts | Primary queries p50 | Hydration SELECTs | Transaction p50 ms | Observed peak worker MiB |
| --- | --- | --- | --- | --- | --- |
| 100 | 5000 | 134.0 → 58.0 | 107.0 → 30.0 | 122.5 → 12.1 | 197.5 → 185.0 |
| 500 | 5000 | 134.0 → 58.0 | 107.0 → 30.0 | 128.3 → 13.3 | 210.7 → 171.7 |
| 1000 | 5000 | 134.0 → 58.0 | 107.0 → 30.0 | 136.3 → 15.1 | 207.7 → 187.4 |

Raw files include successful p50/p95/p99, all-request latency distributions, status
counts/failure rates, successful reads/second, transaction/query/queue/pool/lock
metrics, CPU seconds and observed RSS samples. Counts in queryCount/loadQueries
are counts, although the generic raw summary fields are named p50Ms/p95Ms/p99Ms.

| Mode | Employees | Feed ms | Feed posts / bytes | Original profile-write ms | Worker CPU seconds |
| --- | --- | --- | --- | --- | --- |
| baseline | 100 | 312.5 | 5000 / 3836744 | 142.4 | 11.5 |
| baseline | 500 | 304.4 | 5000 / 3836744 | 180.9 | 12.3 |
| baseline | 1000 | 323.0 | 5000 / 3836744 | 262.4 | 12.9 |
| native | 100 | 321.1 | 5000 / 3836744 | 155.7 | 1.6 |
| native | 500 | 281.2 | 5000 / 3836744 | 187.2 | 1.7 |
| native | 1000 | 295.2 | 5000 / 3836744 | 238.9 | 2.0 |

Feed samples still return the complete 5,000-post list (about 3.84 MB decoded).
No native feed pagination was introduced or benchmarked. Stable server-side
pagination requires a compatible filter/statistics/tie-break contract; client
truncation or a standalone SQL cursor would not certify the existing endpoint.
Writes above are one original profile-update sample per fixture, not a native
writer throughput benchmark. CPU uses verified Linux USER_HZ=100; RSS is process
RSS, not total PostgreSQL/cgroup memory. Whole-host CPU and pool saturation under
sustained multiworker native load are not measured.

Initial synthetic seeding rejected SQL NULL collection attributes before serving
load; the seeder was corrected to preserve JSON null and verify the exact post
count. Those initial rejected-seed files were retained separately and are not
included in performance comparisons.

## 7. Concurrency and database-lock analysis

At 5,000 posts, 10- and 25-request bursts had no failures. At concurrency 50,
both paths served 32 and rejected 18: **36% failure rate** under the unchanged
queue admission cap. This remains a capacity blocker, despite much faster
successful native profile requests.

The global advisory lock and original queue remain intentional. The measured
primary connection query count is 134 → 58 in the completed fixtures; hydration
SELECTs fall from 107 → 30. Account refresh and full original session touches
remain. The default full-graph bootstrap/session path still exceeds the chosen
memory budget at 20,000 posts.

Lock/pool/queue distributions are in both raw load files. Small single-worker
advisory waits do not certify multiworker concurrency. Existing B25 verifies
bounded pool/lock failures; B26 verifies acknowledgement crash/restart; B27 verifies
fail-stop deadline retirement. The unchanged regression suites cover commit,
rollback, unknown outcome, idempotency and media/outbox invariants. No new native
writer crash guarantee is claimed.

The restarted development workflow also logged background-job transaction
refusals. An accelerated-timer comparison against checkpoint reference bytes did
not complete within its 30-second controller deadline; its owned fixture was
stopped and removed. No baseline parity or root cause is asserted. This remains
an unresolved runtime-progression blocker; passing HTTP tests do not certify
periodic jobs. The refusal was not suppressed or represented as a clean run.

## 8. Security/dependency review

The uuid@9.0.1 finding remains **HIGH / OPEN**. Paths:

- @replit/object-storage@1.0.0 > @google-cloud/storage@7.22.0 > gaxios@6.7.1 > uuid@9.0.1
- @replit/object-storage@1.0.0 > @google-cloud/storage@7.22.0 > teeny-request@9.0.0 > uuid@9.0.1

The published SDK 1.0.0 declares storage ^7.7.0; installed storage is 7.22.0.
Registry latest storage 8.4.0 is outside that supported range. No supported parent
SDK fix was identified. No forced major override, provider replacement or package
change was made. Reviewed multipart callers use UUID v4, whereas the reported
buffer-bounds issue concerns v3/v5/v6; that reachability observation does not close
the package finding.

Offline SDK export/API-shape and UUID-v4 smoke: **PASS**,
with no instantiated storage client or provider network operations. This is not
hosted-storage CRUD or production-credential regression certification.

Native SQL uses bound values and fixed schema identifiers. Original eligibility,
session version/expiry and role gates remain before lookup; replay uses all entity
revisions, not merely the partial projection. The native projection cannot persist
unrelated business/media changes. Original root production fences and key-domain
attestation are unchanged. This is a focused review, not a new full-project
SAST/HoundDog scan.

## 9. Translation performance and quality findings

Current B22 HTTP translation check: **PASS**.
Observed request status/timing pairs: [{"status":200,"ms":7211.731969},{"status":200,"ms":216.606326000001},{"status":200,"ms":132.05674999999974},{"status":200,"ms":204.84761399999843},{"status":200,"ms":350.9594929999985},{"status":401,"ms":29.829781000000366}].
These include authentication, SQL and queueing. Background warm-up may overlap
first calls; these are not certified pure cold/warm model inference timings.

The separate local-only engine probe did not return completed measurements within
its 768 MiB / 120-second guards. Exact termination trigger/peak and completed
per-sample data were not captured; no pure-engine p50, memory result, warm-cache
latency or mixed-language quality score is invented. The guarded workload was not
restarted or given a larger resource limit.

| Original text-language detector input | Detected |
| --- | --- |
| مرحبا | "ar" |
| Hello | "en" |
| مرحبا https://example.invalid/long/url | "en" |
| ١٢٣٤ | "ar" |
| OK | "" |
| Hello مرحبا | "ar" |

The unchanged character heuristic can be biased by Latin URLs and can classify
Arabic digits as Arabic; mixed/very short text is not linguistically resolved.
Current B22 verifies basic Arabic/English meaning, edited-content cache keys,
stored-source preservation and concurrency. The prior excessive-punctuation
quality finding remains open. A comprehensive bilingual quality study is not
complete, and no model replacement or external employee-text service was used.

Existing HTTP model computation **still holds the compatibility transaction and
advisory lock**. This requested decoupling is not implemented: a safe change needs
native session/rate accounting with equivalent failure/timeout semantics.
B27 verifies injected handler deadline fail-stop, not an actual stalled-model
experiment. Translation performance progression remains blocked.

## 10. Remaining global-state and write-path blockers

- Shared mutable auth, directory, rate/factor, avatar/view and JSON cache graphs.
- Full-graph bootstrap/session hydration at larger post counts.
- Full account/session-touch and collection subtree writers.
- Feed visibility, global stats, engagement nesting and missing server pagination.
- Notification/legacy announcement merge and search folding/order parity.
- Model compute under the existing global transaction.
- Fixed queue admission failures at 50 simultaneous requests.
- Unsupported dependency remediation path and untested hosted-provider/recovery gaps.
- Unresolved live background-job transaction refusals; diagnostic comparison blocked.

No native writes or advisory-lock removal were attempted. Future write designs
must prove current ownership/authorization, entity versioning, coherent fencing
against old collection writers, actor/digest idempotency, commit-before-response,
atomic outbox/media relations, and before/during/unknown/after-commit crash behavior.
The detailed proof matrix is in the appendix; designs are not implemented proofs.

## 11. Revised next-phase plan

1. Resolve background-job refusals and establish their reference baseline before
   further runtime rollout; review the limited profile slice/fallback boundaries.
2. Make authorization/rendering inputs request-scoped before removing serialization.
3. Address bootstrap/session full-graph memory; repeat 20,000-post workloads within
   an approved budget rather than silently raising this one's cap.
4. Define compatible feed pagination/global-statistics semantics, then prove detail,
   notification/announcement and Arabic search parity before migrating each read.
5. Separate native session touches and rate accounting before moving model compute
   outside SQL; repeat instrumented local cold/warm/quality evaluation.
6. Implement one native write slice only after its legacy-writer fencing and full
   crash/race proof matrix pass. Do not convert all writers together.
7. Obtain a supported dependency upgrade and run real isolated storage-provider
   regressions before closing the advisory or proposing production progression.

## 12. Development and production verdicts

**Development: CONDITIONAL GO: native profile code review only; runtime progression blocked.** This means the narrow employee-profile
optimization can proceed to review while the reference path remains available.
It is not a full Phase 2C performance, 50-user, 20,000-post, lock-free, native-write
or translation-decoupling certification.
Background-job readiness is unresolved. The conditional decision permits code
review only, not additional runtime rollout or a claim that Phase 2C is complete.

**Broader native/concurrency progression: NOT CERTIFIED.**
**Production: NO-GO.** Production code/configuration, provider fences and credentials
were left unchanged; no production migration, data access or publication occurred.

Evidence: generated-artifacts/phase2c/{load-baseline,load-native,native-parity,
dependency-review,translation-findings,preservation-check}.json and verification/
for the original suites. This is one-host synthetic development evidence, not
production capacity or a complete browser/security/provider assessment.

## Architecture appendix

### Phase 2C architecture and bounded native-read design

#### Scope and authority

This is a development-only refactor. PostgreSQL remains authoritative. The existing
independently guarded synthetic dataset, signing/backup-key domains and release
fences remain mandatory. No production records, credentials, migrations or
deployments are part of this work.

The original compatibility handler remains a reference. The original 107 model
tables are retained. Four additional development indexes support the limited
profile/follow slice and its safe legacy-shape fallback.

#### Architecture dependency map

```text
HTTP request / bounded ingress / origin checks / idempotency input
  |
  +-- static GET/HEAD ---------------------------------> unchanged static assets
  |
  +-- global in-process queue
        |
        +-- PostgreSQL pool -> BEGIN -> global advisory lock
        |     -> independent receipt + dataset/key-domain/epoch checks
        |     -> file revision locks
        |
        +-- compatibility request
        |     -> 107 model tables + media graph
        |     -> mutable auth account map + rate/factor/device maps
        |     -> mutable employee directory/lookup + shared JSON/avatar/view caches
        |     -> original handler
        |
        +-- native employee-profile request
              -> selected account/security/employee/moderation/conduct tables
              -> original auth/rate/eligibility handler, still serialized
              -> indexed target profile and follower/following SQL
              -> original PID, avatar and card-rendering functions
              -> immutable target-profile buffer, NOT a writable entity
              -> no media-graph hydration or media-link rebuilding
              -> conservative full-reference fallback for unsupported legacy shapes
        |
        +-- original session touch, if due, still rewrites complete account entity
        +-- encrypted shared-rate state + revision-bound response replay
        +-- COMMIT -> acknowledge response
```

The profile slice deliberately does **not** remove global serialization or make
the original account/session writer native. Complete account state is retained
because `readSession` can update `lastSeen`; projecting a single account into the
existing collection writer would silently remove other accounts.

### Original operation dependencies

| Operation | Mutable/global dependencies | Phase 2C disposition |
|---|---|---|
| Session/authentication | Account graph, session/device lists, factor and failure maps, security config | Unchanged original handler and writer; complete account entity loaded |
| Employee profile | Directory/PID lookup, eligibility, conduct bans, avatars, profiles, follower graph | Native target/follower queries; original authorization/rendering; bounded dependency hydration |
| Search/department | Unicode/Arabic folding, directory ordering/rank, department cache, profiles and hidden departments | Reference only; SQL collation/folding/order parity not proved |
| Feed listing | Live/expired posts, hidden/reported/owner visibility, groups, bookmarks/follows, views, author avatars, comments/reactions/polls, history and global stats | Reference only; no partial result mislabeled a complete feed |
| Post detail/engagement | Feed visibility plus operation-specific permissions and nested relationships | Reference only; no new endpoint or changed response shape |
| Notifications | Recipient rows, generated post announcements, legacy announcements, seen state and ordering | Reference only; merging/visibility parity not yet proved |
| Translation | Session/eligibility/rate maps and model/cache queue | Model evaluation outside SQL; current HTTP transaction coupling remains an explicit blocker |
| Post/comment/reaction writers | Ownership, visibility, mutable collections, notifications and outbox | Unchanged; no native writer |
| Profile writer | Full profile collection, moderation and original revision guard | Unchanged; indexes maintained transactionally by PostgreSQL |
| Account/session writers | Complete accounts, versions, factor/recovery hashes, rate maps and outbox | Unchanged; no partial account persistence |
| Media attachment | Pending intent, immutable bytes/hash, references and commit acknowledgement | Unchanged for writers; profile reads never rebuild the full reference graph |
| Background jobs | Same global maps and snapshots; backup/announcement work | Same serialized queue; poisoned worker cannot start another job |

#### Native profile contract

The existing `POST /api/social` with `action: "person"` retains its JSON/status
contract. There is no new client flag, UX, route, sorting parameter or pagination
shape. The response still includes the existing public PID, card fields, bio,
official/mine/followed flags and follower/following counts.

The existing original authentication, API rate limit and eligibility code runs
before native profile lookup. It continues to enforce employee membership, factor
readiness, session version/expiry/idle rules and conduct restrictions.

SQL binds the target badge and viewer badge as parameters. There are no
user-controlled table names, SQL ordering expressions or interpolated predicates.
Original public-ID and avatar hashing are reused, not reimplemented.

Follower counting preserves distinct follower accounts, duplicate following
entries, numeric/string scalar coercion and leading-zero badges. A JSON array
inside a legacy follower list can have special JavaScript string coercion; such
datasets use the complete reference path. Non-numeric employee/system badge
domains also conservatively fall back rather than receiving an approximate native
answer. These are optimization boundaries, not new authorization denials.

The target-profile buffer is read-only. Persistence rejects changes to any entity
other than the complete original account entity, media writes or queued delivery
events from this slice. The native slice never invokes the compatibility
`DELETE/rebuild all media_links` step.

Replay scope includes **all** entity revisions, not only hydrated dependencies.
An account touch updates its revision in that scope. A profile/follow/role change
therefore invalidates an older replay across both native and reference workers.

#### Transaction and lock analysis

All original handlers retain their global advisory lock and in-process queue.
Native profile reads hold the same boundary, so the remaining mutable directory,
account and cache graphs cannot overlap between requests. Other worker processes
refresh from committed SQL after obtaining the lock.

Native profile is therefore a narrower hydration/query implementation, **not**
an independent lock-free read service. Pool size and admission limits remain
unchanged. The query-count metric covers actual calls on the checked-out primary
request connection; auxiliary media/outbox transactions are not silently included.

The existing full collection writer still deletes/reinserts normalized subtrees.
There is no claim that a profile optimization fixes post-write amplification,
large-feed payloads, global statistics or full account/session persistence.

#### Native write design — specification only, not implemented or certified

No write path has been replaced. The following are proof obligations for a later,
separately reviewed implementation, not assertions that future code already
satisfies them.

| Proposed slice | Transaction/authorization design | Evidence required before enabling |
|---|---|---|
| Post create/edit | Begin; verify current session/membership/group visibility; lock target/revision; owner or explicit status permission; insert/update only affected post/subtrees; write idempotency and outbox in same transaction; COMMIT before response | Native/reference parity for every type and role; revision conflict races; before/during/unknown commit; after-ack kill; stable post numbering and media references |
| Comment/reaction | Lock target post and applicable comment; enforce reply/visibility/ownership; unique actor reaction; update affected child and notification/outbox atomically; stable idempotency actor/key/digest | Concurrent same/different actor toggles, no lost comments, parent deletion race, moderation/private visibility, duplicate notifications and provider crash windows |
| Profile update | Lock actor profile revision; enforce own identity and content/photo rules; update only profile and transactional audit/notification events; preserve avatar public-ID semantics | Actor spoofing, avatar/media lifecycle, stale-revision conflict, native profile replay invalidation, cross-worker changes and rollback |
| Account/session | Per-account locking plus explicit global membership/generation attestations; atomic versions/factor/recovery/session changes and audit/outbox; never infer a fresh account/key from missing data | Registration/2FA/recovery/password/reset/session tests, one-winner consumption, leading-zero/legacy KDF parity, concurrent version changes, unknown commit and independent key-domain recovery |

Do not mix a native row writer with an unfenced full-collection writer: the latter
can overwrite newly committed native rows. Either all writers for that entity
honor a coherent revision/lock protocol, or the entity remains on the reference
writer. Read-path validation alone does not justify enabling any of these writers.

#### Remaining blockers and next-phase sequence

1. Review the narrow profile code, fallback boundaries and measured limits.
2. Define pure request-scoped authorization/rendering data contracts; eliminate
   mutable graph sharing before considering concurrent native reads.
3. Specify a feed pagination/API contract with compatible global statistics,
   filtering and deterministic tie-breaking. No silent truncation of existing
   full-feed responses.
4. Prove native detail and notification/announcement-merging parity with restricted,
   deleted, hidden, expired and group-scoped content.
5. Prove Arabic/Unicode search folding, ranking and directory order before pushing
   search filtering into SQL.
6. Separately design native session touches and transactional rate accounting,
   including error/timeout semantics. Only then move HTTP model computation out
   of unnecessary database transactions without changing failure/rate behavior.
7. Implement at most one native writer after all proof obligations above have
   evidence and the legacy writer is fenced from overwriting it.
8. Close the supported dependency path and hosted recovery/media/provider gaps
   before any production proposal. Production remains NO-GO.

