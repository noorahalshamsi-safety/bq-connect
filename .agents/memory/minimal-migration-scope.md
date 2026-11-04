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
production database with current development data” OFF, but preparation must
not save/change deployment settings, provision resources or Republish.

**Why:** The owner requested final execution preparation only, preserving the
existing app and URL and prohibiting any Development test-record copy.

**How to apply:** Distinguish selected UI values from verified persisted
settings and actual provisioning. Confirm the effective no-copy Publishing
plan for this project's backend before requesting authorization to execute;
keep build/run proposals inert until approved.
