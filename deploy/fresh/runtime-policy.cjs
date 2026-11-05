const { need } = require("./config.cjs");
function transform(source, { mediaEnabled = false, emailDomains = require("./config.cjs").load().emailDomains,
  adminPolicy = { badge: require("./config.cjs").load().initialAdminBadge, approved: false, emailHash: "" } } = {}) {
  const fs = require("node:fs"), path = require("node:path");
  const begin = source.indexOf("    const code = cleanCode(body.code);");
  const end = source.indexOf('  if (req.method === "POST" && urlPath === "/api/translate")', begin);
  need(begin > 0 && end > begin, "fresh_registration_source_contract_changed");
  source = source.slice(0, begin) + fs.readFileSync(path.join(__dirname, "registration-handler.txt"), "utf8") +
    "\n" + source.slice(end);
  source = "const __freshOwnership = require(" + JSON.stringify(path.join(__dirname, "email-ownership.cjs")) +
    ");\nconst __freshDomains = " + JSON.stringify(emailDomains) +
    ";\nconst __freshAdmin = " + JSON.stringify(adminPolicy) + ";\n" + source;
  const forgot = source.indexOf('    if (urlPath === "/api/forgot") {');
  const password = source.indexOf("    if (!auth.strongPassword(body.password)) {", forgot);
  need(forgot > 0 && password > forgot, "fresh_recovery_source_contract_changed");
  source = source.slice(0, forgot) + fs.readFileSync(path.join(__dirname, "recovery-handler.txt"), "utf8") +
    source.slice(password);
  const hash = 'return crypto.createHmac("sha256", PEPPER).update(`${key}:${code}`).digest("hex");';
  need(source.includes(hash), "fresh_email_code_hash_contract_changed");
  source = source.replace(hash, 'return crypto.createHmac("sha256", auth.deriveKey("fresh-email-code-v1")).update(`${key}:${code}`).digest("hex");');
  const loginAudit = '  auth.audit("login", publicId(badge), info);';
  need(source.includes(loginAudit), "fresh_login_notification_contract_changed");
  source = source.replace(loginAudit, loginAudit + `
  noticeMail(accountEmail(person), "BQ Connect login successful. If this was not you, recover your password and contact IT.");`);
  const ready = "return auth.twoFactorOn(person.badge) && Boolean(accountEmail(person));";
  need(source.includes(ready), "fresh_account_readiness_contract_changed");
  source = source.replace(ready, `const account = auth.accountOf(person.badge);
    return Boolean(account?.hash && account.freshEmailVerified === true &&
      account.freshEmailPolicy === "directory-code-mobile-email-v1" && accountEmail(person));`);
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
  source = source.replace(change, `if (!__freshOwnership.normalize(email, __freshDomains) ||
      (badge === __freshAdmin.badge && crypto.createHash("sha256").update(email).digest("hex") !== __freshAdmin.emailHash) ||
      directory.some(r => String(r.badge) !== badge && auth.accountOf(r.badge)?.email === email)) {
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
function transformAuth(source) {
  const marker = "${stage}:";
  need(source.split(marker).length === 3, "fresh_ticket_version_contract_changed");
  // Password recovery revokes pending login/setup/email tickets as well as
  // already-issued sessions. The original authority/epoch guard stays intact.
  return source.replaceAll(marker, "${stage}:${Number(accountOf(badge)?.ver) || 0}:");
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
module.exports = { transform, transformAuth, providers };
