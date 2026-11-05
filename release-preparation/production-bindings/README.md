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
The verifier runs only through the protected diagnostic worker; no remote
shell is assumed. The existing diagnostic Run command is:

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
allowlist of NOT_EXECUTED/MISSING/INVALID/VERIFIED execution states only.
It includes no credentials, key values,
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

The former APP_IDENTITY guard combined absent REPL_ID with fingerprint
mismatch, then threw before all secret, endpoint and bucket checks. Those
later BLOCKED fields were skipped checks, not evidence of missing dependencies.

Independent local observations now run before any protected reads:
runtime marker, expected app binding, actual identity presence/equality,
each secret's presence/format, endpoint syntax/policy, and explicit bucket
bindings/confirmation. The execution states distinguish absent required input
(MISSING), observed failure (INVALID), successful observation (VERIFIED), and
dependent operations not attempted (NOT_EXECUTED). Aggregate PRODUCTION_CONTEXT
now means published/pinned/app identity, not a claim that every dependency passed.
PRODUCTION_SECRETS means observed process presence/format, not proof of
original-key equality, deployment provenance or execution authorization.
Only ORIGINAL_KEY_MATCH:VERIFIED establishes equality.

Protected reads still require verified published/app identity and worker
environment continuity. Source comparison also requires valid secrets and
bucket bindings. Target inspection does not require a source-key match.
Read-only SQL inspection requires verified endpoint identity/policy and the
pinned schema binding, but not source availability or authentication keys.
Failures of those independent groups do not skip the other eligible groups.

The parent and worker compare protected in-memory fingerprints of REPL_ID,
the deployment marker, DATABASE_URL and the three exact BQ secret variables.
Only WORKER_ENVIRONMENT's execution state is emitted; neither those
fingerprints nor any values are output or persisted.

No validation is relaxed: the pinned endpoint validator, original bucket
fingerprints, in-memory key equality, verified database TLS, schema check and
permission-review requirements remain enforced. An unreviewed URL option
remains invalid, rather than being silently removed to obtain a VERIFIED state.

## Exact diagnostic configuration contract

The only diagnostic binding file is `bindings.pending.json`, read by the
launcher/worker. It is not the activation/import manifest and needs no
additional manifest-path environment variable.

- `appFingerprint`: SHA-256 of the intended workspace REPL_ID. The local
  comparison matches; that does not prove the Production process received it.
- Runtime identity: REPLIT_DEPLOYMENT=1 and REPL_ID matching that fingerprint.
  REPL_ID is runtime-managed: do not create an override or substitute an
  operator-supplied app-ID variable to make the comparison succeed.
- Runtime secret names (case-sensitive): BQ_MANAGED_SESSION_KEY (96 lowercase
  hexadecimal characters), BQ_MANAGED_BACKUP_KEY (64), BQ_MINIMAL_AUDIT_KEY (64).
  These names are read directly; SESSION_SECRET is not a substitute.
- DATABASE_URL: managed runtime connection; use the pinned validator, no
  Development fallback or unreviewed connection options.
- Bucket IDs/fingerprints: explicit fields in the pending JSON, not the
  current default. The owner-confirmed target ID is
  replit-objstore-44cb0252-dd69-42fb-8f2d-af513c735acb, with confirmation true.
- The diagnostic flag remains BQ_MINIMAL_BINDINGS_CHECK=approved-readonly-check.

## Stop before another publication

Current deployed output establishes only absent-or-mismatched REPL_ID. It
cannot distinguish those cases. Supported deployment metadata available to
this Agent does not expose the live process value; workspace Shell is not
Production runtime access. Do not request another diagnostic publication
solely to find that value. Do not change the expected app fingerprint to fit
an unknown deployment identity.

An authorized operator with an existing **Production** execution facility can
run the following value-free probe against files already in the deployment.
This is not an instruction to run it in workspace Shell, and no such
Production execution facility is assumed to be available:

```sh
node - <<'NODE'
const fs = require("node:fs"), crypto = require("node:crypto");
const out = { PUBLISHED_PROCESS: "INVALID", APP_BINDING: "NOT_EXECUTED",
  APP_ID_PRESENT: "NOT_EXECUTED", APP_IDENTITY: "NOT_EXECUTED" };
if (process.env.REPLIT_DEPLOYMENT === "1") {
  out.PUBLISHED_PROCESS = "VERIFIED";
  try {
    const b = JSON.parse(fs.readFileSync("release-preparation/production-bindings/bindings.pending.json", "utf8"));
    out.APP_BINDING = !b.appFingerprint ? "MISSING" :
      /^[a-f0-9]{64}$/.test(b.appFingerprint) ? "VERIFIED" : "INVALID";
    const id = process.env.REPL_ID;
    out.APP_ID_PRESENT = id ? "VERIFIED" : "MISSING";
    if (!id) out.APP_IDENTITY = "MISSING";
    else if (out.APP_BINDING === "VERIFIED")
      out.APP_IDENTITY = crypto.createHash("sha256").update(id).digest("hex") === b.appFingerprint ? "VERIFIED" : "INVALID";
  } catch { out.APP_BINDING = "INVALID"; }
}
console.log(JSON.stringify(out));
NODE
```

If authorized Production process inspection is unavailable, remain BLOCKED.
No missing secret or missing manifest should be inferred from that limitation.

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

1. The target ID is already operator-confirmed; do not repeat bucket setup.
2. Resolve Production REPL_ID presence/equality through protected runtime
   inspection before requesting any further diagnostic publication. Do not
   recreate secrets, override runtime identity or modify deployment settings.
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
