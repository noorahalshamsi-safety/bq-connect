---
name: Dependency upgrade boundaries
description: Why the storage dependency advisory was not addressed with an unsupported major override.
---

Do not force a new storage-client major or a UUID major solely to clear the dependency audit. Prefer a supported parent-SDK upgrade; otherwise retain the explicit open finding until compatibility and provider regression evidence justify a reviewed change.

**Why:** The upstream storage client had a newer major outside the object-storage SDK's declared dependency range. The reviewed multipart callers used UUID v4, but that narrower reachability observation did not remove the installed package advisory or establish SDK compatibility with a forced upgrade.

**How to apply:** Recheck current registry metadata and the current advisory rather than trusting old version numbers. Distinguish offline API/import checks from real storage-provider CRUD and credential/environment tests. Do not mark an advisory fixed without an actual supported dependency change and regression evidence.
