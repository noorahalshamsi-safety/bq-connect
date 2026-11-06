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

The following technical binding fields remain unapproved:

- `endpoint.hostname`: verify against the existing **Production** database's
  connection information. The observed role is already `neondb_owner`.
  Do not paste a connection password into the manifest.
- `permissionsFingerprint` and `permissionApproval`: review actual Production
  role capabilities and set approval to `reviewed-managed-runtime-capabilities`.
The final owner business selections are already applied: initial administrator
badge `41060` and company email domain `binquraya.com`. Do not request
reconfirmation. The administrator is present and has complete original code/mobile
hashes. Its stronger owner-confirmed identity/email gate is separate from those
weak knowledge checks.

The latest supported Production catalog results and exact permission fingerprint
are documented in `production-permission-review.md`. The observed role and
fingerprint are now populated in the draft, but explicit owner acceptance of
the broad privileges and the application's hostname/TLS remain pending.

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

### Exact operator-only generation and entry

There is no authorized secure Agent-to-Production secret-writing API available.
Control-plane checks did not report any of the three fresh key names as present;
this is not an observation of secret values or of the running process.

On a trusted owner workstation with Python 3 and `pbcopy`, `wl-copy` or `xclip`,
save the provided `owner-key-clipboard.py` script locally and run:

```sh
python3 owner-key-clipboard.py BQ_FRESH_SESSION_KEY
python3 owner-key-clipboard.py BQ_FRESH_BACKUP_KEY
python3 owner-key-clipboard.py BQ_FRESH_INSTALL_KEY
```

**Run one command at a time.** After each:
1. Open Replit Publishing → Production app secrets.
2. Add the exact printed **name**, paste the clipboard value into its secret
   value field, and save that entry. Do not paste into chat, a report or a file.
3. Clear clipboard and clipboard history before generating the next key.
4. Do not regenerate or overwrite an already-populated key without explicit
   rotation approval. Leave legacy `BQ_MANAGED_*` and other existing secrets alone.

The script generates 48/32/32 random bytes, prints only the name, copies the key
directly to the local clipboard, writes no key file and refuses Replit execution.
If no supported local clipboard is available, use an approved cryptographic
password manager with the exact table formats; do not work around this by
printing keys. Entries remain PENDING until an owner-approved successful publish
applies them, and APPLIED is not established until observed in the new process.

## Ownership and providers

Fresh registration policy `directory-code-mobile-email-v1` requires a directory
badge, the existing **4-digit directory verification code**, registered mobile,
an employee-entered `binquraya.com` email, SMTP OTP and a new strong password.
The code's source contract does not establish that it is a national ID.
The exact existing ascii-digit normalization, HMAC-SHA256 `${badge}:${code}`,
and `phone:${badge}:${last-nine-mobile-digits}` comparisons are reused unchanged.
The hardcoded PEPPER is public compatibility material, **not a secret or strong
authentication factor**. Code/mobile are knowledge checks, not proof of phone
possession. There is no SMS send, dependency or claim of phone possession.
Missing/malformed check or phone hashes and ambiguous records fail closed even
though the original phone matcher alone tolerated absent hashes.
No directory email is required, and no account exists before email OTP confirmation.
TOTP is optional after
registration through authenticated security settings; enabling it requires
password reauthentication. Subsequent logins enforce TOTP when enabled.
Per-badge/IP rate limits, expiring five-attempt single-use email codes, password
hashing, SQL transaction authority, sessions and roles remain enforced. Failed
attempt/challenge state survives application restart.
`POST /api/register` accepts `{badge,code,mobile,password,email}`, returning
`{needEmailCode,ticket}`; repeat with `emailCode` and that ticket to register
and obtain a session. No role input is honored.

`POST /api/forgot` sends a reset code only to the account's already verified
email, ignoring caller-supplied destinations and returning the same public
response for unknown badges. Confirm with `{badge,op:"confirm",code,newPassword}`.
Codes expire, are single-use and attempt limited; reset revokes existing sessions
and pending login/setup/email tickets,
invalidates older reset challenges and preserves TOTP. No password is emailed.
Every successful completed login queues a security notification to the verified
email through the existing durable SMTP outbox. Delivery failures are not claimed
to be successful delivery.

Configure existing providers through Production Secrets:

- OPTIONAL `BQ_FRESH_SMS_CONFIG`: JSON in the existing SMS format (for example Twilio's
  provider/sid/token/from fields, or the already-supported provider's fields).
- `BQ_FRESH_SMTP_CONFIG`: JSON in the existing SMTP host/port/user/pass/fromName
  format, using actual Production delivery configuration.

They are overlaid only in process-local SQL transaction views, not seeded as
plaintext SQL settings. No legacy settings files are imported. Provider
credentials are never returned by the preparation commands.
The original SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS and
SMS_TOKEN/TWILIO_SID/TWILIO_FROM Production-secret fallbacks are also preserved.
Presence-only metadata did not report those names as configured, either; no
existing Production service credential was read, changed or fabricated.

Missing SMS does not affect fresh registration. Missing SMTP prevents verified
email onboarding. Mail outbox acknowledgement means queued, not delivered;
delivery receipts require a real successful provider response. Web Push is
explicitly unavailable (503), not falsely acknowledged. In-app SQL
notifications remain available.

### Current secure provider/directory checks

```sh
node deploy/fresh/prepare.cjs --verify-current --smtp-auth
```

This reads only the original employees.json and designated SMTP settings,
prints value-free states and performs no source
writes, Production database operations or message sends. The SMTP probe reuses
the existing implicit-TLS/AUTH LOGIN protocol and stops before MAIL FROM,
RCPT TO or DATA.

Observed under the replacement policy: 6,311 employees, unchanged checksum,
6,255 complete unambiguous ownership records, including badge 41060; 56 incomplete
records remain blocked individually. All 6,311 are preserved, including original
check/phone bytes. Source producer/verifier semantics and synthetic vectors are
verified, but **a known employee's positive source-hash comparison remains
required**. Format checks and synthetic fixtures alone cannot prove compatibility
of actual stored values. No codes/mobile numbers were derived or brute-forced.

Use a trusted interactive terminal and hidden input, never command-line values,
chat, shell history or a file:

```sh
python3 -c 'import getpass,json,warnings; warnings.simplefilter("error",getpass.GetPassWarning); print(json.dumps({k:getpass.getpass(k+" (hidden): ") for k in ("badge","code","mobile")}))' \
  | node deploy/fresh/prepare.cjs --verify-ownership
```

This command is source-read-only, outputs PASS/BLOCKED and a nonsecret approval
only, and never touches Production. After a real positive comparison, the owner
may record the returned `ownershipCompatibilityApproval` in production.json.
It binds the source checksum and exact existing verifier contract. Initialization
and startup reject a missing/stale approval; no input or original hash is stored.

Existing SMTP configuration authenticated successfully with verified TLS.
Actual message delivery was not tested and is not claimed VERIFIED.
SMS is not a fresh launch prerequisite. Its existing adapters and unrelated
modules remain available and unchanged; no SMS delivery approval is required.
SMTP configuration has not been transferred to Production by this preparation.

### Controlled delivery review before activation

1. Securely populate the fresh Production SMTP JSON secret from the actual
   existing service configuration/owner credential store, not synthetic values.
2. Obtain explicit permission for **one** company-email delivery to an
   owner-approved recipient. The company domain alone does not approve
   a particular recipient. Keep recipients and credentials out of logs/chat.
3. Use the existing real adapters and configured credentials through an approved
   execution facility. Confirm actual receipt of the email and provider
   outcomes, not merely queue acknowledgement or a configuration flag. No
   live send is authorized or implemented by the read-only command above.
4. No approved recipient or actual Production execution facility was
   established in this preparation. This live test remains an operator
   prerequisite, not a claimed successful check or an available Shell command.
5. Only after real controlled tests, the operator may set:

```
BQ_FRESH_DELIVERY_APPROVAL=delivery-tested:<final reviewed manifest digest>
```

This is an explicit operator assertion, **not machine-generated delivery
evidence**. Do not set it on the basis of source configuration, SMTP AUTH alone
or invented recipients. The fresh startup guard refuses incomplete/placeholder
SMTP configuration, missing delivery approval, or unsuccessful SMTP authentication;
it cannot turn those failures into a live application. If provider credentials
change, repeat their controlled verification before reapproving activation.

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

The owner must independently confirm badge 41060's identity and chosen company
email; code/mobile knowledge alone is **not** enough to authorize this administrator.
Put the independently approved email in Production `BQ_FRESH_ADMIN_EMAIL`.
Set Production `BQ_FRESH_ADMIN_REGISTRATION_APPROVAL` to
`register-admin:SHA256(canonical([finalManifestDigest,initialAdminBadge,normalizedApprovedEmail]))`
only after that independent review. Public registration for that badge is refused
without this approval and can only use the pinned email. The same pin and approval
are checked again by bootstrap; user role flags cannot bypass them.
The separate privileged bootstrap
retains its stronger MFA requirement: enroll optional TOTP before operator
elevation. This is not a registration prerequisite. No public registration request can
assign administrator privileges. There are initially zero administrators.

Only after this account has completed verification and the operator authorizes
elevation, calculate the nonsecret explicit one-time bootstrap approval
(it has deliberately not been generated during preparation):

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
node scripts/fresh/startup-persistence-check.cjs
node scripts/managed/diagnostic-publication-check.cjs
```

The integration test uses a private temporary PostgreSQL instance, the real
repository/runtime/auth HTTP handlers, 6,311 invented employees and synthetic
provider sinks. It tests zero initial accounts, idempotency, explicit new
binding, exact original code/mobile hash compatibility, registration without SMS,
optional post-registration TOTP, email-code expiry/attempt limits, persistent
challenges, concurrent unique registration, login, authorization,
one-use admin bootstrap, directory lookup, new posts and restart. It never
connects to Production or uses source account/key material.

Startup also tests the real public maintenance gateway, generated-module syntax,
refresh/persist/commit failures, complete transaction rollback and fail-stop on
a startup deadline. No scheduler runs before the boot transaction commits.
`SQL_STARTUP` logs contain fixed stages/statuses and an allowlisted error class,
not exception messages, generated source, provider configuration or records.
The startup deadline is 120 seconds; an uncancellable timed-out worker retires
rather than retrying with overlapping mutable contexts.

Department membership persistence uses bounded, parent-before-child SQL batches
within the existing revision-locked transaction. The round-trip regression
test compares every projected value for 6,311 synthetic members.

For an already initialized installation, publish the corrected source with the
existing `npm ci --omit=dev` build and `node deploy/fresh/start.cjs` Run command.
Keep existing Production secrets, manifest and approvals. **Never rerun
initialize** to deploy a startup repair. The gateway remains maintenance-only
until the internal startup transaction commits and runtime readiness resolves.
After the operator-approved Republish, verify `SQL_STARTUP: READY / PASS`,
`/health/ready` HTTP 200 and actual application content at `/`. A listener URL
alone is not evidence of committed readiness.

Partial initialization or lost independent evidence requires reviewed forward
recovery. Do not delete intents, reset populated tables or restore the legacy
application/JSON authority to make a retry pass.
