---
name: Diagnostic verification boundaries
description: Interpret aggregate blockers and test maintenance health without taking over workspace listeners.
---

An aggregate diagnostic BLOCKED status is not evidence that a later check ran
or that a secret is missing/mismatched. Preserve stage-specific, value-free
evidence rather than replacing keys or relaxing identity checks.

**Why:** A Production diagnostic discarded its failed prerequisite and exposed
only the aggregate status, making the exact cause unrecoverable from its logs.

**How to apply:** Report unreached checks as unverified. Distinguish presence/
format from original-key equality and configured TLS policy from negotiated TLS.
Keep only allowlisted PASS/BLOCKED status output.

Local diagnostic HTTP tests must own their listeners; use ephemeral ports and
verify Publishing's configured port argument separately.

**Why:** The configured public port can already belong to a running workspace
service. Rebinding it fails, and probing it would test somebody else's server.

**How to apply:** Do not stop existing workflows or redirect their ports merely
to run focused health tests. Check real HTTP on the test-owned listener.
