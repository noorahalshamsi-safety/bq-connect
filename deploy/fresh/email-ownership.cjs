// Only the designated imported directory's explicit email field is authority.
// Never infer an address from a badge/name or accept a caller-supplied mapping.
function normalize(value, domains) {
  if (typeof value !== "string" || value.length > 254) return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    domains.includes(email.split("@")[1]) ? email : "";
}
function associated(rows, badge, entered, domains) {
  const email = normalize(entered, domains);
  if (!email) return false;
  const matches = rows.filter(row => normalize(row.email, domains) === email);
  return matches.length === 1 && String(matches[0].badge) === String(badge);
}
function readiness(rows, domains, administrator) {
  const counts = new Map();
  for (const row of rows) {
    const email = normalize(row.email, domains);
    if (email) counts.set(email, (counts.get(email) || 0) + 1);
  }
  const eligible = row => counts.get(normalize(row.email, domains)) === 1;
  return { eligible: rows.filter(eligible).length,
    administrator: rows.some(r => String(r.badge) === String(administrator) && eligible(r)) ? "VERIFIED" : "BLOCKED" };
}
module.exports = { normalize, associated, readiness };
