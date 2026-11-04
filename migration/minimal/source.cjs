// Source bytes stay in process memory. No source writes, filesystem cache or app
// module imports. The public capsule intentionally contains no records or keys.
const crypto=require("node:crypto"),codec=require("../../development/postgres/codec.cjs");
const {canonical,sha,fail}=require("../../deploy/managed/config.cjs");
const held=new WeakMap(),required=["accounts.json","employees.json","session.key","backup.key"];
const supporting=["security.json","moderators.json","conduct.json","sms.json","smtp.json"];
const clone=v=>JSON.parse(JSON.stringify(v)),obj=v=>v&&typeof v==="object"&&!Array.isArray(v);
const hmac=(key,domain,value)=>crypto.createHmac("sha256",key).update(canonical([domain,value])).digest("hex");
function freeze(value){if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function factor(secret,value){
  try{const p=value.split(".").map(x=>Buffer.from(x,"base64url"));if(p.length!==3)throw Error();
    const d=crypto.createDecipheriv("aes-256-gcm",crypto.createHmac("sha256",secret).update("totp-vault").digest(),p[0]);d.setAuthTag(p[2]);
    if(Buffer.concat([d.update(p[1]),d.final()]).length!==20)throw Error();
  }catch{fail("minimal_factor_domain_invalid");}
}
function prepare(raw,{bucketFingerprint,expected={employees:6311,accounts:8},auditKey=crypto.randomBytes(32),synthetic=false}={}){
  if(!/^[a-f0-9]{64}$/.test(bucketFingerprint||"")||!Buffer.isBuffer(auditKey)||auditKey.length<32)fail("minimal_source_binding_required");
  if(!synthetic&&(expected.employees!==6311||expected.accounts!==8))fail("minimal_live_count_override_forbidden");
  const parse=name=>{try{return raw[name]===null?{}:JSON.parse(raw[name]);}catch{fail("minimal_source_json_invalid");}};
  const accounts=parse("accounts.json"),employees=parse("employees.json");
  if(!obj(accounts)||!Array.isArray(employees))fail("minimal_source_shape_invalid");
  const counts={employees:employees.length,accounts:Object.keys(accounts).length,registered:Object.values(accounts).filter(a=>a?.hash).length};
  if(counts.employees!==expected.employees||counts.accounts!==expected.accounts||counts.registered!==expected.accounts)
    throw Object.assign(Error("minimal_source_counts_changed"),{code:"minimal_source_counts_changed",counts});
  const sessionKey=raw["session.key"]?.trim(),backupKey=raw["backup.key"]?.trim();
  if(!/^[a-f0-9]{96}$/.test(sessionKey||"")||!/^[a-f0-9]{64}$/.test(backupKey||""))fail("minimal_original_keys_missing_or_invalid");
  const files=Object.fromEntries(Object.entries(codec.specs).map(([name,s])=>[name,s.kind==="array"?[]:s.kind==="value"?null:{}]));
  for(const name of supporting)files[name]=parse(name);
  files["accounts.json"]=clone(accounts);files["employees.json"]=clone(employees);
  const ids=new Set(),security=files["security.json"],official=new Set([security.adminAccount?.badge,security.announcer?.badge].filter(Boolean).map(String));
  for(const e of employees){
    if(!obj(e)||!["string","number"].includes(typeof e.badge)||(typeof e.badge==="number"&&!Number.isSafeInteger(e.badge))||
      !String(e.badge)||ids.has(String(e.badge)))fail("minimal_employee_identity_invalid");
    ids.add(String(e.badge));
  }
  let activeFactors=0,pendingFactors=0,officialAccounts=0;
  for(const [id,a]of Object.entries(accounts)){
    if(!/^\d{1,16}$/.test(id)||!obj(a)||(!ids.has(id)&&!official.has(id)))fail("minimal_account_relationship_invalid");
    if(!ids.has(id))officialAccounts++;
    if(!/^[a-f0-9]{128}$/.test(a.hash||"")||!/^[a-f0-9]{32}$/.test(a.salt||"")||
      (a.kdf!==undefined&&![1,2].includes(a.kdf))||!Number.isSafeInteger(a.ver)||a.ver<1)fail("minimal_credential_format_unsupported");
    if(a.totp?.on){factor(sessionKey,a.totp.key);activeFactors++;}
    if(a.totpSetup?.key){factor(sessionKey,a.totpSetup.key);pendingFactors++;}
    if(a.pending&&(!/^[a-f0-9]{128}$/.test(a.pending.hash||"")||!/^[a-f0-9]{32}$/.test(a.pending.salt||"")||
      (a.pending.kdf!==undefined&&![1,2].includes(a.pending.kdf))))fail("minimal_pending_credentials_invalid");
  }
  // Only conduct restrictions for the retained accounts are login dependencies.
  const conduct=files["conduct.json"],retained=new Set(Object.keys(accounts));
  files["conduct.json"]={...conduct,warnings:(conduct.warnings||[]).filter(r=>retained.has(String(r.badge))),
    bans:Object.fromEntries(Object.entries(conduct.bans||{}).filter(([id])=>retained.has(id))),
    resets:Object.fromEntries(Object.entries(conduct.resets||{}).filter(([id])=>retained.has(id)))};
  files["backup.json"]={enabled:false};
  const membership={accounts:hmac(auditKey,"accounts-membership",Object.keys(accounts).sort()),
    employees:hmac(auditKey,"employees-membership",employees.map(e=>canonical([typeof e.badge,e.badge])).sort())};
  const fingerprint=hmac(auditKey,"minimal-source-v1",{bucketFingerprint,files,keys:{sessionKey,backupKey}});
  const capsule=Object.freeze({kind:"BQ_MINIMAL_SOURCE_V1",bucketFingerprint,synthetic,counts:Object.freeze(counts),
    activeFactors,pendingFactors,officialAccounts,emailLinkedAccounts:Object.entries(accounts).filter(([id,a])=>a.email||
      (String(security.announcer?.badge)===id&&security.announcer?.email)).length,
    storedSmtpConfigured:Boolean(files["smtp.json"].user&&files["smtp.json"].pass),fingerprint,membership:Object.freeze(membership)});
  held.set(capsule,{files:freeze(files),sessionKey,backupKey,auditKey:Buffer.from(auditKey),rawFingerprint:hmac(auditKey,"source-read-v1",raw)});
  return capsule;
}
function access(source){if(!held.has(source))fail("minimal_verified_source_required");return held.get(source);}
async function read({client,bucketFingerprint,auditKey,synthetic=false,expected}){
  const raw={};
  for(const name of [...required,...supporting]){
    const present=await client.exists("data/"+name);if(!present.ok)fail("minimal_source_read_failed");
    if(!present.value){if(required.includes(name))fail("minimal_source_required_file_missing");raw[name]=null;continue;}
    const r=await client.downloadAsText("data/"+name);if(!r.ok||typeof r.value!=="string"||Buffer.byteLength(r.value)>20*1024*1024)fail("minimal_source_read_failed");
    raw[name]=r.value;
    // Stop before reading keys/settings if the owner-designated counts changed.
    if(name==="employees.json"){
      let a,e;try{a=JSON.parse(raw["accounts.json"]);e=JSON.parse(raw[name]);}catch{fail("minimal_source_json_invalid");}
      const counts={employees:Array.isArray(e)?e.length:null,accounts:obj(a)?Object.keys(a).length:null,registered:obj(a)?Object.values(a).filter(v=>v?.hash).length:null};
      const wanted=expected||{employees:6311,accounts:8};
      if(counts.employees!==wanted.employees||counts.accounts!==wanted.accounts||counts.registered!==wanted.accounts)
        throw Object.assign(Error("minimal_source_counts_changed"),{code:"minimal_source_counts_changed",counts});
    }
  }
  const source=prepare(raw,{bucketFingerprint,auditKey,synthetic,expected});
  // A second read detects live drift; it is NOT an atomic snapshot or freeze.
  for(const [name,value]of Object.entries(raw)){
    const r=await client.exists("data/"+name);if(!r.ok||Boolean(r.value)!==(value!==null))fail("minimal_source_changed_during_read");
    if(value!==null){const check=await client.downloadAsText("data/"+name);if(!check.ok||check.value!==value)fail("minimal_source_changed_during_read");}
  }
  return source;
}
module.exports={read,prepare,access,hmac,required,supporting,clone};
