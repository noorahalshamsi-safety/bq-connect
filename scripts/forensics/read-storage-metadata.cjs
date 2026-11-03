// Explicit read-only allowlist. Never downloads account/key objects or archives.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "../..");
const fingerprint = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
const safeCounts = (value) => Object.fromEntries(["accounts", "posts", "employees"]
  .filter((key) => Number.isSafeInteger(value?.[key])).map((key) => [key, value[key]]));

async function main() {
  const config = fs.readFileSync(path.join(root, ".replit"), "utf8");
  const bucket = config.match(/defaultBucketID\s*=\s*"([^"]+)"/)?.[1];
  if (!bucket) throw new Error("No linked bucket configured");
  const { Client } = await import("@replit/object-storage");
  const client = new Client({ bucketId: bucket });
  const output = {
    observedAt: new Date().toISOString(),
    scope: "Explicitly configured bucket; metadata only, not production records or archives",
    bucketFingerprint: fingerprint(bucket),
    existence: {},
  };
  for (const name of ["meta/bq-storage-seeded", "data/accounts.json", "data/session.key",
    "data/backup.key", "data/employees.json", "vault/index.json",
    "meta/restore-request.json", "meta/import-request.json"]) {
    const result = await client.exists(name);
    output.existence[name] = result.ok ? Boolean(result.value) : null;
  }
  const marker = await client.downloadAsText("meta/bq-storage-seeded");
  if (marker.ok) {
    const value = marker.value.trim();
    output.marker = {
      fingerprint: fingerprint(value),
      timestamp: Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString(),
      containsBucketBinding: false,
    };
  }
  const index = await client.downloadAsText("vault/index.json");
  if (index.ok) {
    output.indexFingerprint = fingerprint(index.value);
    const entries = JSON.parse(index.value);
    output.snapshots = (Array.isArray(entries) ? entries : []).map((row) => ({
      nameFingerprint: fingerprint(String(row.name || "")),
      at: row.at,
      reason: row.reason,
      counts: safeCounts(row.counts),
      size: row.size,
      files: row.files,
    }));
  }
  const result = await client.downloadAsText("meta/restore-result.json");
  if (result.ok) {
    const row = JSON.parse(result.value);
    output.lastOperation = {
      at: row.at, type: row.type || "restore", ok: row.ok,
      counts: safeCounts(row.counts),
      added: Object.fromEntries(["accounts", "posts", "media"]
        .filter((key) => Number.isSafeInteger(row.added?.[key])).map((key) => [key, row.added[key]])),
    };
  }
  const destination = path.join(root, "generated-artifacts/forensics");
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, "storage-metadata.json"), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch(() => {
  console.error("Read-only storage metadata investigation could not be completed.");
  process.exitCode = 1;
});
