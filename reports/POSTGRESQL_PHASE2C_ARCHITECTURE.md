# Phase 2C architecture and bounded native-read design

## Scope and authority

This is a development-only refactor. PostgreSQL remains authoritative. The existing
independently guarded synthetic dataset, signing/backup-key domains and release
fences remain mandatory. No production records, credentials, migrations or
deployments are part of this work.

The original compatibility handler remains a reference. The original 107 model
tables are retained. Four additional development indexes support the limited
profile/follow slice and its safe legacy-shape fallback.

## Architecture dependency map

```text
HTTP request / bounded ingress / origin checks / idempotency input
  |
  +-- static GET/HEAD ---------------------------------> unchanged static assets
  |
  +-- global in-process queue
        |
        +-- PostgreSQL pool -> BEGIN -> global advisory lock
        |     -> independent receipt + dataset/key-domain/epoch checks
        |     -> file revision locks
        |
        +-- compatibility request
        |     -> 107 model tables + media graph
        |     -> mutable auth account map + rate/factor/device maps
        |     -> mutable employee directory/lookup + shared JSON/avatar/view caches
        |     -> original handler
        |
        +-- native employee-profile request
              -> selected account/security/employee/moderation/conduct tables
              -> original auth/rate/eligibility handler, still serialized
              -> indexed target profile and follower/following SQL
              -> original PID, avatar and card-rendering functions
              -> immutable target-profile buffer, NOT a writable entity
              -> no media-graph hydration or media-link rebuilding
              -> conservative full-reference fallback for unsupported legacy shapes
        |
        +-- original session touch, if due, still rewrites complete account entity
        +-- encrypted shared-rate state + revision-bound response replay
        +-- COMMIT -> acknowledge response
```

The profile slice deliberately does **not** remove global serialization or make
the original account/session writer native. Complete account state is retained
because `readSession` can update `lastSeen`; projecting a single account into the
existing collection writer would silently remove other accounts.

### Original operation dependencies

| Operation | Mutable/global dependencies | Phase 2C disposition |
|---|---|---|
| Session/authentication | Account graph, session/device lists, factor and failure maps, security config | Unchanged original handler and writer; complete account entity loaded |
| Employee profile | Directory/PID lookup, eligibility, conduct bans, avatars, profiles, follower graph | Native target/follower queries; original authorization/rendering; bounded dependency hydration |
| Search/department | Unicode/Arabic folding, directory ordering/rank, department cache, profiles and hidden departments | Reference only; SQL collation/folding/order parity not proved |
| Feed listing | Live/expired posts, hidden/reported/owner visibility, groups, bookmarks/follows, views, author avatars, comments/reactions/polls, history and global stats | Reference only; no partial result mislabeled a complete feed |
| Post detail/engagement | Feed visibility plus operation-specific permissions and nested relationships | Reference only; no new endpoint or changed response shape |
| Notifications | Recipient rows, generated post announcements, legacy announcements, seen state and ordering | Reference only; merging/visibility parity not yet proved |
| Translation | Session/eligibility/rate maps and model/cache queue | Model evaluation outside SQL; current HTTP transaction coupling remains an explicit blocker |
| Post/comment/reaction writers | Ownership, visibility, mutable collections, notifications and outbox | Unchanged; no native writer |
| Profile writer | Full profile collection, moderation and original revision guard | Unchanged; indexes maintained transactionally by PostgreSQL |
| Account/session writers | Complete accounts, versions, factor/recovery hashes, rate maps and outbox | Unchanged; no partial account persistence |
| Media attachment | Pending intent, immutable bytes/hash, references and commit acknowledgement | Unchanged for writers; profile reads never rebuild the full reference graph |
| Background jobs | Same global maps and snapshots; backup/announcement work | Same serialized queue; poisoned worker cannot start another job |

## Native profile contract

The existing `POST /api/social` with `action: "person"` retains its JSON/status
contract. There is no new client flag, UX, route, sorting parameter or pagination
shape. The response still includes the existing public PID, card fields, bio,
official/mine/followed flags and follower/following counts.

The existing original authentication, API rate limit and eligibility code runs
before native profile lookup. It continues to enforce employee membership, factor
readiness, session version/expiry/idle rules and conduct restrictions.

SQL binds the target badge and viewer badge as parameters. There are no
user-controlled table names, SQL ordering expressions or interpolated predicates.
Original public-ID and avatar hashing are reused, not reimplemented.

Follower counting preserves distinct follower accounts, duplicate following
entries, numeric/string scalar coercion and leading-zero badges. A JSON array
inside a legacy follower list can have special JavaScript string coercion; such
datasets use the complete reference path. Non-numeric employee/system badge
domains also conservatively fall back rather than receiving an approximate native
answer. These are optimization boundaries, not new authorization denials.

The target-profile buffer is read-only. Persistence rejects changes to any entity
other than the complete original account entity, media writes or queued delivery
events from this slice. The native slice never invokes the compatibility
`DELETE/rebuild all media_links` step.

Replay scope includes **all** entity revisions, not only hydrated dependencies.
An account touch updates its revision in that scope. A profile/follow/role change
therefore invalidates an older replay across both native and reference workers.

## Transaction and lock analysis

All original handlers retain their global advisory lock and in-process queue.
Native profile reads hold the same boundary, so the remaining mutable directory,
account and cache graphs cannot overlap between requests. Other worker processes
refresh from committed SQL after obtaining the lock.

Native profile is therefore a narrower hydration/query implementation, **not**
an independent lock-free read service. Pool size and admission limits remain
unchanged. The query-count metric covers actual calls on the checked-out primary
request connection; auxiliary media/outbox transactions are not silently included.

The existing full collection writer still deletes/reinserts normalized subtrees.
There is no claim that a profile optimization fixes post-write amplification,
large-feed payloads, global statistics or full account/session persistence.

## Native write design — specification only, not implemented or certified

No write path has been replaced. The following are proof obligations for a later,
separately reviewed implementation, not assertions that future code already
satisfies them.

| Proposed slice | Transaction/authorization design | Evidence required before enabling |
|---|---|---|
| Post create/edit | Begin; verify current session/membership/group visibility; lock target/revision; owner or explicit status permission; insert/update only affected post/subtrees; write idempotency and outbox in same transaction; COMMIT before response | Native/reference parity for every type and role; revision conflict races; before/during/unknown commit; after-ack kill; stable post numbering and media references |
| Comment/reaction | Lock target post and applicable comment; enforce reply/visibility/ownership; unique actor reaction; update affected child and notification/outbox atomically; stable idempotency actor/key/digest | Concurrent same/different actor toggles, no lost comments, parent deletion race, moderation/private visibility, duplicate notifications and provider crash windows |
| Profile update | Lock actor profile revision; enforce own identity and content/photo rules; update only profile and transactional audit/notification events; preserve avatar public-ID semantics | Actor spoofing, avatar/media lifecycle, stale-revision conflict, native profile replay invalidation, cross-worker changes and rollback |
| Account/session | Per-account locking plus explicit global membership/generation attestations; atomic versions/factor/recovery/session changes and audit/outbox; never infer a fresh account/key from missing data | Registration/2FA/recovery/password/reset/session tests, one-winner consumption, leading-zero/legacy KDF parity, concurrent version changes, unknown commit and independent key-domain recovery |

Do not mix a native row writer with an unfenced full-collection writer: the latter
can overwrite newly committed native rows. Either all writers for that entity
honor a coherent revision/lock protocol, or the entity remains on the reference
writer. Read-path validation alone does not justify enabling any of these writers.

## Remaining blockers and next-phase sequence

1. Review the narrow profile code, fallback boundaries and measured limits.
2. Define pure request-scoped authorization/rendering data contracts; eliminate
   mutable graph sharing before considering concurrent native reads.
3. Specify a feed pagination/API contract with compatible global statistics,
   filtering and deterministic tie-breaking. No silent truncation of existing
   full-feed responses.
4. Prove native detail and notification/announcement-merging parity with restricted,
   deleted, hidden, expired and group-scoped content.
5. Prove Arabic/Unicode search folding, ranking and directory order before pushing
   search filtering into SQL.
6. Separately design native session touches and transactional rate accounting,
   including error/timeout semantics. Only then move HTTP model computation out
   of unnecessary database transactions without changing failure/rate behavior.
7. Implement at most one native writer after all proof obligations above have
   evidence and the legacy writer is fenced from overwriting it.
8. Close the supported dependency path and hosted recovery/media/provider gaps
   before any production proposal. Production remains NO-GO.
