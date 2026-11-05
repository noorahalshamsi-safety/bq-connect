# Pending Production configuration — no publication or execution approval

The original maintenance VM build/run commands are preserved for restoration:

```
npm ci --omit=dev
node deploy/managed/minimal-import-runner.cjs
```

The original entrypoint forces maintenance and ignores the import operation flag.
Publishing the same maintenance source is the supported way to apply the
owner's pending Production app secrets. A saved entry or secret-existence
response does not prove that the running deployment has received it.
Only the operator may approve and perform that publication.

## Nonsecret bucket bindings

The original source is explicitly pinned by its full SHA-256 fingerprint.
The current working .replit default still points to that source. It was
already different from the committed .replit at the start of this preparation;
neither setting has been changed here.

The target candidate ID comes from the latest committed project configuration:
`replit-objstore-44cb0252-dd69-42fb-8f2d-af513c735acb`.
An authorized Replit SDK object listing succeeded with no objects returned.
The owner subsequently confirmed that **bq-connect-production-control**
matches this exact ID; the binding confirmation is now recorded as true.
Do not make the control bucket the source
default, move source objects, or use a bucket's display name as its ID.

## Protected comparison prepared, not installed in the live entrypoint

`verify.cjs` is a standalone read-only diagnostic for a protected Production
process, not a public route or an application run command:

```
node release-preparation/production-bindings/verify.cjs release-preparation/production-bindings/bindings.pending.json
```

Do not run it in the workspace with copied Production authentication keys.
Setting a deployment marker manually is not access to the actual deployment.
It is not currently wired into startup, and no remote shell is assumed.
The supplied `maintenance-check.cjs` is now prepared as the next-publish Run
command, but is not yet live. The configured diagnostic Run command is:

```
node release-preparation/production-bindings/maintenance-check.cjs
```

It first starts a separate HTTP-only maintenance listener, without importing
the pinned runtime or any importer entrypoint. It binds 0.0.0.0 using PORT,
with a 4173 fallback matching Publishing's local4173→external80 mapping.
A single read-only check
runs only in Production with
`BQ_MINIMAL_BINDINGS_CHECK=approved-readonly-check`. Success and failure both
leave maintenance in place. Diagnostic output is projected through a fixed
allowlist of PASS/BLOCKED statuses only. It includes no credentials, key values,
fingerprints, endpoint strings, record data, raw errors or manifest contents.
Without that setting it only serves maintenance. There is no
import/activation flag or automatic retry. This allows a separately approved
publication to apply pending secrets and perform their protected comparison
without assuming Production SSH. Do not replace the run command with the
non-listening `verify.cjs` script.

The diagnostic refuses Development/loopback endpoints, missing applied secrets,
unconfirmed target identity, key mismatches and nonempty destinations. In memory,
it compares both original source keys to Production Secrets, uses the stable
audit key for source/membership bindings, verifies strict TLS and a read-only
database session, and collects schema/permission/endpoint fingerprints.
It never imports, activates, generates keys, runs DDL or writes either bucket.

The diagnostic no longer emits a manifest draft or metadata: it reports
statuses only. The separate pending JSON is not an executable migration
manifest. Dataset, permission review, source-freeze/release evidence and exact
approvals remain unset. No approval or freeze assertion is fabricated.

The PostgreSQL connection is initialized read-only; helpers receive only a
single-SELECT query interface that rejects DML, DDL, SET and multi-statements.
The source helper receives exists/download capabilities only; the target helper
receives list only. All bucket IDs are explicit and their original/confirmed
fingerprints are pinned, regardless of the default bucket.

## Diagnostic health and blocked-context interpretation

GET/HEAD `/` (including query strings) and `/health/live` return 200 with
maintenance content. `/health/ready` and application routes return 503 with
`ready:false` regardless of diagnostic success, failure or pending I/O.
The launcher returns the listener before awaiting diagnostics. The verifier
loads in a worker only after listening: dependency loading, crypto and remote
I/O cannot block the HTTP event loop. Worker stdout/stderr are discarded;
only the allowlisted status message is forwarded. Worker errors are statuses,
not exception messages. No result can attach or activate an application.

The original aggregate `PRODUCTION_CONTEXT:BLOCKED` discarded its failing
guard. It does not prove a missing secret, wrong endpoint, TLS failure or wrong
bucket. New allowlisted subchecks identify the first blocked prerequisite:
published-process marker, pinned release/bindings, app identity, each secret's
presence/format, endpoint presence/syntax/destination/options/TLS policy and
Development identity exclusion, then explicit bucket binding/confirmation.
Checks not reached remain BLOCKED. `PRODUCTION_SECRETS:PASS` means observed
presence/format in the verified app context, not original-key equality.
Only `ORIGINAL_KEY_MATCH:PASS` establishes equality.

No validation is relaxed: the pinned endpoint validator, original bucket
fingerprints, in-memory key equality, verified database TLS, schema check and
permission-review requirements remain enforced. An unreviewed URL option
remains blocked, rather than being silently removed to obtain a PASS.

Focused local tests use only owned ephemeral listeners (never the workspace's
active4173 service). They verify the configured default4173 listen argument
separately and exercise HTTP responses under context failure and pending I/O.

## Restoration after diagnostics

`maintenance.before-diagnostic.replit.toml` is the exact original configuration,
saved before changing next-publish settings. To restore maintenance-only
operation, set Run back to `node deploy/managed/minimal-import-runner.cjs`,
keep Build `npm ci --omit=dev`, and remove only the nonsecret Production setting
`BQ_MINIMAL_BINDINGS_CHECK`. It was absent before preparation. Do not alter any
of the three Production Secrets. Restoring live behavior requires a separate
operator publication; no such publication is performed by preparation.

## Remaining gates

1. Confirm the target bucket's actual Settings ID.
2. Have the owner approve and perform publication of maintenance-only source to
   apply pending Secrets. Keep the source/default bucket and import-disabled
   behavior unchanged; do not activate. The existing entrypoint can remain as
   is for secrets application alone, or the optional diagnostic launcher above
   can be selected only with explicit approval for that read-only check.
3. Run the read-only diagnostic in an actually protected Production context.
   Confirm original-key equality and actual writable-endpoint identity/TLS/
   runtime capability bindings; read-replica database names alone are insufficient.
4. Stop/drain all other source writers and obtain verifiable freeze evidence.
   Stable reads are not a freeze. Review managed owner-role capabilities rather
   than pretending a separate least-privilege runtime role has been installed.
5. Finish the manifest and obtain exact, expiring approvals for
   managed-production-activate and minimal-employee-account-import. The current
   hard-maintenance wrapper cannot execute import merely by adding an env flag.
6. Resolve uncertain intent/commit receipts before retry; never reset a target
   or revert to stale App Storage JSON after accepted SQL writes.
