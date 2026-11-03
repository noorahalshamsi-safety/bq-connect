const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const original = JSON.parse(read("generated-artifacts/forensics/test-results.json"));
const baseline = read("generated-artifacts/repair-baseline/generated-artifacts/forensics/test-results.json");
assert.equal(read("generated-artifacts/forensics/test-results.json"), baseline, "Original forensic evidence changed");
assert.equal(read("reports/P0_ACCOUNT_PERSISTENCE_FORENSICS.md"),
  read("generated-artifacts/repair-baseline/reports/P0_ACCOUNT_PERSISTENCE_FORENSICS.md"), "Original report changed");
const current = JSON.parse(read("generated-artifacts/repair/test-results.json"));
assert.equal(original.results.length, 34);
assert.equal(current.results.length, 53);
assert.equal(new Set(current.results.map(row => row.id)).size, 53);
assert.ok(current.sourceUnchanged);
for (const [name, fp] of Object.entries(current.codeFingerprint)) {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root, name))).digest("hex").slice(0, 12), fp, `Source changed since tests: ${name}`);
}
const originalById = new Map(original.results.map(row => [row.id, row]));
const escape = value => String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const subset = rows => ["PASS", "FAIL", "BLOCKED"].map(status => `${rows.filter(row => row.status === status).length} ${status}`).join(", ");
const oldScenarios = current.results.filter(row => row.id.startsWith("T"));
const regressions = current.results.filter(row => row.id.startsWith("R"));
const comparison = [
  `### Recorded results — ${current.at}`,
  "",
  `- Original forensic baseline: ${subset(original.results)}.`,
  `- Same 34 scenarios after repair: **${subset(oldScenarios)}**.`,
  `- ${regressions.length} additional regressions: **${subset(regressions)}**.`,
  `- Combined: **${subset(current.results)}**.`,
  "- Production release: **NO-GO**. Nonzero harness exit is retained.",
  "",
  "| Test ID | Original Result | New Result | Verified invariant / required expectation | Evidence |",
  "|---|---|---|---|---|",
  ...current.results.map(row => `| ${row.id} | ${originalById.get(row.id)?.status || "NEW"} | **${row.status}** | ${escape(row.expectation)} | ${escape(row.observed)} |`),
  "",
  "Each row has matching before/after synthetic integrity evidence in test-results.json. BLOCKED means no successful functional test was established; FAIL means the invariant is still violated. A containment PASS is not proof of functional production recovery.",
  "",
  "### Tested application source fingerprints",
  "",
  "| File | SHA-256 prefix |",
  "|---|---|",
  ...Object.entries(current.codeFingerprint).map(([file, fp]) => `| ${file} | ${fp} |`),
  "",
  "Original source was fingerprint-verified before edits. The table above identifies the repaired source, unchanged during the recorded test run.",
].join("\n");
const text = read("reports/P0_PERSISTENCE_REPAIR.md").replace("<!-- TEST_COMPARISON -->", comparison);
fs.writeFileSync(path.join(root, "generated-artifacts/repair/P0_PERSISTENCE_REPAIR_REPORT.md"), text);
console.log(JSON.stringify({ original: subset(original.results), repairedOriginal: subset(oldScenarios),
  regressions: subset(regressions), combined: current.totals, originalEvidencePreserved: true, release: "NO-GO" }, null, 2));
