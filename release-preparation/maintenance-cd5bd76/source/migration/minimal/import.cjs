// DATA ONLY. Managed schema must already exist through Replit Publish.
const fs=require("node:fs"),path=require("node:path"),S=require("./source.cjs");
const cfg=require("../../deploy/managed/config.cjs"),schema=require("../../deploy/managed/schema.cjs");
const codec=require("../../development/postgres/codec.cjs"),{saveFile}=require("../../development/postgres/repository.cjs");
const {vault}=require("../../development/postgres/sealed.cjs");
const permits=new WeakSet(),markerName="minimal:import:v1",lock=1793808169;
function policy(manifest,source){
  const m=manifest?.minimal,p=S.access(source);
  if(!m||m.policy!=="employees-accounts-only-v1"||m.sourceBucketFingerprint!==source.bucketFingerprint||
    m.sourceFingerprint!==source.fingerprint||m.employees!==6311||m.accounts!==8||
    m.membership?.accounts!==source.membership.accounts||m.membership?.employees!==source.membership.employees||
    cfg.sha(p.sessionKey)!==manifest.keys?.session||cfg.sha(p.backupKey)!==manifest.keys?.backup||
    cfg.sha(manifest.bucket)===source.bucketFingerprint||!/^[a-f0-9]{64}$/.test(m.freezeEvidence||"")||
    m.freezeEvidence!==manifest.release?.frozenGeneration)cfg.fail("minimal_policy_or_custody_mismatch");
}
function authorize(proof,manifest,source,{approvalRoot=__dirname}={}){
  cfg.assertProof(proof);if(proof.profile!=="production"||source.synthetic)cfg.fail("minimal_production_source_required");
  if(proof.manifestFingerprint!==cfg.sha(cfg.canonical(manifest)))cfg.fail("minimal_verified_manifest_required");
  policy(manifest,source);
  const binding=cfg.sha(cfg.canonical({manifest,source:source.fingerprint}));
  const a=JSON.parse(fs.readFileSync(path.join(approvalRoot,"approvals.json"),"utf8")).approvals;
  if(!a.some(r=>r.operation==="minimal-employee-account-import"&&r.binding===binding&&typeof r.approvedBy==="string"&&r.approvedBy.length&&
    Number.isFinite(Date.parse(r.expires))&&Date.parse(r.expires)>Date.now()))cfg.fail("minimal_execution_approval_required");
  const permit=Object.freeze({proof,source});permits.add(permit);return permit;
}
function assertTarget(proof,source,permit){
  S.access(source);
  if(proof?.verifiedSynthetic){
    if(process.env.REPLIT_DEPLOYMENT||!source.synthetic)cfg.fail("minimal_real_source_in_development_forbidden");
    const checked=require("../../development/postgres/isolation.cjs").verify(proof.root);
    if(checked.dataset!==proof.dataset||checked.seal!==proof.seal)cfg.fail("minimal_synthetic_identity_invalid");
  }else{
    cfg.assertProof(proof);
    if(proof.profile!=="production"||source.synthetic||!permits.has(permit)||permit.proof!==proof||permit.source!==source)
      cfg.fail("minimal_execution_approval_required");
  }
  const p=S.access(source);if(p.sessionKey!==proof.sessionKey||p.backupKey!==proof.backupKey)cfg.fail("minimal_original_key_continuity_required");
}
async function readMarker(c,proof){
  const r=await c.query("SELECT value FROM dev.runtime_state WHERE name=$1",[markerName]);
  return r.rowCount?vault(proof).decode(r.rows[0].value,`state:${markerName}`):null;
}
async function apply({client:c,source,proof,permit,contract,verifySourceUnchanged,failBeforeCommit=false}){
  assertTarget(proof,source,permit);const p=S.access(source);
  await c.query("BEGIN");
  try{
    await c.query("SELECT pg_advisory_xact_lock($1)",[lock]);
    if(contract)await schema.requireSchema(c,contract);else if(!source.synthetic)cfg.fail("minimal_schema_contract_required");
    const old=await readMarker(c,proof);
    if(old){
      const a=(await c.query("SELECT * FROM dev.authority WHERE singleton FOR SHARE")).rows[0];
      if(old.sourceFingerprint!==source.fingerprint||old.dataset!==proof.dataset||old.seal!==proof.seal||
        !a||a.dataset_id!==proof.dataset||a.seal!==proof.seal||String(a.epoch)!=="1"||a.mode!==(source.synthetic?"synthetic":"production"))
        cfg.fail("minimal_previous_import_binding_mismatch");
      await c.query("COMMIT");return {...old,replayed:true};
    }
    // Refuse fixtures, orphan nodes, operational rows or prior authority. Never
    // truncate/reset a destination, even if its files/authority rows were lost.
    for(const table of ["authority","files","runtime_state","outbox","requests","media","media_links","backups","test_faults",...codec.tables.keys()]){
      if((await c.query(`SELECT EXISTS(SELECT 1 FROM dev.${table}) AS occupied`)).rows[0].occupied)cfg.fail("minimal_destination_not_empty");
    }
    await c.query("INSERT INTO dev.authority VALUES(true,$1,$2,1,$3)",[proof.dataset,proof.seal,source.synthetic?"synthetic":"production"]);
    for(const [name,value]of Object.entries(p.files))await saveFile(c,name,value,null);
    // Independent membership reconciliation uses SQL keys/attributes, not the
    // same encoder/decoder pair used for projection.
    const accounts=(await c.query("SELECT entry_key FROM dev.accounts ORDER BY entry_key")).rows.map(r=>r.entry_key).sort();
    const employees=(await c.query("SELECT attrs->'badge' AS badge FROM dev.employees")).rows.map(r=>cfg.canonical([typeof r.badge,r.badge])).sort();
    if(S.hmac(p.auditKey,"accounts-membership",accounts)!==source.membership.accounts||
      S.hmac(p.auditKey,"employees-membership",employees)!==source.membership.employees)cfg.fail("minimal_membership_reconciliation_failed");
    // Full credential/dependency/unknown-field reconstruction is compared to
    // original source values, including nested sessions, factors and versions.
    const restored=new Map();
    for(const table of codec.tables.keys())for(const row of(await c.query(`SELECT * FROM dev.${table}`)).rows){
      if(!restored.has(row.file_name))restored.set(row.file_name,[]);
      restored.get(row.file_name).push({...row,table});
    }
    for(const [name,value]of Object.entries(p.files)){
      if(cfg.canonical(codec.decode(name,restored.get(name)||[]))!==cfg.canonical(value))cfg.fail("minimal_semantic_reconciliation_failed");
    }
    if(!source.synthetic&&!verifySourceUnchanged)cfg.fail("minimal_source_recheck_required");
    if(verifySourceUnchanged)await verifySourceUnchanged();
    const receipt={kind:"BQ_MINIMAL_IMPORT_V1",dataset:proof.dataset,seal:proof.seal,sourceFingerprint:source.fingerprint,
      sourceBucketFingerprint:source.bucketFingerprint,counts:source.counts,membership:source.membership,
      originalKeys:{session:cfg.sha(p.sessionKey),backup:cfg.sha(p.backupKey)},socialHistory:"empty-by-owner-approval"};
    await c.query("INSERT INTO dev.runtime_state(name,value) VALUES($1,$2::jsonb)",[markerName,JSON.stringify(vault(proof).json(receipt,`state:${markerName}`))]);
    if(failBeforeCommit){if(!source.synthetic)cfg.fail("minimal_fault_injection_forbidden");cfg.fail("minimal_injected_rollback");}
    await c.query("COMMIT");return {...receipt,replayed:false};
  }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}
}
module.exports={apply,authorize,policy,readMarker,markerName,lock};
