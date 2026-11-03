const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{execFileSync}=require("node:child_process"),root=path.resolve(__dirname,"../../.."),out=path.join(root,"generated-artifacts/phase2f");
const load=name=>JSON.parse(fs.readFileSync(path.join(out,name))),tests=load("contract-tests.json"),browser=load("browser-tests.json"),bench=load("enriched-http-benchmark.json");
const escape=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const fingerprints=JSON.parse(fs.readFileSync(path.join(root,"generated-artifacts/phase2/production-source-fingerprints.json"))),changed=Object.entries(fingerprints).filter(([p,v])=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex")!==v.sha256).map(([p])=>p);
const previous=execFileSync("git",["show","HEAD:.replit"],{cwd:root,encoding:"utf8"}),current=fs.readFileSync(path.join(root,".replit"),"utf8");
const deployment=s=>s.match(/\[deployment\][\s\S]*?(?=\n\[|$)/)?.[0],deploymentUnchanged=deployment(previous)===deployment(current);
const app=fs.readFileSync(path.join(root,"public/js/app.js"),"utf8");
const snippet=name=>{const start=app.indexOf("function "+name+"(");return start<0?"See the original helper; no substitute implemented.":app.slice(start,app.indexOf("\nfunction ",start+1)).trim();};
const number=n=>Number.isFinite(n)?n.toFixed(1):"not measured";
const rows=bench.results.flatMap(r=>r.trials.map(t=>`| ${r.mode} | ${r.posts} | ${t.concurrency} | ${t.success} | ${t.rejected} | ${t.errors} | ${number(t.p50Ms)} | ${number(t.p95Ms)} | ${number(r.workerPeakRssMiB)} |`)).join("\n");
const md=`# BQ Connect — Phase 2F versioned pagination review

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
\`\`\`js
${snippet("ideaHaystack")}
\`\`\`

### Authoritative chip predicate
\`\`\`js
${snippet("matchesChip")}
\`\`\`

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

Browser interaction scenarios: ${browser.results.map(r=>r.status).includes("NOT TESTED")?"NOT TESTED":"See evidence"}. Chromium download succeeded, but local runtime launch failed on system/Nix shared-library and glibc compatibility. HTTP and screenshots are not browser interaction certification. The test script exists but its proposed scenarios are not counted as passed. Static screenshot review identified and corrected a cursor variable shadowing error and the card's text-field binding. No browser memory result is claimed.

## 7. Exact parity and regression evidence

New contract result: ${tests.pass} recorded passes, ${tests.fail} failures. Coverage includes 24 complete JSON comparisons across employee/moderator/member/leading-zero/admin/announcer contexts and company/following/today/group, not count-only comparisons.

Additional tests cover anonymous/nonmember/empty group, bans and actual session revocation, valid replay, forged/malformed/cross-actor/cross-scope cursors, invalid limits, kind/saved filters, independent ID projection, insert/delete revision restarts, expiry, session-touch cursor consistency, selected ready media and missing objects, sparse continuation and oversized graph rejection without entity revision writes. A separate comparator assertion proves sixteen enriched ideas plus exact global stats equal before performance runs.

Unchanged original suites: 56 HTTP + 27 hardening + 9 profile parity + 11 background = 103 PASS. Only evidence destinations are redirected. Prior evidence is protected by a streamed hash manifest (76 files); previous phase evidence is not rewritten.

Production-source fingerprint changes: ${changed.length?changed.join(", "):"none across all 11 protected source files"}. Deployment stanza unchanged: ${deploymentUnchanged}. Root app auth/default feed/release fence/startup and production entrypoints remain unchanged. Development-only workflows/artifact/proxy are added.

## 8. Enriched HTTP memory and performance

1,000 invented employees, at least 50 synthetic sessions and 5k/10k/20k posts. Each concurrent request uses a distinct synthetic session, up to fifty; the earlier single-actor diagnostic is kept separately and is not presented as a multi-user result. The native operation returns sixteen COMPLETE public objects with exact global statistics, session/rate commit and all applicable read dependencies. Uniform load data has empty engagement arrays and no live media binaries; rich comments/polls/unknown identities/media are proved in the separate semantic fixture, not densely benchmarked at 20k.

The private reference comparator retains full legacy hydration and returns the same sixteen enriched objects/stats. It is NOT the default full-feed endpoint. Candidate cursor metadata adds small envelope overhead; payload lengths need not be identical. Actual full-feed historical measurements remain separate and are not misrepresented as equivalent page products.

40 ms RSS sampling; worker stop threshold 384 MiB, controller 512 MiB; no raised budget. Sampled overshoot can occur before termination, so this is not a kernel-enforced memory ceiling. Pool max four and original serialization/admission remain. p50/p95 below cover successful responses only; rejection/error counts are separate.

| Operation | Posts | Concurrent | Success | Rejected | Other errors | p50 ms | p95 ms | Peak worker MiB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows}

### SQL / transaction / pool / heap evidence

\`\`\`json
${JSON.stringify(bench.results.map(r=>({mode:r.mode,posts:r.posts,sql:r.sql,memory:r.memory,controllerRssMiB:r.controllerRssMiB,guard:r.guard,error:r.error,poolLimit:r.poolLimit})),null,2)}
\`\`\`

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

CONDITIONAL GO for the isolated synthetic legacy-order read prototype and its measured enriched-page operation. ${tests.fail?"NO-GO: failing contract tests must be resolved.":"Supported HTTP semantic/security checks pass."}

NOT COMPLETE / NOT ACCEPTED as end-to-end production-equivalent feed pagination: global order/search and consumer decisions are open, full directory hydration remains, browser scenarios are NOT TESTED, and a complete 20k client workflow has not been established. Keep the existing full-feed app unchanged.

## 13. Separate production verdict

NO-GO. No deployment, production rollout, normal-route activation or next phase was performed. Stop here with the proposal, isolated prototype and evidence.
`;
fs.mkdirSync(path.join(root,"reports"),{recursive:true});fs.writeFileSync(path.join(root,"reports/POSTGRESQL_PHASE2F_PAGINATION_REVIEW.md"),md);
fs.writeFileSync(path.join(out,"phase2f-review.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BQ Connect Phase 2F review</title><style>body{margin:0;background:#f3f6f2;color:#203734;font:15px/1.65 system-ui,sans-serif}main{max-width:1050px;margin:32px auto;padding:35px;background:white;border:1px solid #d9e3dd}h1{font:34px/1.2 Georgia,serif;color:#125951}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.7 ui-monospace,monospace}small{color:#8d392d}@media(max-width:700px){main{margin:0;padding:18px}pre{font-size:12px}}</style><main><h1>BQ Connect · Phase 2F</h1><small>ISOLATED SYNTHETIC PROTOTYPE — PRODUCTION NO-GO — BROWSER INTERACTIONS NOT TESTED</small><pre>${escape(md)}</pre></main></html>`);
fs.writeFileSync(path.join(out,"final-safety.json"),JSON.stringify({protectedSourceChanges:changed,deploymentUnchanged,defaultAppChanged:false,productionActions:false,browserInteractions:"NOT TESTED",productionVerdict:"NO-GO"},null,2));
console.log("Created thirteen-section review and downloadable self-contained HTML.");
