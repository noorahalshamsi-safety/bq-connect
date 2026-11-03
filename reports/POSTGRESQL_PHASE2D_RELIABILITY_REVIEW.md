# BQ Connect — Phase 2D reliability review

Development: **CONDITIONAL GO: background repair and guarded 5k/10k development only**.
20,000-post progression: **NO-GO under the existing 384 MiB guard**.
Production: **NO-GO**. No publication, production data access or migration.

## 1. Background-job root cause and reference evidence

The recurring backup callback looked up backup-settings.json even though the
authoritative mapped entity is backup.json. JSON.parse received undefined and
threw SyntaxError before the due/enabled checks. This also affected disabled
backup schedules: it was not an authorization, writer-epoch or PostgreSQL lock
refusal.

Reproduced using the same owned synthetic fixture in the unchanged Phase 2B
reference and the frozen pre-repair Phase 2C source. The diagnostic adds IPC,
memory samples and transaction-boundary observation, not changed callback policy
or accelerated timer clocks.

- Phase 2B reference: runtime.cjs:155:27.
- Frozen Phase 2C: runtime.cjs:168:27.
- Both: verified dataset/epoch, client queryable, connection not ending,
  one advisory lock, no queued HTTP requests, then acknowledged ROLLBACK.
- No backup committed; retrying the uncorrected callback deterministically failed.
- The other four registered callbacks completed. All five complete after repair.

| Implemented work | Trigger / ownership | State and retry boundary |
| --- | --- | --- |
| Auth maintenance | 10 min; shared serial queue; own BEGIN/client/global advisory lock | Failure/mail/ticket map expiry; maps refreshed and persisted transactionally |
| Server maintenance | 5 min; same transaction boundary | Rate/OTP/email map expiry; no account identity replacement |
| Daily sparks | 15 min; same transaction boundary | Current Riyadh date/version marker; deterministic daily content |
| Event reminders | 1 min; same transaction boundary | reminded marker, notifications and fixture outbox in same transaction |
| Synthetic backup | 1 min due check; same transaction boundary | Existing enabled/interval policy, archive and lastAt commit together |
| Fixture outbox drain | 1 sec and after commit; independent checked-out client | Verified dataset; FOR UPDATE SKIP LOCKED, receipt and delivery state committed together; no real provider |
| Translation warm-up | One-shot 3 sec; model state only | No account/social graph write; original local model path unchanged |
| HTTP/socket callbacks | SMS fixture finish, response callbacks, original SMTP/place timeout paths | Not recurring jobs; SMTP/push/SMS are fixture boundaries; existing HTTP deadline remains |

The original production backup module's separate weekly scheduler is not active
in this synthetic override. Its source and schedule were not modified. The
existing development due-check policy was preserved, not replaced with a new one.
All private workers used invented data and independent PostgreSQL sockets.

## 2. Exact repair and transaction/lifecycle behavior

Correct lookup: development/postgres/runtime.cjs:190.
The backup status, archive and other entities remain in the same guarded
transaction; there is no fallback configuration or bypass of attestation.

Related narrow lifecycle corrections:

- Catch pool/begin/attestation/hydration failures as well as callback failures.
- Coalesce repeat ticks while the same callback is queued or running; keep the
  existing global serial queue/advisory lock across different work and processes.
- Apply a 25-second callback deadline. An uncancellable overrun poisons HTTP/job
  admission, rolls back where possible and retires the worker. It does not reuse
  the shared graph. Pool/lock/SQL waits retain their existing bounds; this is not
  a single 25-second wall-clock bound covering hydration and every commit query.
- Clear the callback timer before the bounded SQL persistence/commit phase.
- Stop interval admission before close, drain admitted work, then end the pool.
  A close acknowledgement is not sent while an active transaction is held.
- Log job label/category/code and sanitized file/line frames, not payloads,
  credentials, signing material or raw SQL parameters.

These are development safety changes, not production HA. There is no generic
exactly-once promise for arbitrary callbacks or external providers. Implemented
jobs use their durable date/reminded/lastAt markers under the same lock. A lost
commit response still requires re-reading committed state; it is not permission
to replay arbitrary effects blindly.

## 3. Measured allocation stages

The main no-forced-GC matrix is preserved separately from the phase-isolated
20,000-post diagnostic. The latter explicitly collects between startup/session/
profile/feed phases to identify reclaimable memory; it is not a new deployment
setting or evidence that the ordinary guarded workload passes.

| Probe | Outcome | Observed peak RSS MiB | Full-feed posts / bytes |
| --- | --- | --- | --- |
| before | COMPLETED DIAGNOSTIC ONLY | 278.18 | 20000 / 15386745 |
| after | COMPLETED DIAGNOSTIC ONLY | 270.98 | 20000 / 15386745 |

Below: maximum sampled RSS/heap/external/ArrayBuffer values at each named stage
across this isolated probe, not additive memory categories or allocator totals.
ArrayBuffer memory is part of external memory.

| Mode | Stage | Samples | RSS MiB | Heap used MiB | External MiB | ArrayBuffer MiB |
| --- | --- | --- | --- | --- | --- | --- |
| before | process-start | 1 | 62.61 | 5.28 | 1.85 | 0.02 |
| before | sql-connection | 4 | 215.91 | 18.75 | 7.16 | 4.95 |
| before | sql-table-accounts | 4 | 215.91 | 18.91 | 7.22 | 5.02 |
| before | sql-table-employees | 4 | 215.91 | 20.36 | 7.70 | 5.49 |
| before | sql-table-posts | 3 | 216.41 | 36.14 | 8.39 | 6.18 |
| before | decode-ideas.json | 3 | 223.23 | 100.53 | 7.16 | 4.96 |
| before | graph-decoded | 4 | 223.23 | 101.74 | 7.70 | 5.49 |
| before | media-and-buffers | 4 | 227.98 | 104.28 | 12.08 | 9.87 |
| before | before-auth-load | 1 | 187.13 | 87.85 | 7.35 | 5.19 |
| before | after-auth-load | 1 | 187.13 | 88.14 | 7.39 | 5.23 |
| before | before-app-load | 1 | 187.25 | 88.41 | 7.42 | 5.23 |
| before | after-app-load | 1 | 188.04 | 92.21 | 7.42 | 5.23 |
| before | ready | 1 | 196.85 | 89.76 | 7.17 | 4.96 |
| before | response-constructed | 3 | 266.96 | 143.08 | 27.39 | 25.18 |
| before | explicit-gc | 4 | 247.91 | 18.85 | 12.51 | 4.95 |
| after | process-start | 1 | 62.75 | 5.31 | 1.85 | 0.02 |
| after | sql-connection | 4 | 202.59 | 8.26 | 2.25 | 0.04 |
| after | sql-table-accounts | 4 | 202.59 | 8.41 | 2.31 | 0.10 |
| after | sql-table-employees | 4 | 202.59 | 9.67 | 2.81 | 0.61 |
| after | sql-table-posts | 3 | 202.84 | 21.80 | 3.79 | 1.63 |
| after | decode-ideas.json | 3 | 212.15 | 94.09 | 3.42 | 1.21 |
| after | graph-decoded | 4 | 212.15 | 95.30 | 3.42 | 1.21 |
| after | media-and-buffers | 4 | 218.77 | 90.95 | 8.32 | 6.11 |
| after | before-auth-load | 1 | 183.03 | 84.81 | 7.35 | 5.19 |
| after | after-auth-load | 1 | 183.16 | 85.12 | 7.39 | 5.23 |
| after | before-app-load | 1 | 183.16 | 85.39 | 7.42 | 5.23 |
| after | after-app-load | 1 | 184.33 | 89.25 | 7.42 | 5.23 |
| after | ready | 1 | 192.50 | 89.49 | 7.17 | 4.96 |
| after | response-constructed | 3 | 258.61 | 137.60 | 23.65 | 21.44 |
| after | explicit-gc | 4 | 237.78 | 8.40 | 8.78 | 0.03 |

SQL node/entity counts are sampled at account, directory and post decode;
stored post bytes are measured with pg_column_size, not misrepresented as network
wire bytes. Actual SQL wire-byte totals and complete JavaScript object counts
were not captured. Sampled heap peaks are not exact temporary-allocation totals;
short peaks between samples and precise allocation-site attribution remain uncertain.

| Mode | Posts | Post SQL rows | Stored post bytes | Postmaster RSS MiB | Controller-backend RSS MiB |
| --- | --- | --- | --- | --- | --- |
| before | 5000 | 5000 | 1976270 | 25.91 | 51.52 |
| before | 10000 | 10000 | 3956270 | 25.92 | 60.30 |
| before | 20000 | 20000 | 7946270 | 25.97 | 80.57 |
| after | 5000 | 5000 | 1976270 | 25.90 | 51.11 |
| after | 10000 | 10000 | 3956270 | 25.90 | 60.23 |
| after | 20000 | 20000 | 7946270 | 25.91 | 80.36 |

PostgreSQL process RSS above is separate from worker RSS. Backend shared buffers
can be counted in multiple processes; these samples are not a summed PostgreSQL
server/cgroup memory total. Heap snapshots were not produced under the guard.

## 4. Verified memory mechanisms and remaining uncertainty

Two isolated changes:

1. Release the bootstrap transaction reference after commit. The overridden
   server.listen closure previously retained its immutable boot context.
   Current release: runtime.cjs:307.
2. Transfer owned driver rows into per-file buckets, decode them and release each
   bucket. This removes the extra shallow row copy and repeated whole-graph
   filters without changing the decoder or its deep-copy semantics.
   Current implementation: repository.cjs:84.

At 5,000 and 10,000 posts, the post-GC live set is smaller. The two changes were
measured together; their individual contributions were not separated by an
ablation experiment. The retained bootstrap reference and duplicate allocation
sites are source-confirmed, but neither explains every byte of RSS.

Large full-graph hydration, decoded application objects, JSON buffers and full
response construction still coexist. The 20,000-post no-forced-GC scenario still
hits the guard. The corrected profile bursts complete before the later full-feed
check fails; that is not a completed full workflow.

Do not infer a permanent leak solely from high RSS, or infer bounded RSS from
low post-GC live heap. V8 collection timing, temporary graph copies and allocator
retention are not fully disentangled. No heap-size increase, forced application
GC, unrelated-media shortcut, native write, pagination or post truncation was used.

## 5. Changed-file inventory and preservation

- .agents/memory/MEMORY.md
- .agents/memory/compatibility-runtime-safety.md
- development/postgres/repository.cjs
- development/postgres/runtime.cjs
- .agents/memory/memory-evidence-boundaries.md
- scripts/postgres/phase2d-forensics.cjs
- scripts/postgres/phase2d-load.cjs
- scripts/postgres/phase2d-regressions.cjs
- scripts/postgres/phase2d-report.cjs
- scripts/postgres/phase2d-stage-probe.cjs
- scripts/postgres/phase2d-tests.cjs
- scripts/postgres/phase2d-worker.cjs
- reports/POSTGRESQL_PHASE2D_RELIABILITY_REVIEW.md

Ignored evidence, frozen diagnostic source snapshots and the downloadable HTML
are in generated-artifacts/phase2d. Three original suite files match their
checkpoint bytes. Eleven production-source fingerprints and seven previous
evidence/source hashes match. Temporary test ports were removed; complete
.replit content matches its checkpoint. Earlier report/evidence paths were not
used as output destinations.

## 6. Before/after resources and repeated requests

| Posts | Observed peak RSS MiB | Sampled peak heap MiB | Post-feed GC live heap MiB | After external / buffers MiB | After scenario |
| --- | --- | --- | --- | --- | --- |
| 5000 | 176.25 → 182.88 | 63.17 → 70.46 | 12.42 → 9.56 | 11.50 / 9.29 | COMPLETED |
| 10000 | 221.05 → 213.61 | 80.08 → 80.76 | 14.98 → 9.59 | 10.94 / 8.73 | COMPLETED |
| 20000 | 384.57 → 391.68 | 262.45 → 250.89 | NOT MEASURED → NOT MEASURED | 24.50 / 22.30 | NOT COMPLETED |

Peak RSS does not improve consistently: the 5,000-post run is higher after the
change, the 10,000-post run is lower, and both 20,000-post runs stop. The measured
improvement is the smaller live heap at completed sizes, not a claim of universal
RSS reduction. Small overshoots above 384 MiB are monitor/termination latency,
not a raised limit.

| Posts | 20 identical requests | Post-GC growth bytes | Result |
| --- | --- | --- | --- |
| 5000 | 20 | 54848 | PASS |
| 10000 | 20 | -985560 | PASS |
| 20000 | NOT RUN | NOT MEASURED | NOT COMPLETED |

The new finite-window assertion allows at most 1 MiB growth for runtime/observer
noise. It does not weaken an existing assertion, establish zero allocations or
prove leak freedom over hours/days. No completed 20,000-post GC pair is claimed.

## 7. Controlled performance matrix

All fixtures: 1,000 employees, invented posts, unchanged 384 MiB worker RSS guard,
512 MiB controller guard, bounded request/fixture deadlines. Each row is one
burst, not sustained load. Successful latency excludes admission rejection.
Throughput columns are successful responses/sec and all completed attempts/sec.

| Mode | Posts | Concurrency | Attempted | Succeeded | Admission rejected | Other failed | p50 ms | p95 ms | Success/s | Completion/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | 5000 | 10 | 10 | 10 | 0 | 0 | 205.64 | 277.75 | 33.22 | 33.22 |
| before | 5000 | 25 | 25 | 25 | 0 | 0 | 270.75 | 466.69 | 49.83 | 49.83 |
| before | 5000 | 50 | 50 | 32 | 18 | 0 | 285.42 | 531.87 | 56.47 | 88.24 |
| before | 10000 | 10 | 10 | 10 | 0 | 0 | 140.45 | 229.30 | 40.17 | 40.16 |
| before | 10000 | 25 | 25 | 25 | 0 | 0 | 273.34 | 454.93 | 50.93 | 50.93 |
| before | 10000 | 50 | 50 | 32 | 18 | 0 | 327.35 | 550.56 | 54.64 | 85.38 |
| before | 20000 | 10 | 10 | 10 | 0 | 0 | 142.64 | 244.85 | 36.81 | 36.81 |
| before | 20000 | 25 | 25 | 25 | 0 | 0 | 307.66 | 530.70 | 43.86 | 43.86 |
| before | 20000 | 50 | 50 | 27 | 18 | 5 | 342.98 | 593.57 | 40.76 | 75.48 |
| after | 5000 | 10 | 10 | 10 | 0 | 0 | 126.44 | 205.43 | 43.93 | 43.93 |
| after | 5000 | 25 | 25 | 25 | 0 | 0 | 249.79 | 433.03 | 52.92 | 52.92 |
| after | 5000 | 50 | 50 | 32 | 18 | 0 | 331.38 | 573.27 | 52.65 | 82.27 |
| after | 10000 | 10 | 10 | 10 | 0 | 0 | 131.51 | 215.28 | 42.92 | 42.92 |
| after | 10000 | 25 | 25 | 25 | 0 | 0 | 263.60 | 440.99 | 52.49 | 52.49 |
| after | 10000 | 50 | 50 | 32 | 18 | 0 | 308.65 | 526.25 | 57.25 | 89.45 |
| after | 20000 | 10 | 10 | 10 | 0 | 0 | 139.35 | 225.58 | 40.97 | 40.97 |
| after | 20000 | 25 | 25 | 25 | 0 | 0 | 266.01 | 445.72 | 52.11 | 52.11 |
| after | 20000 | 50 | 50 | 32 | 18 | 0 | 362.87 | 640.90 | 46.95 | 73.35 |

Before 20,000: five transport failures occurred when the guard killed the worker
during the 50-request burst. After 20,000: profile bursts completed, with 18
intentional queue rejections at concurrency 50; the subsequent full-feed portion
hit the guard. Both complete scenarios remain NOT COMPLETED. Guard termination
is not labeled a database-integrity failure or intentional admission rejection.

| Mode | Posts | Profile query count p50 | Advisory p50 / p95 ms | Pool p50 / p95 ms | Transaction p50 ms |
| --- | --- | --- | --- | --- | --- |
| before | 5000 | 58.00 | 0.39 / 0.91 | 0.07 / 0.11 | 17.71 |
| before | 10000 | 58.00 | 0.41 / 0.80 | 0.07 / 0.14 | 18.00 |
| before | 20000 | 58.00 | 0.50 / 1.05 | 0.10 / 0.16 | 22.00 |
| after | 5000 | 58.00 | 0.40 / 0.69 | 0.07 / 0.13 | 18.01 |
| after | 10000 | 58.00 | 0.41 / 0.84 | 0.07 / 0.17 | 17.24 |
| after | 20000 | 58.00 | 0.41 / 1.00 | 0.07 / 0.18 | 18.89 |

Counts cover the primary request connection, not auxiliary outbox connections.
The query/hydration contract remains the Phase 2C profile slice; there is no new
native repository expansion. Full feeds are still complete, unpaginated responses.
Completed 5,000/10,000 feeds contain the exact seeded counts and about
3.84/7.68 MB decoded responses respectively.

## 8. Regression and reliability results

- Original unchanged HTTP suite: 56 PASS / 0 FAIL.
- Original unchanged hardening suite: 27 PASS / 0 FAIL.
- Original unchanged profile parity groups: 9 PASS / 0 FAIL.
- New background scenarios: 11 PASS / 0 FAIL.
- New finite memory checks: 2 PASS;
  20,000-post check NOT COMPLETED.

- PASS: All five real timer callbacks commit with attestation and advisory lock
- PASS: Duplicate trigger coalesces; repeated due-check creates no duplicate archive
- PASS: Failure after archive SQL rolls back all entities; retry succeeds once
- PASS: Crash during callback rolls back; process restart safely retries
- PASS: PostgreSQL disconnection refuses commit and next job recovers
- PASS: Concurrent job, HTTP update and existing account writer lose no updates
- PASS: Due event reminder sends one real notification across duplicate triggers
- PASS: Daily content regenerates once without duplicate posts or cards
- PASS: Unmapped entity write fails closed with no account/post changes
- PASS: Shutdown waits for active transaction; no incomplete commit acknowledgement
- PASS: Uninterruptible callback deadline retires worker; no partial archive commits

Backup success/duplicate/crash/retry tests explicitly enable backups only in the
owned test fixture. An initial test attempt assumed the default disabled fixture
would produce archives; those failed results were retained, the fixture setup
was corrected and the unchanged assertions passed. No application guard was
weakened or failure hidden.

The notification test creates an actual due invented event and requires exactly
one notification after duplicate callbacks. The daily-card test invalidates its
date/version and verifies nonempty regeneration without duplicate content.
The account race uses the existing full-entity test writer concurrently with a
real HTTP update and a held job; it is not a newly enabled native account writer.

Crash testing kills a callback after archive SQL but before COMMIT; PostgreSQL
disconnection rejects commit and the next job recovers. The 25-second held callback
test retires the worker and verifies no partial archive. An actual background
COMMIT-response-loss window and long-duration scheduler soak are not newly
certified; existing hardening commit-fault tests remain passing.

## 9. Remaining concurrency and scalability limits

- Global serialization and whole-entity writers remain necessary.
- Fifty-request bursts intentionally reject 18/50 under the existing queue cap.
- Full 20,000-post scenarios remain unsafe under this RSS budget.
- Sampled stage allocations are not a complete retained-object/allocator profile.
- The finite repeated-request window is not a long-running scheduler or leak soak.
- HTTP translation still uses its original transaction/model behavior.
- Unsupported storage dependency remediation and real provider/recovery guarantees
  remain outside this repair; their prior release blockers are not closed.

No frontend/browser journey or signed-in UI certification is inferred from these
HTTP tests. The public app is separately checked for basic rendering/readiness.

## 10. Development progression verdict

**CONDITIONAL GO: background repair and guarded 5k/10k development only.** The recurring backup defect is understood, reproduced
against the reference and corrected. All five implemented timer callbacks and
the targeted rollback/retry/crash/shutdown scenarios pass. Existing regression
assertions remain intact.

The 20,000-post full workflow is **NO-GO / NOT COMPLETED** under the same guard.
Fifty-user sustained capacity is **NOT CERTIFIED**. Do not broaden native
repositories/writers or silently increase memory based on these results.
Remaining allocator attribution and long-duration stability require separate
bounded investigation; this phase does not automatically begin that work.

## 11. Production verdict

**NO-GO.** No production data, storage, credentials, secret rotation, recovery,
migration, publication or production entrypoint/configuration changes occurred.
The schema and production safety fences remain unchanged. No advisory lock was
removed and no native write path was enabled.

## Evidence

generated-artifacts/phase2d contains background-before-detailed.json,
background-current.json, targeted-tests.json, load-before.json, load-after.json,
allocation-stage-probe.json, repeated-memory-checks.json, preservation-check.json
and verification/ for original suite outputs. Diagnostic source snapshots are
code-only reproducibility artifacts, not imported employee data.
