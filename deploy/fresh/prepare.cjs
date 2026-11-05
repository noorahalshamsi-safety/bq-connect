// Read-only source preparation. No key reads, Production database access, import,
// secrets changes or publishing. Output contains only non-personal configuration.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { base, sha, canonical } = require("./config.cjs");
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
    sourceBucket: pins.sourceBucket, bucket: pins.targetBucket, directorySha256,
    endpoint: { hostname: null, port: "5432", database: "neondb", role: null, schema: "dev" },
    schemaFingerprint: pins.schemaFingerprint,
    releaseFingerprint: require(path.join(base, "deploy/managed/schema.cjs")).releaseFingerprint,
    permissionsFingerprint: null, permissionApproval: null,
    initialAdminBadge: null, emailDomains: [] };
}
module.exports = { prepare };
if (require.main === module) {
  if (process.argv[2] === "--digest") {
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
