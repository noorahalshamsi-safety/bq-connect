// Pure synthetic contracts: no environment/Production secrets, SQL or storage.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const vm = require("node:vm"), crypto = require("node:crypto");
const { base, canonical, sha } = require("../../deploy/fresh/config.cjs");
const { adminPolicy } = require("../../deploy/fresh/email-ownership.cjs");
const manifest = { initialAdminBadge: "41060", emailDomains: ["example.invalid"], synthetic: true };
const env = { BQ_FRESH_ADMIN_EMAIL: " Approved@Example.Invalid ",
  BQ_FRESH_ADMIN_REGISTRATION_APPROVAL: "register-admin:" +
    sha(canonical([sha(canonical(manifest)), "41060", "approved@example.invalid"])) };
const valid = adminPolicy(manifest, env);
assert(valid.approved);
assert.deepEqual(valid.checks, { emailPresent: true, emailAllowed: true,
  approvalPresent: true, approvalMatches: true });
assert(!adminPolicy({ ...manifest, synthetic: "changed" }, env).approved);
assert(!adminPolicy(manifest, {}).approved);
assert(!adminPolicy(manifest, { ...env, BQ_FRESH_ADMIN_EMAIL: "other@example.invalid" }).approved);
assert(!adminPolicy(manifest, { ...env, BQ_FRESH_ADMIN_EMAIL: "approved@outside.invalid" }).approved);
const safeOutput = JSON.stringify(valid.checks);
assert(!safeOutput.includes("approved@") && !safeOutput.includes(env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL));
const original = fs.readFileSync(path.join(base, "public/js/app.js"), "utf8");
const transformed = require("../../deploy/fresh/post-client.cjs").transform(original);
new vm.Script(transformed);
assert(transformed.includes('freshPostError(error) || t("errFailed")'));
assert(transformed.includes('reject(new Error("post_media"))'));
const calls = [], outcomes = [];
const context = vm.createContext({ crypto, mode: "api", voterId: () => "synthetic",
  conductReply: async () => false, ideas: [], stats: {}, fetch: async (url, options) => {
    calls.push({ url, ...options });
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next?.body || { error: "database_unavailable" }),
      { status: next?.status || 503 });
  } });
vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../../deploy/fresh/post-client.txt"), "utf8"), context);
const post = { token: "SYNTHETIC_SESSION", type: "post", text: "Synthetic only" };
const success = { status: 201, body: { idea: { id: "synthetic-post" }, ideas: [], stats: {} } };
async function main() {
  outcomes.push(new Error("PRIVATE_NETWORK_DETAIL"));
  await assert.rejects(context.saveIdea(post), { message: "post_uncertain" });
  const key = calls.at(-1).headers["Idempotency-Key"];
  await assert.rejects(context.saveIdea(post), { message: "post_uncertain" });
  assert.equal(calls.at(-1).headers["Idempotency-Key"], key);
  outcomes.push(success);
  await context.saveIdea(post);
  assert.equal(calls.at(-1).headers["Idempotency-Key"], key);
  outcomes.push(success);
  await context.saveIdea(post);
  assert.notEqual(calls.at(-1).headers["Idempotency-Key"], key);
  for (const [status, error, message] of [
    [503, "queue_busy", "post_busy"], [503, "transaction_deadline", "post_uncertain"],
    [409, "replay_state_changed", "post_conflict"], [429, "limited", "post_limited"],
    [401, "employee_required", "employee"], [403, "terms", "terms"],
    [403, "origin_forbidden", "forbidden"], [400, "text_required", "post_invalid"],
    [503, "media_provider_unconfigured", "post_media"]
  ]) {
    outcomes.push({ status, body: { error } });
    await assert.rejects(context.saveIdea(post), { message });
    if (message.startsWith("post_")) assert(context.freshPostError(new Error(message)).length > 20);
  }
  const oldKey = calls.at(-1).headers["Idempotency-Key"];
  outcomes.push(success);
  await context.saveIdea({ ...post, text: "Different synthetic draft" });
  assert.notEqual(calls.at(-1).headers["Idempotency-Key"], oldKey);
  console.log(JSON.stringify({ result: "PASS", adminApprovalAndManifestBinding: true,
    adminNormalizationAndMissingConfiguration: true, valueFreeDiagnostics: true,
    clientSyntax: true, safePostAndMediaErrors: true, stableUncertainRetryKey: true,
    newIntentGetsNewKey: true, productionAccess: false }));
}
main().catch(() => { console.error('{"result":"BLOCKED","productionAccess":false}'); process.exitCode = 1; });
