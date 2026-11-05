---
name: Read-only SQL configuration effects
description: Platform SQL verification may change local toolchain configuration despite issuing only a SELECT.
---

A read-only SQL callback is not necessarily workspace-configuration-neutral.

**Why:** During a design-only database compatibility check, the platform added a PostgreSQL module and Nix channel to `.replit` while executing only a development metadata SELECT. No application schema or records were written, but the configuration side effect required restoration.

**How to apply:** For read-only/design-only assignments, compare configuration before and after platform SQL checks. Preserve unrelated user changes and restore unintended toolchain additions through the supported configuration validator, not direct `.replit` edits. Do not equate SQL read-only status with an unchanged workspace or with production database certification.

Production SQL metadata does not attest the published application's connection
hostname or TLS session.

**Why:** Supported Production queries use a read-only replica/proxy. It reported
a backend/proxy address and SSL off even though the application's external
connection endpoint and strict TLS had not been observed.

**How to apply:** Use the results for the queried role's catalog permissions
and schema evidence, not as a hostname or proof that application TLS is
unsupported. Obtain actual connection details from Production Database Settings
and retain strict TLS checks. Never infer a hostname from the replica address.
