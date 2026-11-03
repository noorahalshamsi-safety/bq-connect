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
