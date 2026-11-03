# BQ Connect — Phase 2F versioned pagination review

Generated from private synthetic evidence. This is a contract proposal and isolated prototype, not approval or activation of the normal feed.

## 1. Exact existing feed contract

- GET /api/ideas authenticates the existing session. Unknown, revoked and banned identities cannot read; employee-required is 401. Leading-zero badge identity is preserved by the established compatibility runtime, never numerically collapsed.
- Company scope excludes group posts. Following includes followed people, departments, self and official announcers. Today uses a moving 24-hour createdAt threshold. A requested group requires current membership even if empty; admin/moderator status does not bypass this check.
- Expired stories are excluded on every read; invalid nonempty expiry also excludes a story. Missing story expiry is retained. Hidden posts are visible to their owner, not automatically to admins. A viewer's reported posts are suppressed. A legacy scalar deleted:true is not a tombstone; physical removal is deletion.
- The server preserves stored array ordinal order. The original client globally sorts new/old by parsed date; top by likes-minus-dislikes, then likes, then descending date. Stable ties retain input order; invalid dates can yield JS NaN comparisons. Pagination in ordinal order followed by page-local sorting is NOT equivalent.
- Search is currently client-wide: lowercase, Arabic-mark removal, أ/إ/آ/ٱ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي, Arabic/Persian digits→ASCII, whitespace folding; all query terms must match. Numeric hashtag handling is in searchWords. The exact current haystack and chip predicates are included below.
- Bookmarks/follow flags are viewer-specific. Output retains comments/replies/likes, rating vote and legacy-star interpretation including unknown identities, poll option vote counts and mine flags, repost count/own/repostedBy, acknowledgements, event attendance, view counts, author/public-ID/official/avatar fields, reply/status/pin permissions, status history, group identity, thanks identity, media and gallery sanitization.
- Global stats count ALL raw posts, including hidden/group/expired rows: shared length; exact review/project statuses; nextNumber uses the legacy JS Number/Math.max fold, including hexadecimal, invalid, boolean, null and extreme values. It is not a page or visible-post count.
- Existing stories strip, alerts/pins, ranking widgets, bookmarks/profile/search and deeplinks rely on the full client collection. No claim is made that a page alone replaces these consumers.
- Original full endpoint response remains ideas/stats; no-store, JSON UTF-8, Vary Accept-Encoding, optional gzip and correct per-response length are preserved.

### Authoritative search haystack
```js
function ideaHaystack(idea) {
  const author = idea.author || {};
  return [
    pad(idea.number),
    idea.title,
    idea.text,
    idea.problem,
    idea.impact,
    idea.place,
    displayPlace(idea.place),
    ...(idea.pros || []),
    ...(idea.cons || []),
    author.name,
    author.position,
    author.department || "",
    DEPT_LABELS[author.department] || "",
    idea.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
```

### Authoritative chip predicate
```js
function matchesChip(idea) {
  if (view !== "hub") return true;
  if (idea.type && idea.type !== "idea") return false;
  return inHubPeriod(idea);
}

const cardMemo = new Map();
```

## 2. Proposed opt-in API contract

Private worker only: GET /api/ideas?pagination=keyset-v1&limit=8&feed=company&sort=legacy. Normal GET without this opt-in remains the original full response in the isolated worker; the normal application source does not know this opt-in.

Envelope: {ideas:[fully enriched objects],stats:{shared,review,projects,nextNumber},page:{version:"keyset-v1",state:"more"|"end",nextCursor:string|null,order:"legacy",limit}}.

Limits 1–32; preview uses eight. Supported scopes: company, following, today, group. Versioned kind and saved filters operate before page selection. Nonempty q or new/old/top sort returns explicit 422 product_decision_required, never local-page substitutes. Unsupported filter values are explicit 400s.

More means a bounded scan can continue, not a promise of another visible item. A sparse scan can return zero items and a signed continuation. Exhaustion is explicit end/null; a full final page may need one empty terminal probe. A single over-budget graph/response is rejected, never silently truncated or skipped.

Deeplink projection is independent of the cached page, still scoped and freshly authorized. An authorized absence gives an empty result. Group deeplinks require an explicit group scope; discovering or bypassing groups from a bare ID is not implemented.

Cursor: HMAC-SHA256, synthetic-only key/audience, v1, actor+session digest, normalized scope/limit/filter digest, dependency-revision digest, ordinal position, issue and fixed expiry time. Lifetime is two minutes across the whole chain, not extended on each page. No production/session/backup key is reused or rotated. Keys and bootstrap sessions are private-fixture process state; worker/server restart is not seamless session resume and requires rebootstrap/reload.

Errors: 400 invalid cursor, 403 actor/scope mismatch, 409 revision restart, 410 expiry; normal 401/403 authorization errors occur before cursor processing. Read-only replay is intentionally allowed within the same revision/lifetime; client ID deduplication is not a security boundary.

## 3. Cursor strategy comparison and recommendation

| Strategy | Strength | Limit / decision |
|---|---|---|
| Revision-bound ordinal | Preserves exact legacy wire order; bounded continuation; no migration | Any affected dependency revision requires restart; writes can rebase all ordinals |
| Immutable keyset | Efficient stable keys if immutable order is defined | Current whole-entity writers do not guarantee immutable ordinal IDs; date/top/tie definitions would change history |
| Snapshot session | A frozen ordered set across mutations | Requires quotas, lifetime/storage/cleanup, fresh auth on every page and dedicated snapshot design; holding transactions conflicts with four pool connections/deadlines |

Recommend revision-bound ordinal ONLY for the explicitly named legacy-order version. Inserts, deletes, edits, ratings, moderation, membership, follows, saved state and roles conservatively invalidate through revisions. New/top/old are blocked pending a global ordering decision, including invalid dates and ties. Story expiry and today are re-evaluated against current time; this is a live view, NOT a frozen historical snapshot. Already-issued content cannot be treated as permanently authorized.

## 4. SQL and read-model dependency coverage

- Reuses the Phase 2E bounded graph reader with only a private scan-continuation extension. Posts plus complete comment/like/rating/repost/poll/vote/status/report/ack/attendee/gallery relations are fetched in parameterized parent batches, not per-post N+1 queries.
- Original accounts/security/moderators/conduct and the employee directory remain authorization dependencies. The directory is still loaded globally (1,000 in load tests), so unlimited directory/account growth is NOT solved.
- Groups are projected to requested scope; follows/bookmarks to current actor; profiles to referenced identities; views to selected post IDs. Unknown/legacy fields are decoded losslessly before the original public projection.
- Ready/retained media metadata is selected by referenced paths, then existence/SHA-256 verified using streaming reads. Missing/corrupt objects reject; no partial media-link rebuild occurs on a projected read. Per-object 32 MiB and selected-total 64 MiB diagnostic media budgets are explicit.
- Exact global stats use bounded 512-row scalar streams and one revision-keyed stats cache, never a complete post graph or approximate SQL number coercion.
- Per-page graph budget: 8,192 nodes / 8 MiB decoded attribute preflight; 512 scanned candidates; max 32 returned; response cap 2 MiB. Projection budgets reject rather than truncate.
- Bootstrap hydrates non-post state and a read-only empty post placeholder solely for module initialization. Existing department-group normalization is an original compatibility/CAS bootstrap write. Request reads do not activate native entity writers.
- The feed-only worker deliberately does not run periodic jobs; unchanged background suites exercise those separately. This is NOT a full-service memory measurement.

## 5. Backend authorization, transactions and safety

The original request dispatcher, session validation/touch, ban/session revocation checks, employee/public-ID helpers, scope filters, visibility, enrichment, HTTP send, rate maps, encrypted runtime state, global serialization, advisory lock, timeouts, ingress and queue admission remain in use.

The reduced path rehydrates current auth before every page; it cannot fall back to the full graph on a paging error. Account/session touch is a complete accounts compatibility write, with cursor revision accounting for the pending commit. Responses are held until transaction commit; auth/rate/session state is not acknowledged before commit. Projected readonly files cannot be persisted accidentally. The media commit rebuild is skipped only for this guarded readonly projection; link counts are tested unchanged on failed media reads.

Synthetic fixture controls are in a separate loopback operator service. They seed invented posts through the existing fixture writer, advance only a diagnostic cursor-verifier clock, or inject one explicit HTTP failure. They are not native application writers or a substitute production login. No actual account, key, archive, SMTP, push, or production database was used.

## 6. Isolated frontend behavior and browser status

Separate artifact: Isolated feed pagination prototype. Original public HTML/JS/CSS are unchanged.

Implemented preview controls: synthetic actor selection; initial and load-more requests; opt-in IntersectionObserver loading; refresh; signed restart/expiry/error handling; request abort/stale-generation guards; scope/kind/saved controls; explicit unsupported Arabic search/global sorts; off-window ID fetch; EN/AR direction and mobile CSS; fixture insert/expiry/failure controls. Authorization/revision/expiry failures clear the cached visible data. Card/data window is capped at 80, seen-ID set at 320, with disclosed eviction and refresh to restore the first window.

This is a read-only inspection UI: saved filtering/flags are real, but bookmark mutation is not added. It does not replace the original story strip, ranking/alert/pinned widgets, full engagement interaction UI or production session recovery. A server restart requires synthetic-session rebootstrap/reload. These remain integration limitations, not silently implemented behavior.

Browser interaction scenarios: NOT TESTED. Chromium download succeeded, but local runtime launch failed on system/Nix shared-library and glibc compatibility. HTTP and screenshots are not browser interaction certification. The test script exists but its proposed scenarios are not counted as passed. Static screenshot review identified and corrected a cursor variable shadowing error and the card's text-field binding. No browser memory result is claimed.

## 7. Exact parity and regression evidence

New contract result: 17 recorded passes, 0 failures. Coverage includes 24 complete JSON comparisons across employee/moderator/member/leading-zero/admin/announcer contexts and company/following/today/group, not count-only comparisons.

Additional tests cover anonymous/nonmember/empty group, bans and actual session revocation, valid replay, forged/malformed/cross-actor/cross-scope cursors, invalid limits, kind/saved filters, independent ID projection, insert/delete revision restarts, expiry, session-touch cursor consistency, selected ready media and missing objects, sparse continuation and oversized graph rejection without entity revision writes. A separate comparator assertion proves sixteen enriched ideas plus exact global stats equal before performance runs.

Unchanged original suites: 56 HTTP + 27 hardening + 9 profile parity + 11 background = 103 PASS. Only evidence destinations are redirected. Prior evidence is protected by a streamed hash manifest (76 files); previous phase evidence is not rewritten.

Production-source fingerprint changes: none across all 11 protected source files. Deployment stanza unchanged: true. Root app auth/default feed/release fence/startup and production entrypoints remain unchanged. Development-only workflows/artifact/proxy are added.

## 8. Enriched HTTP memory and performance

1,000 invented employees, at least 50 synthetic sessions and 5k/10k/20k posts. Each concurrent request uses a distinct synthetic session, up to fifty; the earlier single-actor diagnostic is kept separately and is not presented as a multi-user result. The native operation returns sixteen COMPLETE public objects with exact global statistics, session/rate commit and all applicable read dependencies. Uniform load data has empty engagement arrays and no live media binaries; rich comments/polls/unknown identities/media are proved in the separate semantic fixture, not densely benchmarked at 20k.

The private reference comparator retains full legacy hydration and returns the same sixteen enriched objects/stats. It is NOT the default full-feed endpoint. Candidate cursor metadata adds small envelope overhead; payload lengths need not be identical. Actual full-feed historical measurements remain separate and are not misrepresented as equivalent page products.

40 ms RSS sampling; worker stop threshold 384 MiB, controller 512 MiB; no raised budget. Sampled overshoot can occur before termination, so this is not a kernel-enforced memory ceiling. Pool max four and original serialization/admission remain. p50/p95 below cover successful responses only; rejection/error counts are separate.

| Operation | Posts | Concurrent | Success | Rejected | Other errors | p50 ms | p95 ms | Peak worker MiB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| native | 5000 | 1 | 1 | 0 | 0 | 114.3 | 114.3 | 141.4 |
| native | 5000 | 10 | 10 | 0 | 0 | 297.0 | 469.8 | 141.4 |
| native | 5000 | 25 | 25 | 0 | 0 | 520.2 | 868.3 | 141.4 |
| native | 5000 | 50 | 32 | 18 | 0 | 568.5 | 997.8 | 141.4 |
| native | 10000 | 1 | 1 | 0 | 0 | 97.6 | 97.6 | 140.4 |
| native | 10000 | 10 | 10 | 0 | 0 | 273.8 | 438.2 | 140.4 |
| native | 10000 | 25 | 25 | 0 | 0 | 496.0 | 904.6 | 140.4 |
| native | 10000 | 50 | 32 | 18 | 0 | 573.7 | 1047.8 | 140.4 |
| native | 20000 | 1 | 1 | 0 | 0 | 197.7 | 197.7 | 139.1 |
| native | 20000 | 10 | 10 | 0 | 0 | 476.1 | 747.0 | 139.1 |
| native | 20000 | 25 | 25 | 0 | 0 | 727.0 | 1270.0 | 139.1 |
| native | 20000 | 50 | 32 | 18 | 0 | 954.4 | 1673.9 | 139.1 |
| reference-page | 5000 | 1 | 1 | 0 | 0 | 222.2 | 222.2 | 204.4 |
| reference-page | 5000 | 10 | 10 | 0 | 0 | 1024.5 | 1576.8 | 204.4 |
| reference-page | 5000 | 25 | 25 | 0 | 0 | 1805.2 | 3309.0 | 204.4 |
| reference-page | 5000 | 50 | 32 | 18 | 0 | 2199.8 | 3981.6 | 204.4 |
| reference-page | 10000 | 1 | 1 | 0 | 0 | 332.8 | 332.8 | 291.1 |
| reference-page | 10000 | 10 | 10 | 0 | 0 | 1517.9 | 2509.2 | 291.1 |
| reference-page | 10000 | 25 | 25 | 0 | 0 | 3161.5 | 5946.6 | 291.1 |
| reference-page | 10000 | 50 | 32 | 18 | 0 | 4077.8 | 7289.9 | 291.1 |
| reference-page | 20000 | 1 | 1 | 0 | 0 | 619.7 | 619.7 | 387.9 |
| reference-page | 20000 | 10 | 2 | 0 | 8 | 1279.3 | 1279.3 | 387.9 |

### SQL / transaction / pool / heap evidence

```json
[
  {
    "mode": "native",
    "posts": 5000,
    "sql": {
      "samples": 68,
      "queries": [
        119,
        97
      ],
      "hydrationQueries": [
        30
      ],
      "p95TransactionMs": 49.66660200000001,
      "p95QueueWaitMs": 889.1043239999999,
      "feedNodes": [
        160
      ]
    },
    "memory": {
      "type": "memory",
      "rss": 147550208,
      "heapTotal": 67538944,
      "heapUsed": 16053192,
      "external": 3488726,
      "arrayBuffers": 1172554
    },
    "controllerRssMiB": 116.8046875,
    "guard": "not hit",
    "poolLimit": 4
  },
  {
    "mode": "native",
    "posts": 10000,
    "sql": {
      "samples": 68,
      "queries": [
        139,
        97
      ],
      "hydrationQueries": [
        30
      ],
      "p95TransactionMs": 47.74617999999964,
      "p95QueueWaitMs": 940.1156270000001,
      "feedNodes": [
        160
      ]
    },
    "memory": {
      "type": "memory",
      "rss": 146362368,
      "heapTotal": 61247488,
      "heapUsed": 34081496,
      "external": 10044704,
      "arrayBuffers": 7728532
    },
    "controllerRssMiB": 125.42578125,
    "guard": "not hit",
    "poolLimit": 4
  },
  {
    "mode": "native",
    "posts": 20000,
    "sql": {
      "samples": 68,
      "queries": [
        179,
        97
      ],
      "hydrationQueries": [
        30
      ],
      "p95TransactionMs": 78.55450800000017,
      "p95QueueWaitMs": 1534.0461679999999,
      "feedNodes": [
        160
      ]
    },
    "memory": {
      "type": "memory",
      "rss": 144957440,
      "heapTotal": 65179648,
      "heapUsed": 21832112,
      "external": 4305766,
      "arrayBuffers": 1989594
    },
    "controllerRssMiB": 149.53515625,
    "guard": "not hit",
    "poolLimit": 4
  },
  {
    "mode": "reference-page",
    "posts": 5000,
    "sql": {
      "samples": 68,
      "queries": [
        131
      ],
      "hydrationQueries": [
        107
      ],
      "p95TransactionMs": 188.6916659999997,
      "p95QueueWaitMs": 3568.6930090000005,
      "feedNodes": [
        null
      ]
    },
    "memory": {
      "type": "memory",
      "rss": 206815232,
      "heapTotal": 79155200,
      "heapUsed": 39316552,
      "external": 5253031,
      "arrayBuffers": 2942232
    },
    "controllerRssMiB": 94.35546875,
    "guard": "not hit",
    "poolLimit": 4
  },
  {
    "mode": "reference-page",
    "posts": 10000,
    "sql": {
      "samples": 68,
      "queries": [
        131
      ],
      "hydrationQueries": [
        107
      ],
      "p95TransactionMs": 282.8027339999999,
      "p95QueueWaitMs": 6612.261941999999,
      "feedNodes": [
        null
      ]
    },
    "memory": {
      "type": "memory",
      "rss": 290213888,
      "heapTotal": 105005056,
      "heapUsed": 62874592,
      "external": 7945087,
      "arrayBuffers": 5634288
    },
    "controllerRssMiB": 124.515625,
    "guard": "not hit",
    "poolLimit": 4
  },
  {
    "mode": "reference-page",
    "posts": 20000,
    "sql": {
      "samples": 3,
      "queries": [
        131
      ],
      "hydrationQueries": [
        107
      ],
      "p95TransactionMs": 663.3867529999998,
      "p95QueueWaitMs": 663.4215359999998,
      "feedNodes": [
        null
      ]
    },
    "controllerRssMiB": 129.54296875,
    "guard": "worker RSS guard",
    "poolLimit": 4
  }
]
```

Peak RSS is not inferred from post-GC heap. Timings separate successful transaction time and queue wait; no independent advisory-lock wait distribution or pool-wait histogram was instrumented. No browser-memory measurement is available. Burst-50 results do NOT mean fifty successful admissions. These are bounded page-operation measurements, not a 20k full-client scroll, all background jobs, sustained multi-user capacity, or a proof of globally bounded RSS.

## 9. Cursor security and failure handling

HMAC verified before payload use; bounded token size and exact signed schema/version/audience/time/position validation. Actor/session and scope bindings preserve badge strings including leading zeroes. Fresh session/ban/group checks precede cursor handling; revoked/banned identities get no ideas. Role/dependency revision changes cannot be hidden by a previously valid signature.

Every request uses a fresh locked transaction. Failed graph/media reads roll back; 409/410 tell the client to clear/restart; 400 invalid signatures do not reveal key material. Replay is harmless readonly repetition, explicitly tested, not treated as a new security credential. Cursor payload is signed but not encrypted: it contains digests/positions/times, never raw employee/account/profile data.

Limits do not silently increase; budgets do not skip an oversized authorized post. A sparse scan returns a signed continuation rather than pretending exhaustion. Unsupported global operations return explicit 422 with no page data. No global gate, lock, authentication stack or production key policy was removed/replaced.

## 10. Unresolved product and acceptance decisions

1. Approve or reject a new legacy-order API independently of the existing client's default newest order.
2. Define global new/old/top order, stable ties, invalid dates, ranking mutations and a compatible Arabic-search/chip contract. Implementation of those affected paths is stopped at explicit 422.
3. Define independent global story/pin/alert/ranking projections versus complete client-collection dependencies.
4. Approve conservative restart-on-mutation behavior, two-minute lifetime, rate-limit pacing, navigation/eviction UX, and live expiry/today semantics versus immutable snapshots.
5. Define group deeplink discovery/missing/forbidden behavior and production cursor-key/session recovery across restart.
6. Run actual browser interactions, RTL/mobile/expiry/restart/revoke/dedup/cache-memory tests in a working environment; screenshots and code inspection are insufficient.
7. Complete full consumer integration, saved/engagement mutations through existing safe writers, richer-load and sustained/page-chain capacity measurements. None is implied by this prototype.

These unresolved points block calling this phase fully accepted or activating pagination in the original application. The blocked paths were not guessed or silently implemented.

## 11. Production migration dependencies

Separate authorization and release approval; production backup/restore proof and migration plan; approved contract/frontend behavior; independent global projections; key lifecycle; full consumer integration; browser and mutation-race/security validation; load tests with real-shaped synthetic engagement and directory scale; sustained monitoring and rollback plan; any schema/index changes only through an approved migration.

No production connection/query/migration/import, deployment/republish, real-data write, key rotation, auth replacement, native-write activation, lock removal or fence removal occurred. This report does not authorize any of them.

## 12. Development verdict

CONDITIONAL GO for the isolated synthetic legacy-order read prototype and its measured enriched-page operation. Supported HTTP semantic/security checks pass.

NOT COMPLETE / NOT ACCEPTED as end-to-end production-equivalent feed pagination: global order/search and consumer decisions are open, full directory hydration remains, browser scenarios are NOT TESTED, and a complete 20k client workflow has not been established. Keep the existing full-feed app unchanged.

## 13. Separate production verdict

NO-GO. No deployment, production rollout, normal-route activation or next phase was performed. Stop here with the proposal, isolated prototype and evidence.
