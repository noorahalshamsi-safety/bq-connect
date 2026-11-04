# BQ Connect — REL-001 lossless migration tooling review

Review date: 4 November 2026.
**Development tooling: PASS within the supported synthetic staging contract. REL-001: PARTIALLY CLOSED, development portion only. Production: NO-GO.**

## 1. Exact implemented files and execution boundary

Standalone tools were implemented; the original PostgreSQL adapter, production source, release fences, UI and auth behavior were not edited.

- scripts/migration/rel001/auth-proof.cjs
- scripts/migration/rel001/boundary-tests.cjs
- scripts/migration/rel001/cli.cjs
- scripts/migration/rel001/common.cjs
- scripts/migration/rel001/compatibility.cjs
- scripts/migration/rel001/export.cjs
- scripts/migration/rel001/import.cjs
- scripts/migration/rel001/interruption-worker.cjs
- scripts/migration/rel001/lab.cjs
- scripts/migration/rel001/preserve.cjs
- scripts/migration/rel001/reconcile.cjs
- scripts/migration/rel001/report.cjs
- scripts/migration/rel001/source.cjs
- scripts/migration/rel001/tests.cjs

Operator procedure: reports/REL001_OPERATOR_RUNBOOK.md.

The CLI exposes only new-lab, status, import, reconcile, reverse, stop and resume. Every post-creation operation requires explicit lab path, source identity, independent target identity and frozen source-manifest SHA. No DATABASE_URL, arbitrary socket/host, production-mode switch, authority activation, reset/adoption or force option is supported. Deployment execution is refused.

new-lab creates an invented source and a new local PostgreSQL cluster/database, binding independently generated source/target IDs to PostgreSQL system identifier, physical data directory and current database. Existing application development/production datasets cannot be selected implicitly. Business identifiers and credentials come from the frozen source unchanged; UUIDs identify lab/source/target metadata only. The imported target has **zero dev.authority rows**, so no application authority is activated.

Target creation records an external identity receipt before provisioning. An interrupted creating state is refused for operator review; resume never initializes a cluster. Missing previously created state, metadata or SQL receipt cannot authorize fresh data/identity generation.

## 2. Complete 28-path coverage

All 28 inventoried JSON paths are required and imported into the existing codec's relational tables inside a new staging-only database. Known nested collections have parent/file relationships and ordinals; unknown extensions remain JSONB without inferred normalization. This is not a whole-file-only JSON ledger. Raw bytes are escrowed separately.

| Source path | SQL root | Interpretation | Source→SQL | SQL→source | Source byte escrow |
|---|---|---|---|---|---|
| accounts.json | dev.account_root | map | PASS | PASS | Exact |
| announce-seen.json | dev.seen_root | map | PASS | PASS | Exact |
| announcements.json | dev.announcement_root | array | PASS | PASS | Exact |
| backup-status.json | dev.backup_status | object | PASS | PASS | Exact |
| backup.json | dev.backup_settings | object | PASS | PASS | Exact |
| bookmarks.json | dev.bookmark_root | map | PASS | PASS | Exact |
| conduct.json | dev.conduct_settings | object | PASS | PASS | Exact |
| daily-sparks.json | dev.spark_settings | object | PASS | PASS | Exact |
| dept-profiles.json | dev.department_root | map | PASS | PASS | Exact |
| employees.json | dev.employee_root | array | PASS | PASS | Exact |
| follows.json | dev.follow_root | map | PASS | PASS | Exact |
| groups.json | dev.group_root | array | PASS | PASS | Exact |
| highlights.json | dev.highlight_root | map | PASS | PASS | Exact |
| ideas.json | dev.post_root | array | PASS | PASS | Exact |
| join-requests.json | dev.join_root | array | PASS | PASS | Exact |
| mail.json | dev.opaque_mail | Opaque JSON; no inferred semantics | PASS | PASS | Exact |
| messages.json | dev.opaque_messages | Opaque JSON; no inferred semantics | PASS | PASS | Exact |
| moderators.json | dev.moderator_settings | object | PASS | PASS | Exact |
| notifications.json | dev.notification_root | array | PASS | PASS | Exact |
| profiles.json | dev.profile_root | map | PASS | PASS | Exact |
| push-keys.json | dev.push_keys | object | PASS | PASS | Exact |
| push-subs.json | dev.push_root | map | PASS | PASS | Exact |
| security-log.json | dev.audit_settings | object | PASS | PASS | Exact |
| security.json | dev.security_settings | object | PASS | PASS | Exact |
| sms.json | dev.sms_settings | object | PASS | PASS | Exact |
| smtp.json | dev.smtp_settings | object | PASS | PASS | Exact |
| vault-status.json | dev.vault_status | object | PASS | PASS | Exact |
| views.json | dev.view_root | map | PASS | PASS | Exact |

Full per-file semantic and byte fingerprints: generated-artifacts/rel001-evidence/coverage.json. It includes source and reverse byte hashes separately. An exact semantic round-trip does not imply identical JSON formatting.

mail.json and messages.json are opaque values. Their unknown business relationships, date fields and media-looking strings are not interpreted as an invented schema. Complete protected inventory/media semantics for them remain a production discovery dependency.

## 3. Missing/null/unknown-field and identifier compatibility proof

Current executable proof includes:

- Leading-zero badge strings and distinct case-sensitive directory identifiers. No numeric badge conversion, casing normalization, regenerated post/comment/group IDs or replacement credential occurs.
- Missing pending credentials versus explicit null; missing status history versus null versus array; empty object/array values; unknown/historical extensions and archived snapshots.
- Ordered post, comment, vote, group/member, bookmark and nested arrays, including deliberately non-sorted extension values. M29 reverses comment order without changing counts and independent reconciliation rejects it.
- JSON fields named __proto__ are preserved as data, without prototype mutation. Duplicate object keys are rejected rather than silently overwritten.
- Unknown source **files** are blocked rather than silently omitted. Known-file unknown **fields** are preserved.
- Unsupported numeric encodings, unsafe integers, decimal precision loss, underflow/nonfinite values, negative-zero normalization and unsupported Unicode fail explicitly. Equivalent decimal notation may reconstruct differently but exact source bytes remain escrowed.
- Corrupt JSON, missing required paths, malformed supported roots, invalid recognized timestamp strings, unsupported KDF, contradictory recognized memberships/IDs or undecryptable factors reject without repair.

The strict parser compares numeric decimal values before accepting JavaScript/JSONB representation. Canonical semantic equality sorts object keys, preserves every array position and distinguishes missing keys from null/empty values. No claim is made that every conceivable production legacy shape has been profiled: ambiguous/unsupported shapes are blockers, not candidates for silent coercion.

## 4. Source-to-SQL independent reconciliation

Status: **PASS**.

Counts: {"files":28,"accounts":7,"employees":10,"posts":10,"stories":1,"comments":20,"media":2,"mediaReferences":12,"relationalNodes":359}.

Source manifest SHA: d99f9348f2d91f123f19c669373ad84f371089383c126aee2129df61db2d92b6

Complete semantic SHA: 91e0de438f80f7f2736a85bac615503630b2b925e777190e24a8617278bee741

The importer uses codec.encode. The independent SQL reader deliberately does **not** use codec.decode, Repository.load or the importer to reconstruct records. It reads all closed-registry tables, checks one root per file, consumes every row, validates object/array/map shapes, contiguous ordinals and absence of unused/orphan relationships, then reconstructs values independently. It shares the reviewed table registry/schema, not the decoding algorithm. Semantic comparison checks the complete reconstructed data against parsed frozen source values.

Category digests cover file inventory; account and employee membership; posts/stories; nested comments/reactions/polls; groups; notifications/audit; profiles/settings; credential/session/factor state; field presence/null/order/unknown extensions. Every source inventory path/size/hash and media reference is compared as well. Counts are recorded for diagnosis, never used as a losslessness substitute. M03 proves equal-count account substitution fails.

All 28 files, media, references, source inventory and committed content receipt are inserted in **one PostgreSQL transaction** under a dedicated advisory transaction lock. Independent reconciliation executes before COMMIT. SQL receipt commits atomically with contents; the local journal is diagnostic, not an alternate authority.

## 5. Reverse-export and exact-byte recovery results

Status: **PASS**; 28 reconstructed JSON paths; 2 media objects written and read-back hash verified.

SOURCE JSON → relational SQL → independently reconstructed JSON achieves complete semantic equality. Export executes in a read-only repeatable-read SQL snapshot after binding/receipt/full reconciliation checks. Reconstructed files are reparsed and compared individually.

Exact original bytes are stored separately in the private source recovery bundle:

{"status":"PASS","files":34,"exactBytes":true,"bundleIdentity":"d99f9348f2d91f123f19c669373ad84f371089383c126aee2129df61db2d92b6"}

That bundle contains all original JSON, the original signing/backup key file bytes, signed-session fixture vectors, all inventoried media and source manifest. It is verified byte-for-byte on creation and subsequent import/replay/export. Corrupt escrow fails; it is not regenerated behind the operator's back.

Mode 0400 and digest binding provide accidental-write detection and private local fixture custody, **not owner-proof/WORM immutability or disaster recovery**. Key files are not copied into the reverse-export directory. No recovery bundle or private lab database is delivered as a public report attachment.

Reverse output is development reconstruction only. It is **not approved for legacy production rollback**, authority replacement or live restore.

## 6. Auth/session/2FA compatibility results

- Exact account subtree semantic digest: 77dd2f84b53c63813ab8721155db949c41a641fa83f28e44ab629229e156b3db
- 7 original password hashes independently recomputed with the original scrypt parameters, including legacy missing-KDF behavior, without invoking login's upgrade path on the source/target.
- 7 original signed sessions accepted by the **unchanged original auth.readSession** using a disposable reconstructed copy and original fixture signing key.
- 8 active/pending factor ciphertexts authenticated and decrypted under the preserved original key domain. Original auth.checkTwoFactor accepted a current TOTP on the disposable copy only.
- Hash/salt/KDF property presence, pending credentials, sessions, active factors and pending enrollment are compared field-by-field, including missing versus null. Source/SQL/reverse canonical equality and raw-byte escrow preserve them without rotation.

Actual fixture password/hash/salt/token/plaintext-factor values are not printed in the report. Crypto digests and counts are retained. No real employee, key, authenticator enrollment or credential was used. Pending enrollment was preserved/decrypted, **not activated**. No authenticated browser login is claimed.

## 7. Media reference and object integrity

Rehearsal: 2 inventoried media objects, 12 recognized references.

The source includes a referenced PNG and a retained unreferenced binary. The importer preserves both rather than inferring orphan deletion. Known media references include post galleries, profiles and an archived highlight snapshot whose original story is absent.

All recognized /media/ references must resolve within the frozen inventory; traversal/unsafe paths fail. Imported SQL media bytes, recorded size and SHA256 are independently verified against source, as are source-file/JSON-pointer/reference tuples. Reconstructed media bytes are written, fsynced and read back with matching hash.

Media semantic digest: 80991b0229b67dfe17fb312f0cf81cce3f7bf7f8a75746881e762d5290a7f443

These are invented local PostgreSQL byte objects in a staging-only migration schema, **not a production media-storage implementation**. Hosted object storage durability, access policy, version retention, opaque-file reference semantics and protected full-source media closure remain separate blockers.

## 8. Failure, interruption and security test results

**31 scenarios PASS, 0 FAIL.** Diagnostic tests assert both protections and expected refusal paths; no failing behavior was relabeled as readiness.

| ID | Executed scenario | Result |
|---|---|---|
| M01 | Complete invented migration, independent reconciliation and reverse export | PASS |
| M02 | Duplicate employee identifiers rejected | PASS |
| M03 | Equal account counts with substituted membership detected independently | PASS |
| M04 | Missing account record rejects source | PASS |
| M05 | Unknown fields, null/missing/empty, opaque roots and ordering preserved | PASS |
| M06 | Invalid timestamps reject without normalization | PASS |
| M07 | Corrupt source JSON rejected | PASS |
| M08 | Unsupported KDF rejected | PASS |
| M09 | Missing signing key refused without generation | PASS |
| M10 | Mismatched active 2FA domain rejected | PASS |
| M11 | Incomplete referenced media rejected | PASS |
| M12 | Actual process interruption before COMMIT rolls back and resumes | PASS |
| M13 | Actual PostgreSQL connection termination during import rolls back | PASS |
| M14 | Actual deferred foreign-key failure at COMMIT has no partial rows | PASS |
| M15 | Identical import is a verified no-op | PASS |
| M16 | Different-source replay to same target refused | PASS |
| M17 | Committed SQL is authoritative after local receipt interruption | PASS |
| M18 | Unauthorized target selection and deployment execution refused | PASS |
| M19 | Missing target state cannot authorize fresh initialization | PASS |
| M20 | Owned cluster cold stop/resume preserves reconciled target | PASS |
| M21 | Duplicate JSON keys and lossy numbers rejected | PASS |
| M22 | Source tampering after freeze is detected without SQL changes | PASS |
| M23 | Independent reader catches relationship ordering and media byte corruption | PASS |
| M24 | Missing target receipt cannot turn populated data into a fresh import | PASS |
| M25 | Opaque mail/messages are preserved without invented media/date semantics | PASS |
| M26 | Unavailable database refuses without reinitializing and same cluster recovers | PASS |
| M27 | Source file symlink is refused before SQL | PASS |
| M28 | Unexpected source file blocks inventory rather than disappearing | PASS |
| M29 | Array-order corruption fails independent semantic reconciliation | PASS |
| M30 | Corrupt source escrow is rejected, not silently regenerated | PASS |
| M31 | Decimal precision loss is refused, equivalent decimal notation retained in escrow | PASS |

Important distinctions:

- M12 actually kills the importing process with SIGKILL while rows are uncommitted, verifies rollback/empty target and successfully retries the **same** target.
- M13 actually terminates the PostgreSQL connection during import; retry succeeds with preserved source. M26 also stops the cluster and proves unavailable reads refuse before recovering the same identity.
- M14 creates a real deferred foreign-key violation at PostgreSQL COMMIT (23503), verifies no partial rows/receipt and unchanged source.
- M17 simulates loss of local completion after actual SQL COMMIT; repeat import reconciles the committed receipt and returns a no-op, without duplicate records or a new generation.
- M19 and M24 establish that missing cluster state or a missing receipt with populated data cannot authorize initialization/reseed.
- M22 deliberately corrupts its owned synthetic source **as test setup**; failed import does not repair or further modify it. M27/M28/M30 restore deliberately introduced test-only symlink/extra-file/escrow corruption themselves. Import/reconciliation never mutates or repairs the authoritative source.
- Sockets are Unix-only, private and derived from the minted target identity. Actual server/database/data-directory/system-ID attestations occur before writes. Replays bind source, target and manifest; arbitrary URLs, the existing application cluster and deployment execution are refused.

No hostile same-OS-user/root compromise guarantee is claimed: that principal owns these test files and local database. Production least privilege, custody, signed approvals and immutable independent recovery require separate provider/operator design.

## 9. Preservation and affected regression results

Protected original source/config/reports/test bytes and prior evidence: **206 files checked; 0 changed** against the pre-work baseline.

Unchanged original suites executed now:

- HTTP compatibility: 56 PASS, 0 FAIL.
- Native profile parity: 9 PASS, 0 FAIL.

Only evidence destinations were redirected; original assertions/expectations were not modified. Current migration regressions are additive. No production source, development adapter, normal API/UI, workflow, auth behavior, release fence, historical evidence or authoritative 18-item blocker register was edited.

Hardening/background suites from earlier phases were **not rerun in this assignment**; their existing results remain historical. No unrelated translation, performance, UI or native-writer development occurred. The app's public landing may be statically checked separately; signed-in UI remains unverified and is not an importer acceptance substitute.

## 10. Operator runbook and future protected-adoption gates

reports/REL001_OPERATOR_RUNBOOK.md contains executable synthetic commands for explicit identity selection, import/status/reconciliation/reverse/stop/resume, and exact failure/retry handling.

Its protected-adoption design is deliberately **non-executable**. It requires explicit protected source/destination identities, confirmed frozen authoritative generation, verified independent immutable source backup, matching signing/backup/active+pending-factor custody, positive old-writer freeze/drain, independent complete source/destination and media reconciliation, operator approval before activation, recoverable interruption handling and separate rollback authorization.

No generic production-mode switch or unsafe bypass was added. Creation interruption is a documented operator-review block, not permission to fill an empty target. Current reverse export does not authorize returning data to legacy production.

## 11. Remaining REL-001 blockers

Development-implementable importer/reconciliation/reverse/rehearsal work is implemented and tested within this contract. REL-001 itself remains **partially closed**, because the following are not authorized/certified:

1. Protected real source inventory and true authoritative generation/membership, including production-only paths, unknown legacy shapes and mail/messages business semantics.
2. Historical account-loss attribution: still unverified; synthetic success cannot establish the incident cause.
3. Protected immutable independent source backup and actual existing key-domain custody/escrow verification.
4. Approved production schema/provider/role/TLS/media mapping and hosted failure/restore semantics. This tool imports into an isolated local staging target only.
5. Enforceable real old-writer freeze, final frozen reconciliation, operator-approved activation/cutover and current-state post-cutover application rollback.
6. Production-specific capacity/retention/security/operational evidence. Existing release blockers remain in the authoritative Phase 2G register; they were not duplicated or marked closed.

Stop blocked paths until their separate data/security/provider approvals exist. Do not promote a minted synthetic lab into a production target by editing identity files or adding flags.

## 12. Separate development and production verdicts

**Development tooling — PASS / READY FOR REVIEW** for the supported invented dataset, private independent local PostgreSQL staging target, explicit identities, atomic import, independent complete semantic reconciliation, exact-byte escrow, reverse reconstruction and demonstrated failure/retry cases.

This is not blanket support for every unprofiled legacy source. Unsupported/missing/contradictory input fails explicitly and needs review; it never authorizes normalization or credential regeneration.

**Production — NO-GO.** No republish/deployment, production access/schema change, real account import, secret rotation, live restore, old-writer freeze, authority activation or release-fence removal occurred. No next phase was started. Stop for review.
