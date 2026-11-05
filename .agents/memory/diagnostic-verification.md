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
Keep only allowlisted, value-free execution states, not arbitrary results or
exception details.

Local diagnostic HTTP tests must own their listeners; use ephemeral ports and
verify Publishing's configured port argument separately.

**Why:** The configured public port can already belong to a running workspace
service. Rebinding it fails, and probing it would test somebody else's server.

**How to apply:** Do not stop existing workflows or redirect their ports merely
to run focused health tests. Check real HTTP on the test-owned listener.

Do not request another diagnostic publication solely to discover which
Production identity prerequisite failed. Identify and address that cause first.

**Why:** The owner explicitly required this after repeated diagnostic
publication cycles. A workspace identity match cannot prove the deployed
process received the same identity; deployment metadata did not expose it.

**How to apply:** Do not override the runtime-managed REPL_ID, auto-rebind the
expected identity, or treat the workspace Shell as Production process access.
If protected deployed-process inspection is unavailable, report that limit
and stop rather than requesting another speculative publication.

Any alternative Production identity attestation must use independently
authenticated deployment metadata and proof tying the running workload to
that metadata, not a workspace ID, user-provided UUID or copied binding alone.

**Why:** The owner explicitly required independent verification for alternatives,
while retaining authentication, TLS, permissions and source/bucket authority.

**How to apply:** Keep alternatives disabled until the provider trust source
is established. A production-only binding alone is replayable and does not
prove which workload received it.
