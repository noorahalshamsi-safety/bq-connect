// Read-only future approval preparation. Output contains only counts and
// fingerprints, never employee/account records or original secret values.
const fs=require("node:fs"),cfg=require("../../deploy/managed/config.cjs"),S=require("../../migration/minimal/source.cjs");
async function bindings({configFile,client,auditHex}){
  if(!/^[a-f0-9]{64}$/.test(auditHex||""))cfg.fail("minimal_protected_audit_key_required");
  const text=fs.readFileSync(configFile,"utf8"),section=text.match(/(?:^|\n)\[objectStorage\]\s*\n([\s\S]*?)(?=\n\[|$)/)?.[1];
  const bucket=section?.match(/(?:^|\n)\s*defaultBucketID\s*=\s*"([^"]+)"/)?.[1];if(!bucket)cfg.fail("minimal_designated_bucket_missing");
  if(!client){const {Client}=await import("@replit/object-storage");client=new Client({bucketId:bucket});}
  const source=await S.read({client,bucketFingerprint:cfg.sha(bucket),auditKey:Buffer.from(auditHex,"hex")}),p=S.access(source);
  return {keys:{session:cfg.sha(p.sessionKey),backup:cfg.sha(p.backupKey)},minimal:{policy:"employees-accounts-only-v1",sourceBucket:bucket,
    sourceBucketFingerprint:source.bucketFingerprint,sourceFingerprint:source.fingerprint,membership:source.membership,
    employees:source.counts.employees,accounts:source.counts.accounts,freezeEvidence:null},
    observations:{counts:source.counts,activeFactors:source.activeFactors,pendingFactors:source.pendingFactors,officialAccounts:source.officialAccounts,
      emailLinkedAccounts:source.emailLinkedAccounts,storedSmtpConfigured:source.storedSmtpConfigured,readStable:true,sourceFrozen:false,executionAuthorized:false}};
}
module.exports={bindings};
if(require.main===module)bindings({configFile:process.argv[2],auditHex:process.env.BQ_MINIMAL_AUDIT_KEY})
  .then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({error:e.code||"minimal_bindings_failed",sourceWritten:false,...(e.counts?{observedCounts:e.counts}:{})}));process.exitCode=1;});
