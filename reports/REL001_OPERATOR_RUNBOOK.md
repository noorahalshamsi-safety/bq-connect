# REL-001 — synthetic migration operator runbook

**Development-only tooling. Production NO-GO. No activation or live restore command exists.**

## 1. Preconditions and safety model

- Work only in this workspace, with Node and the existing PostgreSQL tools/packages installed. No provider credentials or environment connection string is used.
- `new-lab` creates its own invented source and a **new independent local PostgreSQL cluster/database**. It never chooses the application's existing development cluster or a hosted database.
- Explicit source ID, target ID and frozen manifest SHA are required for every later operation. They are not bearer secrets; do not replace them with guessed IDs.
- Keep the generated lab root private. Source/custody/media and recovery files are mode 0400 inside private directories. These permissions protect against accidental writes, **not** an owner/root adversary or a WORM storage service. Actual immutable backup and custody remain separately blocked.
- Do not copy real account data, key files or existing production snapshots into a lab. There is no arbitrary source-directory or database-URL option and no production-mode flag.
- Unknown source paths, duplicate JSON keys, unrepresentable JSON numbers, malformed supported shapes and inconsistent recognized relationships fail explicitly. No automatic normalization, skipped record or replacement business identity is permitted.
- `mail.json` and `messages.json` remain opaque JSON values. Their contents, including unknown dates/media-looking strings, round-trip without invented semantics; production discovery must still establish their true meaning and any media closure requirements.

## 2. Create a new invented rehearsal

```bash
node scripts/migration/rel001/cli.cjs new-lab
```

The result contains:

```text
root: generated-artifacts/rel001-labs/lab-<independent-lab-uuid>
expected.sourceId: source-<source-uuid>
expected.targetId: target-<different-target-uuid>
expected.manifestSha: <frozen-source-manifest-sha256>
```

Actual `root` is absolute. Copy only these non-secret identity fields to operator records. The command does not print passwords, signed sessions, factor keys, salts/hashes or media contents. New fixture credentials are invented at creation; an import never rotates or regenerates them.

Set local shell variables to the returned identifiers (placeholders below are intentionally not valid):

```bash
LAB='<absolute returned root>'
SOURCE_ID='<returned sourceId>'
TARGET_ID='<returned targetId>'
MANIFEST_SHA='<returned manifestSha>'
```

## 3. Check status and import atomically into staging

```bash
node scripts/migration/rel001/cli.cjs status \
  --lab "$LAB" --source-id "$SOURCE_ID" --target-id "$TARGET_ID" --manifest-sha "$MANIFEST_SHA"

node scripts/migration/rel001/cli.cjs import \
  --lab "$LAB" --source-id "$SOURCE_ID" --target-id "$TARGET_ID" --manifest-sha "$MANIFEST_SHA"
```

Before any entity insert the importer:

1. Refuses deployment execution and any non-minted/private lab.
2. Verifies source inventory and immutable fingerprint binding, strict JSON parsing, account/directory/credential/factor/session and recognized relationship constraints, and known media closure.
3. Creates/verifies private exact-byte source escrow, including original JSON, signing/backup key files, signed-session test vectors and all inventoried media. A corrupt escrow is refused, not silently replaced.
4. Connects **only** to the lab's derived private Unix socket and database name. Checks actual PostgreSQL system identifier, physical data directory, current database, bound source/target/manifest and staging mode.
5. Requires empty `dev.authority` and either an empty unreceipted target or an identical already-committed receipt.
6. Takes the dedicated migration transaction lock. All 28 entity graphs, media bytes/references, inventory and content receipt commit in one transaction. Independent reconciliation occurs before COMMIT.

Successful operation is `IMPORTED_STAGING_ONLY`; repeated identical input returns `IDENTICAL_IMPORT_NOOP` only after re-verifying every semantic value/media digest. There is **no activation**. The normal app never serves this target.

## 4. Independent reconciliation and reverse reconstruction

```bash
node scripts/migration/rel001/cli.cjs reconcile \
  --lab "$LAB" --source-id "$SOURCE_ID" --target-id "$TARGET_ID" --manifest-sha "$MANIFEST_SHA"

node scripts/migration/rel001/cli.cjs reverse \
  --lab "$LAB" --source-id "$SOURCE_ID" --target-id "$TARGET_ID" --manifest-sha "$MANIFEST_SHA"
```

Reconciliation runs in a read-only repeatable-read SQL snapshot. It reconstructs relationships with a reader that does **not** use the importer's decoder or `Repository.load`, compares all source semantic values and ordered arrays, and verifies every inventoried media byte/digest and reference. Matching counts alone are insufficient.

Reverse output uses a new private `reverse-<uuid>/data` and `media` directory. It reconstructs the JSON formats from SQL, reparses each file and compares against the frozen source. JSON formatting/key order may differ. The **separate recovery bundle** retains exact original bytes. No signing/backup keys are copied into reverse output; retain approved custody separately.

**Do not return reverse output to legacy production.** Compatibility of an operational post-cutover legacy rollback/export remains unapproved and unimplemented. The auth proof used a disposable copy only and does not change that restriction.

## 5. Interruptions, stopped cluster and failures

```bash
node scripts/migration/rel001/cli.cjs stop \
  --lab "$LAB" --source-id "$SOURCE_ID" --target-id "$TARGET_ID" --manifest-sha "$MANIFEST_SHA"

node scripts/migration/rel001/cli.cjs resume \
  --lab "$LAB" --source-id "$SOURCE_ID" --target-id "$TARGET_ID" --manifest-sha "$MANIFEST_SHA"
```

- Resume starts only an already-created owned cluster. Missing identity metadata, missing `PG_VERSION`/cluster, wrong target binding or unexpected directory state **blocks**; it never runs initdb or creates new keys.
- Kill before COMMIT: PostgreSQL rolls back. Resume the same lab and rerun the exact import command; source escrow remains unchanged.
- SQL COMMIT succeeds but diagnostic journal/response is lost: query status, then rerun exact import. The committed SQL receipt and complete reconciliation determine a no-op; do not infer rollback from a missing success message.
- No receipt but populated rows: stop. The tool refuses reinitialization (`unreceipted_target_data`). A manual destructive reset is not offered.
- Wrong source, different-source replay, changed manifest/raw source, corrupt escrow/media, unsupported KDF, missing keys or undecryptable factors: stop and retain evidence. Do not edit/re-sign the frozen manifest, skip records, repair keys, delete the target or select another database to make the import pass.
- A creation interruption leaves a diagnostic `creating` target and no permission to resume/initialize it. This narrower path is **BLOCKED for operator review**, not silently adopted. `new-lab` always creates a different lab, never repairs the old one.
- CLI errors contain categorical codes only. Do not paste database error details, source records, credentials, signed sessions or plaintext factor material into incident evidence.

## 6. Repeat the executed tests without altering older evidence

```bash
node scripts/migration/rel001/tests.cjs
node scripts/migration/rel001/boundary-tests.cjs
node scripts/migration/rel001/compatibility.cjs e2e
node scripts/migration/rel001/compatibility.cjs parity
node scripts/migration/rel001/preserve.cjs verify
node scripts/migration/rel001/report.cjs
```

The suites create new private invented labs and stop their clusters. They retain frozen source, target/recovery artifacts and sanitized reports under ignored `generated-artifacts/`. No real records are needed. Recovery bundles contain invented confidential-shaped data; do not publish or attach them as report assets.

Preservation baseline creation (`preserve.cjs` without `verify`) is a one-time pre-work action and refuses overwrite. A repeat test run does not grant permission to replace the existing baseline. Regression wrappers redirect output only; original test bytes and expectations are unchanged.

## 7. Future protected adoption — design only, execution BLOCKED

These are **proposed command responsibilities**, not installed commands or a hidden mode of this tool:

| Future stage | Explicit required inputs | Gate / current state |
|---|---|---|
| Protected discovery/inventory | Approved source identity, owner, protected environment, allowed paths, custody fingerprints, generation and source-reader access | Separate read/copy authorization; BLOCKED. Never copy employee data into ordinary development. |
| Protected freeze verification | Enforceable old-writer inventory, positively confirmed freeze/drain receipt and final frozen generation | Freeze must cover old deployments, CLI, storage mirror and scheduled jobs. No freeze executed here. |
| Immutable source escrow | Verified independent/WORM-equivalent backup identity and full content/media manifest, original keys under custodian control | Prove recoverability before import. Local mode 0400 is not sufficient production immutability. |
| Create protected candidate | Separately authorized destination identity/provider, supported schema, least-privilege/TLS, no-existing-data assertion, backup/PITR policy | Requires REL-003/004/014. Current `new-lab` cannot be repurposed through flags. |
| Import/reconcile candidate | Source/destination identities, frozen manifest, matching active/pending-factor and signing/backup domains, complete source inventory | Independent source/destination full reconciliation and media closure; no defaults/normalization. Unknown paths/shapes block. |
| Interrupted candidate recovery | Durable import/commit journal, original identities, source escrow, authoritative target receipt | Resume/refuse explicitly; never infer new authority from missing state. Hosted failure semantics not certified by local tests. |
| Pre-activation review | Signed complete reconciliation, operator approvals, no-write verification, recovery proof, current-state application rollback build | Mandatory human stop. No authority activation command implemented. |
| Cutover | Separate schema/data/authority/traffic/publish approvals, signed freeze generation and operator window | Production NO-GO; authority cutover remains BLOCKED. |
| Rollback/recovery | Separate rollback authorization, current committed authority, exact data/media/key recovery scope, measured RPO/RTO | No live restore or legacy data rollback is permitted by this development runbook. |

No generic `--production`, `--force`, `--adopt`, `--activate`, `--database-url`, authority-epoch change, old-writer bypass or key-replacement option exists. Designing those future responsibilities does not authorize implementing or executing them.

## 8. Required operator sign-off

For this development rehearsal, review the 28-path coverage, canonical source/SQL/reverse digests, exact escrow proof, original auth compatibility, media closure, all failure results and preserved original-source hashes.

For protected adoption, data/security/database/storage/operations owners must separately authorize the stages above. REL-001 remains **partially closed in development only**. The historical incident cause, real protected inventory and actual production migration remain unverified/blocked. **Stop for review.**
