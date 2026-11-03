---
name: Feed pagination approval boundary
description: Why the private feed paging prototype must not be activated as an approved API.
---

The private feed candidate is diagnostic, not an approved HTTP integration. Keep the original full-feed API and UI unchanged until the user approves a versioned pagination contract and client behavior.

**Why:** The user explicitly required approval for default API/UI changes. Exact private response parity does not resolve server/client ordering, search, global widgets, cursor restarts or reduced global-statistics/media transaction dependencies.

**How to apply:** Do not interpret successful small raw-page benchmarks as full-application scalability or permission to wire the prototype into the runtime. Ordinal continuation needs a revision fence while legacy whole-entity writes can rebase positions. Fresh authorization and expiry checks remain mandatory on every page.
