const C=require("./common.cjs"),{fs,path,hash,digest,fail,parse,safeFile,walk}=C;
const codec=require("../../../development/postgres/codec.cjs");
const files=Object.keys(codec.specs).sort();
const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
function unique(rows,key,code){const ids=new Set();for(const r of rows){if(!obj(r)||typeof r[key]!=="string"||!r[key])fail(code);if(ids.has(r[key]))fail("duplicate_"+code);ids.add(r[key]);}return ids;}
function unseal(secret,sealed){
 try{
  const parts=sealed.split(".").map(x=>Buffer.from(x,"base64url"));if(parts.length!==3)fail("factor_domain_mismatch");
  const decipher=C.crypto.createDecipheriv("aes-256-gcm",C.crypto.createHmac("sha256",secret).update("totp-vault").digest(),parts[0]);
  decipher.setAuthTag(parts[2]);const key=Buffer.concat([decipher.update(parts[1]),decipher.final()]);if(key.length!==20)fail("factor_domain_mismatch");return key;
 }catch{fail("factor_domain_mismatch");}
}
function validate(values,keys,reference){
 const accounts=values["accounts.json"],employees=values["employees.json"],posts=values["ideas.json"],groups=values["groups.json"];
 for(const f of files){
  const k=codec.specs[f].kind;
  if((k==="array"&&!Array.isArray(values[f]))||(["map","object"].includes(k)&&!obj(values[f])))fail("root_shape:"+f);
 }
 const people=unique(employees,"badge","employee_identifier"),postIds=unique(posts,"id","post_identifier"),groupIds=unique(groups,"id","group_identifier");
 const systems=new Set([values["security.json"].adminAccount?.badge,values["security.json"].announcer?.badge].filter(Boolean));
 const exists=badge=>typeof badge==="string"&&(people.has(badge)||systems.has(badge));
 const knownBadge=(badge)=>{if(!exists(badge))fail("missing_employee_reference");};
 const key=keys.session.toString("utf8").trim();
 if(!/^[0-9a-f]{96}$/.test(key)||!/^[0-9a-f]{64}$/.test(keys.backup.toString("utf8").trim()))fail("invalid_key_custody");
 for(const [badge,a]of Object.entries(accounts)){
  knownBadge(badge);if(!obj(a))fail("malformed_account");
  const credential=(v)=>{
   if(!obj(v)||typeof v.hash!=="string"||!/^[0-9a-f]{128}$/.test(v.hash)||typeof v.salt!=="string"||!/^[0-9a-f]{32}$/.test(v.salt))fail("missing_account_credentials");
   if(Object.hasOwn(v,"kdf")&&![1,2].includes(v.kdf))fail("unsupported_kdf");
  };
  credential(a);if(a.pending!==null&&Object.hasOwn(a,"pending"))credential(a.pending);
  if(Object.hasOwn(a,"ver")&&(!Number.isSafeInteger(a.ver)||a.ver<1))fail("invalid_account_version");
  if(Object.hasOwn(a,"sessions")&&!Array.isArray(a.sessions))fail("malformed_sessions");
  unique(a.sessions||[],"sid","session_identifier");
  for(const factor of ["totp","totpSetup"])if(a[factor]!==null&&Object.hasOwn(a,factor)){
   if(!obj(a[factor]))fail("malformed_factor");
   if(a[factor].key)unseal(key,a[factor].key);
   else if(a[factor].on||factor==="totpSetup")fail("missing_factor_material");
  }
 }
 for(const [badge,token]of Object.entries(reference)){
  if(!accounts[badge])fail("missing_account_record");
  const parts=Buffer.from(token,"base64url").toString().split(".");if(parts.length!==5||parts[0]!==badge||parts[1]!==String(accounts[badge].ver))fail("session_compatibility");
  const payload=parts.slice(0,4).join(".");
  if(parts[4]!==C.crypto.createHmac("sha256",key).update("session:"+payload).digest("hex")||!accounts[badge].sessions?.some(s=>s.sid===parts[3]))fail("session_domain_mismatch");
 }
 for(const p of posts){
  knownBadge(p.badge);if(!["post","idea","suggestion","complaint","thanks","story","poll","article","announcement","event"].includes(p.type))fail("unsupported_post_type");
  if(p.groupId&&!groupIds.has(p.groupId))fail("missing_group_reference");
  const comments=p.comments||[];if(!Array.isArray(comments))fail("malformed_comments");
  const ids=unique(comments,"id","comment_identifier");
  for(const r of comments){knownBadge(r.badge);if(r.parentId&&!ids.has(r.parentId))fail("missing_comment_parent");
   const seen=new Set([r.id]);let parent=r.parentId;while(parent){if(seen.has(parent))fail("comment_cycle");seen.add(parent);parent=comments.find(x=>x.id===parent)?.parentId;}}
  for(const field of ["ratings","reposts"])if(Object.hasOwn(p,field)){
   if(!Array.isArray(p[field]))fail("malformed_"+field);
   unique(p[field],"badge",field+"_member");p[field].forEach(r=>knownBadge(r.badge));
  }
  if(Object.hasOwn(p,"poll")){if(!Array.isArray(p.poll))fail("malformed_poll");for(const option of p.poll){if(!obj(option)||!Array.isArray(option.votes))fail("malformed_poll");const ids=new Set();for(const b of option.votes){knownBadge(b);if(ids.has(b))fail("duplicate_poll_member");ids.add(b);}}}
 }
 for(const g of groups){if(!Array.isArray(g.members))fail("malformed_group_members");const ids=new Set();for(const b of g.members){knownBadge(b);if(ids.has(b))fail("duplicate_group_member");ids.add(b);}}
 for(const f of ["notifications.json","announcements.json","join-requests.json"])unique(values[f],"id",f.replace(".json","")+"_identifier");
 const dates=new Set(["createdAt","changedAt","lastSeen","expiresAt","exp","at"]);
 function datesWalk(v){
  if(!v||typeof v!=="object")return;
  for(const [k,x]of Object.entries(v)){if(dates.has(k)&&typeof x==="string"&&x&& !Number.isFinite(Date.parse(x)))fail("invalid_timestamp");datesWalk(x);}
 }
 // Opaque files remain semantically uninterpreted.
 for(const f of files)if(!["mail.json","messages.json"].includes(f))datesWalk(values[f]);
 return {accountMembership:digest(Object.keys(accounts).sort()),employeeMembership:digest([...people].sort()),
  postMembership:digest([...postIds].sort()),stories:digest(posts.filter(p=>p.type==="story").map(p=>p.id).sort()),auth:digest(accounts)};
}
function references(values){
 const refs=[];function scan(v,file,segments){
  if(typeof v==="string"&&v.startsWith("/media/")){
   if(!/^\/media\/[A-Za-z0-9_.-]+$/.test(v)||v.includes(".."))fail("unsafe_media_reference");
   refs.push({file,pointer:JSON.stringify(segments),legacy:v});return;
  }
  if(v&&typeof v==="object")for(const [k,x]of Object.entries(v))scan(x,file,[...segments,k]);
 }
 // Their JSON values are preserved, but their business/media semantics are
 // explicitly unknown; do not invent a reference schema for opaque files.
 for(const f of files)if(!["mail.json","messages.json"].includes(f))scan(values[f],f,[]);
 return refs;
}
function load(c){
 const manifestBytes=safeFile(path.join(c.source,"manifest.json"));
 if(hash(manifestBytes)!==c.meta.manifestSha)fail("source_manifest_changed");
 const manifest=parse(manifestBytes);
 if(manifest.sourceId!==c.meta.sourceId||manifest.kind!=="INVENTED_REL001_SOURCE"||manifest.generation!==1)fail("source_identity_mismatch");
 const inventory=walk(c.source).filter(n=>n!=="manifest.json");
 if(digest(inventory)!==digest(manifest.inventory.map(x=>x.path).sort()))fail("source_inventory_mismatch");
 const bytes=new Map(),values={};
 for(const row of manifest.inventory){
  const b=safeFile(path.join(c.source,row.path));
  if(b.length!==row.size||hash(b)!==row.sha256)fail("source_fingerprint_mismatch");
  bytes.set(row.path,b);
 }
 const expected=[...files.map(f=>"data/"+f),"custody/session.key","custody/backup.key","custody/reference-sessions.json"];
 if(expected.some(f=>!bytes.has(f))||inventory.some(f=>!expected.includes(f)&&!/^media\/[A-Za-z0-9_.-]+$/.test(f)))fail("unmapped_source_inventory");
 for(const f of files)values[f]=parse(bytes.get("data/"+f));
 if(hash(bytes.get("custody/session.key"))!==manifest.sessionKeySha||hash(bytes.get("custody/backup.key"))!==manifest.backupKeySha)fail("key_domain_mismatch");
 const identities=validate(values,{session:bytes.get("custody/session.key"),backup:bytes.get("custody/backup.key")},parse(bytes.get("custody/reference-sessions.json")));
 if(digest(identities)!==digest(manifest.identities))fail("source_membership_mismatch");
 const refs=references(values);
 for(const ref of refs)if(!bytes.has(ref.legacy.slice(1)))fail("missing_media_object");
 return{manifest,bytes,values,identities,refs};
}
module.exports={files,validate,references,load,unseal};
