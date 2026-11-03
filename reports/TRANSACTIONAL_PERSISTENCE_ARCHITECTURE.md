# BQ Connect — transactional persistence architecture and migration design

**Decision date:** 2026-11-03. **Scope:** design and synthetic validation only.

**Release remains NO-GO.** Nothing in this document approves publishing, removing a fence, provisioning a production schema, importing real records, restoring production, deleting JSON/media, rotating keys, or replacing live authentication.

## Executive decision

Recommend **PostgreSQL as the sole transactional application authority, with private durable object storage for media**. Prefer Replit-managed PostgreSQL if the production provisioning, permissions, backup/recovery and availability gates below pass. Otherwise compare a separately approved external managed PostgreSQL provider; do not silently substitute one.

Do not continue the current JSON/App Storage replication model for acknowledged account writes. The installed App Storage SDK exposes overwrite uploads, but no verified conditional commit/fenced-writer protocol. Designing locks around that limitation does not create a safe distributed transaction system.

Use a **scheduled write freeze and reconciled final snapshot**, not JSON/PostgreSQL dual writes. This can prevent migration-induced loss of a complete, proven frozen dataset. It cannot prove that historical acknowledged writes were never lost before that checkpoint. Historical incident root cause and complete production membership remain NOT VERIFIED.

### What was actually verified

- All **22 current workspace JSON filenames** were mapped; **28 current/optional source paths** were inventoried. Only filenames and application source were read, not the contents of imported employee/account/settings records.
- Source contracts, readers, writers and relationships are documented in the generated inventory appendix. `mail.json` and `messages.json` have unresolved content/provenance: no current application reader/writer was found. They are not assumed to implement email delivery or direct messaging.
- Replit's development SQL service answered a **read-only settings query**: PostgreSQL 16.10, `fsync=on`, `synchronous_commit=on`. This does not verify production provisioning, application connectivity, permissions, replication durability, pricing entitlement, recovery retention or an SLA.
- A fresh Unix-socket-only PostgreSQL cluster under `/tmp` validates the design with invented fixtures. It never connects to a supplied database URL or reads an existing `data/` directory.
- Root application source, package files, deployment/workflow configuration and existing safety fences remain unchanged after this assignment. A platform-added local SQL toolchain configuration was restored through configuration validation; no production schema or record was changed.
- Existing forensic results are preserved: **43 PASS / 1 FAIL / 9 BLOCKED** across the prior 53 tests. Those are not reclassified by the architecture prototype.

## 1. Inventory and source-of-truth boundaries

The inventory distinguishes **source-contract verification** from **actual dataset verification**. No claim is made that live files are valid, complete, homogeneous, or even identical to imported workspace files.

### Implemented record domains

1. Employees, including directory-only people without accounts: stable badge strings, name, department, position, identity-check hash and phone hash.
2. Accounts: current and pending password material, KDF version, session version, timestamps, linked email, re-registration/other optional flags, terms acceptance and remembered devices.
3. Authentication children: persisted sessions, active and pending encrypted TOTP material, replay counter, remaining recovery-code hashes. Password reset/registration paths share account state rather than a separate existing reset-token file.
4. Posts, ideas, suggestions, complaints, thanks, stories, polls, articles, announcement posts and events. Stories are posts with expiry, not a new independent source collection.
5. Embedded comments/replies/likes, ratings including legacy stars, reposts, poll options/votes, status history, reports/moderation metadata, announcement acknowledgements, event attendance/reminder markers.
6. Bookmarks, views, people/department follows, profiles, groups and membership, generated daily sparks, department biographies and reviewed achievements.
7. Story highlights: **archived snapshots**, which may outlive the original story, plus cover media. Do not replace these with mandatory FKs to live stories.
8. Notifications and separately sourced legacy announcement inbox entries/read markers. Historic actor names and audit labels are not invented employee identities.
9. Admin/moderator/official-announcer configuration, conduct warnings/bans/resets, security audit log, join requests, SMTP/SMS configuration, push subscriptions/VAPID keys, backup configuration/status.

### Not existing persisted entities

Translation results are an in-memory cache in `translate.js`; model files are not business records. OTP/email challenges, ticket-consumption nonces, some authentication/rate/mail counters, place-name caches and notification echo suppression are process-local Maps. Durable `challenges`, `rate_buckets`, `requests`, `outbox`, `authority`, `recovery_points`, media metadata and migration ledgers are **proposed additions**, not discovered production tables.

`mail.json` and `messages.json` remain protected opaque originals until an approved protected inspection establishes their shape and owner. Unknown records, duplicate keys/IDs, invalid timestamps, unexplained references and unexpected fields must produce reconciliation issues—not silent defaults, truncation, ID normalization, invented employees, or dropped rows.

### Non-JSON and operational boundaries

Preserve `session.key`, `backup.key`, VAPID private material and every media byte. Existing encrypted archives and remote request/index/manifest metadata are recovery evidence, not application records to opportunistically import as authoritative state. Exclude lock/temp files from data authority. Inventory includes old CLI writers (`set-password`, `set-smtp`, `restore`) and vault/sync/startup paths, not just HTTP handlers.

Protected source inspection, production record counts, exact field/type distribution, authoritative bucket binding at cutover, original bytes, storage size and all source-record membership remain approval-gated and NOT VERIFIED.

## 2. Proposed schema and relationship model

`design/persistence/schema.sql` is a **design prototype**. The validation harness applies it only to its own temporary database. It is not an application startup migration, managed-production migration script or publish hook. The generated report includes the full DDL appendix.

### Identity and authentication

- `people(badge PK)` is the common actor registry; `employees(badge PK/FK)` is the directory subset; `accounts(badge PK/FK)` is the account subset. Official non-employee accounts are explicit system people, not fake employees. Unknown referenced identities go to reconciliation, not the login directory.
- Keep IDs as **text with exact original spelling**. Do not strip leading zeroes or merge aliases during import. Current input canonicalization must be compared against existing stored identifiers; collisions stop migration.
- `identity_aliases(namespace,alias PK,badge FK)` preserves both current key-derived public IDs and legacy public IDs. Resolve `views.json` public IDs through these aliases; do not interpret them as badges.
- Child tables model sessions, pending credentials, TOTP/recovery/setup state, devices, terms and roles. Session PK is `(badge,sid)`; ordinal columns preserve source ordering and session eviction behavior.
- Password/KDF fields accept legacy absence through an explicit compatibility mapping, not an unapproved rehash. Session version and optimistic row revision are different counters.
- `roles` represents admin/moderator/announcer grants; nonsecret configuration preserves official identity labels and allowed email domains. No email uniqueness rule is assumed: first audit current semantics.

### Social and content relationships

- `posts.id` and all existing comment/group/notification IDs remain stable text PKs. Child FKs target `people`, not only registered accounts.
- `comments(post_id,id PK)` plus `(post_id,parent_id)` FK prevents cross-post replies. Deferred validation permits loading parent/child arrays in any order. Application/import validation must additionally reject longer parent cycles.
- Ratings preserve both new like/dislike and historical star fields; do not silently convert old stars. Reposts and ratings are unique per post/actor. Poll votes are unique per post/actor with a composite FK to an actual option.
- Bookmarks, views, follows, membership, acknowledgements and event attendance have relationship PKs. Views retain the original public ID alongside the resolved person.
- `legacy_announcements` is separate from announcement-type posts. Notifications have nullable live-post FK plus original subject ID because deleted posts and achievement notifications legitimately lack a live post.
- Department profiles, achievements, profiles, highlight snapshots, sparks, join requests, conduct and audit state are modeled separately. Audit `who` remains a historical label where no authoritative person mapping exists.
- Historical snapshots, optional fields and unknown extensions are preserved alongside normalized columns. `migration_records` is a restricted immutable reconciliation ledger, **not** a replacement JSON document database for normal application writes.

### Integrity, indexing and compatibility decisions

- PKs, FKs, bounded status/type checks, unique identity aliases, per-user engagement uniqueness, same-post reply relationships, nonnegative sizes, media hashes and session version constraints are in the prototype DDL.
- Do not cascade-delete accounts, employees, posts, keys or media during adoption. Hard deletes require a separate approved retention design; existing user-visible delete/hide behavior must remain compatible through tombstones/visibility filtering.
- Post `number` is a historical display value, not the identity PK. Audit duplicates; preserve existing display numbers without silent renumbering. New numbers use the transactional `counters` row initialized above the frozen maximum. Do not reuse a legacy `MAX()+1` race.
- Preserve array order with ordinals; preserve absence versus explicit `null`, especially credential/pending fields and missing legacy KDF. Preserve original JSON bytes in encrypted escrow as well as canonical semantic fingerprints. JSONB alone cannot preserve original whitespace, duplicate object keys or exact source bytes.
- Existing source truncation (400 notifications, 3000 audit rows, bounded highlights/achievements/session lists) is an existing behavior, not permission to truncate the import. Import all frozen source rows first; apply unchanged API visibility rules without inventing a new retention policy.
- DDL indexes cover feed ordering, author/group feeds, story expiry, status queues, comment parents, notification inboxes, session expiry, reverse follows and undelivered outbox work. PK indexes cover most relationship lookup paths.
- Add measured secondary indexes for badge-centric child lookups, memberships, reports and operational recovery queries after synthetic-scale `EXPLAIN (ANALYZE, BUFFERS)` and provider connection-budget validation. Production cardinality, query plans, collation, duplicate display numbers and malformed legacy records remain unknown.
- Published schema changes must be expand/contract and backward compatible across the supported application rollback window. Do not contract columns/tables or change encryption/KDF semantics in the adoption release.

## 3. Transactions, concurrency, authorization and acknowledgements

### Runtime write contract

Use a single checked-out PostgreSQL connection for each transaction:

1. Authenticate and resolve the actor. Begin; `SELECT authority ... FOR SHARE`; require expected dataset ID, schema range, mode `postgres` and current writer epoch.
2. Establish the unique `(actor, request_id)` idempotency record. Serialize concurrent duplicate keys; reject reuse for a different operation/input digest. An existing matching committed result returns the original outcome without reapplying mutations.
3. Lock affected account/session/challenge/content rows in deterministic order, or update with `WHERE revision = expected_revision RETURNING ...`. A stale conditional update affects zero rows and returns an explicit conflict, not last-writer-wins.
4. Recheck authorization and current account/session/ban/role state inside the transaction. Perform all related relational mutations, audit insert and outbox event insert. Store the result in the same transaction.
5. Await successful **COMMIT** before sending success. Never treat local file writes, cache updates, a queued sync, an upload kickoff or an uncommitted SQL statement as a durable acknowledgement.

Compute expensive password hashes before opening a lock-heavy transaction, then recheck the expected current revision/hash. Lock account/session rows consistently; verify password-reset/pending-password promotion against current state after asynchronous work. Use bounded retry for serialization/deadlock failures and require the original idempotency key.

If the network fails while committing, the result may be **unknown**, not necessarily rolled back. Reconnect and query the same idempotency key. Do not blindly repeat the credential mutation, clear account state or acknowledge success from a cache.

### Transaction boundaries

| Operation | One atomic database unit |
|---|---|
| Registration/password creation | Existing directory identity + registration eligibility, pending promotion/current credential, session version, audit, idempotency and outbox |
| Password change/recovery | Expected credential revision + replacement hash/salt/KDF, version increment/revocation rules, pending clear, audit and notification outbox |
| Session creation/revoke/logout-all | Account version/ban checks + session rows/last-seen/eviction, with consistent lock order |
| TOTP confirmation or recovery use | Current sealed key/setup expiry + monotonic counter or single recovery hash consumption + audit; concurrent reuse has one winner |
| Join approval | Unique employee identity + request resolution + directory/account eligibility + audit |
| Post/comment create/edit/delete | Ownership/visibility/group/reply-policy checks + normalized children/media references, source-compatible visibility/tombstone state and outbox |
| Toggle/vote/follow/bookmark | Existing relationship state + unique constraint + notification/outbox; represent explicit desired state on retries rather than re-toggling blindly |
| Moderation | Current role + post/conduct state + warning/ban/session revocation + audit/outbox |
| Recovery activation/freeze | Authority row `FOR UPDATE`, epoch increment and mode change; wait for earlier `FOR SHARE` writer transactions to finish |

No SQL/object-storage distributed transaction is assumed. Publishing a post with newly uploaded media uses the media readiness protocol below.

### Authorization and sessions

Preserve current route-level policy, including directory membership, email/2FA readiness, bans, official-account restrictions, hidden departments, complaints, department approvers, group membership, owner/moderator/admin actions and reply scope. These are requirements for an adapter, not implemented by FKs. Add negative owner/admin/moderator/department tests for every mutation.

Read session version, SID membership, expiry, idle status and current ban/readiness from the authoritative primary database. Do not allow a stale read replica/cache to accept revoked credentials. Last-seen batching must preserve the current idle limit; session write conflicts cannot cause silent login success or mass logout.

Runtime credentials must not own schema, disable constraints, alter authority or run DDL. Separate restricted app, outbox, media-cleanup and operator responsibilities. Operator-only access governs activation/restore; the runtime may read the authority row but not change it. Whether required managed-production roles/grants can be provisioned through the supported workflow is an explicit approval gate. No unsupported custom production DDL/grant script is supplied.

The prototype tests row locks and conditional updates. It does **not** implement an app-wide database adapter or prove every runtime caller respects the authority/authorization contract.

## 4. Authentication preservation and continuity limits

| Material | Compatibility requirement |
|---|---|
| Passwords | Copy hash/salt bytes exactly; absent `kdf` means existing scrypt v1 (`N=32768,r=8,p=1`), current v2 uses `p=3`, 64-byte output and hex-decoded salt. Preserve current upgrade-on-success with CAS. No mass reset/forced migration rehash. Unknown KDF blocks that record, not its deletion. |
| Sessions | Preserve badge, account `ver`, SID, issue/lastSeen/expiry, IP/device and ordinal. Keep token payload/signature/base64url parsing and session-list limits. Existing nominal TTL is 3 days, idle limit 24 hours; admin session override is 12 hours. No TTL extension to conceal migration downtime. |
| Session key | Preserve exact existing `session.key` bytes in approved secure configuration and protected escrow. Never generate a replacement on missing/invalid data. HMAC uses the existing representation, not a newly decoded/reformatted key. |
| Public IDs | Preserve current `derive:public-id` derivation and legacy fixed-pepper IDs. Derive alias membership in a protected environment; do not expose badges/key material through public ID reconciliation reports. |
| TOTP | Preserve AES-256-GCM sealed string, key derivation `HMAC(session.key,'totp-vault')`, enabled state, activation timestamp and replay counter. Preserve pending setup sealed key/expiry. No foreign-key-domain merge, disabling, decryption/re-encryption or recovery-code regeneration. |
| Recovery codes | Preserve existing badge/key-bound hashes and remaining membership/order. Compare/consume atomically once. Backup decryptability separately depends on unchanged `backup.key`, not only session key. |
| Pending passwords/registration | Preserve pending hash/salt/KDF/expiry, `reregisterUntil`, timestamps and eligibility; preserve 30-day join request records without running their read-time filter during export. Do not auto-promote pending credentials. |
| Roles/status | Preserve explicit admin/moderator/system-person grants, bans/warnings/resets, linked email, terms, remembered devices, readiness/registration flags and all unknown extensions. No assumption that missing employee == account deletion or that empty role data grants authority. |
| SMTP/SMS/VAPID | Preserve independently in secure configuration. Do not put passwords/tokens/private JWKs into ordinary settings/ledgers/logs. Missing VAPID material must fail explicitly, not trigger current auto-generation behavior. No actual rotation performed. |

**Established sessions:** synthetic byte-preserving round-trip with the unchanged `auth.js` accepts a pre-import signed session and the existing password/2FA material. This is evidence of format compatibility, not a guarantee for all production sessions. It is not a PostgreSQL HTTP auth integration test. Expired/idle/revoked sessions remain invalid; a directory/ban/email/2FA mismatch can still reject a valid signature.

**Transient challenges cannot have guaranteed continuity.** OTP/email proofs and consumed ticket nonces currently live only in process memory. Retaining the signing key alone could re-enable consumed-ticket replay after restart. Proposed durable challenge/replay state cannot reconstruct already-forgotten nonces.

At cutover, reject the pre-cutover pending-ticket namespace, require users with unfinished flows to start a fresh challenge, and use a versioned post-cutover challenge namespace with durable consumption. Existing established session tokens are not changed. Login-stage tickets are normally 5 minutes; setup tickets can be 15 minutes; email codes last 10 minutes and SMS OTPs 5 minutes. A drain/wait option must cover the longest accepted legacy ticket lifetime, not just the default 5 minutes. Preserve persisted pending credentials/TOTP setup for the new flow subject to their original expiries. This is a controlled retry, not a password reset or 2FA disable.

## 5. Persistent media design

### Identity, references and upload consistency

- Keep a private bucket with explicitly verified binding. `media_objects` records immutable logical object identity, bucket/key, SHA-256, size, MIME, owner, readiness and legacy URL alias. Optional provider generation stays NULL unless actually supported/verified.
- Use a unique, never-reused object key per upload/version. App code must not overwrite an existing media key. Content hashes detect substitution; they do not themselves enforce storage WORM or restore lost bytes.
- First commit a pending upload intent. Stream/validate the upload and permitted MIME/size; upload to the unique key. Verify the returned result and byte integrity, using read-back hashing where the provider cannot supply a validated checksum.
- In a second database transaction, lock the upload intent, require verified bytes and expected owner, mark it ready and atomically attach it to the post/comment/profile/highlight. Acknowledge user-visible creation only after this transaction commits.
- Crash before upload: retry or expire the pending intent. Crash after upload but before attach: retain an unreferenced/pending object for reconciliation. Crash after attach but before response: recover the same result by idempotency key.
- Concurrent retry must be serialized per upload intent; if uncertain whether a key was used, allocate a new immutable key and quarantine the old candidate rather than overwrite it.

### Access controls and existing behavior

Current `serveMedia` serves a matching local media path without a session check. The proposed authenticated authorization-aware media route is a **deliberate privacy change requiring approval**, not an already implemented feature. Preserve `/media/...` aliases and Range/HEAD behavior; verify whether legacy sharing/public access is intentional before selecting per-owner/group/department visibility. Never put an access token in a durable URL.

Keep buckets private; proxy authorized reads or use short-lived signed access only if officially supported by the selected provider. Do not assume the installed SDK provides signed URLs, per-prefix IAM or native object generations.

Inline profile avatars remain preserved data URIs at initial cutover; moving them to objects is an optional separately approved lossless conversion. Include comments, post galleries, expired stories, highlight item snapshots/covers and any unknown retained media references in the protected manifest—not only current post `media` strings.

### Versions, cleanup and backup integrity

Use new immutable object keys for each logical version and retain old references for the database PITR/backup horizon. Native object versioning, object lock/WORM, retention enforcement and independently scoped old/new deployment identities are **not verified** through the installed App Storage SDK.

During migration, **disable all destructive media cleanup**. Later cleanup is two-phase: mark candidate unreachable under a consistent database snapshot, retain for a policy-approved grace period, recheck all post/comment/profile/highlight and recovery-manifest references plus upload leases, then let a separately privileged worker delete only approved versions. The snapshot and grace period must protect a reference being attached concurrently. A suggested minimum is longest PITR window plus seven days, subject to privacy/cost approval; 35 days is only an example for a verified 28-day window, not an assumed current setting.

Every recovery point binds a database snapshot/LSN or provider restore point, dataset/epoch, key-domain references and a complete media manifest of key/version/size/hash. Keep verified encrypted independent copies; restore drills must decrypt and read every referenced object, including archived highlights. A database-only PITR is not a complete recovery if associated media has been deleted.

## 6. Replit hosting and operational compatibility

### Verified versus not verified

| Option | Evidence | Decision |
|---|---|---|
| Replit-managed PostgreSQL | Official SQL, connection, development/production and recovery documentation; project development service returned PostgreSQL 16.10/on/on | Preferred candidate; production-specific recovery/permissions/availability configuration is not certified |
| External managed PostgreSQL | Replit documents connecting applications to custom/external PostgreSQL; standard Node PostgreSQL over TLS is deployment-compatible in principle | Alternative requiring explicit provider/integration selection, reachable TLS connection, region/egress/budget and recovery evidence; no external provider connected |
| PostgreSQL on this app VM's filesystem | Local PostgreSQL 16.x validates SQL mechanics only; published local filesystem is not a durable database service | Reject as production authority; do not run the prototype cluster in the app deployment |
| JSON + existing App Storage SDK | Overwrite upload API with no verified CAS/fenced transactions; prior T18 still FAIL | Reject for acknowledged transactional account state |

The app currently deploys as a VM with `node start.js`, Node 22 and file-oriented storage; it has no PostgreSQL runtime adapter/driver. No runtime dependency, app entrypoint, production command or workflow was changed for this design.

### Connections and runtime deployment

Use a long-lived, bounded Node PostgreSQL pool over verified TLS with hostname/certificate validation; do not disable verification or derive/modify a pooler hostname speculatively. Obtain only supported provider endpoints through secure environment configuration.

Start with a provisional maximum of five connections per app process, min zero, bounded acquisition/connect/statement/lock/idle-in-transaction timeouts and jittered reconnect. Certify the actual budget:

`overlapping app processes × pool max + workers + recovery/admin reserve <= provider limit`.

Do not assume a one-VM deployment prevents rolling overlap. Two app processes at five connections each, two worker connections and five reserved operator connections already require at least 17 available slots. Measure the real provider limit; reduce pool sizes or choose a supported pooler if needed. A transaction and its locks must stay on one checked-out client. Confirm prepared statement/session-state compatibility if using a transaction pooler.

After DB loss, readiness becomes 503; bounded idempotent retries may reconnect, but credentials/social writes never fall back to local JSON or acknowledge to a process cache. New process startup checks database schema range, dataset/authority epoch, key domains and media binding before readiness. Local disk is cache/temp only.

### Schema tooling and secure configuration

For **Replit-managed production**, use the supported development-schema → reviewed Publish diff path after separate implementation/cutover approval. Inspect rename/destructive warnings; never select an option replacing production data with development fixtures. Do not add startup DDL, deploy-build `db:push`, or a custom production schema migration script. Test that the selected schema objects/permissions are supported by the managed flow; if not, stop for a verified supported solution.

For an **external** production database, Replit's managed Publish schema diff does not manage that external schema. A provider-specific reviewed migration workflow would need separate approval; none is supplied or run here.

Secure environment configuration will separate development and production URLs and existing key-domain references. Use workspace/platform secret management and least privilege; never print URLs with passwords, actual signing/backup/VAPID keys or record data. Confirm how existing key bytes can be transferred to secure configuration without an operator exposing them in chat/logs.

### Backup, monitoring, cost and objectives

Official recovery documentation describes managed backups/PITR with plan-dependent windows; current project entitlement, enabled retention, failover replication, restore granularity, deletion protection, cross-region copies and restore permission checks remain unverified. Documentation describes windows up to 28 days; **do not assume this project has that window**. No exact price quote or platform RPO/RTO guarantee is inferred.

Monitor readiness, transaction/commit latency, pool wait/exhaustion, SQLSTATE errors/retries, WAL/storage consumption where exposed, idempotency conflicts, stale epochs, pending media age, hash mismatch, orphan counts, outbox lag/retry age, recovery-point age and restore-drill results. Use identifiers/redacted aggregate metrics, never passwords, full session tokens, hashes/recovery material, employee records or connection secrets in logs.

Proposed objectives, requiring owner/provider approval and measured drills:

| Failure domain | Objective | Evidence/gap |
|---|---|---|
| App crash/redeploy with healthy database | RPO 0 for successfully committed/acknowledged transactions; recovery within 15 minutes | Local fsync/WAL restart verified; hosted/application integration not certified |
| Migration cutover | No loss of the proven frozen final dataset or new PostgreSQL acknowledged writes | Conditional on full reconciliation and enforced writer freeze; historical loss cannot be disproved |
| Hosted failover/region/storage disaster | Select a provider meeting the approved account RPO; if true RPO 0 is mandatory, require documented synchronous durability/failover guarantees | `synchronous_commit=on` alone does not prove remote/synchronous replication; cannot promise zero regional data loss |
| Independent backup/PITR recovery | Provisional RPO <=15 minutes and RTO <=60 minutes, including media and key restoration | Targets only; change them or reject provider if retention/WAL/PITR behavior or measured restore cannot satisfy them |

Cost model: database compute + storage + PITR/backups + separate protected copies + media storage/requests + egress + overlapping deployment connections + monitoring/operator work. Replit uses usage-based production database billing; development service availability does not imply free production. External PostgreSQL adds provider billing, network latency/egress, separate IAM/backups and operations. No budget or media size has been approved, so no reliable monthly estimate is possible yet.

## 7. Alternatives and architecture decision

| Criterion | A: JSON/object storage with a verified transaction protocol | B: PostgreSQL + object media |
|---|---|---|
| Present support | Required CAS/leases/commit primitives have not been validated in installed SDK | Transactions, PK/FK/unique constraints, row locks and WAL validated on real PostgreSQL |
| Durable acknowledgement | Would require durable write-ahead records, a linearizable authoritative head and independently fenced writers | Commit result from authoritative database; media separately gated ready |
| Multi-writer safety | Custom conflict/replay/recovery engine and object generation binding | Native locking, uniqueness, revisions, idempotency transactions |
| Multi-file social integrity | Custom versioned immutable dataset + transactional manifest publication + rollback/reconciliation | Native cross-table transaction boundaries and FKs |
| Recovery | Custom atomic activation/index selection, key/media closure, stale-generation rejection | PITR/logical restore + bound immutable media/key manifests; provider guarantees still required |
| Migration risk | Smaller code interface change, but high protocol correctness risk and missing supported path | Larger explicit repository/adapter change, manageable with protected freeze/reconciliation and staged tests |
| Scale/maintenance | Whole-file work and contention grow with records; custom distributed storage engine ownership | Incremental row operations, indexes and established database tooling |
| Cost/complexity | Low apparent storage cost; high engineering/on-call cost and repeated whole-file transfers | Database service cost plus media; lower custom consistency-engine burden |

Choose **B**. Option A is only reconsidered if a provider officially supplies an authenticated supported conditional protocol and an independently reviewed, failure-tested transaction design. Raw undocumented transport, hidden credentials, local lock files or a capability flag are not substitutes.

## 8. Reversible, lossless migration and reconciliation plan

### Stage M0 — approve protected inventory and establish authority

This document does not authorize these steps. After approval, identify the authoritative deployed revision/processes, bucket binding, dataset generation and every source writer, including scheduled sync, snapshot/import/recovery paths, CLI jobs and background notification/media/event tasks.

In an approved **protected production-adjacent environment**, inspect schema/type distributions and aggregate counts, using least privilege. Keep actual records, keys and source archives out of development, test output, chat and project Git. Classify unexplained files and all nonstandard references before mapping them.

Build a signed/checksummed inventory manifest: original file/object versions where available, exact byte hashes/sizes, stable-ID membership fingerprints, per-type counts, nested child counts/ordinals, field-presence profiles and media closure. Counts alone cannot detect equal-count replacement. Protect membership fingerprints against exposing badges through enumeration.

### Stage M1 — immutable recovery point and key proof

After a proven write drain, capture a complete encrypted byte-preserving bundle and media manifest to independently protected storage with verified retention/immutability. An ordinary overwritable object named “backup” is not immutable evidence. Preserve source JSON/media exactly; do not initialize manifests or overwrite production pointers to create this backup.

Prove archive decryptability with the **existing** backup key, then existing session/2FA key-domain consistency, inside the protected environment. Confirm all key sources match the running deployment without exposing them. Verify every manifest object hash and run a complete restore to an isolated protected target. Approval must specify who can decrypt, approve restore, retain and destroy copies.

Stop if any key, source, media object or already-acknowledged write cannot be reconciled. A backup proven only by file existence is insufficient.

### Stage M2 — synthetic implementation and migration rehearsal

First implement a repository/transaction adapter behind the existing API/auth feature contract in development only, with synthetic fixtures. Keep current release fences until a verified replacement gate exists and its removal is separately approved.

Expand this isolated prototype into complete source/unknown-field validation and bidirectional exporters for every inventoried entity. The current prototype reverse-maps accounts/employees/posts and all embedded post children; other source files are preserved in its immutable synthetic ledger, with many relational import checks, **not a completed production reverse exporter**.

Include optional/non-present files, legacy/null/malformed variants, role and directory edge cases, archived media, Unicode, very large IDs, numeric precision, duplicate keys, session/KDF variants and unknown fields. Protect raw source secrets separately: real SMTP/SMS/private-key files must go only to encrypted secure escrow/references, not plaintext migration-ledger rows. The prototype contains only fake secrets.

No real snapshots or “anonymized” employee copies enter development.

### Stage M3 — exact final cutover procedure

1. Obtain explicit approvals for production provider, schema diff, maintenance window, protected copy, operator actions and rollback authority. Verify the complete synthetic suite, protected restore drill and available capacity.
2. Publish only a separately approved, backward-compatible PostgreSQL-capable release through the supported schema flow, initially maintenance-only. Do not publish this current NO-GO repair branch. Schema/schema-version preparation alone does not enable writes or select production authority.
3. Establish an independently enforceable ingress/write freeze for **all** legacy routes and background/CLI writers. Drain in-flight requests and uploads while their source files are still accessible. Reject new writes with 503/Retry-After; no success/queued acknowledgement.
4. Prove all legacy processes are quiescent, including overlap revisions and direct old endpoints. Export/verify their final accepted state before stopping them. The current code/SDK cannot be assumed to offer a remotely fenced legacy writer: the freeze/shutdown control must be implemented and rehearsed first. An unverified ingress toggle alone is not proof.
5. Produce the final frozen byte/media/key-domain recovery point; compare it to any earlier pre-copy. Pre-copy is for transfer speed only. There is no JSON CDC or safe dual-write catch-up assumed: use the complete frozen final state/diff under the write freeze.
6. Load only into an isolated staging database/schema/target that cannot serve writes. Disable outbox delivery and derived-data generators. Validate every source record and reference; preserve original IDs/hashes/statuses/arrays/unknown fields. Any unresolved issue blocks activation.
7. Reconcile stable-ID membership, per-file/per-type/per-child counts, canonical row fingerprints, original file byte hashes, PK/FKs, alias resolution, author snapshots, statuses, roles, session SID/version/expiry, exact credential/2FA/recovery bytes, all media hashes and every opaque original. Check timestamps/numeric representation without normalizing away differences.
8. Verify secure key configuration and the exact database/bucket identity in the new deployment. Run authorized protected checks without changing real passwords, 2FA, sessions or user records.
9. With ingress still frozen, stop/deny every old writer. Disable JSON sync/vault/CLI/background mutation paths in the new release. New runtime must never read JSON as fallback or upload critical account/directory JSON as a replica. Preserve originals read-only.
10. Perform a single database authority activation transaction with expected dataset/schema and incremented writer epoch. Open traffic only to the ready PostgreSQL release after verifying old endpoints cannot accept writes. Resume workers under the current epoch and outbox deduplication.
11. Observe commit/readiness/error/media/outbox metrics and reconcile new writes by committed idempotency records. Keep original bundles, keys and media unchanged through the approved retention window. No automatic deletion or schema contraction.

**Writes during the window:** before freeze they stay on the sole old authority and must be captured in the final frozen checkpoint; during freeze they are rejected without success; after activation only PostgreSQL commits may acknowledge them. If the old system had already acknowledged an unrecoverable local-only write, stop and report it—do not call the migration zero-loss.

**Old object writers:** even an old overwritten JSON object cannot overwrite PostgreSQL because the new runtime never imports it. That alone is insufficient: an old server could still acknowledge isolated JSON-only writes or delete shared media. Enforced process shutdown/route denial and, where supported, independently scoped media/storage permissions are mandatory gates. Shared app/bucket identity and rolling revision isolation are not yet certified.

### Stage M4 — rollback, with exact boundaries

- **Before PostgreSQL accepts its first business write:** keep all writes frozen; verify zero committed post-activation requests; change authority/epoch in a controlled transaction; select the unchanged final JSON recovery point and a separately approved legacy-compatible maintenance release. Verify keys/media/source hashes and old writer fencing before reopening. Do not simply publish an arbitrary old revision.
- **After any PostgreSQL business commit:** the old JSON snapshot is stale. **Application rollback** may use an earlier PostgreSQL-compatible application version against the same current database and compatible schema. It must not restore old data, keys or JSON.
- **Data rollback** is a different, explicitly approved incident operation. Freeze current writers, preserve the current database recovery point, identify whether the goal is repair, PITR or a reverse migration, and reconcile all accepted writes after the chosen point. A point-in-time restore alone discards later commits; replay or reconciliation is required to claim no loss.
- Returning to JSON after PostgreSQL writes requires a **fully tested complete reverse exporter**, unchanged API semantics, current protected export, full reconciliation of all post-cutover commits, ready media/key closure and a proven durable/fenced JSON writer design. These prerequisites do not exist. Therefore post-write rollback to the current legacy JSON implementation is **NO-GO**, not a hidden emergency shortcut.
- Keep the schema expand-only until the application rollback window closes. Fix forward or retain a PostgreSQL-compatible rollback build when reverse-export equivalence cannot be proven. No feature redesign or credential reset is part of rollback.

## 9. Testing and evidence interpretation

The generated test-matrix appendix lists **each original T01–T34 and R01–R19**, preserves its previous result, specifies the PostgreSQL adaptation and marks it **planned, not executed** against an application adapter.

The new A-series prototype validates SQL DDL, invented import, exact core reverse mapping, equal-count substitution detection, actual unchanged auth format compatibility, KDF upgrade, session/2FA/recovery compatibility, concurrent unique registration, concurrent password revision CAS, transaction rollback, commit-response ambiguity/idempotency, actual PostgreSQL immediate-stop/WAL recovery, reconnect/restart, FKs/uniqueness, social relationships, local media hash checks, freeze row locks and a complete table-content logical backup restore.

It does not certify hosted durability/failover, pool reconnect behavior in the application, SQL-backed HTTP authorization, complete source/optional-file mappings, secure escrow, full rollback exporter, real media provider ACL/version/retention, production key decryptability, production scale or production adoption.

### Additional mandatory integration/fault matrix

| Area | Required test / acceptance criterion |
|---|---|
| Concurrent registration | Many processes, same/different badge; one winner per identity, no cross-account loss, directory/role eligibility checked atomically |
| Concurrent password/reset/pending promotion | Controlled scrypt pause + competing update; only expected revision wins; no stale hash/pending resurrection; correct revocation and durable response |
| Commit/retry | DB unavailable before begin/during write/during commit/after commit before response; unacknowledged unknown result resolved by request ID, never blindly duplicated |
| App crash/redeploy | Kill app before/after COMMIT, cold process with no local data, rolling overlapping processes; acknowledged account/session/social state remains authoritative |
| Database recovery | Real supported-provider disconnect/reconnect/pool exhaustion/failover/PITR; readiness fail-closed, no JSON fallback, approved measured RPO/RTO |
| Sessions | Pre-cutover token, account/SID revocation, expiry/idle/device order, missing employee, ban/email/2FA status, concurrent logout/read and last-seen touch; all API roles/paths |
| 2FA | Exact key-domain match, foreign key rejection, active/pending setup, counter replay and two concurrent recovery submissions: one winner; unfinished tickets explicitly retried |
| Full social integrity | All ten post types; comment trees/cycles/likes/media; stars/votes; repost snapshots; poll uniqueness; group visibility; follows/bookmarks/views aliases; notifications/orphan subjects; highlights with deleted originals; achievements, conduct, roles, audit, sparks, join requests, push |
| Media | Interrupted upload/read-back/attach/response, duplicate request, pending/ready policy, missing/corrupt object, thumbnails/inline avatars/galleries/comments/archived highlights, Range/HEAD, unauthorized access, orphan race and retained-version restore |
| Controlled rollback | Freeze boundary, zero-write preactivation rollback, post-write application rollback with current data, attempted stale JSON rollback refused; approved complete reverse export/replay before any data rollback |
| Reconciliation | Equal-count different membership, duplicate IDs/keys, unknown field/null/absence, unsupported KDF, orphan references, malformed types, unknown files; no drop/default/truncation; all unresolved issues block activation |
| Operations | Outbox duplicate delivery/retry and provider non-idempotence; expired jobs; connection budgets under overlap; least-privilege role attempts; logs contain no private record/key material |

Keep the legacy 53-test harness and its original evidence unchanged. Filesystem-specific cases become migration-reader tests or explicit legacy-refusal tests, not false PostgreSQL “passes.” A real PostgreSQL HTTP adapter must satisfy the behavioral replacements before release.

## 10. Risks, unresolved questions and approval gates

1. What is the proven authoritative production dataset and complete membership? Which already-acknowledged writes, if any, were lost? Not established.
2. What do `mail.json`/`messages.json` contain, who writes them, and are any other production-only paths present? Protected inspection required.
3. Are there duplicate badge aliases, display numbers, legacy stars, malformed dates, orphan historical references, unknown KDFs or source shapes? No real records profiled.
4. Can the selected managed provider prove the required failover RPO, recovery window, permissions, TLS endpoint, region, restore granularity and independent backup capability? Development SELECT is not certification.
5. Can all old deployed revisions, CLI jobs, shared-storage mutations and direct endpoints be positively frozen/drained/stopped? No verified platform-level distributed fencing path exists yet.
6. Can existing signing/backup/TOTP/VAPID/config material be placed in approved secure configuration and recovery escrow without rotation or exposure? Not tested with actual keys.
7. What media size/egress, freeze duration, recovery budget and data-retention/privacy policy are acceptable? No production size or budget measured.
8. Is current unauthenticated media serving intentional? Protected media access changes need explicit product approval, not silent enforcement.
9. The synthetic prototype has a partial reverse exporter. A full bidirectional mapping, production-safe secret escrow, app adapter, authorization coverage and provider fault testing are still implementation work.
10. RPO 0 for a local database commit is not a guarantee against every hosted storage/region disaster. If the provider cannot meet the approved failure-domain requirement, do not weaken the requirement silently.

### Recommended phases — separate approvals, not tasks already authorized

| Phase | Deliverable | Approval gate |
|---|---|---|
| 0 — this assignment | Inventory, decision, DDL design, isolated prototype, migration/rollback/test plan | Review architecture; production remains untouched and NO-GO |
| 1 — provider and protected discovery | Verify hosting/SLA/roles/cost; approved production schema profiling and immutable recovery/key/media drill | Explicit approval for protected read/copy/restore validation; no live mutation |
| 2 — development adapter | Complete SQL repositories/auth compatibility adapter, all source mappings/reverse exports, media/outbox/fencing; synthetic-only regression suite | Approval to implement; preserve feature/API contracts and current fences until replacement certified |
| 3 — staging certification | Provider-realistic failure/load/rollback/restore tests with synthetic records; measured connection budgets, RPO/RTO and maintenance time | Security/operations/data owner sign-off; no real employee copies in development |
| 4 — protected cutover rehearsal | Complete frozen-dataset reconciliation/restore rehearsal in approved protected environment, rollback build and enforceable old-writer shutdown | Explicit authorization for protected data operations and final cutover window |
| 5 — production cutover | Reviewed supported schema flow + exact frozen final copy + gated authority activation | Separate publish/schema/data/traffic approvals; stop on any mismatch |
| 6 — observation and retention | Current-state app rollback readiness, independent recovery proof, periodic reconciliation | Separate future approval for schema contraction, cleanup or destruction; no automatic legacy deletion |

**Stop here.** This assignment does not authorize implementing the migration.

## Evidence and references

Project evidence:
- `reports/P0_ACCOUNT_PERSISTENCE_FORENSICS.md` — original forensic baseline, preserved.
- `reports/P0_PERSISTENCE_REPAIR.md` and `generated-artifacts/repair/test-results.json` — prior 53 results, NO-GO and provider blockers.
- `scripts/architecture/inventory.cjs` — source/filename-only inventory.
- `design/persistence/schema.sql` and `scripts/architecture/validate.cjs` — isolated design validation only.
- Generated appendices below contain inventory, per-scenario adaptation matrix, actual prototype results and full proposed DDL.

Official Replit documentation consulted on 2026-11-03:
- https://docs.replit.com/features/data-and-storage/sql-database
- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/connection-details
- https://docs.replit.com/features/data-and-storage/data-recovery
- https://docs.replit.com/billing/about-usage-based-billing
- https://docs.replit.com/features/sdks/object-storage-javascript-sdk
- https://docs.replit.com/features/data-and-storage/object-storage
- https://docs.replit.com/build/troubleshooting

Official documentation is evidence of supported platform categories, not an account-specific guarantee. The supported managed-production schema workflow was also checked against the current database migration guidance: reviewed Publish diff, no custom production/startup DDL.
