const { need, sha } = require("./config.cjs");
function validate(bytes, expected = 6311) {
  need(typeof bytes === "string" && Buffer.byteLength(bytes) <= 20 * 1024 * 1024, "fresh_directory_size_invalid");
  let rows; try { rows = JSON.parse(bytes); } catch {}
  need(Array.isArray(rows) && rows.length === expected, "fresh_directory_count_mismatch");
  const unique = new Map(["badge", "id", "employeeId", "employee_id"].map(k => [k, new Set()]));
  for (const row of rows) {
    need(row && typeof row === "object" && !Array.isArray(row) &&
      ["string", "number"].includes(typeof row.badge) && /^\d{1,16}$/.test(String(row.badge)) &&
      typeof row.name === "string" && row.name.trim().length > 0, "fresh_directory_record_invalid");
    for (const key of unique.keys()) if (row[key] !== undefined && row[key] !== null) {
      const value = row[key];
      need(["string", "number"].includes(typeof value) && String(value).length > 0 &&
        (typeof value !== "number" || Number.isSafeInteger(value)) &&
        !unique.get(key).has(String(value)), "fresh_directory_identity_duplicate_or_invalid");
      unique.get(key).add(String(value));
    }
    for (const key of ["check", "phone"]) if (row[key] !== undefined && row[key] !== "")
      need(typeof row[key] === "string" && /^[a-f0-9]{64}$/.test(row[key]), "fresh_directory_ownership_record_invalid");
  }
  return { rows, sha256: sha(bytes) };
}
async function read(client, expected = 6311) {
  // The only source object this workflow ever requests. No accounts, keys or settings.
  const result = await client.downloadAsText("data/employees.json");
  need(result?.ok && typeof result.value === "string", "fresh_directory_read_failed");
  return validate(result.value, expected);
}
module.exports = { validate, read };
