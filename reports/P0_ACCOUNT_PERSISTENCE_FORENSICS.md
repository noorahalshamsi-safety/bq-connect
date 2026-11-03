# BQ Connect — P0 Account Persistence Forensic Report

**Status: ROOT CAUSE NOT VERIFIED. No production fix applied.**

**Investigation date:** 3 November 2026. All timestamps below are UTC; add three hours for Riyadh.

**Scope:** Account disappearance after Republish, continuing the initial audit—not a new broad security audit. Evidence consists of current source, tracked configuration history, revision-scoped telemetry, an allowlisted metadata read, and isolated synthetic experiments.

## 1. Executive findings and confidence

| Finding | Classification | Evidence and limits |
|---|---|---|
| The reported production incident was caused by Republish deleting account records | **NOT VERIFIED** | No incident window or authoritative pre/post membership baseline was supplied. No production account objects were opened. |
| Sampled Nov 3 startups advertise eight accounts throughout | **VERIFIED, aggregate metadata/logs only** | Startup snapshots and the configured bucket's index report eight accounts. This does not establish which accounts were present, whether intended employees could sign in, or that index counts describe archive contents exactly. |
| Normal clean restore/rebuild preserves synthetic accounts, sessions, posts and media | **VERIFIED in isolation** | T01–T04 and T30 run the real copied startup/server with mocked storage and compare core file integrity. This is not a real Replit republish. |
| Authentication failures can look like disappearance while records remain | **VERIFIED mechanism** | Missing session key, a different key, stale session generation, revocation, employee-directory mismatch, and foreign-key 2FA imports are distinguished by T10, T11, T20, T23, T32 and T33. Their occurrence in the reported incident is **not verified**. |
| Current persistence safeguards permit actual data loss or mixed generations under specific failures | **VERIFIED mechanisms** | Reproduced stale-writer overwrite, gradual account shrink, unflushed-write loss, incoherent snapshot counts, and partial restore/import commits. T31 starts the real copied server after an injected restore-promotion failure. |
| A storage identity change caused the incident | **NOT VERIFIED** | Two tracked configurations share the same bucket fingerprint. Earlier configuration has no explicit link. Runtime logs do not identify the resolved bucket. |
| The latest import removed existing account IDs | **Not supported by the observed import metadata or merge algorithm** | Last operation reports `+0 accounts`. Merge is add-only for missing account keys; existing keys win. This is not proof that all intended account credentials were usable beforehand. |

**Bottom line:** There is no basis to call the production incident resolved, or to select one cause as likely over the others. There are verified P0 failure mechanisms to correct, but reproducing them synthetically does not establish production causality.

### Safety and access boundaries

- No production code/configuration changes, publish, restart, restore/import, recovery, reset, migration, deletion or key rotation were performed.
- No live authentication endpoint was called. HTTP tests went only to temporary loopback servers containing invented identities.
- Production metadata access was limited to existence checks and the seed marker, vault index and last-operation result. Account objects, key contents, employee records, archives and media were not downloaded.
- Actual bucket identifiers are represented only by fingerprints. There are no employee identifiers or credential values in this report.
- Only forensic scripts, documentation and generated-output ignore rules were added in development. The application source and `.replit` were not changed.

## 2. Storage identity and historical evidence

### 2.1 Configured bucket versus resolved runtime bucket

The workspace's explicitly linked bucket has SHA-256 fingerprint **`ce11c603901c`**. A read using that explicit bucket ID succeeded at **2026-11-03 10:05:08.417**.

This establishes the identity of the **configured bucket inspected**, not an independently observed runtime identity for every deployment. Production `storage-sync.js:202–205` constructs `Client()` without an explicit bucket ID. Its resolved platform default is not logged or bound into a dataset manifest.

Matching snapshot timing and counters correlate the inspected metadata with the sampled startup activity, but matching counters are not identity proof.

| Tracked configuration timestamp | Bucket fingerprint | Meaning |
|---|---|---|
| 2026-11-02 08:22:02 | No explicit default-bucket link in that file version | Does not prove the runtime had no default bucket; platform linkage can exist outside that tracked text. |
| 2026-11-03 09:27:29 | `ce11c603901c` | Explicitly linked configuration. |
| 2026-11-03 09:55:31 | `ce11c603901c` | Same configured bucket after development-preview setup. This is not evidence of a new production deployment. |

**Historical consistency conclusion:** Same configured identity in two recorded versions: verified. Same resolved runtime bucket across all relevant deployments: **not verified**.

### 2.2 Seed marker and expected identity

`meta/bq-storage-seeded` exists. Its value is an ISO timestamp, **2026-11-03 07:51:52.335**, fingerprint **`769e54bfd46e`**.

The marker contains no bucket binding, app/dataset UUID, generation, critical-file inventory or hashes. `storage-sync.js:14,70–76,88–113` uses marker existence, not an authenticated expected dataset identity. Any `data/` object satisfies `hasData`; required critical objects are not validated as a set.

Consequences:

- Previously seeded storage with no `data/` objects is blocked: T07.
- A different empty, unmarked bucket is treated as a fresh destination and may be seeded from bundled data: T13.
- A populated wrong dataset with equal counts can pass: T12.
- The marker timestamp does not establish which employee population was authoritative at that time.

### 2.3 Current allowlisted metadata

Existence checks found the marker, `data/accounts.json`, `data/session.key`, `data/backup.key`, `data/employees.json` and `vault/index.json`. Neither restore nor import request existed at observation time. **Existence is not validity, membership or decryptability.**

Vault index fingerprint: **`6b81f4becd62`**.

| Snapshot entry time | Reason | Name fingerprint | Accounts | Non-story posts | Employees | Archive bytes / files |
|---|---|---|---:|---:|---:|---:|
| 09:41:19.222 | merged | `478231b0df30` | 8 | 17 | 6,311 | 1,327,794 / 26 |
| 09:41:17.779 | preimport | `7bda8d19a596` | 8 | 2 | 6,311 | 1,326,268 / 26 |
| 09:27:18.169 | start | `0b4e1baa286d` | 8 | 2 | 6,311 | 1,326,269 / 26 |
| 09:27:17.488 | stop | `68e58584e3af` | 8 | 2 | 6,311 | 674,009 / 25 |
| 08:32:17.184 | start | `ed41b7e1649d` | 8 | 1 | 6,311 | 673,898 / 24 |

All entries above are dated 2026-11-03. Entry timestamps are initialized before snapshot work completes; they are not atomic commit times.

The last-operation result advertises a successful import, initialized at **09:41:17.717**, with `added = { accounts: 0, posts: 18, media: 7 }` and resulting counts `8 / 17 / 6,311`.

No archive was opened to verify these advertised counts. T24 shows why that distinction matters: the source can publish index counts from a different moment than the archived records. Archive size/file-count changes alone do not establish account loss or corruption.

### 2.4 Revision-scoped telemetry review

Read-only deployment telemetry reports a public VM deployment and a successful current build. Sampled successful builds were at **08:28, 09:22 and 09:36** on Nov 3.

- **08:32:17:** restored 33 files; subsequent startup snapshot logged eight accounts and one post.
- **09:27:17:** restored 34 files; subsequent startup snapshot logged eight accounts and two posts.
- **09:41:17:** restored 35 files; pre-import snapshot logged eight accounts/two posts; import logged `+0 accounts, +18 posts, +7 media`; merged snapshot logged eight accounts/17 posts.
- Sampled Nov 2 startup logs reported restores of 28 and 30 files, but returned no vault account totals.
- Transient startup healthcheck 500s appeared around the Nov 3 startup windows. No retrieved log connects them to account loss.
- Targeted recent-revision searches returned no maintenance/retry/drop matches. That is limited sampled evidence, not proof those paths never occurred.
- A Nov 2 11:45 failed build was followed by successful builds; there is no evidence tying it to account persistence.
- Retrieved revision logs/build metadata did not provide historical bucket identity. Runtime/capacity metrics are not employee-record counts.

## 3. Exact startup and mutation paths

Line references apply to the unchanged application source fingerprinted in section 8.

### 3.1 Startup sequence

```text
start.js
 |
 +-- storage.enabled() false ---------------------> require(server.js)
 |                                                  [guards bypassed]
 |
 +-- storage.enabled() true
       |
       +--> bind maintenance placeholder (HTTP 200)
       |
       +--> connect -> list data/backups -> sequential download/tmp/rename
       |       |
       |       +-- failure -> retry/backoff; do NOT load real server yet
       |
       +--> read pending restore and pending import
       |
       +-- restore request exists?
       |     YES -> snapshot current local -> decrypt to staging
       |            -> promote each file separately -> record result
       |            -> delete request even on failure
       |            -> if successful: trust/reset sync count baseline
       |            -> skip ordinary checkDrop EVEN WHEN RESTORE FAILED
       |
       |     NO  -> checkDrop(index[0].counts, local counts)
       |            -> detected drop: remain in maintenance
       |            -> unreadable/missing index: empty baseline, no objection
       |
       +--> import request exists?
       |       -> load supplied archive key -> pre-import snapshot
       |       -> decrypt stage -> merge accounts, then posts, then media
       |       -> record result; delete request/key even on failure
       |       -> startup does not inspect result.ok
       |
       +--> release placeholder
       +--> sync.start() queues upload scan and 5-second interval
       +--> require(server.js)
       |       -> auth loads secret (may regenerate), then accounts
       |       -> employee directory loads into lookup structures
       |       -> actual server listens
       |
       +--> asynchronous vault snapshot
               reason is based on request presence, not successful commit

Shutdown:
  sync.stop()/flush -> snapshot if changed, limited to 15 seconds -> exit
  HTTP acceptance is not explicitly quiesced first.
```

References: `start.js:41–56,58–87,89–104`; `storage-sync.js:88–114,179–199`; `vault.js:127–156,180–207,275–299`.

During ordinary download interruption, the real server waits for successful restore: T05/T30. Maintenance nevertheless returns HTTP 200 (`start.js:22–30`), so an HTTP-200 probe is not evidence of data readiness.

During failed **recovery promotion**, the protection is different: a restore request takes the branch that skips `checkDrop`, while startup continues even if the recovery failed. T31 reproduced this through the real copied `start.js` and `server.js`, not a mocked HTTP handler.

### 3.2 Account creation, modification, replacement and invalidation

| Path | Relevant functions and exact locations | Persistence effect |
|---|---|---|
| Initial/auth reload | `auth.js:32–38,48–83` — `readJsonFile`, `loadSecret`, `syncAccounts`, `saveAccounts` | Initial malformed account read falls back to `{}`; valid external file reload replaces the in-memory object graph. Missing/invalid session secret generates a new secret. |
| Account creation/password writes | `auth.js:93–100,165–220` — `ensureAccount`, `checkLogin`, `allowReregister`, `setPassword`, `setPending` | Skeleton creation, password/KDF changes, pending-password promotion and registration reopening; whole account-file writes. `setPassword` keeps an account reference across an asynchronous hash operation. |
| Session/device/terms updates | `auth.js:223–324` — `revokeSessions`, `revokeSession`, `rememberDevice`, `acceptTerms`, `signSession`, `readSession` | Version bumps, session-array edits and periodic last-seen writes; these do not intentionally delete the account. |
| 2FA/email/recovery | `auth.js:337,356–372,418–494` — `seal`, `unseal`, `beginTwoFactor`, `confirmTwoFactor`, `checkTwoFactor`, `renewRecovery`, `linkEmail`, `disableTwoFactor` | 2FA ciphertext/recovery derivations depend on the session secret. Each path persists account state. |
| HTTP and administrative entry points | `server.js:3060–3178,3256–3306,3881–3901`; `set-password.js:99–103` | Login, registration, pending/password reset, logout/revocation and administrative re-registration/2FA reset invoke auth functions. These scripts/routes were not executed against production. |
| Object restore and sync | `storage-sync.js:88–114,117–177` | Remote file replaces local account file by rename. Upload replaces remote object unconditionally. Shrink guard compares counts, not generation/membership. |
| Explicit archive restore | `vault.js:159–207` — `unpack`, `applyRestore` | Per-file overlay replaces account JSON and potentially session secret with archive versions. No all-files atomic commit; files absent from the archive remain locally. |
| Archive import | `vault.js:230–273,275–299` — `mergeInto`, `applyImport` | Adds only missing account keys; preserves existing keys, including possibly incomplete existing entries; merges posts/media separately. No whole-operation rollback. |
| Snapshot/key handling | `backup.js:38–52,97–155`; `vault.js:58–115` | Missing backup key can be generated for a new archive. Snapshot excludes media and backup key; fingerprint used to decide snapshot changes excludes key/media changes. |

No ordinary account-delete function was found among these relevant paths. That does **not** make records deletion-proof: wholesale file replacement, stale writers, fallback writes and gradual shrink can remove account entries without a dedicated delete-account route.

`auth.js:41–46` uses per-file temporary-write/rename, not a multi-writer transaction. Atomic replacement prevents a partially written individual file from normal auth writes; it does not prevent last-writer-wins lost updates.

### 3.3 Scheduling and applying imports/restores

`restore.js` is an operational CLI, **not safe to run as a read-only production checker**. Its default/check path reads live record objects; its merge/restore paths can upload or schedule recovery.

- `restore.js:61–110` prepares a merge by uploading an archive/key and writing `meta/import-request.json`.
- `restore.js:113–139` schedules selection of an archive through `meta/restore-request.json`.
- `start.js:67–79` consumes requests on startup. Republish can therefore activate a request created earlier; republish itself does not construct that request.
- `vault.js:212–220` validates import path shape, not account lineage. Restore accepts a syntactically permitted archive name (`vault.js:138–156`).
- Existing account keys win on merge (`vault.js:233–241`), irrespective of whether an older candidate has better credentials. Absent archive accounts are **not deletions**.
- Existing post IDs win. Missing/duplicate IDs are skipped; colliding post numbers are renumbered (`vault.js:243–259`).
- Media copies only missing paths; existing media wins (`vault.js:261–272`).
- Other application JSON state is not merged. The old session secret is not adopted or used to rewrap imported 2FA.
- Neither operation is atomic across accounts/posts/media. On an exception, both log wording implying unchanged data even though prior file commits can remain (T25/T26).
- `applyRestore` deletes its request regardless of success. `applyImport` deletes its request and uploaded key regardless of success; it retains the archive on failure. Result-upload/delete outcomes are not enforced as a commit protocol.
- Source order places regular sync after these operations, so ordinary startup sync does not run midway through this process in that same process. Another revision/writer is not excluded, and failed partial state can be synchronized after startup proceeds.

## 4. Why the post counts changed from 2 to 17

This change is associated with the logged import, **not evidence of account loss**.

Two different counters are involved:

1. `vault.js:27–32` counts posts excluding `type === "story"`.
2. `vault.js:249–257` increments `added.posts` for every newly merged post-array entry, including stories.

T22 reproduces the exact arithmetic with invented content:

```text
2 existing non-story posts
+18 newly merged entries (15 non-story posts + 3 stories)
=17 non-story posts reported by the vault
```

This is a demonstrated explanation consistent with production metadata. The actual type breakdown was **not verified**, since production post objects were deliberately not inspected and concurrent activity is not ruled out. It is not appropriate to infer either account loss or archive corruption from `2 + 18 != 17`.

Account counts remain eight in the pre-import and merged metadata, and added-account count is zero. Equal totals do not prove equal membership or usable authentication.

## 5. Distinguishing the failure classes safely

The following is a diagnostic design, **not additional production reads performed during this investigation**. Sensitive comparisons must run inside the authorized production context and emit only booleans/aggregates or keyed opaque fingerprints, never employee IDs, account data, keys or tokens.

| Failure class | Safe discriminating evidence to add | Synthetic evidence / limitations |
|---|---|---|
| Physically missing persistent account object/entries | Required-object existence and schema status; committed generation; aggregate hashed-account count and opaque membership-set digest versus the same committed manifest | T08/T09 distinguish object absence from baseline failure; T15/T17/T18 reproduce actual entry loss in mock persistence. Current production existence alone does not prove completeness. |
| Records exist but are not loaded correctly | Compare persistent parse/schema/count/digest against local file and auth-cache aggregate diagnostics from one generation | T27 proves malformed JSON accepted by restore can load as an empty auth fallback. A valid vault count baseline ordinarily blocks the initial drop; the dangerous full-start path additionally requires an absent/unreadable/zero baseline or other bypass. |
| Loaded account, invalid session | Account-present boolean; categorized rejection reason: signature, expiry, version, missing SID, idle timeout, ban or readiness | T33 revokes a session while preserving working credentials. T11 removes SID state without changing account totals. Do not log raw tokens. |
| Authentication secret mismatch | Compare key fingerprints inside the protected context; distinguish HMAC failure from missing account; report decryptability boolean for synthetic/approved diagnostic fixtures | T10/T20 retain four accounts but reject the prior session. T23 retains a working imported password but cannot decrypt its 2FA under the live test key. No production key was read. |
| Employee lookup/readiness failure | Auth session-valid boolean versus employee-lookup, banned, email and 2FA-readiness booleans | `server.js:88–100,214–220,911–924`. T32 has a valid loaded account/session but returns HTTP 401 because the same-size directory contains other identities. |
| Wrong/older generation or bucket | Expected dataset identity, bucket fingerprint, monotonic committed generation and manifest hashes—not counts alone | T34 blocks an older smaller generation; T11 accepts same-count stale data. T12/T13 demonstrate absent identity binding. Historical live bucket identity remains unverified. |
| Startup/sync failure | Separate phase/readiness state, last successful committed generation, pending-operation result, last successful sync and sanitized failure category | T06/T30 hold maintenance for connection/download failure. T31 shows failed recovery promotion still releasing maintenance. HTTP 200 maintenance is not readiness. |

`server.js:921–924` combines token verification with ban status, employee lookup and email/2FA readiness. An HTTP 401 from that combined gate does not identify which failure occurred and does not establish record deletion.

## 6. Isolated experiment results

**34 scenarios: 16 PASS, 18 FAIL, 0 BLOCKED.**

PASS/FAIL here refers to each stated safety/diagnostic expectation. These are **not 18 independent proven production incidents**. Several failing scenarios expose overlapping mechanisms or component paths requiring additional preconditions.

The final combined result was recorded at **2026-11-03 10:13:53.929**. Earlier results were retained only when application source fingerprints matched; targeted startup retries and added scenarios were combined with those unchanged results.

### Isolation and methodology

- Copies only a whitelist of application source into `/tmp/bq-forensics-*`; never copies workspace `data/`, `backups/`, `.replit`, production snapshots or secrets.
- Creates four synthetic employees/accounts, three posts and one story, synthetic media, fresh test keys and a real synthetic 2FA/session fixture.
- Uses a filesystem-backed App Storage test double. The production SDK is not loaded by startup workers; connection is replaced before copied `start.js` runs.
- Child environments are explicitly constructed rather than inheriting production secrets; translation/models are off. Requests use random loopback ports.
- Real copied `start.js`, `server.js`, `auth.js`, `vault.js` and `backup.js` are exercised. Failure injection is scoped to temporary workers/files.
- Every scenario records before/after local and mock-persistent account/employee/post/story/media counts and core file hashes. Fixture hashes are synthetic, not production fingerprints.
- Temporary data and keys are removed after the run. Results persist under ignored `generated-artifacts/forensics/`.
- This does not emulate every provider property, actual deployment promotion, power-loss/fsync behavior, network consistency or multi-VM scheduling. Independent auth caches model competing writers; they are not evidence that production had concurrent writers.

| ID | Scenario | Result | Observed outcome |
|---|---|---|---|
| T01 | Fresh provisioned startup | PASS | Real copied server accepts test session; core byte integrity preserved. |
| T02 | Restart | PASS | Same session/key and core records retained. |
| T03 | Clean source rebuild equivalent | PASS | New tree without local data restores complete fixtures. |
| T04 | Republish-equivalent stale bundle | PASS | Canonical mock remote replaces stale empty accounts/different bundled key. |
| T05 | Interrupted download/restore | PASS | Throws without remote writes; retry recovers full integrity. Local partial files can exist before retry. |
| T06 | Unavailable connection | PASS | Real app not loaded; maintenance HTML HTTP 200; local core unchanged. |
| T07 | Seeded marker, no data objects | PASS | Restore refused. |
| T08 | Missing accounts, valid indexed baseline | PASS | Count-drop check blocks. |
| T09 | Unreadable index plus missing accounts | **FAIL** | Index failure becomes no baseline; count check makes no objection. |
| T10 | Missing session secret | **FAIL** | Secret regenerated; four accounts remain; old session rejected. |
| T11 | Older same-count account/session generation | **FAIL** | Count gate accepts stale generation; prior session no longer valid. |
| T12 | Wrong populated dataset | **FAIL** | Other account identities with equal totals accepted by the count gate. |
| T13 | Wrong empty unmarked storage | **FAIL** | Accepted as fresh; bundled fixture data uploaded. Intended fresh provisioning and wrong-bucket boot are not distinguished. |
| T14 | Immediate account shrink 4→0 | PASS | Existing remote four-account object retained. |
| T15 | Gradual shrink 4→2→0 | **FAIL** | Both writes allowed; persistent account count becomes zero. |
| T16 | Concurrent independent auth caches | **FAIL** | Two new-account operations expect six accounts; whole-file last-writer-wins leaves five. |
| T17 | Concurrent stale sync replica | **FAIL** | Stale replica erases the other replica's newly committed account. |
| T18 | Crash before periodic sync | **FAIL** | Completed local credential write is absent on cold restore without a flush. |
| T19 | Missing remote media | **FAIL** | Account/post totals unchanged; no count-gate objection although media is missing. |
| T20 | Explicit different session key | PASS | Diagnoses intact account versus rejected signed session. |
| T21 | Merge priority, duplicate IDs and media | PASS | Existing account/post/media retained; missing account/post added; number collision renumbered. |
| T22 | Post-count arithmetic | PASS | `+18` all-type additions turns two non-story posts into 17 non-story posts. |
| T23 | Foreign-key 2FA import | **FAIL** | Password remains valid; 2FA marked enabled but TOTP valid under old key fails under live key. |
| T24 | Write between archive creation and index publication | **FAIL** | Index advertises five accounts while the authenticated synthetic archive contains four. |
| T25 | Mid-promotion restore failure | **FAIL** | Returns failure after replacing accounts; failed request deleted; original file not preserved. |
| T26 | Mid-merge import failure | **FAIL** | Returns failure with a new account already committed; failed request deleted. |
| T27 | Malformed critical JSON | **FAIL** | Component restore accepts corrupt JSON; auth fallback/write produces a one-account replacement. See baseline precondition above. |
| T28 | Missing backup key | **FAIL** | New backup key generated; old synthetic archive cannot be opened with current key. |
| T29 | Async password change versus account reload | **FAIL** | Password-change promise completes, but detached-reference mutation does not persist the new password. |
| T30 | Actual startup with interrupted download | PASS | Maintenance observed; retry finishes; full core integrity and test session recover. |
| T31 | Actual startup after failed recovery promotion | **FAIL** | Failure is logged, but real copied server serves session HTTP 200 after partial promotion; newer synthetic field is lost. |
| T32 | Directory mismatch versus disappearance | PASS | Account loaded and session valid; HTTP 401 from mismatched directory; account count still four. |
| T33 | Session revocation versus disappearance | PASS | Old session rejected while account and password remain valid. |
| T34 | Older generation with lower count | PASS | Three accounts versus indexed four is blocked. |

### Reproduction

```sh
# Synthetic, local-only experiments. Expected exit code is currently 1:
# failed safety expectations are intentionally exposed, not hidden.
node scripts/forensics/persistence-harness.cjs

# Optional selected rerun; combines only matching-source results.
node scripts/forensics/persistence-harness.cjs --only=T31
```

`scripts/forensics/read-storage-metadata.cjs` is a **separate networked, read-only metadata collector**. It is not part of the synthetic harness. It must not be expanded to download records/keys or invoke `restore.js` under the guise of inspection.

## 7. Risk assessment and minimal proposed P0 corrections

**Proposals only. None of the following application changes were applied.**

### 7.1 Accounts

**Verified risks**

- `storage-sync.js:149–158`: shrink protection only applies when the previous count is at least four and the next is strictly below half. Therefore 4→2→0 is accepted. Count baselines are local to a sync instance, not a remote compare-and-swap.
- `storage-sync.js:156–158`: unconditional object upload permits stale-replica overwrite. `auth.js:41–83,206–220` permits whole-file and async-reference lost updates.
- `storage-sync.js:7–8,117–158` plus `server.js:3166`/`auth.js:206–211`: a local acknowledged credential mutation is not synchronously committed to durable storage. A five-second poll plus settling period is not zero-loss persistence.
- `vault.js:186–205,233–259,283–297`: operations can partially commit and then discard retry requests. `start.js:69–83` may serve that state.
- `auth.js:32–59`: silent fallback is unsafe when critical data is expected to exist. The valid-index guard helps but fails open when its own baseline is unavailable.

**Minimum correction sequence**

1. **Fail closed before auth loads:** validate critical JSON schemas, key lengths/format, required file membership, expected dataset identity and a committed manifest. Distinguish deliberate first provisioning from an existing production dataset. Missing/unreadable integrity baselines are errors, not an empty fresh store.
2. **Stop on any recovery failure:** require `result.ok` before releasing maintenance; preserve request, archive and supplied recovery material on failure; report partial state honestly. Revalidate the committed generation after recovery, not just before it.
3. **Make recovery transactional:** stage and validate a complete generation, then activate it through a recoverable atomic pointer/journal. Do not represent a sequence of individual file renames as an atomic restore. Define explicit overlay-versus-exact-restore semantics.
4. **Protect account membership:** refuse any unexplained removal, rather than allowing percentage shrink. Legitimate administrative removal must be separately authorized/audited; ordinary account paths currently do not delete accounts.
5. **Serialize and durably commit account mutations:** lock the entire read/modify/async-hash/write operation, avoid detached references, and establish one writer or a verified provider-supported conditional generation protocol. A process-local lock alone does not protect overlapping revisions.
6. **Close the crash window:** acknowledge credential changes only after a durable commit or durable journal. Surface flush failures; quiesce HTTP writes before final flush/snapshot. Reducing the poll interval alone does not provide this guarantee.

The current SDK calls do not establish a compare-and-swap protocol. Any proposed provider generation/lease mechanism must be verified as supported; adding an unrecognized option or a local “lock” flag is not a distributed lock. No database/authentication migration is required or authorized by this report.

### 7.2 Sessions and 2FA

**Verified risks**

- `auth.js:48–58` can replace a missing/invalid session secret; `storage-sync.js:12` protects only push keys as write-once, not session keys.
- Secret changes invalidate signatures and change 2FA encryption/recovery derivations (`auth.js:294–324,337,356–372,443–471,700–702`).
- A foreign-key account import copies sealed 2FA unchanged and does not rewrap it (`vault.js:233–241`). T23 reproduces password success plus unusable TOTP.
- The observed production import added zero accounts, so that operation's newly imported-account 2FA mechanism is **not demonstrated as the incident cause**.
- Version/SID/idle/expiry checks and readiness/directory gates can reject legitimate-looking login state without deleting account records.

**Minimum corrections**

- For an existing dataset, treat missing/invalid authentication secrets as a startup error; never silently regenerate them.
- Bind the expected key fingerprint to the dataset manifest without exposing key material.
- Reject importing encrypted 2FA from a different key domain unless a separately approved and synthetically tested in-place rewrap is available. Do not silently disable 2FA, rotate the live key or force employee re-enrollment.
- Add sanitized categorical diagnostics to separate missing records from session and readiness failures.

### 7.3 Posts and snapshots

**Verified risks**

- Snapshot creation reads files asynchronously, and index counts are sampled after archive upload (`backup.js:109–155`; `vault.js:94–115`). T24 produces archive/index disagreement.
- Index updates are unconditional whole-object writes, without a committed generation lineage. The drop check trusts the first advertised entry (`vault.js:79–90,104–111,127–136`).
- Account/employee drops are checked, but equal-count substitutions are invisible. Post drop protection only applies to a previous total of at least ten and a drop below half.
- Generic social JSON writes are not atomic (`server.js:169–173,1406–1417`).
- Noncritical missing local files can be deleted remotely; bounded deletion guards are not a record/media referential-integrity check (`storage-sync.js:166–176`).

**Minimum corrections**

- Freeze or copy one consistent generation under the writer discipline; derive archive counts and hashes from exactly those staged bytes.
- Validate archive authentication/manifest before publishing its authoritative generation pointer.
- Preserve immutable prior committed generations and prevent index lost updates/rollback through a supported atomic commit mechanism.
- Use consistent counters: distinguish all entries, non-story posts and stories explicitly in both import output and snapshot metadata.

### 7.4 Media and backup keys

**Verified/static risks**

- Vault snapshots explicitly request `skipMedia: true` (`vault.js:100`), and `backup.js:97–107` skips that directory when requested. They are not full media recovery backups.
- Snapshot change detection excludes key/media changes (`vault.js:58–76`).
- Missing media does not block the current count check (T19); remote deletion propagation can remove individual noncritical media objects.
- The backup key is excluded from archives. A missing key can generate a new one for subsequent snapshots, leaving old archives inaccessible with the new current key (T28).

**Minimum corrections**

- Include media-reference integrity and immutable media recovery/versioning in the committed generation design, or explicitly label vault archives incomplete for media recovery.
- Keep required decryption keys in a separately controlled, verified escrow process; do not put plaintext keys into reports or development fixtures.
- Refuse backup-key regeneration for an existing dataset; distinguish first setup explicitly.
- Include key/media state in backup-change detection and fail safely on missing referenced objects rather than declaring full recovery success.

### 7.5 What already fails safely, and what does not

| Condition | Current behavior |
|---|---|
| Storage connection/download fails during normal bootstrap | Retries before real-server load; synthetic tests pass. Maintenance returns HTTP 200, not a readiness guarantee. |
| Seeded bucket loses every data object | Refuses normal restore, unless an explicit override is used. No override was used here. |
| Indexed account count drops | Usually blocks; index read failure and same-count substitutions are not protected. |
| Large immediate mirror account shrink | Blocks some changes; threshold bypass permits gradual total loss. |
| Missing/invalid session key | Auth may generate another key; does not fail closed. |
| Wrong populated bucket/same totals | No identity fence; count gate accepts. |
| Explicit restore/import partially fails | Can leave partial state, discard retry material and continue startup. |
| Missing referenced media | No count-gate detection; vault snapshot cannot supply omitted media. |
| Archive/index generation disagrees | No authoritative content validation before index publication. |

## 8. Backup, rollback, evidence and approvals

### 8.1 Required backup/rollback plan before remediation

This is a plan, **not a production backup or recovery performed here**.

1. With explicit approval and within a controlled production recovery context, establish a known-good immutable generation covering accounts, employee directory, sessions, posts, related JSON state and media references/objects.
2. Preserve the matching authentication and backup decryption keys through restricted escrow. Verify decryptability without exporting records or key values into development or reports.
3. Record only approved aggregate counts, opaque identity fingerprints, generation, file/object hashes and authentication/manifest validation results outside that context.
4. Keep the current generation and any candidate recovery generation separate. Validate a candidate before changing an authoritative pointer; no blind older-snapshot overlay.
5. Test every code correction against this synthetic harness first, including failed promotion, stale writers, abrupt shutdown and unavailable storage.
6. Production rollout must quiesce or safely coordinate writers, retain the previous application release and immutable data generation, and define a clear rollback trigger.
7. A **code rollback must not automatically roll back employee data**. Data rollback is a separate approved action; reverting application files cannot recover writes absent from durable storage.
8. After an approved rollout, observe aggregate commit/readiness diagnostics and reconciliation. Any real employee sign-in validation requires separate explicit authorization; it was not performed here.

### 8.2 Evidence needed to verify incident causality

The following remain **BLOCKED by missing evidence or deliberate scope restrictions**, not failed synthetic tests:

- An incident time window and the relevant pre/post publish events.
- An authoritative sanitized pre/post account-membership baseline—not just equal totals.
- Safe historical resolved bucket/dataset identity for those runtime revisions.
- Evidence linking affected-account failures to missing entries versus load, directory, readiness, session-key, SID/version or 2FA errors.
- Archived-content validation in an authorized protected context; current index metadata alone is insufficient.
- Real platform republish/promotion and live-account validation, prohibited in this investigation.

No request for passwords, keys, employee identifiers or production snapshot copies is necessary to provide that initial incident window and aggregate evidence.

### 8.3 Approval gates

Before proceeding beyond this report, obtain explicit approval for each applicable action:

1. **Implement proposed guards/transactions in development.** No production data needed; extend synthetic tests.
2. **Perform additional protected production diagnostics or escrow/backup verification.** Define the exact read scope and sanitized output first.
3. **Publish a tested code change.** Separate approval for deployment and its writer-coordination plan.
4. **Execute any production restore/import, repair, key-domain rewrap or data rollback.** Independently authorize the exact generation and rollback plan. No key rotation, reset, recovery or override flags are implicitly authorized.

No follow-on work is started by this report.

### 8.4 Reproducibility artifacts

- `scripts/forensics/persistence-harness.cjs` — experiment runner and synthetic before/after integrity checks.
- `scripts/forensics/file-storage.cjs` — temporary-root-guarded filesystem storage double.
- `scripts/forensics/startup-worker.cjs` — sanitized child startup and recovery-promotion fault injection.
- `scripts/forensics/read-storage-metadata.cjs` — explicit-bucket, allowlisted read-only metadata collector.
- `generated-artifacts/forensics/test-results.json` — 34 results, safety expectations and synthetic integrity evidence.
- `generated-artifacts/forensics/storage-metadata.json` — sanitized metadata observation.

The generated directory is ignored by Git and deployment packaging. Reports/scripts remain available for review; temporary fixture data is removed.

Source SHA-256 prefixes used for the experiments:

| File | Fingerprint |
|---|---|
| `start.js` | `48e053cea915` |
| `storage-sync.js` | `bce5892ec7bb` |
| `vault.js` | `583f69c8645b` |
| `auth.js` | `8b61ba9e3a61` |
| `backup.js` | `07db1685718c` |
| `server.js` | `a367e042a8a5` |
| `moderation.js` | `11b6ca0cb9c8` |
| `push.js` | `f70113ec0f33` |
| `spark-agent.js` | `40609c6f4615` |
| `translate.js` | `9a1af06741a9` |

**Application source unchanged during tests: verified. Production incident resolved: not claimed. Investigation stops here at the requested report and proposed fixes.**
