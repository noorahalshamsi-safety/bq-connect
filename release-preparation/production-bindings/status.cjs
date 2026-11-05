// Only this allowlisted status projection may reach diagnostic stdout/stderr.
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
  "DIAGNOSTIC_WORKER"
]);
function statuses(input = {}) {
  return Object.fromEntries(names.map(name => [name, input[name] === "PASS" ? "PASS" : "BLOCKED"]));
}
function report(input) { console.log(JSON.stringify(statuses(input))); }
module.exports = { statuses, report };
