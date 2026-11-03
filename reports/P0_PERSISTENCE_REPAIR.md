# BQ Connect — Development Persistence Safety Repair

**Production release readiness: NO-GO. This is a development-only containment/repair branch, not a deployable persistence solution.**

The production account-disappearance incident remains **NOT VERIFIED**. This work repairs independently testable local failure mechanisms and adds fail-closed fences where the supported storage SDK cannot provide the necessary durability protocol. It does not establish production safety from mocks.

## 1. Scope, checkpoint and unchanged production

Before editing, all ten recorded application source fingerprints were checked against the completed forensic results. A reversible source/evidence checkpoint is retained at `generated-artifacts/repair-baseline/`, with its timestamp, Git baseline and fingerprints in `checkpoint.json`. It contains only source, the existing report and sanitized forensic outputs—not employee data or production keys.

The original forensic report and `generated-artifacts/forensics/` outputs were preserved. The repaired harness writes to a separate `generated-artifacts/repair/` directory.

No production objects, employee records, real keys or production configuration were modified. No production restore/import, publish, deployment or production restart occurred. This repair turn did not run the production metadata collector. No database, dependencies or authentication architecture were replaced.

Only the **isolated development preview** was restarted. It explicitly provisions disposable random test keys and empty records in its temporary directory. That is not rotation or regeneration of real keys.

## 2. Exact changed files and purpose

| File | Purpose |
|---|---|
| `persistence-safety.js` | New strict critical-data/key/schema checks, membership/version guards, manifest/pinned-identity validators, explicit bucket binding, durable-provider fence, fsynced local writes, and offline local recovery journal. |
| `auth.js` | Remove implicit secret generation and malformed-account fallback; reload by content digest; reject membership/version loss; serialize local commits using an exclusive filesystem lock and expected digest; reload on conflicts; obtain fresh account references after password hashing; expose internal categorical session diagnostics. |
| `storage-sync.js` | Download to a candidate and validate before local activation; reject implicit provisioning, lost membership and old account versions; explicitly bind the SDK bucket; refuse critical mirror changes without a durable provider; propagate explicit flush/upload failures; retain missing remote objects rather than inferring deletion; exclude operational locks. |
| `start.js` | Manifest/adoption/provider preflight before restore; refuse authenticated startup after unsuccessful recovery or disabled production storage; distinguish liveness from readiness; remove the old count-drop override path and unsafe operator hints. |
| `vault.js` | Refuse unsafe remote restore/import/index publication without deleting requests, keys or archives; reject corrupt authoritative indexes; offline merge uses validated candidates and a recoverable local directory journal; reject incompatible active/pending 2FA domains; use captured archive counts/full-media metadata in the future publication path. |
| `backup.js` | Never regenerate missing backup keys; freeze bytes into a private staging directory, check source stability, and derive counts/hashes from those frozen bytes; fail on missing critical data or referenced media; exclude writer locks; retain the encrypted archive format. |
| `server.js` | Add `/health/live` and `/health/ready` for the admitted application. Existing user-facing routes/UI are otherwise unchanged. |
| `preview-safe.js` | Copy the new helper; explicitly initialize only disposable empty preview fixtures/test keys so the stricter auth loader can run safely. |
| `scripts/forensics/persistence-harness.cjs` | Preserve all original scenarios; copy the new helper; explicitly provision synthetic keys; record repaired results separately; document exact expected rejection codes; add separate development/maintenance checks. |
| `scripts/forensics/startup-worker.cjs` | Allow explicitly local-only development-server tests in the sanitized test worker; production-equivalent tests still use real copied `start.js` and its fences. |
| `scripts/forensics/repair-regressions.cjs` | New targeted regression scenarios, including two actual local writer processes, journal interruption, complete-media archives and legacy KDF compatibility. |
| `scripts/forensics/repair-report.cjs` | Generate the full before/after report from preserved baseline and current evidence. |
| `.gitignore`, `.replitignore` | Keep generated evidence, candidate/old/quarantined data directories and local recovery journals out of Git/deployment packaging. |
| `reports/P0_PERSISTENCE_REPAIR.md` | This review narrative; the generated full report includes the per-test comparison below. |
| `replit.md` | Current development-only scope, preserved forensic baseline and explicit NO-GO/approval constraints. |

`package.json`, the installed SDK and `.replit` deployment settings were not changed.

## 3. Reproduced root causes and dependencies

| Failure family | Original failing scenarios | Repair and limits |
|---|---|---|
| Missing/unreadable authority, silent fallback, identity/generation ambiguity | T09, T11, T12, T13, T27 | Strict schema/key checks, staged validation, pinned manifest/bucket/generation helpers and fail-closed preflight. No automatic adoption. Full committed-generation advancement remains blocked by the provider dependency. |
| Secret regeneration and cross-domain encrypted 2FA | T10, T23, T28 | Key generation removed from auth/backup loaders. Import rejects incompatible enabled TOTP, recovery material and pending setup domains before activation. Matching-key local import remains tested. No real rotation, disabling of 2FA or forced resets. |
| Whole-file cached updates and detached async references | T16, T29 | Hash first, then obtain the current account object; content-based reload; local lock plus expected-digest commit, fsync and explicit conflict rejection. Two independent caches and two actual processes are tested. This is local filesystem coordination, not multi-VM fencing. |
| Shrink/substitution and asynchronous remote write-back | T15, T17, T18 | Membership/version loss is rejected. Critical polling-mirror changes are fenced because durable conditional commits are unavailable. T18 still fails: a completed **development-local** write is not durable remote storage. Production writes are refused instead of falsely acknowledged. |
| Partial restore/import and serving mixed generations | T25, T26, T31 | Remote operations are denied while preserving all recovery material; startup checks unsuccessful results. Offline merge stages/validates before a journaled directory activation, with rollback/quarantine tests. Successful remote activation is **not implemented** without a supported fenced authority update. |
| Missing media and incoherent archive/index metadata | T19, T24 | Referenced-media validation and private frozen full-media archive staging; counts/hashes describe archive bytes. Authoritative remote index publication is blocked, not simulated as transactional. |

Dependencies are explicit: safe remote activation and multi-writer account commits require an approved provider protocol first; manifest adoption then requires coordinated, quiescent validation; only then can normal mutable deployment startup be enabled. Local locks alone cannot satisfy those dependencies.

### Account-mutation protocol implemented locally

1. Hash password input before retaining a mutable account reference.
2. Reload the latest valid account file by content digest; reject identity removal/version rollback.
3. Apply the synchronous mutation, then acquire the exclusive local account lock.
4. Under that lock, compare the on-disk digest with the loaded digest; reject conflicts, not overwrite.
5. Validate membership/schema; write a private temporary file, fsync it, rename it, and fsync its directory.
6. On failure, reload disk state and do not acknowledge success; do not steal another writer's lock.

Every normal auth account save uses this shared path. Deployment mode additionally refuses the save before any disk mutation because no durable provider exists. That fence also protects against directly starting auth outside the managed bootstrap. A crash leaving a local lock requires operator review; automatic stale-lock stealing is deliberately absent.

Operational locks are excluded from backup/mirroring and local activation refuses an active account lock. Offline generation activation still requires quiescent writers; it does not coordinate noncooperating social-file writers.

## 4. Storage guarantees: verified versus not established

### Verified public SDK surface

Reviewed installed `@replit/object-storage` **1.0.0** declarations and current official documentation:

- [App Storage JavaScript SDK](https://docs.replit.com/features/sdks/object-storage-javascript-sdk)
- [App Storage](https://docs.replit.com/features/data-and-storage/object-storage)
- [Publishing troubleshooting](https://docs.replit.com/build/troubleshooting)

`UploadOptions` in `node_modules/@replit/object-storage/dist/index.d.ts` exposes `compress`; it does not expose generation preconditions, compare-and-swap, transactions, create-if-absent or a distributed/fenced lease. The documentation search confirms uploads overwrite existing object paths. `Client({ bucketId })` is supported and is now used after checking the explicitly configured bucket fingerprint.

Persistent object storage survives publishing; local deployment files are not durable across republish. A polling mirror, a UUID object name, a local mutex or a successful local rename does not constitute a remote commit protocol.

### Not established or assumed

- No supported, authenticated conditional-write/lease transport beyond this public SDK was verified.
- This does **not** prove the underlying storage service has no conditional primitives. It means this application has no validated way to use them.
- No hidden provider headers, service credentials, undocumented sidecar access, fake mock-only CAS or pretend capabilities were introduced.
- No multi-object atomic activation, global serializability, multi-VM fencing, zero-loss remote acknowledgement or exactly-once behavior is claimed.
- Local filesystem lock/rename/fsync behavior is exercised in Linux process tests; abrupt power loss and actual Replit deployment promotion were not tested.

**Implementation stop:** `requireDurableBackend()` intentionally rejects production activation, deployed auth saves, critical mirror changes and remote index publication. There is no environment flag or client property to bypass it. A valid manifest does not remove this fence.

## 5. Recovery, snapshots and media

### Offline candidate/journal design

An offline local merge copies the existing dataset to a sibling private candidate, adds missing accounts/posts/media, checks schemas, key domains, account membership and media references, then validates the complete candidate.

A fsynced journal records the live/old directory and prepared/committed phase. Individual directory renames are **not described as one atomic transaction**:

- An error between renames recovers the old directory before returning.
- A restart in an uncommitted prepared state restores the old directory.
- A candidate already placed at the live path is quarantined, not deleted, when rolling back a prepared state.
- A first-generation prepared state without an old committed dataset is refused and quarantined, not silently accepted.
- Old and quarantined generations are retained for review.

This journal is **local only**. It cannot survive a republish that discards the filesystem and is not a distributed authoritative pointer. Production activation is therefore blocked even if this local procedure succeeds.

### Remote recovery containment

`applyRestore` and `applyImport` return `ok: false` and a sanitized `recovery_commit_unavailable` code, logging the refusal. They do not download/decrypt a candidate, publish a snapshot/index, delete a request/key/archive or mutate the live dataset. These are real safety rejections, not successful recovery transactions.

Containment PASS results for T25/T26 do **not** mean functional production restore/import is repaired. The positive deployment/recovery paths remain BLOCKED. A distributed candidate/pointer protocol must be designed only after an actual supported atomic primitive is approved.

### Archive integrity

Local encrypted backups retain the existing AES-GCM format. They stage private bytes before asynchronous encryption, derive counts and hashes from those staged bytes and fail rather than silently skipping vanished files. Default full archives include media. The old remote vault archives that excluded media have not been rewritten and are not retroactively full backups.

Referenced media is checked for `/media/` references in post JSON, including nested values. This does not claim complete coverage of every historical URL convention or references in other application JSON; authorized compatibility validation remains necessary. Media restore/versioning across provider generations is unresolved until the durable backend design is approved.

The decryption key is not embedded into its own archive. Real key escrow/decryptability verification requires separate authorization and must stay outside development. Cross-process global snapshot isolation is not established by the local copy/stability check.

## 6. Production compatibility and adoption plan

**Do not publish this branch.** Existing production storage has no adopted authoritative manifest in the evidence reviewed. The repaired bootstrap intentionally stays unready; even a valid pinned manifest still hits the unsupported-provider fence. This is a material deployment incompatibility, not a release-ready migration.

| Concern | Required handling before any future release |
|---|---|
| Existing legitimate records | Validate legacy schemas/counts/key fingerprints inside an approved protected context. Do not “clean up,” reset, rewrite or discard records to satisfy a new validator. Actual production records were not opened here. |
| Manifest initialization | No automatic writer/initializer was added. First obtain a supported durable protocol, quiesce writers, validate a candidate inventory and key/media bindings, and explicitly approve initial authority. |
| Manifest generation | Current schema/pin/file-hash validators are building blocks, not a live advancement protocol. Future backend design must define monotonic advancement, trusted rollback floors and reconciliation; a static deployment generation pin is not an ongoing transaction system. |
| Rolling overlap | Old revisions do not honor the new locks/manifest rules and can overwrite shared objects. Coexistence is unsafe; a process-local lock or new revision's fence does not stop an already-running old writer. |
| Key preservation | Preserve original bytes/fingerprints. Never regenerate missing keys. Reject cross-domain imports unless separately approved and tested rewrapping is designed. |
| Interrupted deployment | Do not switch authority before a verified durable commit. Local journal recovery alone is insufficient after VM filesystem replacement. |
| Health checks | Maintenance root/readiness return 503; liveness returns 200. Existing promotion health checks must be reviewed before any future deployment. No publishing settings were changed or promotion tested. |
| Code rollback | Do not automatically roll back employee data with code. Old code may resume unsafe writes; any rollback plan must coordinate writer access and compatible authority formats. |
| Recovery without losing newer data | Retain immutable current/candidate generations and quarantine local uncommitted candidates. Never overlay an old snapshot over a newer live generation without explicit approval and reconciliation. |
| Capacity/performance | Full-media staging consumes disk and blocks this process during the initial synchronous copy. No production-size storage/latency/load test was performed. |

The development preview remains usable with explicit empty synthetic provisioning. Tests also verify a legitimate existing local fixture, matching-key 2FA import, existing session and legacy password-KDF upgrade. This is limited backward-compatibility evidence, not certification of the unseen production dataset.

## 7. Remaining risks and approval decisions

1. **T18 remains FAIL:** a local write completed before a remote flush is not durable after cold restore. Production acknowledgements are now refused, not made durable.
2. Multi-revision CAS/leases, transactional critical writes and successful remote recovery/index activation remain **BLOCKED**.
3. The current live production application remains unchanged and therefore still has its original risks; development fences do not repair an already deployed revision.
4. Validating manifests/pins is not proof of an atomic committed generation. Schema helpers cannot make an unconditional SDK upload transactional.
5. Retained local generations/quarantine require an authorized retention/recovery policy and are not substitutes for immutable remote backups.
6. Conflict handling rejects rather than automatically retries account changes. User-facing retry behavior and operating procedures need validation before a future release.
7. Production-sized media/archive behavior, real promotion/overlap, interrupted VM replacement and real employee login were not tested.

### Decisions requiring explicit approval

- **Supported provider path:** approve investigation/design of an officially supported conditional-write/transaction/fenced-lease transport with verified authentication and semantics. Do not assume an underlying API is accessible.
- **Separate transactional-storage option:** if no supported path exists, approve a separately scoped transactional durable account/state store while preserving existing auth behavior. No PostgreSQL or other new storage architecture was installed in this phase.
- **Controlled adoption:** after the storage decision, approve protected production compatibility checks, immutable backup/key escrow verification, coordinated writer quiescence and manifest adoption. No production snapshot copies into development.
- **Deployment/recovery:** separately approve a tested rollout and any exact restore/import/data rollback. This repair request authorizes none of those actions.

Until those decisions and tests are complete: leave production untouched and do not remove the provider fence just to make tests green.

## 8. Data safety and rollback

Development source can be restored from the reviewed baseline checkpoint, or by selecting the appropriate platform checkpoint. Neither action restores missing production writes. The original forensic artifacts remain independently available.

Before an eventual approved production transition:

1. Establish an immutable known-good generation with critical records, related JSON and complete media references/objects.
2. Preserve matching keys in restricted escrow and verify decryptability in the protected context.
3. Record only approved aggregates and opaque fingerprints outside it.
4. Retain the current generation and candidate separately; validate before activating.
5. Quiesce/fence all old writers; test admission, commit and crash recovery with the actual chosen backend.
6. Keep application rollback and data rollback separate. Never delete newer data to make an older application start.

No automatic production adoption/migration/repair command is supplied.

## 9. Test methodology, expectation changes and evidence

All original 34 scenarios are rerun; none is deleted or silently reclassified as successful startup. Test storage is a temporary filesystem mock and HTTP uses random loopback ports. Child environments do not inherit production credentials. Before/after synthetic counts and hashes accompany each result.

Negative tests that previously continued past a broken guard now accept only specific documented error codes when rejection is the correct invariant: T08/T09/T10/T11/T12/T13/T14/T15/T19/T23/T27/T28/T34. Shrink guards additionally assert persistent bytes unchanged. Unknown exceptions remain BLOCKED.

Positive provider-dependent tests remain BLOCKED rather than being changed to expect successful maintenance. T18 remains FAIL. T25/T26 test refusal/preservation only; they do not establish available remote recovery. R03/R04 independently test actual maintenance readiness. R01 explicitly tests the **non-production local server**, not a bypass of production admission.

The harness exits nonzero for any FAIL/BLOCKED. Expected current nonzero exit is evidence of unresolved work, not a passing release.

Run:

```sh
node scripts/forensics/persistence-harness.cjs
node scripts/forensics/repair-report.cjs
```

The generated complete report is `generated-artifacts/repair/P0_PERSISTENCE_REPAIR_REPORT.md`. Its comparison table and source fingerprints come directly from recorded evidence. Do not overwrite the original forensic result directory.

<!-- TEST_COMPARISON -->

**Final decision: NO-GO. Independent development repairs and containment are implemented; safe mutable production persistence and activation remain unavailable. Stop for review.**
