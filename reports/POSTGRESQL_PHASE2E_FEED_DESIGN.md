# BQ Connect — Feed scalability and pagination boundary review

**Outcome: tested design and private SQL prototype, not an activated native feed API.**
The application, UI, default API, original writers, authorization/session code,
global lock and production configuration are unchanged.

## 1. Feed dependency and authorization map

Actual path: server.js GET /api/ideas → badgeFrom → readIdeas →
filteredIdeas → publicList → publicIdea → send. The private comparison calls
these same functions; it does not infer permission rules from relational names.

| Concern | Observed reference semantics | Native read dependency |
| --- | --- | --- |
| Authentication | Existing x-session/badgeFrom checks run before feed access; no new token reader | Unchanged auth/session/ban/identity preparation, not a cursor credential |
| Public/owner/hidden/reported | visibleTo: owner wins first; otherwise hidden excludes; a report by the viewer excludes. Admin/moderator status is NOT a hidden-post bypass | Post attrs and complete reports for requested candidates; fresh actor |
| Groups | filteredIdeas requires an existing exact group ID and stringified member badge. Nonmembers receive 403 even when the group has no posts. publicList repeats membership/scope checks | Requested group and members before pagination; company excludes group posts |
| Departments | following combines followed people, stored post departments, own badge and official announcer. Department reply restriction is not a blanket read restriction | Actor follows, announcer identity, stored author department; live viewer department for canReply |
| Stories | liveIdeas removes expired stories; missing expiry remains; invalid nonempty expiry fails Date.parse comparison. Expiration runs before owner visibility | Time-sensitive post attrs; reevaluate on every page |
| Deletion | Physical removals disappear. A deleted:true extension is not interpreted as a tombstone by this endpoint | Preserve existing behavior; do not invent a logical-deletion filter |
| Identity | publicIdea uses stored name/department/position, HMAC public IDs, avatar/profile lookups, official flags and thanks recipient lookup | Directory/security and only the referenced profiles/avatars; do not require every author to join an employee row |
| Likes/ratings/reposts | ratingSummary uses voteOf, including legacy stars; repostedBy retains last 200 entries, counts/own flags preserve original coercion | Complete requested-post relations, including unusual/unknown badge values; no new inner-join filtering |
| Comments/replies | publicComments resolves parent IDs and reply counts across the complete post comment list; comment likes and media preserved | All comments/likes for each returned post, including parent resolution; no silent nested truncation |
| Polls | Option index/text/count and viewer mine flag; duplicate and non-array votes retain existing semantics | Requested polls/options/votes; no cross-feed graph required |
| Bookmarks/follows/views | savedBy is viewer-specific; followed uses viewer people; viewsOf counts the complete view list for that post | Actor bookmark/follow slices and requested-post view counts |
| Media | safeMedia checks existing local media paths or bounded inline-image prefix; gallery requires a valid base media. Avatars/comments/thanks also reference media | Batch only authorized paths and relevant profiles; preserve missing-file behavior and original integrity fences |
| Announcements/notifications | Post announcements include pin/ack/audience data. Browser also merges legacy alert announcements separately. Notification delivery is not a feed read side effect | Requested acks; global audience count for a pinner; unchanged separate announcement/notification paths |
| Global statistics | statsFor uses ALL raw posts, including hidden/group/expired posts: shared, review, projects, nextNumber. These are not visible-page totals | Independent bounded aggregation; JS Number coercion must be preserved for legacy number values |
| Ordering/search | Server returns original array/ordinal order; feed=following/today and group scope only. Client applies newest/top/oldest modes, folded search and chips | Do not treat createdAt ordering or SQL ILIKE as existing server semantics |
| Arabic/English | Stored text returned without translation; client folds Arabic search and renders localized labels. Relevant public IDs/coercion are shared behavior | Preserve Unicode and existing renderer/search helpers; no locale/collation rewrite |

Source consumers: public/js/app.js loadIdeas downloads raw text, parses it,
caches raw+data by feed query, replaces the whole ideas array and invokes
paintIdeas. sortedIdeas sorts by like-minus-dislike, likes, then date for top;
default sorts by date. Rendering also uses story collections, global hot-post
selection, announcements, search, bookmarks, profiles and hash/deep-link lookup.
The local load-more controls reveal slices of an already downloaded array.
public/js/feed.js IntersectionObserver handles video visibility, not a server
cursor. There is no existing feed cursor/next-page client contract.

Page-local fields: requested post attrs, engagement, comments, poll, history,
acks, attendees, gallery and selected author/profile/media data.
Global or actor-scoped fields: raw statistics, audience count, auth/role/group
state and actor follows/bookmarks. Client global ranking/search/story behavior
cannot become correct merely by limiting the first SQL result.

## 2. Verified memory and response-size breakdown

One thousand invented employees; 5k/10k complete reference HTTP workloads;
20k uses ONLY bounded component diagnostics. No forced GC or higher heap/RSS
limit is used. Worker RSS guard 384 MiB, controller 512 MiB, bounded deadlines.
Reference request-phase monitoring starts at readiness; startup memory is also
sampled by stage, but its RSS was not continuously polled during bootstrap.

| Path | Posts | Outcome | Peak observed RSS MiB | Sampled peak heap MiB | External MiB | Buffers MiB | One response/result bytes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| reference | 5000 | COMPLETED | 213.35 | 78.65 | 24.65 | 22.45 | 3836744 |
| reference | 10000 | COMPLETED | 239.68 | 86.04 | 36.63 | 34.42 | 7676745 |
| component | 5000 | COMPLETED | 90.90 | 22.16 | 2.94 | 1.04 | 3869 |
| component | 10000 | COMPLETED | 90.62 | 22.51 | 2.89 | 1.07 | 3869 |
| component | 20000 | COMPLETED | 91.15 | 22.14 | 2.85 | 1.03 | 3869 |

The two paths return different products: full enriched HTTP JSON versus a
16-record raw SQL page. These are NOT interchangeable before/after HTTP results.
Reference bytes are complete decoded HTTP responses (identity encoding);
component bytes are serialized raw page records, not a public API envelope.

| Posts | Component | Samples | p50 ms | p95 ms |
| --- | --- | --- | --- | --- |
| 5000 | sql-retrieval-and-driver-decode | 69 | 58.02 | 71.15 |
| 5000 | relational-object-decoding | 69 | 45.64 | 50.82 |
| 5000 | authorization-filter | 69 | 0.29 | 0.44 |
| 5000 | visibility-check | 69 | 0.28 | 0.43 |
| 5000 | post-enrichment | 69 | 76.54 | 92.95 |
| 5000 | media-reference | 69 | 0.69 | 1.15 |
| 5000 | json-stringification | 69 | 10.91 | 32.79 |
| 5000 | serialization-and-send | 69 | 12.27 | 34.15 |
| 10000 | sql-retrieval-and-driver-decode | 69 | 100.49 | 113.07 |
| 10000 | relational-object-decoding | 69 | 94.71 | 104.37 |
| 10000 | authorization-filter | 69 | 0.56 | 0.75 |
| 10000 | visibility-check | 69 | 0.62 | 0.87 |
| 10000 | post-enrichment | 69 | 146.31 | 160.06 |
| 10000 | media-reference | 69 | 1.33 | 1.64 |
| 10000 | json-stringification | 69 | 21.78 | 47.73 |
| 10000 | serialization-and-send | 69 | 24.11 | 50.37 |

SQL retrieval above includes driver JSON parsing; relational object decoding is
the compatibility codec after retrieval. Post-enrichment includes media lookup,
and serialization-and-send includes JSON stringify/buffer/gzip/send work, so
these overlapping timings must not be added as independent exclusive phases.
The first send sample is excluded from component timing summaries because it
also accumulated bootstrap work.

| Posts | Stage | Samples | Max RSS MiB | Max used heap MiB | Max external MiB | Max ArrayBuffer MiB |
| --- | --- | --- | --- | --- | --- | --- |
| 5000 | sql-table-posts | 71 | 207.80 | 56.60 | 22.26 | 20.05 |
| 5000 | decode-ideas.json | 71 | 209.55 | 72.55 | 19.63 | 17.42 |
| 5000 | graph-decoded | 71 | 209.55 | 73.73 | 19.63 | 17.42 |
| 5000 | media-and-buffers | 71 | 210.67 | 70.92 | 20.98 | 18.77 |
| 5000 | authorization-filter | 70 | 211.92 | 75.01 | 21.17 | 18.97 |
| 5000 | enrichment-and-visibility | 70 | 207.80 | 74.98 | 17.33 | 15.13 |
| 5000 | json-stringification | 70 | 215.05 | 78.64 | 17.33 | 15.13 |
| 5000 | json-response-buffer | 70 | 215.05 | 78.64 | 20.99 | 18.79 |
| 5000 | response-constructed | 70 | 215.05 | 78.65 | 24.65 | 22.45 |
| 10000 | sql-table-posts | 71 | 228.56 | 64.95 | 23.87 | 21.66 |
| 10000 | decode-ideas.json | 71 | 232.03 | 60.37 | 19.44 | 17.24 |
| 10000 | graph-decoded | 71 | 232.03 | 61.58 | 19.44 | 17.24 |
| 10000 | media-and-buffers | 71 | 234.38 | 64.24 | 21.98 | 19.77 |
| 10000 | authorization-filter | 70 | 236.75 | 71.74 | 22.18 | 19.97 |
| 10000 | enrichment-and-visibility | 70 | 232.13 | 78.70 | 21.99 | 19.78 |
| 10000 | json-stringification | 70 | 239.29 | 86.03 | 21.99 | 19.78 |
| 10000 | json-response-buffer | 70 | 239.29 | 86.03 | 29.31 | 27.10 |
| 10000 | response-constructed | 70 | 239.29 | 86.04 | 36.63 | 34.42 |

The primary observed costs are full-graph retrieval/decoding and per-post
enrichment, not the small permission predicate. Each original feed request
retrieves 107 relational collections and enriches every returned post; SQL row
counts and phase counters are preserved in the performance evidence. The source
also retains decoded files, serialized virtual-file buffers, readIdeas reparsing,
enriched cards, a JSON string/UTF-8 buffer and the middleware response buffer.
commitMedia still traverses the complete compatibility graph before acknowledgement.
Its sweep is not isolated by the safeMedia timer and remains part of transaction
residual time.

Peak allocation totals and precise retained-object ownership were not captured
with a heap/allocation profiler. The table reports sampled live heap and RSS,
not an invented exact temporary-allocation count. SQL wire-byte totals are not
measured; component preflights record JSON attribute/shape bytes separately from
HTTP bytes. No browser DOM/heap benchmark is claimed: the client requirements
above come from source tracing, not an authenticated rendering measurement.

## 3. Native SQL feed architecture proposal

The private prototype is scripts/postgres/phase2e-candidate.cjs. It is not imported
by development/postgres/runtime.cjs or exposed by the application.

It reads revision/root metadata, then an ordinal window of at most 32 posts and
batch-loads descendants only for that window using parameterized parent arrays.
The original lossless codec reconstructs complete nested values. Returned graphs
are deeply frozen. A mandatory trusted policy callback must accept records;
in semantic comparisons it calls the original filteredIdeas and visibleTo.
An empty-scope membership check runs before scanning, preserving 403 responses.

The batch query count depends on the fixed relationship schema, not one query
per post. Existing child (parent,ordinal) indexes remain; the prototype adds
(file_name,parent,ordinal) ONLY to owned test databases. The measured header
EXPLAIN plans are saved:

| Posts | Observed indexes | Header rows | Execution ms |
| --- | --- | --- | --- |
| 5000 | posts_parent | 16 | 0.02 |
| 10000 | posts_parent | 16 | 0.02 |
| 20000 | posts_parent | 16 | 0.02 |

The component preflights row count and JSON attribute/shape bytes before decoding:
8,192 relationship nodes, 8 MiB attribute bytes and 512 scanned candidates per
page maximum. Exceeding a bound returns an explicit component error, not a
truncated comment list, incomplete post or false end-of-feed. Sparse predicates
can therefore reject; no sparse-feed success guarantee is claimed.
This version can load relationships for later-rejected candidates. A future
indexed header/report predicate phase could avoid that work, but SQL coercion
and authorization parity would need its own proof.

The compatibility reference is retained. For exact response comparison ONLY, a
private owned worker exhausts these pages inside the existing full compatibility
transaction and uses original publicList/send/statsFor. This validates semantics
but still hydrates the global graph and assembles a full response: it is not a
scalable native HTTP implementation.

An activated design would need:

- Unchanged authentication/session checks, fresh group/role/ban evaluation and
  global serial/advisory locks. No new native writer.
- Batch referenced identities/media and immutable request-local render inputs,
  without replacing the original semantic helpers with guessed SQL joins.
- Separate all-post statistics: count/status counts plus exact legacy Number
  behavior for nextNumber. Canonical SQL values may aggregate directly; unusual
  values need a bounded scalar streaming fold rather than loading the post graph.
  This aggregation is proposed, not implemented or claimed parity-proven here.
- A read-specific commit path preserving auth touches, audit/rate state and media
  integrity without reintroducing the global media sweep. No early streaming
  before commit: existing middleware intentionally buffers until commit succeeds.
- Complete parity for those reduced dependencies before any application activation.

## 4. Pagination/API compatibility assessment

**A. Existing API:** GET /api/ideas still returns all eligible posts and original
global stats, with the existing status codes, Content-Type, no-store, Vary,
Content-Encoding and Content-Length semantics. No default limit, cursor,
truncation or frontend change was introduced.

**B. Proposed opt-in API:** after explicit approval, use an explicit versioned
pagination opt-in, for example pagination=keyset-v1 and bounded limit. Return
ideas, original global stats, nextCursor and a documented completion/restart
state. Do not apply it to callers that omit the opt-in.

Ordinal keysets match existing WIRE order only while the post-file revision is
unchanged. Compatibility writes replace the entity and can rebase ordinal IDs.
The prototype therefore binds a trusted internal cursor to revision and a scope
digest; insertion/deletion causes cursor_restart_required. It never treats a
rebased ordinal as a stable cross-revision anchor.

Prototype cursors are INTERNAL objects, not signed browser tokens. An approved
public cursor must be authenticated, versioned, actor/scope-bound, expiring and
validated. It must include relevant permission/filter dependency revisions, not
just post revision, and must never substitute for fresh session/role checks.
Do not expose this internal object directly as the production cursor format.

A restart-on-change contract is the minimum conservative option, but can starve
an active feed. Stable continuation across mutations would require an explicit
snapshot/immutable-order design; existing writers do not provide that guarantee.
Story expiry and rolling today filters must be reevaluated without extending
visibility via an old cursor timestamp.

For the client's date/top/oldest modes, an ordinal cursor alone is insufficient.
Top scores change with votes; invalid dates and stable JavaScript tie order have
legacy semantics. Server ordering, Unicode search and tie-break rules need a
versioned specification and tests. SQL timestamp/null ordering or ILIKE must not
be substituted silently.

**C. Required frontend decisions:** cursor-aware page state per actor/scope/sort/
search; restart/dedup on revision change; stale-request cancellation; explicit
loading/error/end states; deep-link authorized item fetch; correct global search,
hot rankings, story strips, bookmarks and announcement merge; bounded raw/data
cache and DOM retention. Merely appending ordinal pages then re-sorting all of
them preserves neither bounded client memory nor early top/newest correctness.

These decisions are unresolved and unapproved. Accordingly this phase stops at
the tested design and component, not a user-facing pagination change.

## 5. Exact implementation scope and changed files

- .agents/memory/MEMORY.md
- .agents/memory/feed-pagination-approval.md
- scripts/postgres/phase2e-benchmark.cjs
- scripts/postgres/phase2e-candidate.cjs
- scripts/postgres/phase2e-component-worker.cjs
- scripts/postgres/phase2e-regressions.cjs
- scripts/postgres/phase2e-report.cjs
- scripts/postgres/phase2e-support.cjs
- scripts/postgres/phase2e-tests.cjs
- scripts/postgres/phase2e-worker.cjs
- reports/POSTGRESQL_PHASE2E_FEED_DESIGN.md

All executable additions are private synthetic diagnostics/prototypes in
scripts/postgres. Source transformations occur only in forked owned test workers.
The normal app cannot select the private comparison header. No production/runtime
module imports it. The one test index is created only by the private fixture
prepare function. No application or production schema was changed.

52 previous report/evidence files match their pre-run hashes.
Original suites, compatibility runtime/repository/codec and production-source
fingerprints match their saved checkpoints. Temporary test ports are removed;
the full .replit content matches its checkpoint.

## 6. Feature and authorization parity evidence

| Evidence | Result |
| --- | --- |
| Deep full-response comparisons | 24 reference/component pairs: six actors × company/following/today/private-group |
| Roles/identity | Owner, moderator, ordinary accounts, leading-zero identity, administrator, announcer; different directory departments |
| HTTP behavior | Status and complete JSON compared; Content-Type/Length/Encoding, Cache-Control, Vary and nosniff compared; gzip/Unicode case |
| Safety | Anonymous/nonmember/empty-group denial; owner-only hidden override; reporter exclusion; expired story exclusion |
| Relationships | Poll vote shapes, comments/reply parents/likes, ratings/stars, reposts, inline gallery, status history, acks, event attendance |
| Legacy | Unknown scalar/nested extensions preserved by codec; stored and missing directory identity; legacy deleted flag not reinterpreted |
| Pagination | One-record pages, equal dates/ordinal order, zero/one/many, scope mismatch, stale insertion/deletion cursor rejection |
| Integrity | Oversize/sparse scans reject rather than truncate; account/entity values and all revisions unchanged by component reads |

- PASS: Response comparison coverage (24 exact pairs)
- PASS: Exact reference/native full semantics and HTTP headers for six identities × four scopes
- PASS: Original visibility: owner sees hidden, admin has no hidden bypass, reporter excluded
- PASS: Anonymous and nonmember requests cannot leak posts, including an empty group
- PASS: Gzip and Arabic/English legacy payloads preserve exact response semantics
- PASS: One-record pages preserve ordinal ties, nested relations and unknown scalar fields
- PASS: Cursor scope mismatch and malformed limits fail closed
- PASS: Concurrent insertion invalidates ordinal cursor rather than skipping or duplicating posts
- PASS: Physical deletion invalidates cursor and deleted post never returns
- PASS: Oversized relation and sparse visibility scans reject explicitly, never truncate
- PASS: Zero and one records terminate without phantom posts
- PASS: Read component leaves account, media and all entity revisions unchanged

The evidence file has 12 PASS entries: eleven scenario
groups plus a separate comparison-coverage record. It is not twelve independent
suite groups. No count-only equality is used to approve response parity.
Native raw page equality also preserves complete unknown extensions, including
fields that the public renderer deliberately omits.

A first fixture attempt used an unresolved /media path and was correctly refused
by the unchanged media-integrity fence before readiness. The fixture was corrected
to inline isolated media and an invalid non-media gallery value; the fence was
not weakened. Real stored-media CRUD remains covered by the original unchanged
HTTP suite; this prototype does not prove a reduced native media loader.

## 7. Before/after performance results and their boundaries

There is no activated after-HTTP implementation: the original full-feed source is
unchanged. The comparison below is compatibility full HTTP versus the proposed
bounded raw component, not a claim of an apples-to-apples endpoint speedup.

| Path | Posts | Concurrent | Attempted | Success | Rejected | Failed | p50 ms | p95 ms | p99 ms | Success/s | Completion/s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| reference | 5000 | 10 | 10 | 10 | 0 | 0 | 1302.51 | 2251.28 | NOT ESTIMATED | 4.07 | 4.07 |
| reference | 5000 | 25 | 25 | 25 | 0 | 0 | 3100.68 | 5447.59 | NOT ESTIMATED | 4.19 | 4.19 |
| reference | 5000 | 50 | 50 | 32 | 18 | 0 | 3755.06 | 7191.57 | NOT ESTIMATED | 4.14 | 6.46 |
| reference | 10000 | 10 | 10 | 10 | 0 | 0 | 2584.85 | 4341.54 | NOT ESTIMATED | 2.10 | 2.10 |
| reference | 10000 | 25 | 25 | 25 | 0 | 0 | 5724.90 | 10077.94 | NOT ESTIMATED | 2.29 | 2.29 |
| reference | 10000 | 50 | 50 | 32 | 18 | 0 | 7173.08 | 13311.41 | NOT ESTIMATED | 2.25 | 3.52 |
| component | 5000 | 10 | 10 | 10 | 0 | 0 | 114.20 | 171.79 | NOT ESTIMATED | 53.07 | 53.07 |
| component | 5000 | 25 | 25 | 25 | 0 | 0 | 193.94 | 342.12 | NOT ESTIMATED | 68.30 | 68.30 |
| component | 5000 | 50 | 50 | 50 | 0 | 0 | 329.75 | 614.99 | NOT ESTIMATED | 76.76 | 76.76 |
| component | 10000 | 10 | 10 | 10 | 0 | 0 | 120.71 | 199.73 | NOT ESTIMATED | 46.13 | 46.13 |
| component | 10000 | 25 | 25 | 25 | 0 | 0 | 245.89 | 495.78 | NOT ESTIMATED | 47.47 | 47.47 |
| component | 10000 | 50 | 50 | 50 | 0 | 0 | 429.21 | 793.77 | NOT ESTIMATED | 58.73 | 58.73 |
| component | 20000 | 10 | 10 | 10 | 0 | 0 | 170.17 | 274.42 | NOT ESTIMATED | 32.48 | 32.48 |
| component | 20000 | 25 | 25 | 25 | 0 | 0 | 361.26 | 637.16 | NOT ESTIMATED | 35.82 | 35.82 |
| component | 20000 | 50 | 50 | 50 | 0 | 0 | 657.43 | 1298.58 | NOT ESTIMATED | 35.97 | 35.97 |

Percentiles are empirical within each small burst; p99 is not estimated below
100 successful samples and no tail-latency SLO is inferred. Successful latency
excludes rejection. Throughput is a finite burst, not sustained user capacity.

| Path | Posts | Queries p50 | Pool p50 / p95 ms | Advisory wait p50 / p95 ms | Held/transaction p50 / p95 ms |
| --- | --- | --- | --- | --- | --- |
| reference | 5000 | 131.00 | 0.11 / 0.19 | 0.68 / 2.48 | 236.65 / 266.78 |
| reference | 10000 | 131.00 | 0.08 / 0.16 | 0.74 / 2.90 | 437.28 / 493.51 |
| component | 5000 | 30.00 | 165.39 / 540.47 | 40.28 / 48.30 | 13.45 / 19.72 |
| component | 10000 | 30.00 | 209.97 / 693.54 | 51.63 / 74.09 | 17.67 / 27.55 |
| component | 20000 | 30.00 | 321.80 / 1110.85 | 79.55 / 101.70 | 26.55 / 36.32 |

Component query counts exclude guarded transaction/verification setup; full HTTP
counts include its primary transaction. Component held time is measured after
lock acquisition; full totalTxMs is a broader transaction timing. Neither counts
auxiliary outbox connections as part of the primary request.

All component results for each fixture have identical result digests. They return
16 raw records without loading the complete post graph, application bootstrap,
global stats, public enrichment or public HTTP buffering.
The component benchmark uses direct calls through the same four-client pool and
global advisory lock, not the HTTP admission gate; therefore its lack of 18/50
HTTP rejections is NOT an admission/capacity improvement.

The initial component experiment used BEGIN READ ONLY and received PostgreSQL
25006 because the existing authority verifier uses FOR SHARE. Its failed
measurements are retained in performance-component-readonly-refusal.json.
The corrected probe uses the original guarded transaction mode, SELECT-only
component code and unconditional rollback. No verifier or lock was removed.

The original full-feed 50-request bursts still show 32 successes and 18 deliberate
admission rejections. No full 20,000-post HTTP workload was run: a small raw-page
headroom result does not establish headroom for global hydration/render/buffering.

## 8. Unchanged regression protection

| Original suite | PASS | FAIL |
| --- | --- | --- |
| http | 56 | 0 |
| hardening | 27 | 0 |
| profile | 9 | 0 |
| background | 11 | 0 |

The exact 56 HTTP, 27 hardening, 9 profile parity and 11 background reliability
tests were rerun without editing their bytes or assertions. Only output writes
were redirected into this phase's regressions directory. Earlier evidence was
not overwritten. No application writer expectation was weakened.

## 9. Remaining scalability blockers

- Legacy bootstrap/full hydration, reparsing, whole-feed enrichment and response
  buffering remain in the actual application.
- Global statistics and media/audit/auth persistence are not implemented as a
  complete native read transaction with proven reduced dependencies.
- Original client sorting/search/story/global-ranking/announcement/deep-link
  behavior needs an approved pagination migration.
- Revision-bound ordinal continuation rejects concurrent rewrites; it does not
  certify uninterrupted scroll during active posting.
- Sparse authorization and huge nested posts explicitly hit component budgets;
  they are not yet a production-quality pagination UX.
- No sustained concurrency, long-running heap/allocator soak, authenticated DOM
  profile or production load result is claimed.

## 10. Recommended next step from measured evidence

Approve or reject a versioned opt-in cursor contract and corresponding frontend
behavior first: ordering/search modes, revision restart policy, fresh permission/
expiry handling, deep links and global widgets. Keep the default complete API.
Then implement and prove only the approved native read dependency slice, including
global statistics and media/commit behavior, before changing the UI.

This is a recommendation, not started work. No further phase, deployment or
automatic native-write expansion follows this report.

## 11. Development readiness verdict

**GO for the tested design/private component. Native HTTP activation: NOT APPROVED.**
The existing conditional guarded 5k/10k development baseline is retained.
20,000-post bounded raw component: completed under the same guard.
20,000-post full application feed: NOT RUN here and remains NO-GO from the prior
guard failure. The 91 MiB component result does not close that blocker.

## 12. Separate production readiness verdict

**NO-GO. Production unchanged.** No real employee/media import, production
connection, credential rotation, release-fence removal, migration, publication,
native write enablement, global-lock removal or UI change occurred.
Existing authentication/session semantics and production settings are preserved.

## Reproduction and evidence

node scripts/postgres/phase2e-tests.cjs
node scripts/postgres/phase2e-benchmark.cjs reference
node scripts/postgres/phase2e-benchmark.cjs component
node scripts/postgres/phase2e-regressions.cjs e2e
node scripts/postgres/phase2e-regressions.cjs hardening
node scripts/postgres/phase2e-regressions.cjs parity
node scripts/postgres/phase2e-regressions.cjs background

Evidence: generated-artifacts/phase2e/feed-parity.json, performance-reference.json,
performance-component.json, regressions/, preservation-check.json and this report.
These commands create only independently attested invented private fixtures.
