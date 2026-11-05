// Fixed field names and value-free execution states only.
const names = Object.freeze([
  "MAINTENANCE", "DIAGNOSTIC_REQUEST", "PRODUCTION_CONTEXT",
  "PRODUCTION_SECRETS", "ORIGINAL_KEY_MATCH", "CONTROL_BUCKET",
  "PRODUCTION_DATABASE", "PERMISSION_REVIEW", "READ_ONLY_SAFETY",
  "SOURCE_WRITER_FREEZE", "PUBLISHED_PROCESS", "PINNED_BINDINGS", "APP_IDENTITY",
  "SESSION_KEY_PRESENT", "SESSION_KEY_FORMAT",
  "BACKUP_KEY_PRESENT", "BACKUP_KEY_FORMAT",
  "AUDIT_KEY_PRESENT", "AUDIT_KEY_FORMAT",
  "ENDPOINT_PRESENT", "ENDPOINT_SYNTAX", "ENDPOINT_DESTINATION",
  "ENDPOINT_ALLOWED_OPTIONS", "ENDPOINT_TLS_POLICY", "ENDPOINT_NOT_DEVELOPMENT",
  "BUCKET_BINDING", "CONTROL_BUCKET_CONFIRMATION", "DATABASE_TLS",
  "DIAGNOSTIC_WORKER", "APP_ID_PRESENT", "APP_BINDING", "SCHEMA_BINDING",
  "WORKER_ENVIRONMENT", "SOURCE_READ"
]);
const values = new Set(["NOT_EXECUTED", "MISSING", "INVALID", "VERIFIED"]);
function statuses(input = {}) {
  return Object.fromEntries(names.map(name => {
    // Accept older internal callers, but never conflate skipped with failed.
    const value = input[name] === "PASS" ? "VERIFIED" :
      input[name] === "BLOCKED" ? "INVALID" : input[name];
    return [name, values.has(value) ? value : "NOT_EXECUTED"];
  }));
}
function report(input) { console.log(JSON.stringify(statuses(input))); }
module.exports = { statuses, report };
