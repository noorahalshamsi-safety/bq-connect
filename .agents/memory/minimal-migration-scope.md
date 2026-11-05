---
name: Minimal migration scope
description: Owner-approved account-only scope and authentication handoff constraints for BQ Connect.
---

For the current production migration, preserve only the 6,311 employee-directory
records and eight registered accounts from the currently configured App Storage,
their credentials, roles/security, original authentication secrets, factors and
essential relationships. The Workspace three-account copy is never authoritative.
If the source counts change, stop and report rather than discard records.

**Why:** The owner said BQ Connect is experimental, historical social content is
not required, and explicitly stopped full historical migration/backup investigations.

**How to apply:** Use the owner's designated source rather than reopening broad
source/Vault/media investigations. New social tables may start empty. Dropping
history from migration scope never permits deleting or overwriting the source,
resetting the published app, exposing credentials, importing real records into
Development, or live migration/resource changes/Republish without verified
destination/key continuity/cutover behavior and exact owner approval.

Keep original authenticated-session, recovery and TOTP domains during this
handoff, but exclude unfinished pre-cutover challenge tickets.

**Why:** The old process's used-challenge ledger is not in App Storage. Reusing
its old challenge domain without that ledger could permit an already-consumed
challenge to be accepted again; rotating the original session key would instead
break the account continuity the owner requires.

**How to apply:** Scope new challenge signatures to the destination dataset,
keep that scope stable across restarts, and let users restart unfinished
challenges without replacing their account credentials or factor secrets.

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
