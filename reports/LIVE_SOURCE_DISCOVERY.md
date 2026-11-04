# BQ Connect — live-source discovery handoff

Observed 2026-11-04. No previous development suite or architecture audit was rerun.

## LIVE SOURCE — BLOCKED

Authorized deployment metadata confirms the public Reserved VM at
https://bq-connect.replit.app, with a successful build. Latest recorded successful
build: `ac733296-a2e8-453a-8758-1346ca453389`, GCE, created
2026-11-03 09:36:41 UTC, updated 09:41:36 UTC.

The metadata APIs expose status, timing and machine sizing, **not** the serving
process's source commit, environment, mounted JSON, bucket resolution, authority
manifest or generation. Latest successful build history alone does not establish
which generation the serving process has loaded. The GitHub managed branch is
at `aa56f7b`; that does not mean this code is published.

No production account/post/media files, raw logs, archives or signing keys were
downloaded. The workspace bucket metadata reader was deliberately not used:
workspace `defaultBucketID`, a seeded marker or an old vault index cannot prove
the running VM's authority. No authenticated account/session was created.

## EMPLOYEE INVENTORY — BLOCKED

Live counts and membership fingerprints remain **unknown**, not zero. No
synthetic development count has been substituted. No actual source manifest has
been manufactured from the candidate's 28-path schema.

Prepared exact aggregate-only evidence format:
`deploy/managed/live-source-contract.cjs`.
Generate the empty handoff template with:

```sh
node deploy/managed/live-source-contract.cjs template
```

It requires all 28 declared document paths, aggregate entity counts, original-byte,
semantic and membership HMACs, unmapped-data-file count, complete media reference
closure and unreadable/missing counts. Unknowns stay null. Extra record fields,
raw account payloads, unknown paths and unkeyed digest algorithm declarations
are rejected. An unmapped source file blocks completeness; it must not be omitted
just because the candidate has only 28 codecs.

### Minimum protected operator action

The app owner must arrange **one read-only inspection of the actually serving
published VM**, tied to its confirmed serving revision, in a protected execution
environment. The available Agent APIs do not provide that filesystem/process
access. If no deployment-specific read-only access is available to the owner,
request a Replit/platform-assisted inspection; do not use workspace SSH as a
substitute or republish to install a diagnostic endpoint.

The operator must inspect locally and return **only** the aggregate template:

1. Bind serving VM/process → actual code artifact → selected data directory and
   resolved App Storage bucket → original authority/generation. Return keyed
   fingerprints, never raw files or identifiers. If no generation exists, leave
   it null and explicitly keep discovery blocked; do not create a marker.
2. Verify local/remote binding and do repeated read-only manifests to detect
   changes during observation. Equality is observational evidence, **not** a
   global transaction boundary or a writer freeze.
3. Count accounts, employees, posts, comments and relationships using the actual
   deployed schema. Produce domain-separated keyed membership/semantic/original
   byte HMACs, preserving opaque ID type/case/leading zeros and unknown fields.
   Read/stream referenced media only inside that protected environment; return
   totals and a keyed manifest, not object names, URLs or bytes. Make no durable
   copy or deletion of the production bucket.
4. Inspect key custody and writer/recovery evidence as below. Never require
   `start.js`, authentication, restore or storage startup modules in the
   diagnostic process; they may create keys, write state or execute requests.

Keep a separate audit HMAC key in the protected environment; never reuse/export
application keys. Include the entity domain, schema version and source context
in every HMAC input. Existing `scripts/migration/rel001/membership-evidence.cjs`
defines the reviewed keyed membership semantics; use only after confirming the
deployed record shapes, not as a reason to export those records here.

An owner-approved protected operator may sign the canonical aggregate payload
with Ed25519. Establish its **public** verification key and serving revision
independently; do not trust a key delivered with its own self-signed report.
Then, in the isolated candidate:

```sh
node deploy/managed/live-source-contract.cjs check \
  aggregate-evidence.json trusted-operator-public.pem CONFIRMED_SERVING_REVISION
```

The checker verifies the signature, strict privacy envelope, revision and
one-hour freshness. It labels claims as operator claims, not independent proof,
and **always returns `migrationAuthorized:false`**. Signing establishes
provenance; it does not authorize a freeze, source export, import or release.

## KEY CUSTODY — BLOCKED

The configuration presence API reports SESSION_SECRET present; managed adapter
session/backup env keys absent; DATABASE_URL present and platform-managed.
This is current configuration/shared-scope presence, not the November 3
process's actual environment or proof that any production SQL resource is used.

It establishes neither original `data/session.key` / `data/backup.key` custody
nor active/pending 2FA decryption continuity. The operator must check the keys
actually used by the running artifact, verify original session-signature and
active/pending factor domains in protected memory, and return only booleans and
a keyed key-set fingerprint. No new keys, password resets, login attempts,
token values or source key bytes are permitted.

## ACTIVE WRITERS / PENDING OPERATIONS — BLOCKED

Actual process/worker/queue inventories are not exposed by deployment metadata.
The protected operator must account for HTTP/auth/account/session writers,
post/comment/reaction/profile/media mutations, direct/admin/import scripts,
scheduled maintenance/delivery, storage sync, snapshot/shutdown handlers,
restore/import requests and other deployments/processes sharing the same bucket.
Return process/writer/pending-operation counts and a keyed inventory.

The workspace has sync, automatic snapshots, shutdown snapshots and recovery
request code; these are **unverified candidate checks**, not an observed list of
active production writers. Do not consume requests, flush queues, drain workers,
change scheduling, restart or freeze the app during this read-only inspection.

## BACKUP/RESTORE — BLOCKED

No independent backup of the verified current authority or restoration was
established. An index entry/existing archive is not proof of complete recoverable
JSON, media, keys and accepted writes. Earlier synthetic restoration results
do not qualify this deployment.

The operator can read-only attest what existing independent backup custody and
restore evidence already exists. Establishing a new protected independent copy
and rehearsal needs separate authorization, destination, source-generation/media
closure and key-custody evidence. The present no-copy/no-production-change
instructions do not authorize doing that here.

## PRODUCTION DATABASE PROVISIONING PATH

Official current documentation specifies:

- **Helium:** production is created through Publishing when development has data.
- **Legacy Neon UI:** Production database settings → Create production database;
  the optional “Set up your production database with your current development
  data” copies development rows.
- Publishing applies reviewed schema diffs; normal schema updates are not a
  development-row copy. Initial creation must be distinguished from updates.

The primary documentation does **not** establish a separate, no-republish,
schema-only initial-provision command for this Helium project. It does not
document the legacy no-copy checkbox as a guaranteed Helium control. A generated
search summary was broader than the primary page; the primary page controls.

Therefore: the supported route is the **Replit Publishing database flow**, but
the exact no-copy/no-app-rollout initial provisioning capability remains
**unverified and not executable under this assignment's no-republish rule**.
The owner must obtain platform confirmation for this project and inspect its
actual Publishing → Database settings without clicking Publish/Create/Copy.
If schema-only initial provisioning cannot be positively confirmed, STOP.
Do not clear development fixtures, clone the database, run custom production
DDL, provision external Neon or publish simply to make a resource appear.

Sources checked:
- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/publishing/overview
- https://docs.replit.com/features/workspace-tools/ssh

The SSH documentation describes development workspace/IDE connections; it does
not establish that workspace SSH reaches the published Reserved VM.

## MIGRATION READINESS / SAFE IMPLEMENTATION

**NO-GO.** Actual authority, generation, inventory, keys, writers and recovery
are unverified. Original frozen-generation adoption and the production delivery
worker remain blocked. No real-data import, production resource creation,
bucket copy/delete, live application change or republish occurred.

The new evidence checker and its dedicated test file are isolated on
`development/live-source-discovery-2026-11-04`, based on `aa56f7b`.
**18 new evidence-boundary tests passed.** They use invented in-memory data and
signing keys; they are not repeated database tests or live-source certification.
The original application, deployment configuration and existing development
fixtures were not changed. No push was requested/performed.

The lossless procedure cannot become an executable real-data runbook until the
actual source is attested. Its exact remaining gates are:

1. Review the protected source manifest, classify every unmapped file/unknown
   record and reconcile JSON/media closure against the actual deployed schema.
2. Obtain separate backup/export/restore approval; prove independent byte and
   key recovery for that generation in a protected environment.
3. Approve no-fixture managed production creation and validate the actual
   schema/TLS/principal-capability contracts through the supported platform flow.
4. Implement/review the bound protected real-data adoption path and production
   delivery worker. Existing REL-001 CLI is synthetic-only, not a live importer.
5. After separate cutover approval, freeze/drain **all attested writers**,
   capture the final immutable generation, import losslessly, reverse/reconcile
   every original byte/semantic/membership/media proof and confirm session/factor
   continuity before authority activation or publishing.
6. Retain frozen JSON non-authoritatively; rollback must retain every newer
   accepted SQL write, never revert to older JSON.

## EXACT NEXT ACTION

Have the app owner arrange the protected, read-only **serving-VM source
attestation** described above, returning only signed aggregates/HMACs and its
independently approved public verification key. Confirm the serving revision
first; the latest build-list entry is not sufficient. If platform access cannot
provide this inspection without a rollout, leave production untouched and
obtain that capability through Replit/platform assistance.
