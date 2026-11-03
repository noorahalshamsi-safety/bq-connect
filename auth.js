const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const tls = require("tls");

const DATA_DIR = path.join(__dirname, "data");
const ACCOUNTS = path.join(DATA_DIR, "accounts.json");
const SECRET_FILE = path.join(DATA_DIR, "session.key");
const SMTP_FILE = path.join(DATA_DIR, "smtp.json");
const SECURITY_FILE = path.join(DATA_DIR, "security.json");
const AUDIT_FILE = path.join(DATA_DIR, "security-log.json");

const SESSION_MS = 3 * 24 * 60 * 60 * 1000;
const SESSION_LIMIT = 15;
const TOUCH_MS = 5 * 60 * 1000;
const IDLE_MS = 24 * 60 * 60 * 1000;
const DEVICE_MEMORY = 20;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
const LOCK_MAX_MS = 24 * 60 * 60 * 1000;
// Keys whose lockout doubles on every repeat, so guessing the 4 ID digits takes years instead of days.
const ESCALATING = /^reg:/;
const PENDING_MS = 24 * 60 * 60 * 1000;
const MAIL_GAP_MS = 10 * 60 * 1000;
const MAIL_DAILY = 5;
// Hashes without a kdf field were made with SCRYPT_V1 and are upgraded on the next successful login.
const SCRYPT_V1 = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 96 * 1024 * 1024 };
const KDF = 2;
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function readJsonFile(file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writePrivate(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, text, { mode: 0o600 });
  fs.renameSync(temp, file);
}

function loadSecret() {
  try {
    const value = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (/^[0-9a-f]{96}$/.test(value)) return value;
  } catch {}
  const value = crypto.randomBytes(48).toString("hex");
  writePrivate(SECRET_FILE, value);
  return value;
}

const secret = loadSecret();
const accounts = readJsonFile(ACCOUNTS, {});
const failures = new Map();
const mailLog = new Map();

function accountsStamp() {
  try {
    return fs.statSync(ACCOUNTS).mtimeMs;
  } catch {
    return 0;
  }
}

let loadedStamp = accountsStamp();

function syncAccounts() {
  const stamp = accountsStamp();
  if (stamp === loadedStamp) return;
  const fresh = readJsonFile(ACCOUNTS, null);
  if (!fresh) return;
  for (const key of Object.keys(accounts)) delete accounts[key];
  Object.assign(accounts, fresh);
  loadedStamp = stamp;
}

function saveAccounts() {
  writePrivate(ACCOUNTS, JSON.stringify(accounts, null, 2));
  loadedStamp = accountsStamp();
}

function accountOf(badge) {
  syncAccounts();
  return accounts[String(badge)] || null;
}

function ensureAccount(badge) {
  syncAccounts();
  const key = String(badge);
  if (!accounts[key]) accounts[key] = { ver: 1, createdAt: new Date().toISOString() };
  return accounts[key];
}

let securityCache = { stamp: "", value: null };

function securityConfig() {
  let stamp = "none";
  try {
    const info = fs.statSync(SECURITY_FILE);
    stamp = `${info.mtimeMs}:${info.size}`;
  } catch {}
  if (securityCache.value && securityCache.stamp === stamp) return securityCache.value;
  securityCache = { stamp, value: buildSecurityConfig() };
  return securityCache.value;
}

function buildSecurityConfig() {
  const cfg = readJsonFile(SECURITY_FILE, {});
  const announcer = cfg.announcer && typeof cfg.announcer === "object" ? cfg.announcer : {};
  const adminAccount = cfg.adminAccount && typeof cfg.adminAccount === "object" ? cfg.adminAccount : {};
  const adminBadge = String(adminAccount.badge || "").replace(/\D/g, "").replace(/^0+/, "");
  const admins = new Set((Array.isArray(cfg.admins) ? cfg.admins : []).map((item) => String(item).replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean));
  if (adminBadge) admins.add(adminBadge);
  return {
    admins,
    adminAccount: { badge: adminBadge, name: String(adminAccount.name || "BQ Connect").slice(0, 60) },
    emailDomains: (Array.isArray(cfg.emailDomains) ? cfg.emailDomains : []).map((item) => String(item).trim().toLowerCase().replace(/^@/, "")).filter(Boolean),
    announcer: {
      badge: String(announcer.badge || "").replace(/\D/g, "").replace(/^0+/, ""),
      name: String(announcer.name || "إعلانات بن قريعة").slice(0, 60),
      email: String(announcer.email || "").trim().toLowerCase(),
    },
  };
}

function scryptHash(password, salt, params = SCRYPT) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), Buffer.from(salt, "hex"), 64, params, (error, key) => (error ? reject(error) : resolve(key.toString("hex"))));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: await scryptHash(password, salt), kdf: KDF };
}

const DUMMY = { salt: crypto.randomBytes(16).toString("hex"), hash: crypto.randomBytes(64).toString("hex"), kdf: KDF };

async function matches(password, record) {
  const target = record && record.salt && record.hash ? record : DUMMY;
  const actual = Buffer.from(await scryptHash(password, target.salt, target.kdf === KDF ? SCRYPT : SCRYPT_V1), "hex");
  const expected = Buffer.from(target.hash, "hex");
  return target !== DUMMY && actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function newPassword() {
  for (;;) {
    let value = "";
    for (let i = 0; i < 12; i += 1) value += PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)];
    if (/[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value)) return value;
  }
}

function strongPassword(value) {
  const text = String(value || "");
  return text.length >= 10 && text.length <= 128 && /[A-Za-z]/.test(text) && /\d/.test(text) && new Set(text).size >= 5;
}

async function checkLogin(badge, password, exists) {
  const account = exists ? accountOf(badge) : null;
  const text = String(password || "").slice(0, 128);
  if (await matches(text, account)) {
    if (account.kdf !== KDF) {
      const fresh = await hashPassword(text);
      const current = accountOf(badge);
      if (current && current.hash === account.hash) {
        Object.assign(current, fresh);
        saveAccounts();
      }
    }
    return "ok";
  }
  const pending = account && account.pending && Date.parse(account.pending.exp) > Date.now() ? account.pending : null;
  if (pending && (await matches(text, pending))) {
    account.salt = pending.salt;
    account.hash = pending.hash;
    account.kdf = pending.kdf;
    account.pending = null;
    account.sessions = [];
    account.ver = (Number(account.ver) || 0) + 1;
    account.changedAt = new Date().toISOString();
    saveAccounts();
    return "ok";
  }
  return "";
}

async function setPassword(badge, password, patch) {
  const account = ensureAccount(badge);
  const { salt, hash, kdf } = await hashPassword(password);
  Object.assign(account, patch || {}, { salt, hash, kdf, pending: null, sessions: [], ver: (Number(account.ver) || 0) + 1, changedAt: new Date().toISOString() });
  saveAccounts();
  return account;
}

async function setPending(badge, password, patch) {
  const account = ensureAccount(badge);
  const { salt, hash, kdf } = await hashPassword(password);
  Object.assign(account, patch || {});
  account.pending = { salt, hash, kdf, exp: new Date(Date.now() + PENDING_MS).toISOString() };
  saveAccounts();
  return account;
}

function revokeSessions(badge) {
  const account = ensureAccount(badge);
  account.ver = (Number(account.ver) || 0) + 1;
  account.sessions = [];
  saveAccounts();
}

function liveSessions(account) {
  const now = Date.now();
  return (account && Array.isArray(account.sessions) ? account.sessions : []).filter((row) => row && row.sid && Date.parse(row.exp) > now);
}

function sessionKey(sid) {
  return crypto.createHmac("sha256", secret).update(`sid:${sid}`).digest("hex").slice(0, 16);
}

function listSessions(badge) {
  return liveSessions(accountOf(badge)).map((row) => ({
    id: sessionKey(row.sid),
    createdAt: row.createdAt || "",
    lastSeen: row.lastSeen || row.createdAt || "",
    ip: row.ip || "",
    device: row.device || {},
  }));
}

function revokeSession(badge, id) {
  const account = accountOf(badge);
  if (!account) return false;
  const sessions = liveSessions(account);
  const kept = sessions.filter((row) => sessionKey(row.sid) !== String(id || ""));
  if (kept.length === sessions.length) return false;
  account.sessions = kept;
  saveAccounts();
  return true;
}

function rememberDevice(badge, signature) {
  const account = ensureAccount(badge);
  const known = Array.isArray(account.devices) ? account.devices : [];
  if (known.includes(signature)) return false;
  account.devices = [...known, signature].slice(-DEVICE_MEMORY);
  saveAccounts();
  return known.length > 0;
}

function acceptTerms(badge, version) {
  const account = ensureAccount(badge);
  account.terms = String(version);
  account.termsAt = new Date().toISOString();
  saveAccounts();
}

function sign(payload) {
  return crypto.createHmac("sha256", secret).update(`session:${payload}`).digest("hex");
}

function signSession(badge, info, ttl) {
  const account = ensureAccount(badge);
  const exp = Date.now() + (Number(ttl) > 0 ? Math.min(Number(ttl), SESSION_MS) : SESSION_MS);
  const sid = crypto.randomBytes(12).toString("base64url");
  const now = new Date().toISOString();
  const details = info && typeof info === "object" ? info : {};
  const sessions = liveSessions(account);
  sessions.push({ sid, createdAt: now, lastSeen: now, exp: new Date(exp).toISOString(), ip: String(details.ip || "").slice(0, 64), device: details.device || {} });
  account.sessions = sessions.slice(-SESSION_LIMIT);
  saveAccounts();
  const payload = `${badge}.${Number(account.ver) || 0}.${exp}.${sid}`;
  return Buffer.from(`${payload}.${sign(payload)}`).toString("base64url");
}

function tokenParts(token) {
  let raw = "";
  try {
    raw = Buffer.from(String(token || "").slice(0, 400), "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = raw.split(".");
  if (parts.length !== 5) return null;
  const [badge, ver, exp, sid, sig] = parts;
  const left = Buffer.from(String(sig));
  const right = Buffer.from(sign(`${badge}.${ver}.${exp}.${sid}`));
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  if (!(Number(exp) > Date.now())) return null;
  return { badge, ver, sid };
}

function readSession(token) {
  const parts = tokenParts(token);
  if (!parts) return "";
  const account = accountOf(parts.badge);
  if (!account || !account.hash || String(Number(account.ver) || 0) !== parts.ver) return "";
  const row = liveSessions(account).find((item) => item.sid === parts.sid);
  if (!row) return "";
  if (Date.now() - (Date.parse(row.lastSeen || row.createdAt) || 0) > IDLE_MS) return "";
  if (Date.now() - (Date.parse(row.lastSeen) || 0) > TOUCH_MS) {
    row.lastSeen = new Date().toISOString();
    saveAccounts();
  }
  return parts.badge;
}

function currentSessionId(token) {
  const parts = tokenParts(token);
  return parts ? sessionKey(parts.sid) : "";
}

const TOTP_STEP_MS = 30 * 1000;
const TOTP_SETUP_MS = 15 * 60 * 1000;
const TICKET_MS = 5 * 60 * 1000;
const RECOVERY_COUNT = 8;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const vaultKey = crypto.createHmac("sha256", secret).update("totp-vault").digest();
const usedTickets = new Map();

function base32(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function seal(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey, iv);
  const data = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return [iv, data, cipher.getAuthTag()].map((part) => part.toString("base64url")).join(".");
}

function unseal(text) {
  try {
    const [iv, data, tag] = String(text || "").split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    return null;
  }
}

function hotp(key, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", key).update(message).digest();
  const offset = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

function totpCounter(key, code, last) {
  const now = Math.floor(Date.now() / TOTP_STEP_MS);
  const wanted = Buffer.from(String(code));
  for (const counter of [now - 1, now, now + 1]) {
    if (counter <= (Number(last) || 0)) continue;
    const actual = Buffer.from(hotp(key, counter));
    if (actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted)) return counter;
  }
  return 0;
}

function recoveryHash(badge, code) {
  return crypto.createHmac("sha256", secret).update(`recovery:${badge}:${code}`).digest("hex");
}

function newRecoveryCodes(badge) {
  const plain = [];
  for (let n = 0; n < RECOVERY_COUNT; n += 1) {
    let code = "";
    for (let i = 0; i < 10; i += 1) code += RECOVERY_CHARS[crypto.randomInt(RECOVERY_CHARS.length)];
    plain.push(code);
  }
  return { plain: plain.map((code) => `${code.slice(0, 5)}-${code.slice(5)}`), hashes: plain.map((code) => recoveryHash(badge, code)) };
}

function twoFactorOn(badge) {
  const account = accountOf(badge);
  return Boolean(account && account.totp && account.totp.on);
}

function twoFactorStatus(badge) {
  const account = accountOf(badge);
  const totp = account && account.totp && account.totp.on ? account.totp : null;
  return { enabled: Boolean(totp), since: totp ? totp.at || "" : "", recoveryLeft: totp && Array.isArray(totp.recovery) ? totp.recovery.length : 0 };
}

function beginTwoFactor(badge) {
  const account = ensureAccount(badge);
  const key = crypto.randomBytes(20);
  account.totpSetup = { key: seal(key), exp: new Date(Date.now() + TOTP_SETUP_MS).toISOString() };
  saveAccounts();
  const issuer = encodeURIComponent("BQ Connect");
  const code = base32(key);
  return { secret: code, uri: `otpauth://totp/${issuer}?secret=${code}&issuer=${issuer}` };
}

function confirmTwoFactor(badge, code) {
  const account = accountOf(badge);
  const setup = account && account.totpSetup && Date.parse(account.totpSetup.exp) > Date.now() ? account.totpSetup : null;
  const key = setup ? unseal(setup.key) : null;
  const digits = String(code || "").replace(/\D/g, "");
  if (!key || digits.length !== 6) return null;
  const counter = totpCounter(key, digits, 0);
  if (!counter) return null;
  const recovery = newRecoveryCodes(badge);
  account.totp = { on: true, key: setup.key, last: counter, at: new Date().toISOString(), recovery: recovery.hashes };
  delete account.totpSetup;
  saveAccounts();
  return recovery.plain;
}

function checkTwoFactor(badge, code) {
  const account = accountOf(badge);
  const totp = account && account.totp && account.totp.on ? account.totp : null;
  if (!totp) return "";
  const text = String(code || "").trim();
  const digits = text.replace(/\D/g, "");
  if (digits.length === 6 && digits.length === text.replace(/\s/g, "").length) {
    const key = unseal(totp.key);
    const counter = key ? totpCounter(key, digits, totp.last) : 0;
    if (!counter) return "";
    totp.last = counter;
    saveAccounts();
    return "totp";
  }
  const recovery = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (recovery.length !== 10) return "";
  const hash = recoveryHash(badge, recovery);
  const list = Array.isArray(totp.recovery) ? totp.recovery : [];
  const index = list.findIndex((item) => {
    const left = Buffer.from(item);
    const right = Buffer.from(hash);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  });
  if (index === -1) return "";
  list.splice(index, 1);
  totp.recovery = list;
  saveAccounts();
  return "recovery";
}

function renewRecovery(badge) {
  const account = accountOf(badge);
  if (!account || !account.totp || !account.totp.on) return null;
  const recovery = newRecoveryCodes(badge);
  account.totp.recovery = recovery.hashes;
  saveAccounts();
  return recovery.plain;
}

function linkEmail(badge, email) {
  const account = ensureAccount(badge);
  account.email = email;
  saveAccounts();
}

function disableTwoFactor(badge) {
  const account = accountOf(badge);
  if (!account) return;
  delete account.totp;
  delete account.totpSetup;
  saveAccounts();
}

function signTicket(badge, stage = "2fa", ttl = TICKET_MS) {
  const payload = `${badge}.${Date.now() + ttl}.${crypto.randomBytes(9).toString("base64url")}`;
  const sig = crypto.createHmac("sha256", secret).update(`ticket:${stage}:${payload}`).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function readTicket(ticket, stage = "2fa") {
  let raw = "";
  try {
    raw = Buffer.from(String(ticket || "").slice(0, 300), "base64url").toString("utf8");
  } catch {
    return "";
  }
  const parts = raw.split(".");
  if (parts.length !== 4) return "";
  const [badge, exp, nonce, sig] = parts;
  const left = Buffer.from(String(sig));
  const right = Buffer.from(crypto.createHmac("sha256", secret).update(`ticket:${stage}:${badge}.${exp}.${nonce}`).digest("hex"));
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return "";
  if (!(Number(exp) > Date.now()) || usedTickets.has(nonce)) return "";
  return badge;
}

function useTicket(ticket) {
  try {
    const [, exp, nonce] = Buffer.from(String(ticket || "").slice(0, 300), "base64url").toString("utf8").split(".");
    const now = Date.now();
    usedTickets.forEach((until, key) => {
      if (until < now) usedTickets.delete(key);
    });
    if (nonce) usedTickets.set(nonce, Number(exp) || now + TICKET_MS);
  } catch {}
}

function locked(key) {
  const row = failures.get(String(key));
  return Boolean(row && row.until > Date.now());
}

function noteFailure(key) {
  const now = Date.now();
  const row = failures.get(String(key)) || { n: 0, until: 0, first: now, strikes: 0 };
  if (now - row.first > LOCK_MS) {
    row.n = 0;
    row.first = now;
  }
  if (row.strikes && now - row.until > LOCK_MAX_MS) row.strikes = 0;
  row.n += 1;
  if (row.n >= LOCK_AFTER) {
    row.strikes = (row.strikes || 0) + 1;
    const span = ESCALATING.test(String(key)) ? Math.min(LOCK_MS * 2 ** (row.strikes - 1), LOCK_MAX_MS) : LOCK_MS;
    row.until = now + span;
    row.n = 0;
    row.first = now;
  }
  failures.set(String(key), row);
  return row.until > now;
}

function clearFailures(key) {
  failures.delete(String(key));
}

setInterval(() => {
  const now = Date.now();
  failures.forEach((row, key) => {
    const stale = row.strikes ? row.until < now && now - row.until > LOCK_MAX_MS : now - row.first > LOCK_MS;
    if (stale) failures.delete(key);
  });
  mailLog.forEach((list, key) => {
    if (!list.length || now - list[list.length - 1] > 24 * 60 * 60 * 1000) mailLog.delete(key);
  });
  usedTickets.forEach((until, key) => {
    if (until < now) usedTickets.delete(key);
  });
}, 10 * 60 * 1000).unref();

function mailAllowed(key) {
  const now = Date.now();
  const sent = (mailLog.get(String(key)) || []).filter((at) => now - at < 24 * 60 * 60 * 1000);
  mailLog.set(String(key), sent);
  if (sent.length >= MAIL_DAILY) return false;
  if (sent.length && now - sent[sent.length - 1] < MAIL_GAP_MS) return false;
  return true;
}

function noteMail(key) {
  const list = mailLog.get(String(key)) || [];
  list.push(Date.now());
  mailLog.set(String(key), list);
}

function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 120 || /[\r\n]/.test(email)) return "";
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email)) return "";
  const domains = securityConfig().emailDomains;
  if (domains.length && !domains.includes(email.split("@")[1])) return "";
  return email;
}

function maskEmail(email) {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return "";
  return `${user.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(6, user.length - 2)))}@${domain}`;
}

function smtpConfig() {
  const cfg = readJsonFile(SMTP_FILE, {});
  return {
    host: String(cfg.host || process.env.SMTP_HOST || "smtp.gmail.com"),
    port: Number(cfg.port || process.env.SMTP_PORT) || 465,
    user: String(cfg.user || process.env.SMTP_USER || "").trim(),
    pass: String(cfg.pass || process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    fromName: String(cfg.fromName || "BQ Connect").replace(/[\r\n"]/g, "").slice(0, 60),
  };
}

function mailConfigured() {
  const cfg = smtpConfig();
  return Boolean(cfg.user && cfg.pass);
}

function encodeWord(text) {
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function buildMessage(cfg, to, subject, text) {
  const body = Buffer.from(text, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n");
  return [
    `From: ${encodeWord(cfg.fromName)} <${cfg.user}>`,
    `To: <${to}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@bq-connect>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

function sendMail(to, subject, text) {
  const cfg = smtpConfig();
  const address = validEmail(to) || (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(to)) ? String(to) : "");
  if (!cfg.user || !cfg.pass || !address) return Promise.reject(new Error("mail"));
  const steps = [
    { expect: 220, send: "EHLO bq-connect" },
    { expect: 250, send: "AUTH LOGIN" },
    { expect: 334, send: Buffer.from(cfg.user).toString("base64") },
    { expect: 334, send: Buffer.from(cfg.pass).toString("base64") },
    { expect: 235, send: `MAIL FROM:<${cfg.user}>` },
    { expect: 250, send: `RCPT TO:<${address}>` },
    { expect: 250, send: "DATA" },
    { expect: 354, send: `${buildMessage(cfg, address, subject, text)}\r\n.` },
    { expect: 250, send: "QUIT" },
  ];
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, minVersion: "TLSv1.2" });
    let buffer = "";
    let step = 0;
    let finished = false;
    const finish = (reason) => {
      if (finished) return;
      finished = true;
      socket.end();
      if (reason) reject(Object.assign(new Error("mail"), { reason }));
      else resolve();
    };
    socket.setTimeout(20000, () => {
      socket.destroy();
      finish("timeout");
    });
    socket.on("error", (error) => finish(/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(error && error.code)) ? "certificate" : "network"));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      const last = lines.length > 1 ? lines[lines.length - 2] : "";
      if (!/^\d{3} /.test(last)) return;
      const code = Number(last.slice(0, 3));
      buffer = "";
      const current = steps[step];
      if (!current || code !== current.expect) {
        finish(step === 4 ? "auth" : `smtp-${code}`);
        return;
      }
      socket.write(`${current.send}\r\n`);
      step += 1;
      if (step === steps.length) finish(false);
    });
  });
}

function audit(type, who, info) {
  const rows = readJsonFile(AUDIT_FILE, { rows: [] });
  const list = Array.isArray(rows.rows) ? rows.rows : [];
  const row = { at: new Date().toISOString(), type: String(type), who: String(who || "") };
  if (info && info.ip) row.ip = String(info.ip).slice(0, 64);
  if (info && info.device) row.device = info.device;
  list.push(row);
  writePrivate(AUDIT_FILE, JSON.stringify({ rows: list.slice(-3000) }, null, 1));
}

module.exports = {
  accountOf,
  acceptTerms,
  audit,
  beginTwoFactor,
  checkLogin,
  checkTwoFactor,
  clearFailures,
  confirmTwoFactor,
  currentSessionId,
  disableTwoFactor,
  linkEmail,
  readTicket,
  renewRecovery,
  signTicket,
  twoFactorOn,
  twoFactorStatus,
  useTicket,
  listSessions,
  locked,
  rememberDevice,
  revokeSession,
  mailAllowed,
  mailConfigured,
  maskEmail,
  newPassword,
  noteFailure,
  noteMail,
  readSession,
  revokeSessions,
  securityConfig,
  sendMail,
  setPassword,
  setPending,
  signSession,
  strongPassword,
  validEmail,
};
