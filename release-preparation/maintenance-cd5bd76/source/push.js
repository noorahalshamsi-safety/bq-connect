// Web Push (RFC 8030 delivery, RFC 8291 payload encryption, RFC 8292 VAPID) with no extra dependencies.
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const KEYS = path.join(__dirname, "data", "push-keys.json");
const SUBS = path.join(__dirname, "data", "push-subs.json");
const PER_USER = 5;
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

const b64u = (value) => Buffer.from(value).toString("base64url");
const unb64u = (value) => Buffer.from(String(value || ""), "base64url");

let keys = null;

function vapidKeys() {
  if (keys) return keys;
  try {
    keys = JSON.parse(fs.readFileSync(KEYS, "utf8"));
  } catch {
    keys = null;
  }
  if (!keys || !keys.publicKey || !keys.privateJwk) {
    const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = pair.privateKey.export({ format: "jwk" });
    keys = { publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)])), privateJwk: jwk };
    fs.mkdirSync(path.dirname(KEYS), { recursive: true });
    fs.writeFileSync(KEYS, JSON.stringify(keys), { mode: 0o600 });
  }
  return keys;
}

function publicKey() {
  return vapidKeys().publicKey;
}

function readSubs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SUBS, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSubs(all) {
  fs.mkdirSync(path.dirname(SUBS), { recursive: true });
  const temp = `${SUBS}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(all), { mode: 0o600 });
  fs.renameSync(temp, SUBS);
}

function cleanSubscription(input) {
  const endpoint = String((input && input.endpoint) || "");
  if (!endpoint || endpoint.length > 1024) return null;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password) return null;
  if (!PUSH_HOSTS.some((pattern) => pattern.test(url.hostname))) return null;
  const p256dh = unb64u(input.keys && input.keys.p256dh);
  const auth = unb64u(input.keys && input.keys.auth);
  if (p256dh.length !== 65 || p256dh[0] !== 4 || auth.length !== 16) return null;
  return { endpoint: url.href, keys: { p256dh: b64u(p256dh), auth: b64u(auth) } };
}

function subscribe(badge, input, extra) {
  const sub = cleanSubscription(input);
  if (!sub) return false;
  const all = readSubs();
  for (const key of Object.keys(all)) {
    all[key] = (all[key] || []).filter((row) => row.endpoint !== sub.endpoint);
    if (!all[key].length) delete all[key];
  }
  const list = all[badge] || [];
  list.push({ ...sub, lang: extra.lang === "en" ? "en" : "ar", origin: extra.origin, at: new Date().toISOString() });
  all[badge] = list.slice(-PER_USER);
  writeSubs(all);
  return true;
}

function unsubscribe(badge, endpoint) {
  const all = readSubs();
  if (!all[badge]) return;
  all[badge] = all[badge].filter((row) => row.endpoint !== String(endpoint || ""));
  if (!all[badge].length) delete all[badge];
  writeSubs(all);
}

function forget(badge) {
  const all = readSubs();
  if (!all[badge]) return;
  delete all[badge];
  writeSubs(all);
}

function hasSubscription(badge, endpoint) {
  return (readSubs()[badge] || []).some((row) => row.endpoint === String(endpoint || ""));
}

function hkdf(salt, ikm, info, length) {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, length));
}

function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const sealed = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, sealed]);
}

function vapidAuth(endpoint, subject) {
  const { publicKey: key, privateJwk } = vapidKeys();
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject }));
  const signer = crypto.createPrivateKey({ key: privateJwk, format: "jwk" });
  const signature = crypto.sign("sha256", Buffer.from(`${head}.${claims}`), { key: signer, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${claims}.${b64u(signature)}, k=${key}`;
}

function deliver(sub, body) {
  return new Promise((resolve) => {
    const subject = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(sub.origin || "") ? sub.origin : "https://bq-connect.invalid";
    const request = https.request(sub.endpoint, {
      method: "POST",
      timeout: 10000,
      headers: {
        Authorization: vapidAuth(sub.endpoint, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "Content-Length": body.length,
        TTL: "86400",
        Urgency: "normal",
      },
    }, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(0));
    request.end(body);
  });
}

async function send(badge, message) {
  const list = readSubs()[badge] || [];
  if (!list.length) return;
  const gone = [];
  await Promise.all(list.map(async (sub) => {
    const status = await deliver(sub, encrypt(sub, JSON.stringify(message(sub.lang))));
    if (status === 404 || status === 410) gone.push(sub.endpoint);
  }));
  if (!gone.length) return;
  const all = readSubs();
  all[badge] = (all[badge] || []).filter((row) => !gone.includes(row.endpoint));
  if (!all[badge].length) delete all[badge];
  writeSubs(all);
}

module.exports = { publicKey, subscribe, unsubscribe, forget, hasSubscription, send };
