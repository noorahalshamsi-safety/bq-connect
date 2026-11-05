# Pending Production configuration — no publication or execution approval

The existing VM build/run commands remain unchanged:

```
npm ci --omit=dev
node deploy/managed/minimal-import-runner.cjs
```

The entrypoint forces maintenance and ignores the import operation flag.
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
Bucket metadata read was denied, so display-name identity is not attested.
The owner must select **bq-connect-production-control → Settings** in App
Storage and confirm this exact ID. If it differs, correct the pending binding
and its SHA-256 before proceeding. Do not make the control bucket the source
default, move source objects, or use a bucket's display name as its ID.

## Protected comparison prepared, not installed in the live entrypoint

`verify.cjs` is a standalone read-only diagnostic for a separately authorized
protected Production process, not a public route or an application run command:

```
node release-preparation/production-bindings/verify.cjs release-preparation/production-bindings/bindings.pending.json
```

Do not run it in the workspace with copied Production authentication keys.
Setting a deployment marker manually is not access to the actual deployment.
It is not currently wired into startup, and no remote shell is assumed.
If no protected Production process-execution facility is available, the supplied
`maintenance-check.cjs` is a separate, future maintenance-only diagnostic
launcher. It is not configured or deployed here. With operator approval the
future Run command can be:

```
node release-preparation/production-bindings/maintenance-check.cjs
```

It first starts the same forced-maintenance listener. A single read-only check
runs only in Production with
`BQ_MINIMAL_BINDINGS_CHECK=approved-readonly-check`. Success and failure both
leave maintenance in place. Results go only to protected deployment logs, never
an HTTP endpoint. Without that setting it only serves maintenance. There is no
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

Its output contains only fingerprints, nonsecret identity/capability metadata
and aggregate counts. Keep it in protected operator custody, not a public API.
The manifest output is deliberately incomplete and not executable: dataset,
permission review, source-freeze/release evidence and exact approvals remain
unset. No UUID, approval or freeze assertion is fabricated.

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
