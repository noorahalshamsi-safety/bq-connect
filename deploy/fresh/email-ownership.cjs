// Reuse the actual original directory producer/verifier, never a new hash scheme.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const crypto = require("node:crypto");
const { base, sha, canonical, need } = require("./config.cjs");
const source = fs.readFileSync(path.join(base, "server.js"), "utf8");
const names = ["asciiDigits", "cleanCode", "codeHash", "codesMatch", "normalizeMobile", "phoneHash", "phoneMatch"];
const functions = names.map(name => {
  const start = source.indexOf("function " + name + "("), end = source.indexOf("\n}", start);
  need(start >= 0 && end > start, "fresh_original_hash_contract_missing");
  return source.slice(start, end + 2);
});
const pepper = source.match(/^const PEPPER = "[^"]+";$/m)?.[0];
need(pepper && source.includes("check: codeHash(badge, code)") &&
  source.includes("phone: phoneHash(badge, digits)"), "fresh_directory_producer_contract_missing");
const contract = [pepper, ...functions].join("\n");
const legacy = vm.runInNewContext(contract + ";({asciiDigits,cleanCode,codesMatch,phoneMatch,codeHash,phoneHash})",
  { crypto, Buffer });
const contractFingerprint = sha(contract);
function complete(row) {
  return !!row && /^[a-f0-9]{64}$/.test(row.check || "") && /^[a-f0-9]{64}$/.test(row.phone || "");
}
function normalize(value, domains) {
  if (typeof value !== "string" || value.length > 254) return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    domains.includes(email.split("@")[1]) ? email : "";
}
function unique(rows, row) {
  return complete(row) && rows.filter(r => String(r.badge) === String(row.badge)).length === 1 &&
    rows.filter(r => r.check === row.check).length === 1 &&
    rows.filter(r => r.phone === row.phone).length === 1;
}
function matches(rows, row, code, mobile) {
  const digits = legacy.asciiDigits(code).replace(/\D/g, "");
  return digits.length === 4 && unique(rows, row) &&
    legacy.codesMatch(row, String(row.badge), legacy.cleanCode(code)) &&
    legacy.phoneMatch(row, String(row.badge), mobile);
}
function readiness(rows, administrator) {
  const checks = new Map(), phones = new Map(), badges = new Map();
  for (const row of rows) {
    for (const [map, value] of [[checks, row.check], [phones, row.phone], [badges, String(row.badge)]])
      if (value) map.set(value, (map.get(value) || 0) + 1);
  }
  const eligible = row => complete(row) && checks.get(row.check) === 1 &&
    phones.get(row.phone) === 1 && badges.get(String(row.badge)) === 1;
  return { eligible: rows.filter(eligible).length,
    administrator: rows.some(r => String(r.badge) === String(administrator) && eligible(r)) ? "VERIFIED" : "BLOCKED" };
}
function approval(manifest) {
  return "verified-known-employee:" + sha(canonical([manifest.directorySha256, contractFingerprint]));
}
function adminPolicy(manifest, env) {
  const email = normalize(env.BQ_FRESH_ADMIN_EMAIL, manifest.emailDomains);
  const expected = "register-admin:" + sha(canonical([
    sha(canonical(manifest)), manifest.initialAdminBadge, email]));
  const checks = { emailPresent: !!env.BQ_FRESH_ADMIN_EMAIL, emailAllowed: !!email,
    approvalPresent: !!env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL,
    approvalMatches: !!email && env.BQ_FRESH_ADMIN_REGISTRATION_APPROVAL === expected };
  return { badge: manifest.initialAdminBadge, emailHash: sha(email),
    approved: checks.approvalMatches, checks };
}
module.exports = { normalize, complete, matches, readiness, contractFingerprint, approval, legacy, adminPolicy };
