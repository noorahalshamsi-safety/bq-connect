// Explicit live read-only diagnostics. No DB connections, local data directory,
// original-key persistence, source writes, record values or raw SDK errors.
const fs=require("node:fs"),S=require("../../migration/minimal/source.cjs"),{sha}=require("../../deploy/managed/config.cjs");
(async()=>{
  if(process.argv.length!==3)throw Error("minimal_explicit_config_required");
  const bucket=fs.readFileSync(process.argv[2],"utf8").match(/defaultBucketID\s*=\s*"([^"]+)"/)?.[1];
  if(!bucket)throw Error("minimal_designated_bucket_missing");
  const {Client}=await import("@replit/object-storage");
  const source=await S.read({client:new Client({bucketId:bucket}),bucketFingerprint:sha(bucket)});
  console.log(JSON.stringify({scope:"owner-designated App Storage; memory-only; no data/key exports or destination writes",
    counts:source.counts,activeFactors:source.activeFactors,pendingFactors:source.pendingFactors,officialAccounts:source.officialAccounts,
    emailLinkedAccounts:source.emailLinkedAccounts,storedSmtpConfigured:source.storedSmtpConfigured,
    originalKeyFormatsVerified:true,activeAndPendingFactorDomainsVerified:true,stableRead:true,cutoverAuthorized:false}));
})().catch(e=>{console.error(JSON.stringify({error:/^minimal_[a-z_]+$/.test(e.code||e.message)?e.code||e.message:"minimal_source_inspection_failed",
  ...(e.code==="minimal_source_counts_changed"?{counts:e.counts}:{}),cutoverAuthorized:false}));process.exitCode=1;});
