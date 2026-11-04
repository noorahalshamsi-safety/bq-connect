# Final production preparation

## Production database creation method

Use Publishing on the **existing BQ Connect application**, retaining
https://bq-connect.replit.app. Do not create a replacement application.
Owner-selected choices are **Create production database ON** and
**Set up production database with current development data OFF**.
For the documented Publishing UI exposing these options, this selects database
creation without copying Development records. Production schema is applied by
the reviewed development-to-production schema diff during Publish.
Never use a build hook, startup DDL, custom production schema installer or
Development-data overwrite.

Replit documentation qualifies these named switches as legacy Neon UI; current
managed infrastructure provisions Production automatically during Publishing.
Consequently the visible option labels alone do not certify the backend or the
effective no-data-copy plan for this project. Require the actual Publishing
review to confirm an empty/schema-only destination before executing.

The read-only Production database check returned **“This project has no
production database.”** This establishes no database provisioned through that
interface, not whether settings have been saved. Available deployment metadata
does not expose saved database-copy settings or pending browser form state.
**Saved versus pending is unverified.** Check the persisted Publishing review,
not merely the current toggle appearance. Do not save or publish in this task.

References:
- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/publish-database-changes

## Production runtime readiness

Verified remote branch `development/minimal-accounts-2026-11-04` resolves to
`cd5bd760a3b1d4a663d9a41c0479a58e36f02dd9`; isolated source worktree is clean.
Active workspace remains `529ebe5`, with existing production build
`npm install --omit=dev` and run `node start.js`. Merely publishing this active
workspace would **not** select the minimal migration runtime.

Two inert deployment-section templates are supplied alongside this file:
`maintenance.deployment.toml` and `activation.deployment.toml`.
Both target the existing VM deployment and use `npm ci --omit=dev`.
The source package manifest and lockfile root dependencies match; Node >=22
is declared. No dependency installation or broad test suite was repeated.
These templates reference source-root files. Do not point Publishing at the
ignored generated-artifacts worktree or replace the whole .replit file with a
deployment-section snippet.

Initial run command: `node deploy/managed/minimal-import-runner.cjs`, operation
unset. Root/liveness return 200 with ready:false; readiness/login stay 503.
No import or application activation occurs by default.
Final run command: `node deploy/managed/minimal-bootstrap.cjs`; activation
requires verified database, keys, approvals and independent import receipt.
No schema DDL runs from either command. Code preparation is ready; actual
production startup and provider deliveries remain unverified.

Read-only catalog attestation exactly matched the existing managed Development
release contract: **117 tables, 800 columns, 423 constraints, 348 indexes,
zero invalid indexes and zero unvalidated constraints**.
Schema fingerprint:
`bb2ddae82613494ce98dba922e53eedbe98f872f9d0cfabb552db4c9dc49df76`.
Release fingerprint:
`3c93e9cdcee602f95ffbadd453c4aac885d8d973b634c409531af580c4aee768`.
Publish must reproduce this complete structural contract, not just table count.
An empty schema-migration ledger is supported by structural attestation.
Production structure cannot yet be attested because that database does not exist.

## Migration readiness

The existing minimal importer is prepared; no new importer or historical audit
is needed. Prior designated-source inspection observed 6,311 employees and
8 registered accounts; these are prior observations, not a fresh frozen snapshot.
Execution must freshly require those exact counts and keyed memberships.
Preserve complete hashes/salts/KDF versions, typed account IDs, roles, security
settings, original session/recovery/TOTP domains, active and pending factors.
Restart unfinished pre-cutover challenges; do not replace authentication keys.
Historical social tables start empty; original App Storage remains intact.

The importer requires the exact actual production endpoint/app/TLS/permissions,
schema fingerprint, original-key continuity and a NEW distinct target bucket.
The source is the owner-designated configured App Storage, not workspace JSON.
No actual target identity or key custody is attested yet. Do not reuse a
Development manifest or synthetic dataset/keys/authority as production evidence.
Source freeze must stop and drain every writer; matching reads alone are not
a freeze. Import performs no DDL, refuses nonempty targets, reconciles direct
SQL memberships and decoded credentials, and records independent intent/receipt.

## Exact next operator action

**Review the existing application's persisted Publishing configuration without
clicking Publish. Confirm no-data-copy in the effective provisioning review,
then obtain owner approval for the source/configuration adoption and first
maintenance-only Republish. No such approval is supplied by this preparation.**

Once separately authorized, the exact sequence is:

1. Adopt the verified remote source into the existing app's publishable source,
   preserving app/domain identity and existing protected provider settings.
   Apply only the maintenance deployment section. Keep BQ_MINIMAL_OPERATION
   unset. Confirm create database ON / Development data copy OFF, or the
   current managed equivalent explicitly guaranteeing no record copy.
   Review the complete 117-table schema diff and stop on unexpected changes
   or any data-copy operation. Owner clicks Republish only after authorization.
   This first publish intentionally replaces the serving app with maintenance;
   it is a real cutover/downtime action, not a harmless preview.
2. After schema provisioning, read-only attest actual production endpoint/app,
   TLS and permissions, full structural fingerprint, and empty application and
   control tables. Verify a separately approved NEW target/control-media bucket.
   If fixtures appear, stop: no truncation/reset workaround.
3. Through protected Production Secrets custody, retain/transfer the original
   BQ_MANAGED_SESSION_KEY and BQ_MANAGED_BACKUP_KEY values and original delivery/
   verification configuration; establish separate stable BQ_MINIMAL_AUDIT_KEY.
   Never reveal values in chat, reports, Git or Development.
4. Freeze/drain every designated-source writer, including older deployments.
   Run the existing protected read-only
   `node scripts/managed/minimal-bindings.cjs <designated-config>`.
   Complete the production manifest's real endpoint/bucket/schema/permissions/
   custody fields and minimal source/membership bindings.
   Set minimal.freezeEvidence equal to release.frozenGeneration with real
   evidence; verify fresh 6,311/8 counts. Obtain exact, expiring activation
   approval in deploy/managed/production-approvals.json and separate
   minimal-employee-account-import approval in migration/minimal/approvals.json.
   These approvals must bind that manifest; do not invent them.
5. Set BQ_MANAGED_MANIFEST_FILE to the protected approved manifest.
   Only with import authorization use the same published maintenance runner
   with BQ_MINIMAL_OPERATION=owner-approved-import-once.
   If the deployment needs a Republish to load these files/settings, obtain
   authorization for that Republish too. The published process, not workspace
   SSH, executes the import once. It stays in maintenance after success/failure.
   No automatic retry. Verify committed counts, exact memberships, credentials,
   original keys and independent target receipt before activation.
6. Remove BQ_MINIMAL_OPERATION. With exact activation authorization apply the
   activation deployment section and have the owner Republish the existing app.
   Verify readiness plus owner-controlled original password/TOTP/recovery,
   roles, session and directory canaries; check real provider acceptance.
   No owner passwords enter the agent's context.
7. Before any SQL adoption, restoring the old deployment is only permissible
   if no new SQL writes exist and freeze/source/intent state is understood.
   After import or ambiguous acknowledgement, investigate committed marker
   and receipt before retry. After any accepted new SQL writes, never revert
   to stale App Storage JSON. Keep SQL authoritative and use approved recovery.

## Blocking issue requiring a specific decision

The owner must confirm the effective saved no-data-copy provisioning plan and
approve **adopting the verified source plus the first maintenance-only
Republish**, accepting the maintenance interval on the existing URL.
If Publishing cannot guarantee no Development record copy for this project's
database backend, stop and obtain a supported no-copy provisioning route before
any publish. Do not substitute an external database or reset Development.

Production resource identities, original-key custody, frozen-source manifest
and exact import/activation approvals remain subsequent mandatory gates.
This task changed no active source/configuration, deployment setting, secret,
database record, live resource or serving deployment. No real import, source
write, resource creation, Republish or push occurred.
