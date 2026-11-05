---
name: Fresh PostgreSQL launch scope
description: Current directory-only fresh-install scope; supersedes the earlier eight-account migration requirement.
---

The current release is a fresh PostgreSQL installation: exactly 6,311 employees
from only the designated original bucket's employees.json and ZERO legacy
accounts, credentials, roles, signing keys, sessions, TOTP or social content.
Preserve source storage unchanged. Stop if source counts change.

**Why:** The owner explicitly changed from preserving eight accounts to a clean
launch with new registrations and fresh Production-only security keys.

**How to apply:** Do not reopen legacy key continuity, Vault or historical
migration investigations. Require explicit fresh-install authority, new keys,
verified employee ownership for registration and owner-only initial admin
bootstrap. No first-registrant administration or default password. Do not import
real employees into Development, write Production, or Republish automatically.

Do not repeatedly request already-approved administrator, email-domain, launch
audience or existing-provider reuse decisions; consult the current approved
manifest instead. Keep genuinely unavailable technical evidence and separate
live-operation approvals distinct from those final business decisions.

**Why:** The owner explicitly finalized these business selections and directed
that they not be requested again while completing the fresh launch.

**How to apply:** Reuse existing SMTP adapters, keep unverified delivery
blocked, and never invent provider credentials, recipient approvals or missing
employee ownership information to make a readiness check pass.

Fresh registration uses badge, a new password and an SMTP code to the exact
employee's independently associated company email. Phone/SMS and mandatory TOTP
are removed from registration; TOTP is optional afterward. The previous
verification method was Authenticator/TOTP, not SMS.

**Why:** The owner explicitly simplified fresh registration while requiring
protection against claiming somebody else's badge with an arbitrary company email.

**How to apply:** Do not guess missing addresses or treat company-domain ownership
alone as employee ownership. Block absent/ambiguous trusted associations. Real
SMTP delivery to an approved recipient must precede public registration. Preserve
unrelated modules and the separate approved administrator bootstrap.

Keep the new PostgreSQL implementation. Do not restore the legacy application
or switch back to JSON authority; recovery must preserve this release direction.

**Why:** The owner explicitly ruled out legacy rollback while finalizing the
PostgreSQL release.

**How to apply:** Keep failures in maintenance and require reviewed forward
recovery, not an application-authority fallback or a destructive reset.

The old identity mismatch remains unresolved and the old identity guard must
remain intact. A separately reviewed new-installation environment/database/bucket
binding may authorize the fresh path; it is not proof that the old identity matches.

**Why:** The owner authorized a clean launch, not fabrication of an old runtime
identity or another attestation framework.

**How to apply:** Keep new-install authority and approvals explicit and separate
from legacy migration/adoption. Normal startup must never auto-provision an
empty database or fall back to JSON authority.

The owner selected Publishing's “Create production database” ON and “Set up
production database with current development data” OFF. The owner approved a
temporary maintenance window and preparing the next-publish maintenance-only
build/run configuration, but not executing Republish, migration or activation.

**Why:** The owner requested reversible, isolated preparation while preserving
the existing source, deployment configuration, app/URL and employee App Storage,
and prohibiting any Development test-record copy.

**How to apply:** Distinguish selected UI values from verified persisted
settings and actual provisioning. Confirm the effective no-copy Publishing
plan for this project's backend before publishing. If no-copy creation cannot
be confirmed, report BLOCKED. Maintenance approval never authorizes real-data
import or SQL activation; those require their separate exact approvals.

Treat edits in Publishing's Production app secrets as PENDING until a successful
publication and verification inside the actual new deployment.

**Why:** The owner observed the UI warning that secret changes are saved only
after a successful publish. Secret-existence metadata alone did not establish
that the running process received the values.

**How to apply:** Do not label pending entries APPLIED, infer that operator
entry failed from a pre-publish existence check, or ask for duplicate entries.
Use a protected in-process comparison after an approved maintenance-only
publication; never substitute workspace keys or print secret values.

Diagnostic output must use allowlisted, value-free execution states that
distinguish skipped checks from missing/invalid dependencies, never credentials,
key values, account records, fingerprints or raw diagnostic data.

**Why:** The owner explicitly restricted diagnostic output, then required
distinguishing skipped checks from missing/invalid dependencies.

**How to apply:** Keep diagnostics in maintenance mode on success or failure
and project output through a fixed status allowlist; do not log arbitrary
results or exception details.
