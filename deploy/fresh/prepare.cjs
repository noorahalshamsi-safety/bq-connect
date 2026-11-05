// Read-only source preparation. No key reads, Production database access, import,
// secrets changes or publishing. Output contains only non-personal configuration.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { base, sha, canonical, load, need } = require("./config.cjs");
async function verifyCurrent({ smtpAuth = false } = {}) {
  const manifest = load();
  need(sha(manifest.sourceBucket) === "ce11c603901c2550295d04cf9a5898200348ff8d29086744a88ee73d8f8716ec" &&
    manifest.sourceBucket !== manifest.bucket, "fresh_source_binding_required");
  const { Client } = await import("@replit/object-storage");
  const client = new Client({ bucketId: manifest.sourceBucket });
  const allowed = new Set(["data/employees.json", "data/smtp.json"]);
  const download = async name => { need(allowed.has(name)); return client.downloadAsText(name); };
  const directory = await require("./directory.cjs").read({ downloadAsText: download });
  const settings = {}, unavailable = [];
  for (const file of ["smtp.json"]) {
    try {
      const result = await download("data/" + file);
      if (!result?.ok || typeof result.value !== "string") throw Error("unavailable");
      const parsed = JSON.parse(result.value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("invalid");
      settings[file] = parsed;
    } catch { settings[file] = {}; unavailable.push(file); }
  }
  const providers = require("./providers.cjs").review(settings);
  if (smtpAuth && providers.smtp.status === "CONFIGURATION_READY")
    providers.smtp.authentication = await require("./providers.cjs").probeSmtp(settings["smtp.json"]);
  const administrator = directory.rows.find(r => String(r.badge) === manifest.initialAdminBadge);
  return { directory: { employees: directory.rows.length,
    checksum: directory.sha256 === manifest.directorySha256 ? "MATCH" : "CHANGED",
    approvedAdministrator: administrator ? "PRESENT" : "ABSENT",
    emailAssociation: require("./email-ownership.cjs").readiness(directory.rows,
      manifest.emailDomains, manifest.initialAdminBadge) },
    providers, unavailableProviderObjects: unavailable, source: "READ_ONLY",
    productionSecretTransfer: "NOT_EXECUTED", messagesSent: 0 };
}
async function prepare({ readSource = false } = {}) {
  const pins = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../../release-preparation/production-bindings/bindings.pending.json"), "utf8"));
  let directorySha256 = null;
  if (readSource) {
    const { Client } = await import("@replit/object-storage");
    const source = new Client({ bucketId: pins.sourceBucket });
    directorySha256 = (await require("./directory.cjs").read({
      downloadAsText: name => source.downloadAsText(name)
    })).sha256;
  }
  return { kind: "BQ_FRESH_INSTALL_V1", mode: "fresh-install",
    dataset: "managed-production-" + crypto.randomUUID(), employees: 6311, legacyAccounts: 0,
    registrationPolicy: "directory-email-v1",
    sourceBucket: pins.sourceBucket, bucket: pins.targetBucket, directorySha256,
    endpoint: { hostname: null, port: "5432", database: "neondb", role: null, schema: "dev" },
    schemaFingerprint: pins.schemaFingerprint,
    releaseFingerprint: require(path.join(base, "deploy/managed/schema.cjs")).releaseFingerprint,
    permissionsFingerprint: null, permissionApproval: null,
    initialAdminBadge: null, emailDomains: [] };
}
module.exports = { prepare, verifyCurrent };
if (require.main === module) {
  if (process.argv[2] === "--verify-current") {
    verifyCurrent({ smtpAuth: process.argv[3] === "--smtp-auth" }).then(r => console.log(JSON.stringify(r))).catch(() => {
      console.error('{"FRESH_SOURCE_REVIEW":"BLOCKED"}'); process.exitCode = 1;
    });
  } else if (process.argv[2] === "--digest") {
    const file = process.argv[3] || path.join(__dirname, "production.json");
    console.log(sha(canonical(JSON.parse(fs.readFileSync(file, "utf8")))));
  } else if (process.argv.length <= 3 && [undefined, "--read-directory"].includes(process.argv[2])) {
    prepare({ readSource: process.argv[2] === "--read-directory" }).then(manifest => {
      const file = path.join(__dirname, "production.json");
      fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify({ FRESH_PREPARATION: "PASS", directoryRead: !!manifest.directorySha256,
        reviewedProductionBinding: false, file: "deploy/fresh/production.json" }));
    }).catch(() => { console.error('{"FRESH_PREPARATION":"BLOCKED"}'); process.exitCode = 1; });
  } else { console.error('{"FRESH_PREPARATION":"BLOCKED"}'); process.exitCode = 1; }
}
