// Reporting primitive only: no filesystem, database, environment or key loading.
// Protected inventory must run in its separately approved protected environment.
// Use an independent custody-held audit key, never an app signing/backup key.
const crypto=require("node:crypto");
const domains=new Set(["accounts","employees","posts","groups","media"]);
function membership({domain,sourceFingerprint,generation,identifiers},auditKey){
  const refuse=code=>{throw Object.assign(Error(code),{code});};
  if(!Buffer.isBuffer(auditKey)||auditKey.length<32)refuse("audit_key_required");
  if(!domains.has(domain)||!/^[0-9a-f]{64}$/.test(sourceFingerprint||"")||
    typeof generation!=="string"||!generation.length||generation.length>256)refuse("inventory_context_required");
  if(!Array.isArray(identifiers)||identifiers.some(id=>typeof id!=="string"||!id.length))refuse("stable_string_identifiers_required");
  if(new Set(identifiers).size!==identifiers.length)refuse("duplicate_inventory_identifier");
  // Binary JS string sorting is deterministic and does not case-fold or coerce.
  const ordered=[...identifiers].sort();
  const envelope=JSON.stringify(["BQ_PROTECTED_MEMBERSHIP_V1",domain,sourceFingerprint,generation,ordered]);
  return Object.freeze({algorithm:"HMAC-SHA256",domain,count:ordered.length,
    fingerprint:crypto.createHmac("sha256",auditKey).update(envelope,"utf8").digest("hex")});
}
module.exports={membership};
