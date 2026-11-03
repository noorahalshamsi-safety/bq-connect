// Lightweight findings after the bounded model probe; no retry/model allocation.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {save,output}=require("./phase2c-support.cjs");
const probe=JSON.parse(fs.readFileSync(path.join(output,"translation-review.json")));
const suite=JSON.parse(fs.readFileSync(path.join(output,"verification/hardening-results.json")));
const source=fs.readFileSync(path.resolve(__dirname,"../../public/js/posting.js"),"utf8").match(/function textLanguage\(text\) \{[\s\S]*?\n\}/)?.[0];
if(!source)throw Error("Language detector contract changed");
const detect=vm.runInNewContext(`(${source})`);
const result={
 status:"PARTIAL / NOT PERFORMANCE-CERTIFIED",probe,probeGuards:{rssMiB:768,wallMs:120000,exactTerminationTrigger:"Not captured; do not attribute the termination to a specific guard or infer pure model timings."},
 detectorExamples:["مرحبا","Hello","مرحبا https://example.invalid/long/url","١٢٣٤","OK","Hello مرحبا"].map(text=>({text,detected:detect(text)})),
 currentHttpEvidence:suite.results.find(r=>r.id==="B22"),
 timingMeaning:"B22 times are actual end-to-end authenticated HTTP observations. Background model warm-up can overlap first calls; these are not isolated cold/warm inference timings.",
 sourcePreservation:"B22 asserts stored source is unchanged; response text is separate. Existing cache keys are direction + content digest; edited text and concurrent requests are exercised.",
 quality:"Basic Arabic/English meaning assertions pass in B22. Prior excessive-punctuation finding remains open; no comprehensive quality score or new model selection.",
 timeout:"Existing handler fail-stop deadline is exercised by B27 injection, not an actual stuck-model experiment. No new external fallback, provider or model replacement.",
 transactionBlocker:"Existing HTTP translation still holds the compatibility transaction/advisory lock. Separating compute needs native session/rate accounting with equivalent failure and timeout semantics; not implemented in this safe read slice."
};
save("translation-findings.json",result);console.log("Translation findings recorded without restarting the bounded model workload.");
