const { need } = require("./config.cjs");
function transform(source, { mediaEnabled = false, emailDomains = require("./config.cjs").load().emailDomains } = {}) {
  const fs = require("node:fs"), path = require("node:path");
  const begin = source.indexOf("    const code = cleanCode(body.code);");
  const end = source.indexOf('  if (req.method === "POST" && urlPath === "/api/translate")', begin);
  need(begin > 0 && end > begin, "fresh_registration_source_contract_changed");
  source = source.slice(0, begin) + fs.readFileSync(path.join(__dirname, "registration-handler.txt"), "utf8") +
    "\n" + source.slice(end);
  source = "const __freshOwnership = require(" + JSON.stringify(path.join(__dirname, "email-ownership.cjs")) +
    ");\nconst __freshDomains = " + JSON.stringify(emailDomains) + ";\n" + source;
  const ready = "return auth.twoFactorOn(person.badge) && Boolean(accountEmail(person));";
  need(source.includes(ready), "fresh_account_readiness_contract_changed");
  source = source.replace(ready, `const account = auth.accountOf(person.badge);
    return Boolean(account?.hash && account.freshEmailVerified === true &&
      account.freshEmailPolicy === "directory-email-v1" && accountEmail(person));`);
  const login = 'else send(res, 200, { needSetup: true, ticket: auth.signTicket(badge, "2fa", SETUP_TICKET_MS) });';
  need(source.includes(login), "fresh_login_source_contract_changed");
  source = source.replace(login, `else if (accountReady(person)) finishLogin(res, badge, person, info);
      else send(res, 403, { error: "email_ownership_unverified" });`);
  // Existing authenticated security settings provide optional TOTP enrollment.
  const optional = '    if (op === "recovery") {';
  need(source.includes(optional), "fresh_optional_totp_source_contract_changed");
  source = source.replace(optional, `
    if (op === "setup" || op === "enroll") {
      const problem = await confirmPassword(badge, body.password);
      if (problem) { send(res, problem === "limited" ? 429 : 400, { error: problem }); return; }
      if (auth.twoFactorOn(badge)) { send(res, 400, { error: "already_on" }); return; }
      if (op === "setup") { send(res, 200, auth.beginTwoFactor(badge)); return; }
      if (auth.locked("2fa:" + badge)) { send(res, 429, { error: "limited" }); return; }
      const recovery = auth.confirmTwoFactor(badge, body.code);
      if (!recovery) { auth.noteFailure("2fa:" + badge); send(res, 400, { error: "bad_code" }); return; }
      auth.clearFailures("2fa:" + badge);
      send(res, 200, { recovery, status: auth.twoFactorStatus(badge) }); return;
    }
    ${optional}`);
  const change = '      if (email === accountEmail(person)) {';
  need(source.includes(change), "fresh_email_change_contract_changed");
  source = source.replace(change, `if (!__freshOwnership.associated(directory, badge, email, __freshDomains)) {
        send(res, 403, { error: "email_ownership_unverified" }); return;
      }
      ${change}`);
  const api = "async function handleApi(req, res, urlPath, params) {";
  need(source.includes(api), "fresh_api_source_contract_changed");
  source = source.replace(api, api + `
    if (urlPath === "/api/push") {
      send(res, 503, { error: "push_provider_unconfigured" }); return;
    }`);
  if (!mediaEnabled) {
    const media = "function receiveMedia(req, res) {";
    need(source.includes(media), "fresh_media_source_contract_changed");
    source = source.replace(media, media + `
      send(res, 503, { error: "media_provider_unconfigured" }); return;`);
  }
  return source;
}
function providers(env) {
  function json(key) {
    if (!env[key]) return {};
    const result = JSON.parse(env[key]);
    need(result && typeof result === "object" && !Array.isArray(result), "fresh_provider_configuration_invalid");
    return result;
  }
  let sms = {};
  // SMS is unrelated to fresh registration; a stale optional setting cannot
  // become a fresh-launch dependency.
  try { sms = json("BQ_FRESH_SMS_CONFIG"); } catch {}
  const smtp = json("BQ_FRESH_SMTP_CONFIG");
  // Preserve the original adapters' existing Production-secret fallbacks.
  // These are service credentials, never old account/session signing keys.
  return { "sms.json": { ...sms, token: sms.token || env.SMS_TOKEN || "",
    sid: sms.sid || env.TWILIO_SID || "", from: sms.from || env.TWILIO_FROM || "" },
    "smtp.json": { ...smtp, host: smtp.host || env.SMTP_HOST || "smtp.gmail.com",
      port: smtp.port || env.SMTP_PORT || 465, user: smtp.user || env.SMTP_USER || "",
      pass: smtp.pass || env.SMTP_PASS || "" } };
}
module.exports = { transform, providers };
