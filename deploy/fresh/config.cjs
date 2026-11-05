// New installation authority, not a claim about the old runtime REPL_ID.
const crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const base = path.resolve(__dirname, "../../release-preparation/maintenance-cd5bd76/source");
const canonical = v => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ?
  Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function need(ok, code = "fresh_configuration_required") { if (!ok) throw Object.assign(Error(code), { code }); }
function load(env = process.env) {
  return JSON.parse(fs.readFileSync(env.BQ_FRESH_MANIFEST_FILE || path.join(__dirname, "production.json"), "utf8"));
}
function authorize({ env, manifest: m }) {
  need(env.REPLIT_DEPLOYMENT === "1" && m?.kind === "BQ_FRESH_INSTALL_V1" &&
    m.mode === "fresh-install" && m.employees === 6311 && m.legacyAccounts === 0);
  need(/^managed-production-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(m.dataset || ""));
  // Review this public digest in Publishing. It binds the NEW installation's
  // destination, source, permissions, policy and initial administrator choice.
  need(env.BQ_FRESH_BINDING_SHA256 === sha(canonical(m)), "fresh_owner_binding_required");
  for (const [name, length] of [["BQ_FRESH_SESSION_KEY", 96], ["BQ_FRESH_BACKUP_KEY", 64], ["BQ_FRESH_INSTALL_KEY", 64]])
    need(new RegExp("^[a-f0-9]{" + length + "}$").test(env[name] || ""), "fresh_production_secrets_required");
  let url; try { url = new URL(env.DATABASE_URL); } catch {}
  need(url && ["postgres:", "postgresql:"].includes(url.protocol) &&
    !["helium", "localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
    url.pathname === "/neondb" && !!url.username && !!url.password, "fresh_production_database_required");
  need([...url.searchParams.keys()].every(k => ["sslmode", "channel_binding"].includes(k)) &&
    !["disable", "no-verify", "allow", "prefer"].includes(url.searchParams.get("sslmode")), "fresh_tls_required");
  const endpoint = { hostname: url.hostname, port: url.port || "5432", database: "neondb",
    role: decodeURIComponent(url.username), schema: "dev" };
  need(canonical(endpoint) === canonical(m.endpoint), "fresh_destination_binding_mismatch");
  const pins = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    "../../release-preparation/production-bindings/bindings.pending.json"), "utf8"));
  need(m.sourceBucket === pins.sourceBucket && m.bucket === pins.targetBucket &&
    m.sourceBucket !== m.bucket && sha(m.sourceBucket) === pins.sourceBucketFingerprint &&
    sha(m.bucket) === pins.targetBucketFingerprint, "fresh_bucket_binding_mismatch");
  for (const name of ["schemaFingerprint", "permissionsFingerprint", "directorySha256"])
    need(/^[a-f0-9]{64}$/.test(m[name] || ""), "fresh_reviewed_contract_required");
  need(m.schemaFingerprint === pins.schemaFingerprint &&
    m.releaseFingerprint === require(path.join(base, "deploy/managed/schema.cjs")).releaseFingerprint &&
    m.permissionApproval === "reviewed-managed-runtime-capabilities", "fresh_schema_permission_review_required");
  need(/^\d{1,16}$/.test(m.initialAdminBadge || "") &&
    m.registrationPolicy === "directory-code-mobile-email-v1" &&
    m.ownershipCompatibilityApproval === require("./email-ownership.cjs").approval(m) &&
    Array.isArray(m.emailDomains) && m.emailDomains.length > 0 &&
    m.emailDomains.every(d => typeof d === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)),
  "fresh_registration_policy_required");
  const sessionKey = env.BQ_FRESH_SESSION_KEY, backupKey = env.BQ_FRESH_BACKUP_KEY;
  const seal = crypto.createHmac("sha256", Buffer.from(env.BQ_FRESH_INSTALL_KEY, "hex"))
    .update(canonical([m.dataset, sha(canonical(m)), sha(sessionKey), sha(backupKey)])).digest("hex");
  url.searchParams.delete("sslmode"); url.searchParams.delete("channel_binding");
  return { proof: { verifiedManaged: true, freshInstall: true, profile: "production",
    dataset: m.dataset, seal, sessionKey, backupKey, bucket: m.bucket,
    manifestFingerprint: sha(canonical(m)), endpointFingerprint: sha(canonical(endpoint)),
    schemaFingerprint: m.schemaFingerprint, releaseFingerprint: m.releaseFingerprint,
    permissionsFingerprint: m.permissionsFingerprint },
  pool: { connectionString: url.toString(), ssl: { rejectUnauthorized: true,
    servername: url.hostname, minVersion: "TLSv1.2" }, enableChannelBinding: true,
    max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    statement_timeout: 20000, lock_timeout: 12000, application_name: "bq-fresh-production" } };
}
module.exports = { base, canonical, sha, need, load, authorize };
