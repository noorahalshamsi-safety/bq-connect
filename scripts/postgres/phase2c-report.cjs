const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{execFileSync}=require("node:child_process");
const {save,output}=require("./phase2c-support.cjs");
const root=path.resolve(__dirname,"../.."),read=f=>JSON.parse(fs.readFileSync(path.join(output,f)));
const before=read("load-baseline.json"),after=read("load-native.json"),parity=read("native-parity.json");
const http=read("verification/regression/http-results.json"),hardening=read("verification/hardening-results.json");
const dependency=read("dependency-review.json"),translation=read("translation-findings.json");
const background=read("background-comparison.json");
const hash=f=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex");
const preserved=Object.entries(read("preserved-inputs.json")).map(([file,sha256])=>({file,unchanged:hash(file)===sha256}));
const production=Object.entries(JSON.parse(fs.readFileSync(path.join(root,"generated-artifacts/phase2/production-source-fingerprints.json")))).map(([file,x])=>({file,unchanged:hash(file)===x.sha256}));
const config=fs.readFileSync(path.join(root,".replit"),"utf8")===execFileSync("git",["show","HEAD:.replit"],{cwd:root,encoding:"utf8"});
if([...preserved,...production].some(r=>!r.unchanged)||!config)throw Error("Preservation check failed");
save("preservation-check.json",{preserved,production,productionConfigurationUnchanged:config});
const failures=(http.totals.FAIL||0)+(hardening.totals.FAIL||0)+(parity.totals.FAIL||0);
const verdict={development:failures?"NO-GO":"CONDITIONAL GO: native profile code review only; runtime progression blocked",production:"NO-GO",broaderNativeConcurrency:"NOT CERTIFIED",translationDecoupling:"BLOCKED / NOT IMPLEMENTED",backgroundJobs:"UNRESOLVED / NO BASELINE COMPARISON"};
const inventory=execFileSync("git",["status","--porcelain","--untracked-files=all"],{cwd:root,encoding:"utf8"}).trimEnd().split("\n").filter(Boolean).map(l=>l.slice(3));
const n=v=>Number.isFinite(v)?v.toFixed(1):"NOT MEASURED";
const metric=(r,key)=>r.profileMetrics?.[key]?.p50Ms;
const table=(headers,rows)=>[`| ${headers.join(" | ")} |`,`| ${headers.map(()=>"---").join(" | ")} |`,...rows.map(r=>`| ${r.join(" | ")} |`)].join("\n");
const loadRows=[];
for(const b of before.results){
 const a=after.results.find(a=>a.employees===b.employees&&a.posts===b.posts);
 for(const c of [10,25,50]){
  const x=b.bursts?.find(x=>x.concurrency===c),y=a?.bursts?.find(x=>x.concurrency===c);
  loadRows.push([b.employees,b.posts,c,x?.samples?n(x.p95Ms):"NOT COMPLETED",y?.samples?n(y.p95Ms):"NOT COMPLETED",x?`${x.successes}/${x.concurrency}`:"NOT RUN",y?`${y.successes}/${y.concurrency}`:"NOT RUN"]);
 }
}
const complete=after.results.filter(x=>x.status==="COMPLETED");
const aggregate=complete.map(a=>{
 const b=before.results.find(b=>b.employees===a.employees&&b.posts===a.posts);
 return [a.employees,a.posts,`${n(metric(b,"queryCount"))} → ${n(metric(a,"queryCount"))}`,`${n(metric(b,"loadQueries"))} → ${n(metric(a,"loadQueries"))}`,`${n(metric(b,"totalTxMs"))} → ${n(metric(a,"totalTxMs"))}`,`${n(b.worker.peakRssMiB)} → ${n(a.worker.peakRssMiB)}`];
});
const arch=fs.readFileSync(path.join(root,"reports/POSTGRESQL_PHASE2C_ARCHITECTURE.md"),"utf8");
const timed=(translation.currentHttpEvidence?.requests||[]).map(r=>({status:r.status,ms:r.ms}));
const report=`# BQ Connect — Phase 2C development review

Development: **${verdict.development}**.
Production: **NO-GO**. No deployment or production migration was initiated.

## 1. Architecture dependency map

The existing reference runtime remains operational. Every dynamic operation still
uses its serialized queue, independent dataset/key-domain attestation, transaction,
global advisory lock, revision fences and commit-before-response boundary.

\`\`\`text
HTTP -> bounded ingress -> serial queue -> pool / BEGIN / advisory lock
     -> authenticated original handler
     -> profile slice: 30 dependency tables + target/follow SQL
        OR reference: all 107 model tables + full media graph
     -> original session-touch writer if due / shared rate maps / replay
     -> COMMIT -> response
Background work -> same serialized and fail-stop boundary
\`\`\`

The detailed operation dependency table, read-only projection guarantees and future
write proof obligations are included in the architecture appendix below.

## 2. Original performance baseline

Before means the unchanged compatibility handler on the current development
adapter, selected by the private test controller's reference mode. After means the
same handler/authentication/session/writer contract with the narrow profile SQL
slice enabled. Both use separate fresh invented PostgreSQL fixtures and identical
load-controller source, admission limits and resource guards.

Requested fixture matrix: 100/500/1,000 employees × 5,000/20,000 posts × 10/25/50
simultaneous requests. Seeded post counts were checked in SQL. Each concurrency
has one burst, not a sustained capacity or statistically reliable p99 study.
Different actor sessions were used; profile target was the same invented employee.
Load fixtures contain minimal posts and no large engagement/follower histories.
Functional follower/media edge cases are covered separately by parity tests.

## 3. Changed-file inventory

${inventory.map(f=>"- "+f).join("\n")}

This report itself is an additional generated documentation file. Ignored evidence
and the downloadable report are under generated-artifacts/phase2c. Production
source fingerprints, original suite bytes and selected Phase 2B reports/results
all match their baselines. Temporary test-port configuration was removed;
the complete .replit configuration matches its checkpoint baseline.

No package/lockfile, original production server/auth/storage source, frontend
branding/UX or production provider fence was changed.

## 4. Native repository implementation coverage

${table(["Path","Implementation","Authorization/writes"],[
 ["Employee profile","Native target profile + follower/following queries; original public-ID/avatar/card helpers","Original session, eligibility, ban, directory and rate gates; complete accounts retained"],
 ["Unusual legacy follower arrays / nonnumeric badge domains","Conservative full-reference fallback","No changed denial or approximate coercion"],
 ["Feed / post detail","Reference only","Visibility, groups, reports, ownership, global statistics unchanged"],
 ["Notifications / announcements","Reference only","Legacy/generated merge and seen-state parity not yet proved"],
 ["Search / departments","Reference only","Arabic/Unicode folding, rank and directory order unchanged"],
 ["All entity writers","Reference only","No native collection writer, lock removal or schema redesign"]
])}

Four development indexes were added. The original 107-table model remains.
Native profile hydration loads 30 tables; it is not a fully request-scoped,
lock-free or independently scalable repository.

## 5. Exact API compatibility comparison

Original HTTP checks: **${http.totals.PASS} PASS / ${http.totals.FAIL||0} FAIL**.
Original hardening checks: **${hardening.totals.PASS} PASS / ${hardening.totals.FAIL||0} FAIL**.
Dedicated parity groups: **${parity.totals.PASS} PASS / ${parity.totals.FAIL||0} FAIL**.

The original suites were executed byte-for-byte; only output writes/directories
were redirected externally to preserve the existing Phase 2B evidence.
Profile comparisons assert status, exact decoded response bytes, JSON values and
content-type/cache-control/vary/content-encoding headers against the reference
worker. Volatile transport headers such as Date are not compared.

${parity.results.map(r=>"- "+r.status+": "+r.name).join("\n")}

Coverage includes a 6-actor × 6-target profile matrix; system and leading-zero
identities; original avatar hashing; duplicate/numeric/null legacy follows;
array-coercion fallback; forged/unknown target IDs; missing/banned/revoked/unready
actors; cross-worker replay; changed-profile replay invalidation; due session
touch preserving all other accounts; and nonempty existing media-reference
preservation. Other malformed datasets, every Unicode badge domain and all
unrelated repository semantics are not newly exhaustively certified.

The signed-in browser UI was not verified. No frontend source was changed.
The public language-selection screen was visually checked and the development
readiness endpoint returned live/ready true.

## 6. Before/after load-test results

Latency is successful-request p95 in milliseconds. Success counts are shown so
fast overload rejections cannot be mistaken for good read performance.

${table(["Employees","Posts","Concurrency","Before p95 ms","After p95 ms","Before successes","After successes"],loadRows)}

All six 20,000-post runs were safety-stopped around bootstrap/session setup.
Observed worker RSS exceeded the configured 384 MiB threshold (100 ms sampling
allows a small overshoot); some resulting errors are recorded as fetch failures.
No usable profile-load latency is claimed for those cases. Limits were not raised.
Remaining concurrency levels in stopped fixtures were not run.

${table(["Employees","Posts","Primary queries p50","Hydration SELECTs","Transaction p50 ms","Observed peak worker MiB"],aggregate)}

Raw files include successful p50/p95/p99, all-request latency distributions, status
counts/failure rates, successful reads/second, transaction/query/queue/pool/lock
metrics, CPU seconds and observed RSS samples. Counts in queryCount/loadQueries
are counts, although the generic raw summary fields are named p50Ms/p95Ms/p99Ms.

${table(["Mode","Employees","Feed ms","Feed posts / bytes","Original profile-write ms","Worker CPU seconds"],[...before.results,...after.results].filter(r=>r.status==="COMPLETED").map(r=>[r.mode,r.employees,n(r.feed.ms),`${r.feed.returnedPosts} / ${r.feed.responseBytes}`,n(r.write.ms),n(r.worker.cpuSecondsDelta)]))}

Feed samples still return the complete 5,000-post list (about 3.84 MB decoded).
No native feed pagination was introduced or benchmarked. Stable server-side
pagination requires a compatible filter/statistics/tie-break contract; client
truncation or a standalone SQL cursor would not certify the existing endpoint.
Writes above are one original profile-update sample per fixture, not a native
writer throughput benchmark. CPU uses verified Linux USER_HZ=100; RSS is process
RSS, not total PostgreSQL/cgroup memory. Whole-host CPU and pool saturation under
sustained multiworker native load are not measured.

Initial synthetic seeding rejected SQL NULL collection attributes before serving
load; the seeder was corrected to preserve JSON null and verify the exact post
count. Those initial rejected-seed files were retained separately and are not
included in performance comparisons.

## 7. Concurrency and database-lock analysis

At 5,000 posts, 10- and 25-request bursts had no failures. At concurrency 50,
both paths served 32 and rejected 18: **36% failure rate** under the unchanged
queue admission cap. This remains a capacity blocker, despite much faster
successful native profile requests.

The global advisory lock and original queue remain intentional. The measured
primary connection query count is 134 → 58 in the completed fixtures; hydration
SELECTs fall from 107 → 30. Account refresh and full original session touches
remain. The default full-graph bootstrap/session path still exceeds the chosen
memory budget at 20,000 posts.

Lock/pool/queue distributions are in both raw load files. Small single-worker
advisory waits do not certify multiworker concurrency. Existing B25 verifies
bounded pool/lock failures; B26 verifies acknowledgement crash/restart; B27 verifies
fail-stop deadline retirement. The unchanged regression suites cover commit,
rollback, unknown outcome, idempotency and media/outbox invariants. No new native
writer crash guarantee is claimed.

The restarted development workflow also logged background-job transaction
refusals. An accelerated-timer comparison against checkpoint reference bytes did
not complete within its 30-second controller deadline; its owned fixture was
stopped and removed. No baseline parity or root cause is asserted. This remains
an unresolved runtime-progression blocker; passing HTTP tests do not certify
periodic jobs. The refusal was not suppressed or represented as a clean run.

## 8. Security/dependency review

The uuid@9.0.1 finding remains **HIGH / OPEN**. Paths:

${dependency.paths.map(p=>"- "+p).join("\n")}

The published SDK 1.0.0 declares storage ^7.7.0; installed storage is 7.22.0.
Registry latest storage 8.4.0 is outside that supported range. No supported parent
SDK fix was identified. No forced major override, provider replacement or package
change was made. Reviewed multipart callers use UUID v4, whereas the reported
buffer-bounds issue concerns v3/v5/v6; that reachability observation does not close
the package finding.

Offline SDK export/API-shape and UUID-v4 smoke: **${dependency.smoke.status}**,
with no instantiated storage client or provider network operations. This is not
hosted-storage CRUD or production-credential regression certification.

Native SQL uses bound values and fixed schema identifiers. Original eligibility,
session version/expiry and role gates remain before lookup; replay uses all entity
revisions, not merely the partial projection. The native projection cannot persist
unrelated business/media changes. Original root production fences and key-domain
attestation are unchanged. This is a focused review, not a new full-project
SAST/HoundDog scan.

## 9. Translation performance and quality findings

Current B22 HTTP translation check: **${translation.currentHttpEvidence?.status||"UNKNOWN"}**.
Observed request status/timing pairs: ${JSON.stringify(timed)}.
These include authentication, SQL and queueing. Background warm-up may overlap
first calls; these are not certified pure cold/warm model inference timings.

The separate local-only engine probe did not return completed measurements within
its 768 MiB / 120-second guards. Exact termination trigger/peak and completed
per-sample data were not captured; no pure-engine p50, memory result, warm-cache
latency or mixed-language quality score is invented. The guarded workload was not
restarted or given a larger resource limit.

${table(["Original text-language detector input","Detected"],translation.detectorExamples.map(r=>[r.text,JSON.stringify(r.detected)]))}

The unchanged character heuristic can be biased by Latin URLs and can classify
Arabic digits as Arabic; mixed/very short text is not linguistically resolved.
Current B22 verifies basic Arabic/English meaning, edited-content cache keys,
stored-source preservation and concurrency. The prior excessive-punctuation
quality finding remains open. A comprehensive bilingual quality study is not
complete, and no model replacement or external employee-text service was used.

Existing HTTP model computation **still holds the compatibility transaction and
advisory lock**. This requested decoupling is not implemented: a safe change needs
native session/rate accounting with equivalent failure/timeout semantics.
B27 verifies injected handler deadline fail-stop, not an actual stalled-model
experiment. Translation performance progression remains blocked.

## 10. Remaining global-state and write-path blockers

- Shared mutable auth, directory, rate/factor, avatar/view and JSON cache graphs.
- Full-graph bootstrap/session hydration at larger post counts.
- Full account/session-touch and collection subtree writers.
- Feed visibility, global stats, engagement nesting and missing server pagination.
- Notification/legacy announcement merge and search folding/order parity.
- Model compute under the existing global transaction.
- Fixed queue admission failures at 50 simultaneous requests.
- Unsupported dependency remediation path and untested hosted-provider/recovery gaps.
- Unresolved live background-job transaction refusals; diagnostic comparison blocked.

No native writes or advisory-lock removal were attempted. Future write designs
must prove current ownership/authorization, entity versioning, coherent fencing
against old collection writers, actor/digest idempotency, commit-before-response,
atomic outbox/media relations, and before/during/unknown/after-commit crash behavior.
The detailed proof matrix is in the appendix; designs are not implemented proofs.

## 11. Revised next-phase plan

1. Resolve background-job refusals and establish their reference baseline before
   further runtime rollout; review the limited profile slice/fallback boundaries.
2. Make authorization/rendering inputs request-scoped before removing serialization.
3. Address bootstrap/session full-graph memory; repeat 20,000-post workloads within
   an approved budget rather than silently raising this one's cap.
4. Define compatible feed pagination/global-statistics semantics, then prove detail,
   notification/announcement and Arabic search parity before migrating each read.
5. Separate native session touches and rate accounting before moving model compute
   outside SQL; repeat instrumented local cold/warm/quality evaluation.
6. Implement one native write slice only after its legacy-writer fencing and full
   crash/race proof matrix pass. Do not convert all writers together.
7. Obtain a supported dependency upgrade and run real isolated storage-provider
   regressions before closing the advisory or proposing production progression.

## 12. Development and production verdicts

**Development: ${verdict.development}.** This means the narrow employee-profile
optimization can proceed to review while the reference path remains available.
It is not a full Phase 2C performance, 50-user, 20,000-post, lock-free, native-write
or translation-decoupling certification.
Background-job readiness is unresolved. The conditional decision permits code
review only, not additional runtime rollout or a claim that Phase 2C is complete.

**Broader native/concurrency progression: NOT CERTIFIED.**
**Production: NO-GO.** Production code/configuration, provider fences and credentials
were left unchanged; no production migration, data access or publication occurred.

Evidence: generated-artifacts/phase2c/{load-baseline,load-native,native-parity,
dependency-review,translation-findings,preservation-check}.json and verification/
for the original suites. This is one-host synthetic development evidence, not
production capacity or a complete browser/security/provider assessment.

## Architecture appendix

${arch.replace(/^# /gm,"### ").replace(/^## /gm,"#### ")}
`;
fs.writeFileSync(path.join(root,"reports/POSTGRESQL_PHASE2C_REVIEW.md"),report);
save("review-summary.json",{verdict,http:http.totals,hardening:hardening.totals,parity:parity.totals,preserved,production,config,inventory,background,workloads:{baseline:before.results.map(r=>({employees:r.employees,posts:r.posts,status:r.status,reason:r.reason})),native:after.results.map(r=>({employees:r.employees,posts:r.posts,status:r.status,reason:r.reason}))}});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>");
function render(md){
 const lines=md.split("\n");let html="",code=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith("```")){html+=code?"</code></pre>":"<pre><code>";code=!code;continue;}
  if(code){html+=esc(line)+"\n";continue;}
  const heading=line.match(/^(#{1,6}) (.+)/);
  if(heading){const level=heading[1].length;html+=`<h${level}>${inline(heading[2])}</h${level}>`;continue;}
  if(line.startsWith("|")){
   const rows=[];while(i<lines.length&&lines[i].startsWith("|")){rows.push(lines[i].split("|").slice(1,-1).map(x=>x.trim()));i++;}i--;
   html+='<div class="table"><table><thead><tr>'+rows[0].map(c=>"<th>"+inline(c)+"</th>").join("")+"</tr></thead><tbody>";
   for(const row of rows.slice(2))html+="<tr>"+row.map(c=>"<td>"+inline(c)+"</td>").join("")+"</tr>";
   html+="</tbody></table></div>";continue;
  }
  if(/^(?:- |\d+\. )/.test(line)){
   html+="<ul>";while(i<lines.length&&/^(?:- |\d+\. )/.test(lines[i])){html+="<li>"+inline(lines[i].replace(/^(?:- |\d+\. )/,""))+"</li>";i++;}i--;html+="</ul>";continue;
  }
  if(!line.trim())continue;
  let text=line;while(i+1<lines.length&&lines[i+1].trim()&&!/^(?:#|\||```|- |\d+\. )/.test(lines[i+1]))text+=" "+lines[++i];
  html+="<p>"+inline(text)+"</p>";
 }
 return html;
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BQ Connect — Phase 2C development review</title><style>:root{color-scheme:light dark}body{margin:0;background:light-dark(#f5f6f8,#15181d);color:light-dark(#20252e,#e6e9ee);font:15px/1.65 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:36px 22px 70px}h1{font-size:30px;line-height:1.2}h2{margin-top:44px;padding-top:20px;border-top:1px solid #8792a344}h3,h4{margin-top:30px}strong{font-weight:700}p,li{max-width:95ch}.table{overflow:auto;margin:20px 0}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px;text-align:left;vertical-align:top;border:1px solid #8792a344}th{background:#8792a31a}pre{overflow:auto;padding:18px;background:#8792a312;border:1px solid #8792a344;font-size:12px}code{font-family:ui-monospace,monospace;overflow-wrap:anywhere}@media print{body{background:white;color:black}main{padding:0}.table{overflow:visible}h2{break-after:avoid}}</style><main>${render(report)}</main></html>`;
if(Buffer.byteLength(html,"utf8")>5242880)throw Error("Report exceeds 5 MiB");
fs.writeFileSync(path.join(output,"phase2c-review.html"),html);
console.log(JSON.stringify({verdict,reportBytes:Buffer.byteLength(html),preservedFiles:preserved.length,productionFiles:production.length}));
