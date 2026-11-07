---
name: Compatibility runtime safety
description: Why the development SQL adapter must retain serialization and retire timed-out workers.
---

Do not remove global request serialization merely to improve benchmark results or increase the pool size. Move all legacy mutable graphs and asynchronous callbacks into properly isolated request scopes first.

**Why:** The imported application retains mutable module-level state. Refreshing it from transactional SQL does not make overlapping handlers safe. Abandoning a promise does not cancel the handler; a late callback could otherwise mutate the next transaction's state.

**How to apply:** Bound admission and waits while this compatibility architecture remains. After an uninterruptible handler deadline, refuse both HTTP and background work and retire the worker rather than reusing its context. Treat this as a development safety measure, not production high availability. A native concurrency redesign needs independent review and race/failure evidence before removing the lock.

Apply that fail-stop rule to scheduled callbacks too. Catch acquisition, attestation and hydration failures as well as callback failures; coalesce repeat ticks while the same callback is queued or active.

**Why:** A request-only deadline does not protect the shared context from an uncancelled scheduled callback. A disconnected client can also fail before a transaction context exists, so catching only the callback is insufficient.

**How to apply:** Keep timer ownership explicit, stop triggers before draining on shutdown, and distinguish successful commit, rollback and skipped duplicate triggers. Do not acknowledge an unfinished callback or treat an abandoned promise as cancellation.

Treat a listening socket and committed application readiness as separate
states. Startup failure must settle the readiness waiter, and uncancellable
startup work must retire the worker rather than overlap another attempt.

**Why:** A listener can open before boot persistence finishes. Swallowing a
post-listen failure leaves the public maintenance gateway waiting indefinitely;
background jobs must not compete with the boot transaction.

**How to apply:** Preserve maintenance until successful commit, bound startup,
and use value-free stage diagnostics. When testing remote-SQL startup, account
for per-row network round trips, not just fast local PostgreSQL timings.

Transaction disposition is not the same as operation acceptance or response
delivery. Do not interpret a registration `COMMITTED` event as account creation
without its HTTP result, or a generic posting failure as proof of rollback.

**Why:** Rejected registration can commit abuse-protection state, while a
successful post can commit before its HTTP response is lost. Existing Production
logs did not distinguish those outcomes, and isolated tests reproduce the latter.

**How to apply:** Separate commit status, accepted HTTP outcome and delivery.
Preserve the original idempotency key for an unchanged uncertain retry; never
blindly create a new request to resolve an ambiguous committed operation.
Response replay may legitimately be refused after another transaction or restart
changes its revision scope. Assert duplicate prevention and persisted identity in
those tests, not unconditional cached-response success; preserve that guard.

A coarse startup phase timeout does not identify the awaited operation that
stalled. A read-only replica cannot attest live application lock or pool waits.

**Why:** Production startup evidence exposed only an aggregate hydration
deadline. Local success and replica metadata were insufficient to establish
whether the live process was waiting for a connection, lock, protocol read,
decoding or storage.

**How to apply:** Keep those sub-stages separately timed, distinguish synthetic
latency measurements from Production root-cause evidence, and coalesce test
readiness probes so slow serialized reads do not create a probe flood.

Even a client `READ_TIMEOUT` labelled `ADVISORY_LOCK` does not prove that the
server was blocked on a granted advisory lock. SQL backend identity also does
not attest a VM or release identity, particularly through transaction pooling.

**Why:** A client deadline identifies an unanswered call, not its server-side
wait event or owner; successful later acquisitions do not identify an earlier
holder.

**How to apply:** Require contemporaneous primary lock/activity/blocker
evidence before assigning a live holder or changing concurrency behavior.
Correlate deployment/instance evidence independently; a replica or a backend
start timestamp cannot supply that mapping.

Bound the whole serialized operation, not just its handler, and coalesce
outbox ticks while queued as well as while active. Queue-admission expiry must
also revoke the queued callback's right to execute.

**Why:** A callback-only timeout excludes acquisition, hydration and commit.
An uncoalesced periodic job can accumulate behind those waits, leaving HTTP
requests pending before their own timeout even starts.

**How to apply:** Keep a separate admission deadline and full-operation
watchdog. Retire uncancellable active work rather than reusing its mutable
scope. Test queue expiry, stalled acquisition, and ambiguous committed
registration recovery; encrypted challenge-state presence alone does not
establish whether a pending registration exists.
