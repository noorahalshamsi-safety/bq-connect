# Minimal employee/account release

This path is independent of REL-001. It does not inspect Vault, archives or
historical media. Its only live operation during preparation was a designated,
read-only, memory-only source inspection. No real records were written to a
development database or workspace data files.

## Source and retained dependencies

The owner-designated **currently configured App Storage** must contain exactly
**6,311 employees, eight account entries and eight registered credentials**.
The Workspace three-account JSON is never an input. Any count change stops
execution and reports aggregate counts; no filtering to force the expected
number is permitted.

Read only these `data/` files:

* `employees.json`, `accounts.json`: preserve complete records, original ID
  types and credential/security extensions, hashes, salts, KDFs, versions,
  sessions, active TOTP, pending TOTP and recovery material.
* `session.key`, `backup.key`: require the existing effective keys. Never
  generate replacements or put their values in reports, source control or
  plaintext SQL. Production Secrets must contain those same original keys.
* `security.json`, `moderators.json`: original role grants, official identity
  definitions and authentication policies. Official accounts need not have
  invented employee-directory rows.
* `conduct.json`: retain these eight accounts' warnings, bans and reset
  restrictions plus security-policy settings, not other users' history.
* `sms.json`, `smtp.json`: existing verification/delivery configuration.
  Preserve any existing deployment-side provider/verification secrets too.

Posts, stories, highlights, comments, reactions, groups, memberships, follows,
messages, notifications, profiles, historical push subscriptions and media
start empty. The original bucket and its history remain untouched.
Automatic experimental backup scheduling stays disabled; this is not an
investigation or migration of historical backup archives.

## Safety and runtime behavior

* A real-source capsule cannot be imported into Development or a local test
  database. Synthetic tests use a disposable local PostgreSQL instance, not
  the managed Development database.
* Production requires the existing managed production identity/TLS/schema/
  role/approval gates, original-key fingerprints, a separately approved
  minimal-import binding, source membership fingerprints and freeze evidence.
  Both approval files are deliberately unapproved in this handoff.
* No startup schema DDL, automatic source adoption, local JSON fallback,
  reset/truncate option or arbitrary destination URL exists here.
* One transaction, advisory locks and independent direct-SQL employee/account
  membership digests guard the import. All decoded files are reconciled
  against the minimal projection, including full credential records.
* A nonempty destination is refused, including Development fixture copies.
  Never erase those rows to make this importer pass.
* Same-source replay checks the committed marker and never rewrites subsequent
  SQL account changes. Source drift, foreign bindings or missing/ambiguous
  provisioning metadata fail closed.
* A separate NEW, approved target bucket holds immutable intent/receipt
  markers and future media. It cannot be the original source bucket.
  Unknown intent acknowledgement with no SQL marker needs operator recovery;
  it is not permission to reseed or delete control metadata.
* A fresh source read immediately before commit must still match the approved
  source. Two matching reads are observational stability, **not a write freeze**.
* Original session/recovery/TOTP domains remain unchanged. Unfinished
  pre-cutover login/reset challenge tickets are excluded by a dataset-scoped
  ticket domain, because the old process's used-ticket ledger is not in App
  Storage. Users can restart an unfinished challenge; authenticated sessions
  and original factor secrets are not reset.
* Email and SMS use encrypted durable outboxes and real SMTP/strict-TLS HTTPS
  transports after commit. Failures remain pending, with backoff, not fake
  delivery receipts. Provider acknowledgement is at-least-once; uncertain
  acknowledgement can cause duplicate delivery. Actual provider credentials
  and real deliveries have not been certified by these mock-provider tests.
* No replacement VAPID keys are generated. Push enrollment explicitly remains
  unconfigured in this limited release; login, registration, email/2FA and
  directory routes use the original application handlers.

## Supported lifecycle — blocked before any real change

Use **Replit-managed PostgreSQL for the existing BQ Connect application**.
Do not substitute an external database or publish a new employee-facing app.

Official documentation distinguishes current managed production provisioning
from the **legacy Neon** publishing switches. Do not assume the legacy
“copy development data” switch exists for current managed PostgreSQL.
Current managed Production is provisioned through Publishing; the workspace
has no verified, approved standalone/no-copy provisioning path.

The existing managed Development database has synthetic data. **Do not
blindly Publish it or let those fixtures be copied to Production.** The owner
and platform must first verify a supported schema-only/empty-destination
path and approve the exact resource/publish action. Do not reset Development
or delete Production rows as an unapproved workaround.

References:
* https://docs.replit.com/features/data-and-storage/development-and-production
* https://docs.replit.com/build/troubleshooting

The maintenance listener returns `GET /` and `/health/live` HTTP 200 for
Replit's publishing liveness check, with `ready:false`. `/health/ready`,
login and all application APIs stay 503. Liveness is not successful adoption.

## Exact remaining execution sequence

1. **Approve provisioning, not import.** Confirm the existing BQ Connect app
   identity and supported no-fixture-copy lifecycle. Obtain approval before
   any production resource change or Republish. Provision only the approved,
   empty schema destination and a distinct new target/control-media bucket.
   A future maintenance-only run command is:
   `node deploy/managed/minimal-import-runner.cjs`
   with `BQ_MINIMAL_OPERATION` unset. It does not import or serve login.
2. **Verify the actual destination.** Bind the actual production app, endpoint,
   strict TLS identity, permissions, 117-table schema, empty application/control
   tables and new bucket in the existing managed production manifest. No
   synthetic rows or foreign authority may be present. Use protected operator
   access; do not export connection strings into chat or Development.
3. **Preserve key custody.** Through protected Production Secrets transfer the
   original source session/backup keys to `BQ_MANAGED_SESSION_KEY` and
   `BQ_MANAGED_BACKUP_KEY`; retain existing provider/verification settings.
   Configure a separate stable 64-hex `BQ_MINIMAL_AUDIT_KEY` for keyed membership/
   source bindings. That audit key is not a replacement authentication key.
4. **Freeze and bind the actual source.** Stop/drain all original App Storage
   writers, keeping the source intact. In a protected read-only preparation
   process, run `node scripts/managed/minimal-bindings.cjs <designated-config>`.
   It returns only counts, fingerprints and nonsecret bucket identity; no
   records/key values. Merge its `keys`/`minimal` fields into the production
   manifest; replace `freezeEvidence:null` with verified freeze evidence equal
   to `release.frozenGeneration`. Complete the existing release evidence only
   for this minimal scope, not discarded history. Recheck exactly 6,311/8.
5. **Approve that exact execution.** Review the frozen-source fingerprint,
   memberships, original-key continuity, empty target, cutover/recovery plan
   and full manifest. Bind `managed-production-activate` in
   `deploy/managed/production-approvals.json` and the separate operation
   `minimal-employee-account-import` in `migration/minimal/approvals.json`,
   with approved identities and expiry. The latter binding is
   SHA-256(canonical({manifest, source:manifest.minimal.sourceFingerprint})).
   Do not fabricate approvals, generic “force” flags or evidence.
6. **Import once while remaining in maintenance.** Only after that approval,
   run `node migration/minimal/execute.cjs` in a protected published process,
   or use the dedicated published run command
   `node deploy/managed/minimal-import-runner.cjs` with the explicit production
   setting `BQ_MINIMAL_OPERATION=owner-approved-import-once`.
   `BQ_MANAGED_MANIFEST_FILE` must reference that exact approved manifest.
   The runner remains in maintenance after success/failure and never retries
   a live import automatically. Verify committed counts, memberships,
   source stability and the independent target receipt. No DDL is executed.
7. **Approve/activate the existing application.** Remove the one-time import
   operation; after the exact activation approval change the published run
   command to `node deploy/managed/minimal-bootstrap.cjs`. Missing/mismatched
   gates keep maintenance, never expose fixtures/JSON fallback. Perform the
   owner's original-password/TOTP, role and directory canaries and monitor
   readiness/provider delivery. Real passwords must never enter this agent's
   context. After accepted SQL writes, do not roll back to the stale source
   JSON; keep SQL authoritative and use the approved forward-recovery plan.

Nothing in this runbook grants permission to execute those production steps.

## Focused verification

```sh
node scripts/managed/minimal-tests.cjs
node scripts/managed/minimal-cutover-tests.cjs
node scripts/managed/config-test.cjs
node scripts/staging/object-store-test.cjs
```

These are synthetic tests. The preexisting broad 236-check suite, Vault,
full-history and historical-media audits were not repeated.
