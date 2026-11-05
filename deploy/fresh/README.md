# BQ Connect: fresh PostgreSQL launch

**Scope:** import the original directory's 6,311 employees, zero legacy accounts.
Do not copy old credentials, signing keys, sessions, TOTP, roles, posts, groups,
comments or messages. Original App Storage is read-only and never becomes runtime
authority. Existing PostgreSQL repository, schema, auth, scrypt password hashing,
MFA, role checks, SQL transactions and application handlers are reused.

## New installation binding — review before approval

This path does **not** resolve or bypass the old REPL_ID mismatch. The old
`verify()` and minimal-adoption path remain unchanged. `verifyFresh()` is an
explicit separate authority for a new installation:

- Actual published marker `REPLIT_DEPLOYMENT=1`.
- Owner-reviewed manifest hash in Production configuration, covering exact
  neondb/dev host, port, role, dataset, source/control buckets, source-directory
  digest, schema/release/permission fingerprints, administrator badge and email
  policy. Do not substitute a Development endpoint.
- Three new Production-only keys, never the legacy key variables.
- Independent control-bucket intent/receipt and SQL installation marker. Their
  seal binds the new installation key, fresh session/backup key fingerprints,
  dataset and approved manifest. A changed/missing key cannot reprovision.
- Verified TLS with hostname/certificate verification, fixed Production
  database identity, reviewed role capabilities and exact existing schema.

This is an owner-approved **fresh installation** trust model. A copied manifest
alone cannot adopt a database without the fresh keys and matching independent
receipt. It is not platform runtime attestation and makes no claim that
Workspace and Production REPL_ID values match. No new attestors are needed.

## Preparation completed versus pending

`production.json` is a **draft**, not a launch approval. Source preparation
downloaded only `data/employees.json` through an explicit original bucket client,
validated exactly 6,311 records, and retained only its SHA-256 in the draft.
No source records were saved to the workspace or copied into Development.

The following draft fields intentionally remain unapproved:

- `endpoint.hostname` and `endpoint.role`: owner must verify against the
  existing **Production** database's connection information. Do not paste a
  connection password into the manifest.
- `permissionsFingerprint` and `permissionApproval`: review actual Production
  role capabilities and set approval to `reviewed-managed-runtime-capabilities`.
- `initialAdminBadge`: owner-selected existing directory employee, not a
  fabricated administrator.
- `emailDomains`: approved company email domain(s), lowercase, without `@`.

The latest supported Production catalog results and exact permission fingerprint
are documented in `production-permission-review.md`. The observed role and
fingerprint are now populated in the draft, but owner privilege approval,
application hostname/TLS and owner policy selections remain pending.

Do not change the dataset after initialization or edit an already active
installation manifest casually; its hash and key seal are installation identity.
Do not populate fields from synthetic test output.

The capability fingerprint is SHA-256 of canonical sorted-key JSON returned
by the existing managed `permissions(client)` implementation. For review,
its exact read-only metadata query is:

```sql
SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,
 has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
 has_schema_privilege(current_user,'dev','CREATE') AS schema_create,
 EXISTS(SELECT 1 FROM pg_roles p WHERE p.rolname<>current_user
   AND (p.rolsuper OR p.rolcreaterole OR p.rolbypassrls)
   AND pg_has_role(current_user,p.oid,'MEMBER')) AS elevated_membership
FROM pg_roles WHERE rolname=current_user;
```

This review is not a request to change Production permissions. Runtime rechecks
the exact fingerprint; elevated capabilities need explicit owner review.

After completing and reviewing the manifest:

```sh
node deploy/fresh/prepare.cjs --digest deploy/fresh/production.json
```

Only this nonsecret public digest is printed. Set Production environment:

```
BQ_FRESH_BINDING_SHA256=<reviewed manifest digest>
BQ_FRESH_MANIFEST_FILE=deploy/fresh/production.json
```

## Fresh Production Secrets

Create **new** values in Publishing → Production app secrets:

| Name | Required format |
| --- | --- |
| BQ_FRESH_SESSION_KEY | 48 random bytes, 96 lowercase hexadecimal characters |
| BQ_FRESH_BACKUP_KEY | 32 random bytes, 64 lowercase hexadecimal characters |
| BQ_FRESH_INSTALL_KEY | 32 random bytes, 64 lowercase hexadecimal characters |

Use an approved password manager/cryptographic generator and transfer directly
to Production Secrets. Never print values to terminal logs, paste into chat,
write ordinary workspace files, hardcode them or reuse old BQ_MANAGED_* values.
Leave existing secrets untouched.

No authorized Agent API for securely generating/writing these Production
secrets was established. This preparation **does not claim they exist**.
Publishing UI edits remain pending until an owner-approved successful publish.
The application refuses startup/initialization if any fresh key is missing.

## Ownership and providers

New registration requires the imported employee's badge, hashed identity check,
matching phone and SMS OTP; there is **no** fresh-install KBA-only bypass when
SMS is unavailable or a record lacks phone ownership material. Existing
per-badge/IP rate limits, MFA and email verification remain enforced. Failed
attempt state survives application restart.

Configure existing providers through Production Secrets:

- `BQ_FRESH_SMS_CONFIG`: JSON in the existing SMS format (for example Twilio's
  provider/sid/token/from fields, or the already-supported provider's fields).
- `BQ_FRESH_SMTP_CONFIG`: JSON in the existing SMTP host/port/user/pass/fromName
  format, using actual Production delivery configuration.

They are overlaid only in process-local SQL transaction views, not seeded as
plaintext SQL settings. No legacy settings files are imported. Provider
credentials are never returned by the preparation commands.

Missing SMS returns 503 and creates no account. Missing SMTP prevents verified
email onboarding. SMS/mail outbox acknowledgement means queued, not delivered;
delivery receipts require a real successful provider response. Web Push is
explicitly unavailable (503), not falsely acknowledged. In-app SQL
notifications remain available.

Media upload defaults to 503. Enable `BQ_FRESH_MEDIA_ENABLED=1` only after
reviewing the bound control bucket's actual media read/write access. Existing
SQL/media reconciliation and verified object writes remain mandatory; storage
failure cannot commit a successful upload.

## One-time employee-only operation

No Agent command here was executed in Production. Owner must approve the
manifest, new authority and fresh Secrets before any Production write.

Build remains:

```
npm ci --omit=dev
```

Explicit one-time initialization approval:

```
BQ_FRESH_INIT_APPROVAL=initialize:<reviewed manifest digest>
```

Employee-only import command:

```sh
node deploy/fresh/initialize.cjs
```

Use that as an owner-approved maintenance Publishing Run command, or through
an existing authorized Production operator facility. **Workspace Shell is not
Production.** No SSH/exec facility is assumed or added.

The command opens maintenance liveness first, validates keys/binding/TLS/schema
and all 117 empty application tables, reads only employees.json, creates its
independent intent, and imports within a SQL transaction. It preserves IDs,
badges (including leading zeroes) and directory attributes, rejects duplicate
identities/malformed records, checks source stability before commit and verifies
exact projection and zero account rows. It then writes/verifies the independent
receipt and remains in maintenance. No DDL or reset runs.

A complete replay reconciles and returns without overwriting data—even if new
accounts were subsequently registered. Occupied unrecognized tables, changed
source, missing receipts or partial intents stop execution. Normal startup never
calls this initializer.

## Activation / normal startup

After a successful employee-only import, owner approves:

```
BQ_FRESH_ACTIVATE_APPROVAL=activate:<same reviewed manifest digest>
```

Production startup Run:

```sh
node deploy/fresh/start.cjs
```

Remove/disable the initialization approval in the normal-start configuration.
Normal startup uses only new SQL authority plus the independent fresh receipt,
not the original source bucket or legacy migration receipts/approvals. It checks
schema, TLS, permissions, directory membership/attributes and key continuity
before the existing maintenance gateway exposes the SQL application. An empty
or missing database never authorizes reinitialization. Failure keeps readiness
503 and root liveness 200.

## Initial administrator — no default password

The owner-selected `initialAdminBadge` employee must first register normally and
verify phone ownership, MFA and company email. No public registration request can
assign administrator privileges. There are initially zero administrators.

Calculate the nonsecret explicit one-time bootstrap approval:

```sh
node -e 'const m=require("./deploy/fresh/production.json"),c=require("./deploy/fresh/config.cjs");console.log("bootstrap:"+c.sha(c.canonical([c.sha(c.canonical(m)),m.initialAdminBadge])))'
```

Set it as Production `BQ_FRESH_ADMIN_APPROVAL`, then run only through the
approved operator's Production execution or maintenance Publishing configuration:

```sh
node deploy/fresh/admin.cjs
```

The command validates the installation, grants the role to that exact verified
account and atomically consumes a SQL bootstrap tombstone. It cannot create
passwords, accept another badge, replace an existing administrator or run twice.
Successful creation immediately disables this bootstrap operation in SQL even
if the environment approval remains present. Remove the approval at the next
normal configuration update and restore the startup Run command if maintenance
Publishing was used for bootstrap.

## Focused isolated verification

```sh
node scripts/fresh/check.cjs
node scripts/managed/diagnostic-publication-check.cjs
```

The integration test uses a private temporary PostgreSQL instance, the real
repository/runtime/auth HTTP handlers, 6,311 invented employees and synthetic
provider sinks. It tests zero initial accounts, idempotency, explicit new
binding, ownership, real registration/MFA/email/login, authorization,
one-use admin bootstrap, directory lookup, new posts and restart. It never
connects to Production or uses source account/key material.

Partial initialization or lost independent evidence requires reviewed forward
recovery. Do not delete intents, reset populated tables or restore the legacy
application/JSON authority to make a retry pass.
