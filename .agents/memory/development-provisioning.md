---
name: Development provisioning invariants
description: Why empty SQL state must not authorize a new dataset or replacement keys.
---

An empty or unreachable database is not evidence that fresh provisioning is allowed.
Keep provision evidence independent of SQL contents, and bind dataset identity to
both signing and backup key domains. Missing bootstrap metadata must stop startup,
not generate replacement material.

**Why:** During development integration, the same bootstrap branch could otherwise
interpret loss of an already-provisioned schema as a fresh synthetic install.
The migration's primary requirement is preventing silent replacement/loss, even
in invented-data tests.

**How to apply:** Preserve these invariants in future entrypoints, migrations,
recovery/adoption tools and tests. Treat fresh provision, normal restart and
operator-authorized recovery as separate decisions; never infer one from empty
tables or a generic activation flag.
