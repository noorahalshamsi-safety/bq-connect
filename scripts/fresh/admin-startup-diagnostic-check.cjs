// Pure synthetic comparisons; never read process.env, SQL, storage or secrets.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { sha, canonical } = require("../../deploy/fresh/config.cjs");
const ownership = require("../../deploy/fresh/email-ownership.cjs");
const diagnostic = require("../../deploy/fresh/admin-startup-diagnostic.cjs");
const manifest = { initialAdminBadge: "41060", emailDomains: ["example.invalid"],
  synthetic: { z: 1, a: 2 } };
const email = "independently-approved@example.invalid";
const reference = Object.freeze({ manifestFingerprint: sha(canonical(manifest)),
  initialAdminBadge: "41060", normalizedAdminEmailSha256: sha(email) });
const approvalFor = (m, address) => "register-admin:" + sha(canonical([
  sha(canonical(m)), m.initialAdminBadge, address]));
const env = Object.freeze({ BQ_FRESH_ADMIN_EMAIL: " INDEPENDENTLY-APPROVED@EXAMPLE.INVALID ",
  BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: approvalFor(manifest, email) });
const snapshot = canonical({ manifest, env, reference });
const check = (m = manifest, e = env, r = reference) => diagnostic.compare(m, e, r);
const good = check();
for (const key of ["manifestFingerprintMatches", "initialAdminBadgeMatches",
  "initialAdminBadgeTypeMatches", "adminEmailReferenceAvailable", "adminEmailMatchesApproved",
  "approvalMatchesExpected", "approvalLengthMatchesExpected"]) assert.equal(good[key], true, key);
assert.equal(good.approvalHasOuterWhitespace, false);
assert.equal(good.approvalLength, 79);
assert.equal(good.expectedApprovalLength, 79);
assert.equal(ownership.adminPolicy(manifest, env).approved, good.approvalMatchesExpected);
const reordered = { synthetic: { a: 2, z: 1 }, emailDomains: ["example.invalid"], initialAdminBadge: "41060" };
assert.equal(check(reordered).manifestFingerprintMatches, true);
assert.equal(check(reordered).approvalMatchesExpected, true);
const changed = { ...manifest, synthetic: { a: 2, z: 3 } };
assert.equal(check(changed).manifestFingerprintMatches, false);
assert.equal(check(changed).approvalMatchesExpected, false);
const numeric = { ...manifest, initialAdminBadge: 41060 };
assert.equal(check(numeric).initialAdminBadgeMatches, true);
assert.equal(check(numeric).initialAdminBadgeTypeMatches, false);
assert.equal(check(numeric).manifestFingerprintMatches, false);
assert.equal(check(numeric).approvalMatchesExpected, false);
assert.equal(check({ ...manifest, initialAdminBadge: "41061" }).initialAdminBadgeMatches, false);
const otherEmail = { ...env, BQ_FRESH_ADMIN_EMAIL: "other@example.invalid" };
assert.equal(check(manifest, otherEmail).adminEmailMatchesApproved, false);
assert.equal(check(manifest, otherEmail).approvalMatchesExpected, false);
assert.equal(check(manifest, { ...otherEmail,
  BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: approvalFor(manifest, "other@example.invalid")
}).approvalMatchesExpected, true); // Internally valid is not independently approved.
for (const value of [env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL + "\n",
  " " + env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL, "\t" + env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL + "\r\n"]) {
  const r = check(manifest, { ...env, BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: value });
  assert.equal(r.approvalMatchesExpected, false);
  assert.equal(r.approvalHasOuterWhitespace, true);
  assert.equal(r.approvalLengthMatchesExpected, false);
}
const truncated = check(manifest, { ...env,
  BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL.slice(0, -1) });
assert.equal(truncated.approvalMatchesExpected, false);
assert.equal(truncated.approvalHasOuterWhitespace, false);
assert.equal(truncated.approvalLengthMatchesExpected, false);
const wrongDigest = check(manifest, { ...env,
  BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: "register-admin:" + "0".repeat(64) });
assert.equal(wrongDigest.approvalMatchesExpected, false);
assert.equal(wrongDigest.approvalLengthMatchesExpected, true);
const missingReference = check(manifest, env, { ...reference, normalizedAdminEmailSha256: null });
assert.equal(missingReference.adminEmailReferenceAvailable, false);
assert.equal(missingReference.adminEmailMatchesApproved, null);
assert.equal(check(manifest, {}).approvalMatchesExpected, false);
assert.equal(check(manifest, {}).adminEmailMatchesApproved, false);
assert.equal(canonical({ manifest, env, reference }), snapshot);
const lines = [];
diagnostic.report(manifest, env, line => lines.push(line));
assert.equal(lines.length, 1);
const logged = JSON.parse(lines[0]);
assert.deepEqual(Object.keys(logged), ["FRESH_ADMIN_DIAGNOSTIC"]);
assert.equal(logged.FRESH_ADMIN_DIAGNOSTIC.adminEmailReferenceAvailable, true,
  "owner_approved_reference_must_be_pinned_before_publication");
assert.equal(logged.FRESH_ADMIN_DIAGNOSTIC.adminEmailMatchesApproved, false,
  "invented_test_email_must_not_match_owner_reference");
for (const value of Object.values(logged.FRESH_ADMIN_DIAGNOSTIC))
  assert(value === null || typeof value === "boolean" || typeof value === "number");
for (const forbidden of [email, env.BQ_FRESH_ADMIN_EMAIL, env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL,
  reference.normalizedAdminEmailSha256, reference.manifestFingerprint])
  assert(!lines[0].includes(forbidden));
const localManifest = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, "../../deploy/fresh/production.json"), "utf8"));
const baseline = diagnostic.compare(localManifest, {});
assert.equal(baseline.manifestFingerprintMatches, true);
assert.equal(baseline.initialAdminBadgeMatches, true);
assert.equal(baseline.initialAdminBadgeTypeMatches, true);
// Inspect wiring without invoking start() or touching any runtime dependency.
const runtime = fs.readFileSync(path.resolve(__dirname, "../../deploy/fresh/runtime.cjs"), "utf8");
assert(runtime.indexOf('require("./admin-startup-diagnostic.cjs").report(manifest, env);') <
  runtime.indexOf('need(env.BQ_FRESH_ACTIVATE_APPROVAL'));
assert(runtime.includes('freshAdminPolicy = require("./email-ownership.cjs").adminPolicy(manifest, env)'));
console.log(JSON.stringify({ result: "PASS", manifestAndCanonicalSerialization: true,
  badgeValueAndType: true, independentEmailComparison: true,
  approvalUnchanged: true, approvalWhitespaceAndLength: true,
  missingReferenceNotFabricated: true, valueFreeSingleStartupRecord: true,
  inputsUnchanged: true, noProductionAccess: true }));
