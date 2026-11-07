// Observational only. These are approved comparison references, not authority
// inputs: no environment override, approval generation, storage or network calls.
const { sha, canonical } = require("./config.cjs");
const ownership = require("./email-ownership.cjs");
const approved = Object.freeze({
  manifestFingerprint: "6c1b84ac93edcf28d82860b1a2cfd0aaf20a53231da735f8367dc2d1082bca00",
  initialAdminBadge: "41060",
  // Must come from an independent owner-approved reference, never from the
  // same runtime BQ_FRESH_ADMIN_EMAIL being diagnosed. Do not publish unpinned.
  normalizedAdminEmailSha256: null
});
function compare(manifest, env, reference = approved) {
  const email = ownership.normalize(env.BQ_FRESH_ADMIN_EMAIL, manifest.emailDomains);
  const policy = ownership.adminPolicy(manifest, env); // Exact existing validator.
  const approval = typeof env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL === "string" ?
    env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL : "";
  const expectedLength = "register-admin:".length + 64;
  const emailReferenceAvailable = typeof reference.normalizedAdminEmailSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(reference.normalizedAdminEmailSha256);
  // Do not return any input, digest, email, token, exception or raw environment.
  return {
    manifestFingerprintMatches: sha(canonical(manifest)) === reference.manifestFingerprint,
    initialAdminBadgeMatches: String(manifest.initialAdminBadge) === reference.initialAdminBadge,
    initialAdminBadgeTypeMatches: typeof manifest.initialAdminBadge === typeof reference.initialAdminBadge,
    adminEmailReferenceAvailable: emailReferenceAvailable,
    adminEmailMatchesApproved: emailReferenceAvailable ?
      !!email && sha(email) === reference.normalizedAdminEmailSha256 : null,
    approvalMatchesExpected: policy.approved === true,
    approvalHasOuterWhitespace: approval !== approval.trim(),
    approvalLengthMatchesExpected: approval.length === expectedLength,
    approvalLength: approval.length,
    expectedApprovalLength: expectedLength
  };
}
function report(manifest, env, log = console.log) {
  log(JSON.stringify({ FRESH_ADMIN_DIAGNOSTIC: compare(manifest, env) }));
}
module.exports = { compare, report };
