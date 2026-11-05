// Value-free review only. Configuration readiness is NOT delivery evidence.
const { need, canonical, sha } = require("./config.cjs");
const text = value => typeof value === "string" ? value.trim() : "";
const placeholder = value => /synthetic|placeholder|example\.invalid|^mock|^test[-_]/i.test(text(value));
function review(values) {
  const smtp = values["smtp.json"] || {}, sms = values["sms.json"] || {};
  const mailMissing = [], smsMissing = [];
  const host = text(smtp.host) || "smtp.gmail.com", port = Number(smtp.port || 465);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || placeholder(host)) mailMissing.push("host");
  // Existing adapter uses implicit verified TLS, not plaintext or STARTTLS.
  if (port !== 465 || smtp.secure === false || smtp.rejectUnauthorized === false) mailMissing.push("implicit_verified_tls_465");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(smtp.user)) || placeholder(smtp.user)) mailMissing.push("user");
  if (text(smtp.pass).replace(/\s/g, "").length < 12 || placeholder(smtp.pass)) mailMissing.push("pass");
  const provider = (text(sms.provider) || "twilio").toLowerCase();
  if (!["twilio", "unifonic", "taqnyat"].includes(provider)) smsMissing.push("supported_provider");
  if (text(sms.token).length < 12 || placeholder(sms.token)) smsMissing.push("token");
  if (provider === "twilio") {
    if (!/^AC[0-9a-f]{32}$/i.test(text(sms.sid))) smsMissing.push("sid");
    if (!text(sms.from) || placeholder(sms.from)) smsMissing.push("from");
  } else if (/[\r\n]/.test(text(sms.sender))) smsMissing.push("sender");
  return { smtp: { status: mailMissing.length ? "BLOCKED" : "CONFIGURATION_READY", missing: mailMissing },
    sms: { requiredForFreshRegistration: false,
      status: smsMissing.length ? "BLOCKED" : "CONFIGURATION_READY", missing: smsMissing },
    delivery: "UNVERIFIED" };
}
function requireReady(values, env, manifest) {
  const r = review(values);
  need(r.smtp.status === "CONFIGURATION_READY",
    "fresh_real_provider_configuration_required");
  // Explicit operator assertion after controlled real adapter tests. This is
  // not an automatic measurement or proof inferred from configuration.
  need(env.BQ_FRESH_DELIVERY_APPROVAL === "delivery-tested:" + sha(canonical(manifest)),
    "fresh_controlled_delivery_verification_required");
  return r;
}
async function probeSmtp(config, connect = require("node:tls").connect) {
  // Same implicit-TLS/AUTH LOGIN protocol as the existing auth adapter, stopping
  // before MAIL FROM/RCPT/DATA. Never sends mail or logs server/credential data.
  const host = text(config.host) || "smtp.gmail.com", port = Number(config.port || 465);
  return new Promise(resolve => {
    let socket, finished = false, buffer = "", step = 0;
    const timer = setTimeout(() => finish("BLOCKED", "TIMEOUT"), 15000);
    const finish = (status, reason) => {
      if (finished) return; finished = true; clearTimeout(timer); socket?.destroy();
      resolve({ status, ...(reason ? { reason } : {}), messagesSent: 0 });
    };
    const steps = [
      [220, "EHLO bq-connect"], [250, "AUTH LOGIN"],
      [334, Buffer.from(text(config.user)).toString("base64")],
      [334, Buffer.from(text(config.pass).replace(/\s/g, "")).toString("base64")],
      [235, "QUIT"]
    ];
    try {
      socket = connect({ host, port, servername: host, rejectUnauthorized: true, minVersion: "TLSv1.2" });
      socket.on("error", () => finish("BLOCKED", "TLS_OR_NETWORK"));
      socket.on("secureConnect", () => { if (!socket.authorized) finish("BLOCKED", "TLS_OR_NETWORK"); });
      socket.on("data", chunk => {
        if (finished) return;
        buffer += chunk.toString("utf8");
        if (buffer.length > 32768) return finish("BLOCKED", "SERVER_PROTOCOL");
        const lines = buffer.split("\r\n"); buffer = lines.pop();
        for (const line of lines) {
          if (!/^\d{3} /.test(line)) continue;
          const [expected, command] = steps[step] || [];
          if (Number(line.slice(0, 3)) !== expected)
            return finish("BLOCKED", step >= 2 ? "AUTH" : "SERVER_PROTOCOL");
          if (step === steps.length - 1) {
            socket.end("QUIT\r\n"); return finish("AUTHENTICATED_NO_MESSAGE");
          }
          socket.write(command + "\r\n"); step++;
        }
      });
      socket.on("close", () => { if (!finished) finish("BLOCKED", "CONNECTION_CLOSED"); });
    } catch { finish("BLOCKED", "TLS_OR_NETWORK"); }
  });
}
module.exports = { review, requireReady, probeSmtp };
