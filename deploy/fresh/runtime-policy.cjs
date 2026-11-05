const { need } = require("./config.cjs");
function transform(source, { mediaEnabled = false } = {}) {
  const register = "if (person.phone && smsConfigured()) {";
  need(source.split(register).length === 2, "fresh_registration_source_contract_changed");
  source = source.replace(register, `
    if (!person.phone || !smsConfigured()) {
      send(res, 503, { error: "ownership_verification_unavailable" }); return;
    }
    ${register}`);
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
  const sms = json("BQ_FRESH_SMS_CONFIG"), smtp = json("BQ_FRESH_SMTP_CONFIG");
  // Preserve the original adapters' existing Production-secret fallbacks.
  // These are service credentials, never old account/session signing keys.
  return { "sms.json": { ...sms, token: sms.token || env.SMS_TOKEN || "",
    sid: sms.sid || env.TWILIO_SID || "", from: sms.from || env.TWILIO_FROM || "" },
    "smtp.json": { ...smtp, host: smtp.host || env.SMTP_HOST || "smtp.gmail.com",
      port: smtp.port || env.SMTP_PORT || 465, user: smtp.user || env.SMTP_USER || "",
      pass: smtp.pass || env.SMTP_PASS || "" } };
}
module.exports = { transform, providers };
