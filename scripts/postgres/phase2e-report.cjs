const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict");
const {output,save,hash}=require("./phase2e-support.cjs"),root=path.resolve(__dirname,"../.."),read=p=>JSON.parse(fs.readFileSync(path.join(output,p)));
const reference=read("performance-reference.json"),component=read("performance-component.json"),parity=read("feed-parity.json");
const suites={http:read("regressions/verification/regression/http-results.json").totals,hardening:read("regressions/verification/hardening-results.json").totals,profile:read("regressions/verification/native-parity.json").totals,background:read("regressions/targeted-tests.json").totals};
const preservation=Object.entries(read("preserved-before.json")).map(([file,sha])=>({file,unchanged:hash(fs.readFileSync(path.join(root,file)))===sha}));
const sources=["server.js","auth.js","backup.js","development/postgres/runtime.cjs","development/postgres/repository.cjs","development/postgres/codec.cjs","scripts/postgres/e2e.cjs","scripts/postgres/hardening.cjs","scripts/postgres/phase2c-parity.cjs","scripts/postgres/phase2d-tests.cjs"];
const sourceChecks=sources.map(file=>({file,unchanged:hash(fs.readFileSync(path.join(root,file)))===hash(cp.execFileSync("git",["show","HEAD:"+file],{cwd:root}))}));
const production=Object.entries(JSON.parse(fs.readFileSync(path.join(root,"generated-artifacts/phase2/production-source-fingerprints.json")))).map(([file,v])=>({file,unchanged:hash(fs.readFileSync(path.join(root,file)))===v.sha256}));
const config=fs.readFileSync(path.join(root,".replit"),"utf8")===cp.execFileSync("git",["show","HEAD:.replit"],{cwd:root,encoding:"utf8"});
assert([...preservation,...sourceChecks,...production].every(x=>x.unchanged)&&config,"Preservation or configuration mismatch");
assert(Object.values(suites).every(t=>(t.FAIL||0)===0)&&!(parity.totals.FAIL||0),"Regression failure");
save("preservation-check.json",{priorEvidence:preservation,sourceChecks,production,configurationUnchanged:config});
const n=x=>Number.isFinite(x)?x.toFixed(2):"NOT MEASURED",mi=b=>b/1048576;
const stats=a=>{const s=a.filter(Number.isFinite).sort((a,b)=>a-b);return{n:s.length,p50:s.length?s[Math.floor((s.length-1)*.5)]:null,p95:s.length?s[Math.floor((s.length-1)*.95)]:null};};
const table=(head,rows)=>[`| ${head.join(" | ")} |`,`| ${head.map(()=>"---").join(" | ")} |`,...rows.map(r=>`| ${r.join(" | ")} |`)].join("\n");
const resources=[...reference.results,...component.results].map(r=>[r.kind,r.posts,r.status,n(r.peakRssMiB),n(r.peakHeapMiB),n(r.peakExternalMiB),n(r.peakArrayBuffersMiB),r.responses.find(x=>x.status==="SUCCESS")?.bytes??"NOT COMPLETED"]);
const phaseRows=[],memoryRows=[];
for(const r of reference.results){
 const sends=r.stages.filter(s=>s.stage==="serialization-and-send").slice(1); // Exclude startup accumulation.
 for(const key of ["sql-retrieval-and-driver-decode","relational-object-decoding","authorization-filter","visibility-check","post-enrichment","media-reference"]){
  const a=stats(sends.map(s=>s.components?.[key]?.ms));phaseRows.push([r.posts,key,a.n,n(a.p50),n(a.p95)]);
 }
 for(const key of ["json-stringification","serialization-and-send"]){const a=stats(r.stages.filter(s=>s.stage===key).slice(1).map(s=>s.ms));phaseRows.push([r.posts,key,a.n,n(a.p50),n(a.p95)]);}
 for(const stage of ["sql-table-posts","decode-ideas.json","graph-decoded","media-and-buffers","authorization-filter","enrichment-and-visibility","json-stringification","json-response-buffer","response-constructed"]){
  const a=r.stages.filter(s=>s.stage===stage);memoryRows.push([r.posts,stage,a.length,n(Math.max(...a.map(s=>mi(s.rss)))),n(Math.max(...a.map(s=>mi(s.heapUsed)))),n(Math.max(...a.map(s=>mi(s.external)))),n(Math.max(...a.map(s=>mi(s.arrayBuffers))))]);
 }
}
const burstRows=[...reference.results,...component.results].flatMap(r=>r.bursts.map(b=>[r.kind,r.posts,b.concurrency,b.attempted,b.successes,b.rejected,b.failed,n(b.latencyMs.p50),n(b.latencyMs.p95),b.latencyMs.p99===null?"NOT ESTIMATED":n(b.latencyMs.p99),n(b.successfulPerSecond),n(b.completionPerSecond)]));
const sqlRows=[...reference.results,...component.results].map(r=>{
 const native=r.kind==="component",a=native?[...r.responses,...r.bursts.flatMap(b=>b.responses)].filter(x=>x.status==="SUCCESS"):r.timings||[];
 const q=stats(a.map(x=>native?x.metrics.queries:x.queryCount)),pool=stats(a.map(x=>x.poolWaitMs)),lock=stats(a.map(x=>x.advisoryWaitMs)),held=stats(a.map(x=>native?x.advisoryHeldMs:x.totalTxMs));
 return[r.kind,r.posts,n(q.p50),`${n(pool.p50)} / ${n(pool.p95)}`,`${n(lock.p50)} / ${n(lock.p95)}`,`${n(held.p50)} / ${n(held.p95)}`];
});
const indexes=component.results.map(r=>{const names=[];function walk(p){if(p["Index Name"])names.push(p["Index Name"]);for(const child of p.Plans||[])walk(child);}walk(r.plan?.[0]?.Plan||{});return{posts:r.posts,indexes:names,rows:r.plan?.[0]?.Plan?.["Actual Rows"],ms:r.plan?.[0]?.["Execution Time"]};});
const changed=cp.execFileSync("git",["status","--porcelain","--untracked-files=all"],{cwd:root,encoding:"utf8"}).trimEnd().split("\n").filter(Boolean).map(l=>l.slice(3));
const verdict={development:"GO for tested design/private component only; native HTTP activation NOT APPROVED",existingDevelopment:"Prior conditional guarded development baseline retained",fullTwentyThousandHTTP:"NOT RUN in this phase / remains NO-GO",production:"NO-GO"};
const report=`# BQ Connect — Feed scalability and pagination boundary review

**Outcome: tested design and private SQL prototype, not an activated native feed API.**
The application, UI, default API, original writers, authorization/session code,
global lock and production configuration are unchanged.

## 1. Feed dependency and authorization map

Actual path: server.js GET /api/ideas → badgeFrom → readIdeas →
filteredIdeas → publicList → publicIdea → send. The private comparison calls
these same functions; it does not infer permission rules from relational names.

${table(["Concern","Observed reference semantics","Native read dependency"],[
["Authentication","Existing x-session/badgeFrom checks run before feed access; no new token reader","Unchanged auth/session/ban/identity preparation, not a cursor credential"],
["Public/owner/hidden/reported","visibleTo: owner wins first; otherwise hidden excludes; a report by the viewer excludes. Admin/moderator status is NOT a hidden-post bypass","Post attrs and complete reports for requested candidates; fresh actor"],
["Groups","filteredIdeas requires an existing exact group ID and stringified member badge. Nonmembers receive 403 even when the group has no posts. publicList repeats membership/scope checks","Requested group and members before pagination; company excludes group posts"],
["Departments","following combines followed people, stored post departments, own badge and official announcer. Department reply restriction is not a blanket read restriction","Actor follows, announcer identity, stored author department; live viewer department for canReply"],
["Stories","liveIdeas removes expired stories; missing expiry remains; invalid nonempty expiry fails Date.parse comparison. Expiration runs before owner visibility","Time-sensitive post attrs; reevaluate on every page"],
["Deletion","Physical removals disappear. A deleted:true extension is not interpreted as a tombstone by this endpoint","Preserve existing behavior; do not invent a logical-deletion filter"],
["Identity","publicIdea uses stored name/department/position, HMAC public IDs, avatar/profile lookups, official flags and thanks recipient lookup","Directory/security and only the referenced profiles/avatars; do not require every author to join an employee row"],
["Likes/ratings/reposts","ratingSummary uses voteOf, including legacy stars; repostedBy retains last 200 entries, counts/own flags preserve original coercion","Complete requested-post relations, including unusual/unknown badge values; no new inner-join filtering"],
["Comments/replies","publicComments resolves parent IDs and reply counts across the complete post comment list; comment likes and media preserved","All comments/likes for each returned post, including parent resolution; no silent nested truncation"],
["Polls","Option index/text/count and viewer mine flag; duplicate and non-array votes retain existing semantics","Requested polls/options/votes; no cross-feed graph required"],
["Bookmarks/follows/views","savedBy is viewer-specific; followed uses viewer people; viewsOf counts the complete view list for that post","Actor bookmark/follow slices and requested-post view counts"],
["Media","safeMedia checks existing local media paths or bounded inline-image prefix; gallery requires a valid base media. Avatars/comments/thanks also reference media","Batch only authorized paths and relevant profiles; preserve missing-file behavior and original integrity fences"],
["Announcements/notifications","Post announcements include pin/ack/audience data. Browser also merges legacy alert announcements separately. Notification delivery is not a feed read side effect","Requested acks; global audience count for a pinner; unchanged separate announcement/notification paths"],
["Global statistics","statsFor uses ALL raw posts, including hidden/group/expired posts: shared, review, projects, nextNumber. These are not visible-page totals","Independent bounded aggregation; JS Number coercion must be preserved for legacy number values"],
["Ordering/search","Server returns original array/ordinal order; feed=following/today and group scope only. Client applies newest/top/oldest modes, folded search and chips","Do not treat createdAt ordering or SQL ILIKE as existing server semantics"],
["Arabic/English","Stored text returned without translation; client folds Arabic search and renders localized labels. Relevant public IDs/coercion are shared behavior","Preserve Unicode and existing renderer/search helpers; no locale/collation rewrite"]
])}

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

${table(["Path","Posts","Outcome","Peak observed RSS MiB","Sampled peak heap MiB","External MiB","Buffers MiB","One response/result bytes"],resources)}

The two paths return different products: full enriched HTTP JSON versus a
16-record raw SQL page. These are NOT interchangeable before/after HTTP results.
Reference bytes are complete decoded HTTP responses (identity encoding);
component bytes are serialized raw page records, not a public API envelope.

${table(["Posts","Component","Samples","p50 ms","p95 ms"],phaseRows)}

SQL retrieval above includes driver JSON parsing; relational object decoding is
the compatibility codec after retrieval. Post-enrichment includes media lookup,
and serialization-and-send includes JSON stringify/buffer/gzip/send work, so
these overlapping timings must not be added as independent exclusive phases.
The first send sample is excluded from component timing summaries because it
also accumulated bootstrap work.

${table(["Posts","Stage","Samples","Max RSS MiB","Max used heap MiB","Max external MiB","Max ArrayBuffer MiB"],memoryRows)}

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

${table(["Posts","Observed indexes","Header rows","Execution ms"],indexes.map(r=>[r.posts,r.indexes.join(", "),r.rows,n(r.ms)]))}

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

${[...new Set([...changed,"reports/POSTGRESQL_PHASE2E_FEED_DESIGN.md"])].map(p=>"- "+p).join("\n")}

All executable additions are private synthetic diagnostics/prototypes in
scripts/postgres. Source transformations occur only in forked owned test workers.
The normal app cannot select the private comparison header. No production/runtime
module imports it. The one test index is created only by the private fixture
prepare function. No application or production schema was changed.

${preservation.length} previous report/evidence files match their pre-run hashes.
Original suites, compatibility runtime/repository/codec and production-source
fingerprints match their saved checkpoints. Temporary test ports are removed;
the full .replit content matches its checkpoint.

## 6. Feature and authorization parity evidence

${table(["Evidence","Result"],[
["Deep full-response comparisons","24 reference/component pairs: six actors × company/following/today/private-group"],
["Roles/identity","Owner, moderator, ordinary accounts, leading-zero identity, administrator, announcer; different directory departments"],
["HTTP behavior","Status and complete JSON compared; Content-Type/Length/Encoding, Cache-Control, Vary and nosniff compared; gzip/Unicode case"],
["Safety","Anonymous/nonmember/empty-group denial; owner-only hidden override; reporter exclusion; expired story exclusion"],
["Relationships","Poll vote shapes, comments/reply parents/likes, ratings/stars, reposts, inline gallery, status history, acks, event attendance"],
["Legacy","Unknown scalar/nested extensions preserved by codec; stored and missing directory identity; legacy deleted flag not reinterpreted"],
["Pagination","One-record pages, equal dates/ordinal order, zero/one/many, scope mismatch, stale insertion/deletion cursor rejection"],
["Integrity","Oversize/sparse scans reject rather than truncate; account/entity values and all revisions unchanged by component reads"]
])}

${parity.results.map(r=>"- "+r.status+": "+r.name+(r.pairs?` (${r.pairs} exact pairs)`:"")).join("\n")}

The evidence file has ${parity.totals.PASS||0} PASS entries: eleven scenario
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

${table(["Path","Posts","Concurrent","Attempted","Success","Rejected","Failed","p50 ms","p95 ms","p99 ms","Success/s","Completion/s"],burstRows)}

Percentiles are empirical within each small burst; p99 is not estimated below
100 successful samples and no tail-latency SLO is inferred. Successful latency
excludes rejection. Throughput is a finite burst, not sustained user capacity.

${table(["Path","Posts","Queries p50","Pool p50 / p95 ms","Advisory wait p50 / p95 ms","Held/transaction p50 / p95 ms"],sqlRows)}

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

${table(["Original suite","PASS","FAIL"],Object.entries(suites).map(([name,t])=>[name,t.PASS||0,t.FAIL||0]))}

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
`;
fs.writeFileSync(path.join(root,"reports/POSTGRESQL_PHASE2E_FEED_DESIGN.md"),report);
save("review-summary.json",{verdict,suites,feedParity:parity.totals,resources,indexes,priorEvidencePreserved:preservation.length,sourceChecks,production,configurationUnchanged:config});
const renderer=fs.readFileSync(path.join(__dirname,"phase2c-report.cjs"),"utf8"),start=renderer.indexOf("const esc="),end=renderer.indexOf("const html=",start);assert(start>=0&&end>start);
const render=Function(renderer.slice(start,end)+";return render;")();
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BQ Connect — Feed scalability design review</title><style>:root{color-scheme:light dark}body{margin:0;font:15px/1.65 system-ui,sans-serif;background:light-dark(#f4f6f9,#171a20);color:light-dark(#222b36,#e6e9ee)}main{max-width:1180px;margin:auto;padding:32px 22px 70px}h1{font-size:29px;line-height:1.2}h2{margin-top:40px;border-top:1px solid #8792a344;padding-top:18px}p,li{max-width:100ch}.table{overflow:auto;margin:20px 0}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:9px;border:1px solid #8792a344;text-align:left;vertical-align:top}th{background:#8792a31a}code{overflow-wrap:anywhere}pre{overflow:auto}@media print{main{padding:0}.table{overflow:visible}}</style><main>${render(report)}</main></html>`;
fs.writeFileSync(path.join(output,"phase2e-feed-review.html"),html);console.log(JSON.stringify({verdict,suites,feedParity:parity.totals,preserved:preservation.length,htmlBytes:Buffer.byteLength(html)}));
