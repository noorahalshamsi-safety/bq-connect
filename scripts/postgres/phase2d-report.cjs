const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{execFileSync}=require("node:child_process"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../.."),out=path.join(root,"generated-artifacts/phase2d"),read=p=>JSON.parse(fs.readFileSync(path.join(out,p)));
const before=read("load-before.json"),after=read("load-after.json"),original=read("background-before-detailed.json"),current=read("background-current.json"),targeted=read("targeted-tests.json"),probe=read("allocation-stage-probe.json");
const http=read("verification/regression/http-results.json"),hardening=read("verification/hardening-results.json"),parity=read("verification/native-parity.json");
const save=(f,v)=>fs.writeFileSync(path.join(out,f),JSON.stringify(v,null,2));
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const originals=["scripts/postgres/e2e.cjs","scripts/postgres/hardening.cjs","scripts/postgres/phase2c-parity.cjs"].map(file=>({file,unchanged:hash(fs.readFileSync(path.join(root,file)))===hash(execFileSync("git",["show","HEAD:"+file],{cwd:root}))}));
const production=Object.entries(JSON.parse(fs.readFileSync(path.join(root,"generated-artifacts/phase2/production-source-fingerprints.json")))).map(([file,x])=>({file,unchanged:hash(fs.readFileSync(path.join(root,file)))===x.sha256}));
const earlier=Object.entries(JSON.parse(fs.readFileSync(path.join(root,"generated-artifacts/phase2c/preserved-inputs.json")))).map(([file,sha])=>({file,unchanged:hash(fs.readFileSync(path.join(root,file)))===sha}));
const config=fs.readFileSync(path.join(root,".replit"),"utf8")===execFileSync("git",["show","HEAD:.replit"],{cwd:root,encoding:"utf8"});
assert([...originals,...production,...earlier].every(x=>x.unchanged)&&config,"Preservation mismatch");
save("preservation-check.json",{originals,production,earlier,configurationUnchanged:config,note:"Earlier reports remain unchanged in Git; seven prior evidence/source hashes were independently checked. Prior evidence was never an output destination. This is not a retroactive full-directory hash manifest."});
const memoryTests=after.results.map(r=>{
 if(r.status!=="COMPLETED")return{posts:r.posts,status:"NOT COMPLETED",reason:"No post-workload GC pair after guard stop"};
 assert(Number.isFinite(r.repeatedHeapDeltaBytes));
 return{posts:r.posts,status:r.repeatedHeapDeltaBytes<=1048576?"PASS":"FAIL",identicalRequests:20,postGcGrowthBytes:r.repeatedHeapDeltaBytes,toleranceBytes:1048576,meaning:"Finite diagnostic window with observer/runtime noise allowance; not proof of zero allocation or a long-duration leak test."};
});save("repeated-memory-checks.json",memoryTests);
const failed=(http.totals.FAIL||0)+(hardening.totals.FAIL||0)+(parity.totals.FAIL||0)+(targeted.totals.FAIL||0)+memoryTests.filter(r=>r.status==="FAIL").length;
const verdict={development:failed?"NO-GO":"CONDITIONAL GO: background repair and guarded 5k/10k development only",twentyThousandPosts:"NO-GO / NOT COMPLETED under 384 MiB",fiftyUserCapacity:"NOT CERTIFIED",production:"NO-GO"};
const n=v=>Number.isFinite(v)?v.toFixed(2):"NOT MEASURED",mib=b=>b/1048576;
function stats(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return {p50:a.length?a[Math.floor((a.length-1)*.5)]:null,p95:a.length?a[Math.floor((a.length-1)*.95)]:null};}
const table=(head,rows)=>[`| ${head.join(" | ")} |`,`| ${head.map(()=>"---").join(" | ")} |`,...rows.map(row=>`| ${row.join(" | ")} |`)].join("\n");
const stages=["process-start","sql-connection","sql-table-accounts","sql-table-employees","sql-table-posts","decode-ideas.json","graph-decoded","media-and-buffers","before-auth-load","after-auth-load","before-app-load","after-app-load","ready","response-constructed","explicit-gc"];
const stageRows=probe.results.flatMap(r=>stages.map(stage=>{
 const a=r.stages.filter(m=>m.stage===stage);
 return[r.mode,stage,a.length,a.length?n(Math.max(...a.map(x=>mib(x.rss)))):"NOT REACHED",a.length?n(Math.max(...a.map(x=>mib(x.heapUsed)))):"NOT REACHED",a.length?n(Math.max(...a.map(x=>mib(x.external)))):"NOT REACHED",a.length?n(Math.max(...a.map(x=>mib(x.arrayBuffers)))):"NOT REACHED"];
}));
const loadRows=[],metricRows=[];
for(const dataset of [before,after])for(const row of dataset.results){
 for(const c of [10,25,50]){
  const b=row.bursts.find(b=>b.concurrency===c);
  loadRows.push([dataset.mode,row.posts,c,b?.attempted??"NOT RUN",b?.successes??"NOT RUN",b?.rejected??"NOT RUN",b?.otherFailures??"NOT RUN",n(b?.successfulLatencyMs.p50),n(b?.successfulLatencyMs.p95),n(b?.successfulThroughput),n(b?.totalCompletionThroughput)]);
 }
 const times=(row.timings||[]).filter(t=>t.action==="person");
 metricRows.push([dataset.mode,row.posts,n(stats(times.map(t=>t.queryCount)).p50),`${n(stats(times.map(t=>t.advisoryWaitMs)).p50)} / ${n(stats(times.map(t=>t.advisoryWaitMs)).p95)}`,`${n(stats(times.map(t=>t.poolWaitMs)).p50)} / ${n(stats(times.map(t=>t.poolWaitMs)).p95)}`,n(stats(times.map(t=>t.totalTxMs)).p50)]);
}
const resources=before.results.map(b=>{
 const a=after.results.find(a=>a.posts===b.posts);
 return[b.posts,`${n(b.peakRssMiB)} → ${n(a.peakRssMiB)}`,`${n(b.peakHeapMiB)} → ${n(a.peakHeapMiB)}`,`${n(mib(b.gcBefore?.heapUsed))} → ${n(mib(a.gcBefore?.heapUsed))}`,`${n(a.peakExternalMiB)} / ${n(a.peakArrayBuffersMiB)}`,a.status];
});
const inventory=[...new Set([...execFileSync("git",["status","--porcelain","--untracked-files=all"],{cwd:root,encoding:"utf8"}).trimEnd().split("\n").filter(Boolean).map(l=>l.slice(3)),"reports/POSTGRESQL_PHASE2D_RELIABILITY_REVIEW.md"])];
const line=(file,needle)=>fs.readFileSync(path.join(root,file),"utf8").split("\n").findIndex(l=>l.includes(needle))+1;
const report=`# BQ Connect — Phase 2D reliability review

Development: **${verdict.development}**.
20,000-post progression: **NO-GO under the existing 384 MiB guard**.
Production: **NO-GO**. No publication, production data access or migration.

## 1. Background-job root cause and reference evidence

The recurring backup callback looked up backup-settings.json even though the
authoritative mapped entity is backup.json. JSON.parse received undefined and
threw SyntaxError before the due/enabled checks. This also affected disabled
backup schedules: it was not an authorization, writer-epoch or PostgreSQL lock
refusal.

Reproduced using the same owned synthetic fixture in the unchanged Phase 2B
reference and the frozen pre-repair Phase 2C source. The diagnostic adds IPC,
memory samples and transaction-boundary observation, not changed callback policy
or accelerated timer clocks.

- Phase 2B reference: runtime.cjs:155:27.
- Frozen Phase 2C: runtime.cjs:168:27.
- Both: verified dataset/epoch, client queryable, connection not ending,
  one advisory lock, no queued HTTP requests, then acknowledged ROLLBACK.
- No backup committed; retrying the uncorrected callback deterministically failed.
- The other four registered callbacks completed. All five complete after repair.

${table(["Implemented work","Trigger / ownership","State and retry boundary"],[
 ["Auth maintenance","10 min; shared serial queue; own BEGIN/client/global advisory lock","Failure/mail/ticket map expiry; maps refreshed and persisted transactionally"],
 ["Server maintenance","5 min; same transaction boundary","Rate/OTP/email map expiry; no account identity replacement"],
 ["Daily sparks","15 min; same transaction boundary","Current Riyadh date/version marker; deterministic daily content"],
 ["Event reminders","1 min; same transaction boundary","reminded marker, notifications and fixture outbox in same transaction"],
 ["Synthetic backup","1 min due check; same transaction boundary","Existing enabled/interval policy, archive and lastAt commit together"],
 ["Fixture outbox drain","1 sec and after commit; independent checked-out client","Verified dataset; FOR UPDATE SKIP LOCKED, receipt and delivery state committed together; no real provider"],
 ["Translation warm-up","One-shot 3 sec; model state only","No account/social graph write; original local model path unchanged"],
 ["HTTP/socket callbacks","SMS fixture finish, response callbacks, original SMTP/place timeout paths","Not recurring jobs; SMTP/push/SMS are fixture boundaries; existing HTTP deadline remains"]
])}

The original production backup module's separate weekly scheduler is not active
in this synthetic override. Its source and schedule were not modified. The
existing development due-check policy was preserved, not replaced with a new one.
All private workers used invented data and independent PostgreSQL sockets.

## 2. Exact repair and transaction/lifecycle behavior

Correct lookup: development/postgres/runtime.cjs:${line("development/postgres/runtime.cjs",'context.buffers.get("backup.json")')}.
The backup status, archive and other entities remain in the same guarded
transaction; there is no fallback configuration or bypass of attestation.

Related narrow lifecycle corrections:

- Catch pool/begin/attestation/hydration failures as well as callback failures.
- Coalesce repeat ticks while the same callback is queued or running; keep the
  existing global serial queue/advisory lock across different work and processes.
- Apply a 25-second callback deadline. An uncancellable overrun poisons HTTP/job
  admission, rolls back where possible and retires the worker. It does not reuse
  the shared graph. Pool/lock/SQL waits retain their existing bounds; this is not
  a single 25-second wall-clock bound covering hydration and every commit query.
- Clear the callback timer before the bounded SQL persistence/commit phase.
- Stop interval admission before close, drain admitted work, then end the pool.
  A close acknowledgement is not sent while an active transaction is held.
- Log job label/category/code and sanitized file/line frames, not payloads,
  credentials, signing material or raw SQL parameters.

These are development safety changes, not production HA. There is no generic
exactly-once promise for arbitrary callbacks or external providers. Implemented
jobs use their durable date/reminded/lastAt markers under the same lock. A lost
commit response still requires re-reading committed state; it is not permission
to replay arbitrary effects blindly.

## 3. Measured allocation stages

The main no-forced-GC matrix is preserved separately from the phase-isolated
20,000-post diagnostic. The latter explicitly collects between startup/session/
profile/feed phases to identify reclaimable memory; it is not a new deployment
setting or evidence that the ordinary guarded workload passes.

${table(["Probe","Outcome","Observed peak RSS MiB","Full-feed posts / bytes"],probe.results.map(r=>[r.mode,r.status,n(r.peakRssMiB),r.feed?`${r.feed.posts} / ${r.feed.decodedBytes}`:"NOT COMPLETED"]))}

Below: maximum sampled RSS/heap/external/ArrayBuffer values at each named stage
across this isolated probe, not additive memory categories or allocator totals.
ArrayBuffer memory is part of external memory.

${table(["Mode","Stage","Samples","RSS MiB","Heap used MiB","External MiB","ArrayBuffer MiB"],stageRows)}

SQL node/entity counts are sampled at account, directory and post decode;
stored post bytes are measured with pg_column_size, not misrepresented as network
wire bytes. Actual SQL wire-byte totals and complete JavaScript object counts
were not captured. Sampled heap peaks are not exact temporary-allocation totals;
short peaks between samples and precise allocation-site attribution remain uncertain.

${table(["Mode","Posts","Post SQL rows","Stored post bytes","Postmaster RSS MiB","Controller-backend RSS MiB"],[...before.results.map(r=>({...r,mode:"before"})),...after.results.map(r=>({...r,mode:"after"}))].map(r=>[r.mode,r.posts,r.postSql?.rows??"NOT MEASURED",r.postSql?.stored_bytes??"NOT MEASURED",n(r.postgres?.postmaster.rssMiB),n(r.postgres?.controllerBackend.rssMiB)]))}

PostgreSQL process RSS above is separate from worker RSS. Backend shared buffers
can be counted in multiple processes; these samples are not a summed PostgreSQL
server/cgroup memory total. Heap snapshots were not produced under the guard.

## 4. Verified memory mechanisms and remaining uncertainty

Two isolated changes:

1. Release the bootstrap transaction reference after commit. The overridden
   server.listen closure previously retained its immutable boot context.
   Current release: runtime.cjs:${line("development/postgres/runtime.cjs","boot=null;readyResolve()")}.
2. Transfer owned driver rows into per-file buckets, decode them and release each
   bucket. This removes the extra shallow row copy and repeated whole-graph
   filters without changing the decoder or its deep-copy semantics.
   Current implementation: repository.cjs:${line("development/postgres/repository.cjs","records=new Map()")}.

At 5,000 and 10,000 posts, the post-GC live set is smaller. The two changes were
measured together; their individual contributions were not separated by an
ablation experiment. The retained bootstrap reference and duplicate allocation
sites are source-confirmed, but neither explains every byte of RSS.

Large full-graph hydration, decoded application objects, JSON buffers and full
response construction still coexist. The 20,000-post no-forced-GC scenario still
hits the guard. The corrected profile bursts complete before the later full-feed
check fails; that is not a completed full workflow.

Do not infer a permanent leak solely from high RSS, or infer bounded RSS from
low post-GC live heap. V8 collection timing, temporary graph copies and allocator
retention are not fully disentangled. No heap-size increase, forced application
GC, unrelated-media shortcut, native write, pagination or post truncation was used.

## 5. Changed-file inventory and preservation

${inventory.map(f=>"- "+f).join("\n")}

Ignored evidence, frozen diagnostic source snapshots and the downloadable HTML
are in generated-artifacts/phase2d. Three original suite files match their
checkpoint bytes. Eleven production-source fingerprints and seven previous
evidence/source hashes match. Temporary test ports were removed; complete
.replit content matches its checkpoint. Earlier report/evidence paths were not
used as output destinations.

## 6. Before/after resources and repeated requests

${table(["Posts","Observed peak RSS MiB","Sampled peak heap MiB","Post-feed GC live heap MiB","After external / buffers MiB","After scenario"],resources)}

Peak RSS does not improve consistently: the 5,000-post run is higher after the
change, the 10,000-post run is lower, and both 20,000-post runs stop. The measured
improvement is the smaller live heap at completed sizes, not a claim of universal
RSS reduction. Small overshoots above 384 MiB are monitor/termination latency,
not a raised limit.

${table(["Posts","20 identical requests","Post-GC growth bytes","Result"],memoryTests.map(r=>[r.posts,r.identicalRequests??"NOT RUN",r.postGcGrowthBytes??"NOT MEASURED",r.status]))}

The new finite-window assertion allows at most 1 MiB growth for runtime/observer
noise. It does not weaken an existing assertion, establish zero allocations or
prove leak freedom over hours/days. No completed 20,000-post GC pair is claimed.

## 7. Controlled performance matrix

All fixtures: 1,000 employees, invented posts, unchanged 384 MiB worker RSS guard,
512 MiB controller guard, bounded request/fixture deadlines. Each row is one
burst, not sustained load. Successful latency excludes admission rejection.
Throughput columns are successful responses/sec and all completed attempts/sec.

${table(["Mode","Posts","Concurrency","Attempted","Succeeded","Admission rejected","Other failed","p50 ms","p95 ms","Success/s","Completion/s"],loadRows)}

Before 20,000: five transport failures occurred when the guard killed the worker
during the 50-request burst. After 20,000: profile bursts completed, with 18
intentional queue rejections at concurrency 50; the subsequent full-feed portion
hit the guard. Both complete scenarios remain NOT COMPLETED. Guard termination
is not labeled a database-integrity failure or intentional admission rejection.

${table(["Mode","Posts","Profile query count p50","Advisory p50 / p95 ms","Pool p50 / p95 ms","Transaction p50 ms"],metricRows)}

Counts cover the primary request connection, not auxiliary outbox connections.
The query/hydration contract remains the Phase 2C profile slice; there is no new
native repository expansion. Full feeds are still complete, unpaginated responses.
Completed 5,000/10,000 feeds contain the exact seeded counts and about
3.84/7.68 MB decoded responses respectively.

## 8. Regression and reliability results

- Original unchanged HTTP suite: ${http.totals.PASS} PASS / ${http.totals.FAIL||0} FAIL.
- Original unchanged hardening suite: ${hardening.totals.PASS} PASS / ${hardening.totals.FAIL||0} FAIL.
- Original unchanged profile parity groups: ${parity.totals.PASS} PASS / ${parity.totals.FAIL||0} FAIL.
- New background scenarios: ${targeted.totals.PASS||0} PASS / ${targeted.totals.FAIL||0} FAIL.
- New finite memory checks: ${memoryTests.filter(r=>r.status==="PASS").length} PASS;
  20,000-post check NOT COMPLETED.

${targeted.results.map(r=>"- "+r.status+": "+r.name).join("\n")}

Backup success/duplicate/crash/retry tests explicitly enable backups only in the
owned test fixture. An initial test attempt assumed the default disabled fixture
would produce archives; those failed results were retained, the fixture setup
was corrected and the unchanged assertions passed. No application guard was
weakened or failure hidden.

The notification test creates an actual due invented event and requires exactly
one notification after duplicate callbacks. The daily-card test invalidates its
date/version and verifies nonempty regeneration without duplicate content.
The account race uses the existing full-entity test writer concurrently with a
real HTTP update and a held job; it is not a newly enabled native account writer.

Crash testing kills a callback after archive SQL but before COMMIT; PostgreSQL
disconnection rejects commit and the next job recovers. The 25-second held callback
test retires the worker and verifies no partial archive. An actual background
COMMIT-response-loss window and long-duration scheduler soak are not newly
certified; existing hardening commit-fault tests remain passing.

## 9. Remaining concurrency and scalability limits

- Global serialization and whole-entity writers remain necessary.
- Fifty-request bursts intentionally reject 18/50 under the existing queue cap.
- Full 20,000-post scenarios remain unsafe under this RSS budget.
- Sampled stage allocations are not a complete retained-object/allocator profile.
- The finite repeated-request window is not a long-running scheduler or leak soak.
- HTTP translation still uses its original transaction/model behavior.
- Unsupported storage dependency remediation and real provider/recovery guarantees
  remain outside this repair; their prior release blockers are not closed.

No frontend/browser journey or signed-in UI certification is inferred from these
HTTP tests. The public app is separately checked for basic rendering/readiness.

## 10. Development progression verdict

**${verdict.development}.** The recurring backup defect is understood, reproduced
against the reference and corrected. All five implemented timer callbacks and
the targeted rollback/retry/crash/shutdown scenarios pass. Existing regression
assertions remain intact.

The 20,000-post full workflow is **NO-GO / NOT COMPLETED** under the same guard.
Fifty-user sustained capacity is **NOT CERTIFIED**. Do not broaden native
repositories/writers or silently increase memory based on these results.
Remaining allocator attribution and long-duration stability require separate
bounded investigation; this phase does not automatically begin that work.

## 11. Production verdict

**NO-GO.** No production data, storage, credentials, secret rotation, recovery,
migration, publication or production entrypoint/configuration changes occurred.
The schema and production safety fences remain unchanged. No advisory lock was
removed and no native write path was enabled.

## Evidence

generated-artifacts/phase2d contains background-before-detailed.json,
background-current.json, targeted-tests.json, load-before.json, load-after.json,
allocation-stage-probe.json, repeated-memory-checks.json, preservation-check.json
and verification/ for original suite outputs. Diagnostic source snapshots are
code-only reproducibility artifacts, not imported employee data.
`;
fs.writeFileSync(path.join(root,"reports/POSTGRESQL_PHASE2D_RELIABILITY_REVIEW.md"),report);
save("review-summary.json",{verdict,tests:{http:http.totals,hardening:hardening.totals,parity:parity.totals,targeted:targeted.totals,memory:memoryTests},preservation:{originals,production,earlier,config},inventory});
const oldReport=fs.readFileSync(path.join(root,"scripts/postgres/phase2c-report.cjs"),"utf8"),start=oldReport.indexOf("const esc="),end=oldReport.indexOf("const html=",start);
assert(start>=0&&end>start);
const render=Function(oldReport.slice(start,end)+";return render;")();
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BQ Connect — Phase 2D reliability review</title><style>:root{color-scheme:light dark}body{margin:0;background:light-dark(#f5f6f8,#15181d);color:light-dark(#20252e,#e6e9ee);font:15px/1.65 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:36px 22px 70px}h1{font-size:30px;line-height:1.2}h2{margin-top:40px;padding-top:18px;border-top:1px solid #8792a344}p,li{max-width:96ch}.table{overflow:auto;margin:20px 0}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;text-align:left;vertical-align:top;border:1px solid #8792a344}th{background:#8792a31a}pre{overflow:auto;padding:18px;font-size:12px}code{overflow-wrap:anywhere}@media print{body{background:white;color:black}main{padding:0}.table{overflow:visible}}</style><main>${render(report)}</main></html>`;
assert(Buffer.byteLength(html)<5242880);fs.writeFileSync(path.join(out,"phase2d-review.html"),html);console.log(JSON.stringify({verdict,bytes:Buffer.byteLength(html),tests:{http:http.totals,hardening:hardening.totals,parity:parity.totals,targeted:targeted.totals}}));
