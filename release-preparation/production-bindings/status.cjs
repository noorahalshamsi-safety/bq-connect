// Only this allowlisted status projection may reach diagnostic stdout/stderr.
const names = Object.freeze([
  "MAINTENANCE", "DIAGNOSTIC_REQUEST", "PRODUCTION_CONTEXT",
  "PRODUCTION_SECRETS", "ORIGINAL_KEY_MATCH", "CONTROL_BUCKET",
  "PRODUCTION_DATABASE", "PERMISSION_REVIEW", "READ_ONLY_SAFETY",
  "SOURCE_WRITER_FREEZE"
]);
function statuses(input = {}) {
  return Object.fromEntries(names.map(name => [name, input[name] === "PASS" ? "PASS" : "BLOCKED"]));
}
function report(input) { console.log(JSON.stringify(statuses(input))); }
module.exports = { statuses, report };
