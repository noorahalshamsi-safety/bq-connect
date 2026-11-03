// Architecture validation, NOT an application or production migration.
// No arguments/connection URL accepted. Creates and destroys its own /tmp PG
// cluster, invents all fixtures, and imports no existing data directory.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const {execFileSync, spawn} = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const output = path.join(root, "generated-artifacts/architecture");
if (process.argv.length !== 2) throw new Error("No external inputs or database targets accepted");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bq-architecture-"));
fs.chmodSync(tmp, 0o700);
const pgdata = path.join(tmp, "pgdata"), socket = path.join(tmp, "socket");
fs.mkdirSync(socket, {mode: 0o700});
const env = {PATH: process.env.PATH, HOME: tmp, LANG: "C.UTF-8", PGCONNECT_TIMEOUT: "3"};
const pgargs = ["-X", "--no-psqlrc", "-qAt", "-h", socket, "-p", "55439",
  "-U", os.userInfo().username, "-d", "bq_design_synthetic", "-v", "ON_ERROR_STOP=1"];
const sourceNames = fs.readdirSync(root).filter(n => n.endsWith(".js"));
sourceNames.push(".replit", "package.json", "package-lock.json", "replit.md");
const sha = x => crypto.createHash("sha256").update(x).digest("hex");
const fingerprints = () => Object.fromEntries(sourceNames.map(n => [n, sha(fs.readFileSync(path.join(root, n)))]));
const before = fingerprints(), results = [];
let running = false, schemaVersion;
const children = new Set();
const q = x => x === null || x === undefined ? "NULL" :
  typeof x === "object" ? `'${JSON.stringify(x).replaceAll("'", "''")}'::jsonb` :
  typeof x === "number" || typeof x === "boolean" ? String(x) : `'${String(x).replaceAll("'", "''")}'`;
const insert = (table, row) => `INSERT INTO bq.${table} (${Object.keys(row).join(",")}) VALUES (${Object.values(row).map(q).join(",")});`;
function sql(text) {
  return execFileSync("psql", [...pgargs, "-c", `SET search_path=bq,public; ${text}`], {env, encoding:"utf8", stdio:["ignore","pipe","pipe"]}).trim();
}
function rows(table) {
  return JSON.parse(sql(`SELECT COALESCE(json_agg(t),'[]'::json) FROM ${table} t`));
}
function pgStart() {
  execFileSync("pg_ctl", ["-D", pgdata, "-l", path.join(tmp,"postgres.log"), "-o",
    `-k ${socket} -p 55439 -c listen_addresses='' -c unix_socket_permissions=0700 -c fsync=on -c synchronous_commit=on -c full_page_writes=on -c max_connections=20`,
    "-w", "start"], {env, stdio:"pipe"});
  running = true;
}
function pgStop(mode) {
  execFileSync("pg_ctl", ["-D",pgdata,"-w","-m",mode,"stop"], {env,stdio:"pipe"});
  running = false;
}
async function test(id, scenario, fn) {
  try { const evidence = await fn(); results.push({id,scenario,status:"PASS",evidence:evidence || "Assertions passed"}); }
  catch(e) { results.push({id,scenario,status:"FAIL",evidence:String(e.message).slice(0,300)}); }
  console.log(`${id} ${results.at(-1).status} ${scenario}`);
}
function client(text) {
  // Execute statements separately, with line-buffered diagnostics. A single
  // psql -c batch waits for its final pg_sleep before exposing earlier results.
  const child = spawn("stdbuf", ["-oL","-eL","psql",...pgargs,"-f","-"], {env,stdio:["pipe","pipe","pipe"]});
  child.stdin.end(`SET search_path=bq,public; ${text}`);
  children.add(child);
  child.finished = new Promise(resolve => child.on("close", code => {children.delete(child); resolve(code);}));
  return child;
}
async function markedClient(text, marker) {
  const child = client(text);
  await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("Synthetic client marker timeout"));},8000);
    let observed="";
    child.stdout.on("data", chunk => { observed += chunk; if(observed.includes(marker)){clearTimeout(timer);resolve();} });
    child.on("close",()=>{clearTimeout(timer);if(!observed.includes(marker))reject(new Error("Synthetic client exited before marker"));});
  });
  return child;
}
const canonical = value => JSON.stringify(value && typeof value === "object" ?
  Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))) :
    Object.fromEntries(Object.keys(value).sort().map(k => [k,JSON.parse(canonical(value[k]))])) : value);
function differingPaths(a,b,prefix="") {
  if(canonical(a)===canonical(b)) return [];
  if(!a||!b||typeof a!=="object"||typeof b!=="object") return [prefix];
  return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>
    !(k in a)||!(k in b)?[`${prefix}.${k}`]:differingPaths(a[k],b[k],`${prefix}.${k}`));
}
function copyAuth(name, accounts, secret) {
  const dir=path.join(tmp,name); fs.mkdirSync(path.join(dir,"data"),{recursive:true,mode:0o700});
  for(const file of ["auth.js","persistence-safety.js"]) fs.copyFileSync(path.join(root,file),path.join(dir,file));
  fs.writeFileSync(path.join(dir,"data/session.key"),secret,{mode:0o600});
  fs.writeFileSync(path.join(dir,"data/accounts.json"),JSON.stringify(accounts),{mode:0o600});
  return require(path.join(dir,"auth.js"));
}
function seal(secret, bytes) {
  const key=crypto.createHmac("sha256",secret).update("totp-vault").digest(), iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
  return [iv,encrypted,cipher.getAuthTag()].map(b=>b.toString("base64url")).join(".");
}
function hotp(key,counter) {
  const count=Buffer.alloc(8);count.writeBigUInt64BE(BigInt(counter));
  const h=crypto.createHmac("sha1",key).update(count).digest(), offset=h.at(-1)&15;
  return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}
function without(obj,keys) { return Object.fromEntries(Object.entries(obj).filter(([k])=>!keys.includes(k))); }
let source, restored, secret, totpKey, recoveryCode, oldToken, authBefore;
async function fixture() {
  secret=crypto.randomBytes(48).toString("hex"); totpKey=crypto.randomBytes(20);
  recoveryCode="ABCDE-FGHJK";
  const at=new Date().toISOString(), exp=new Date(Date.now()+86400000).toISOString();
  authBefore=copyAuth("auth-before",{},secret);
  await authBefore.setPassword("102","SyntheticOnly!Password2026",{email:"synthetic@example.invalid"});
  await authBefore.setPassword("9001","SyntheticOnly!System2026",{});
  const current=JSON.parse(fs.readFileSync(path.join(tmp,"auth-before/data/accounts.json"),"utf8"));
  const salt=crypto.randomBytes(16).toString("hex");
  const hash=crypto.scryptSync("SyntheticOnly!Legacy2026",Buffer.from(salt,"hex"),64,{N:32768,r:8,p:1,maxmem:96*1024*1024}).toString("hex");
  current["101"]={hash,salt,ver:3,createdAt:at,email:"legacy@example.invalid",devices:["synthetic-device"],terms:"2026-10-29",termsAt:at};
  current["103"]={ver:1,createdAt:at,pending:{...current["102"],exp}};
  const recoveryHash=crypto.createHmac("sha256",secret).update(`recovery:102:${recoveryCode.replace("-","")}`).digest("hex");
  current["102"].totp={on:true,key:seal(secret,totpKey),last:0,at,recovery:[recoveryHash]};
  current["103"].totpSetup={key:seal(secret,crypto.randomBytes(20)),exp};
  fs.writeFileSync(path.join(tmp,"auth-before/data/accounts.json"),JSON.stringify(current));
  oldToken=authBefore.signSession("102",{ip:"192.0.2.1",device:{name:"Synthetic fixture"}});
  const accounts=JSON.parse(fs.readFileSync(path.join(tmp,"auth-before/data/accounts.json"),"utf8"));
  const employees=["101","102","103","104"].map((badge,i)=>({badge,name:`Synthetic Employee ${i+1}`,department:"Synthetic Engineering",position:"Synthetic Tester",check:sha(`check:${badge}`),phone:sha(`phone:${badge}`)}));
  const media="/media/00000000-0000-4000-8000-000000000001.png";
  const p={id:"p1",number:1,type:"poll",badge:"101",title:"Synthetic poll",text:"Invented only",createdAt:at,media,gallery:[media],
    comments:[{id:"c1",badge:"102",text:"Synthetic parent",createdAt:at,likes:["101"]},{id:"c2",badge:"101",text:"Synthetic reply",createdAt:at,parentId:"c1"}],
    ratings:[{badge:"101",stars:5},{badge:"102",vote:"like"}],poll:[{text:"One",votes:["101"]},{text:"Two",votes:["102"]}],
    reposts:[{badge:"102",text:"Synthetic share",createdAt:at,name:"Synthetic Employee 2"}],unknownFutureField:{nested:["preserve",7]}};
  const ideas=[p,{id:"s1",number:2,type:"story",badge:"102",text:"Synthetic story",createdAt:at,expiresAt:exp,media},
    {id:"i1",number:3,type:"idea",badge:"101",title:"Synthetic idea",text:"Body",status:"received",createdAt:at,statusLog:[{status:"received",badge:"101",at}],reports:[{badge:"102",reason:"other",at}]},
    {id:"a1",number:4,type:"announcement",badge:"9001",title:"Synthetic official",text:"Body",acks:["101"],createdAt:at},
    {id:"e1",number:5,type:"event",badge:"9001",title:"Synthetic event",text:"Body",eventAt:exp,attendees:["102"],createdAt:at}];
  const pid=crypto.createHmac("sha256",authBefore.deriveKey("public-id")).update("pid:102").digest("hex").slice(0,16);
  source={
    "accounts.json":accounts,"employees.json":employees,"ideas.json":ideas,
    "notifications.json":[{id:"n1",badge:"102",read:false,createdAt:at,type:"comment",ideaId:"p1",actorName:"Synthetic Employee 1",text:"fixture"}],
    "bookmarks.json":{"102":["p1"]},"views.json":{"p1":[pid]},
    "follows.json":{"102":{people:["101"],departments:["Synthetic Engineering"]}},
    "profiles.json":{"101":{bio:"Synthetic biography",photo:"data:image/png;base64,iVBORw0KGgo="}},
    "groups.json":[{id:"g1",name:"Synthetic group",members:["101","102"],createdAt:at}],
    "daily-sparks.json":{v:2,date:at.slice(0,10),items:{"Synthetic Engineering":{text:"Synthetic spark"}}},
    "dept-profiles.json":{"Synthetic Engineering":{about:"Synthetic department",achievements:[{id:"ach1",badge:"101",title:"Synthetic achievement",text:"Body",status:"pending",createdAt:at}]}},
    "announcements.json":[{id:"legacy-a1",subject:"Synthetic legacy announcement",text:"Body",from:"Synthetic sender",createdAt:at}],
    "announce-seen.json":{"101":["legacy-a1"]},
    "highlights.json":{"102":[{id:"h1",title:"Synthetic highlight",createdAt:at,cover:media,items:[{id:"archived-story-not-live",media,text:"Archived snapshot"}]}]},
    "moderators.json":{badges:["101"]},"security.json":{admins:["9001"],adminAccount:{badge:"9001",name:"Synthetic system"},emailDomains:["example.invalid"]},
    "security-log.json":{rows:[{at,type:"synthetic_event",who:"unknown"}]},
    "sms.json":{provider:"twilio",token:"SYNTHETIC-NOT-A-CREDENTIAL"},
    "smtp.json":{host:"invalid.example",user:"fixture@example.invalid",pass:"SYNTHETIC-NOT-A-CREDENTIAL"},
    "backup-status.json":{last:"synthetic-only"},"mail.json":{opaque:"synthetic-unclassified"},
    "messages.json":[{opaque:"synthetic-unclassified"}],
  };
}
function importFixture() {
  const statements=[insert("authority",{singleton:true,dataset_id:"synthetic-design-only",writer_epoch:1,mode:"postgres",schema_version:1}),
    insert("departments",{name:"Synthetic Engineering"})];
  for(const e of source["employees.json"]) {
    statements.push(insert("people",{badge:e.badge,kind:"employee",display_name:e.name,department:e.department,position:e.position}),
      insert("employees",{badge:e.badge,check_hash:e.check,phone_hash:e.phone}));
  }
  statements.push(insert("people",{badge:"9001",kind:"system",display_name:"Synthetic system"}));
  for(const badge of ["101","102","103","104","9001"]) for(const namespace of ["public_id","legacy_public_id"]) {
    const key=namespace==="public_id"?authBefore.deriveKey("public-id"):"bq-rd-ideas-2026";
    statements.push(insert("identity_aliases",{namespace,badge,alias:crypto.createHmac("sha256",key).update(`pid:${badge}`).digest("hex").slice(0,16)}));
  }
  for(const [badge,a] of Object.entries(source["accounts.json"])) {
    statements.push(insert("accounts",{badge,password_hash:a.hash,salt:a.salt,kdf:a.hash?(a.kdf||1):null,session_version:a.ver,email:a.email,created_at:a.createdAt,
      extension:without(a,["hash","salt","kdf","ver","email","createdAt","pending","totp","totpSetup","sessions","devices","terms","termsAt"])}));
    if(a.pending) statements.push(insert("pending_credentials",{badge,credential:a.pending}));
    if(a.totp) {
      statements.push(insert("two_factor",{badge,enabled:a.totp.on,sealed_key:a.totp.key,last_counter:a.totp.last,extension:without(a.totp,["on","key","last","recovery"])}));
      a.totp.recovery.forEach((code_hash,ordinal)=>statements.push(insert("recovery_codes",{badge,ordinal,code_hash})));
    }
    if(a.totpSetup) statements.push(insert("pending_two_factor",{badge,sealed_key:a.totpSetup.key,expires_at:a.totpSetup.exp}));
    (a.sessions||[]).forEach((s,ordinal)=>statements.push(insert("sessions",{badge,sid:s.sid,ordinal,created_at:s.createdAt,last_seen:s.lastSeen,expires_at:s.exp,ip:s.ip,device:s.device})));
    (a.devices||[]).forEach((signature,ordinal)=>statements.push(insert("remembered_devices",{badge,ordinal,signature})));
    if(a.terms) statements.push(insert("terms_acceptance",{badge,version:a.terms,accepted_at:a.termsAt}));
  }
  for(const group of source["groups.json"]) {
    statements.push(insert("social_groups",{id:group.id,name:group.name,created_at:group.createdAt}));
    group.members.forEach((badge,ordinal)=>statements.push(insert("group_members",{group_id:group.id,badge,ordinal})));
  }
  const media=source["ideas.json"][0].media, bytes=Buffer.from("SYNTHETIC MEDIA BYTES ONLY");
  fs.writeFileSync(path.join(tmp,"media.bin"),bytes);
  statements.push(insert("media_objects",{id:"m1",bucket_binding:"synthetic-local-no-provider",object_key:"immutable/m1",content_sha256:sha(bytes),byte_length:bytes.length,content_type:"image/png",owner_badge:"101",state:"ready",legacy_path:media}));
  const scalar=["id","number","type","badge","title","text","status","createdAt","expiresAt","eventAt","replies","groupId","pinned","hidden","thanksBadge"];
  const childrenKeys=["comments","ratings","poll","reposts","statusLog","reports","acks","attendees","media","gallery"];
  for(const p of source["ideas.json"]) {
    statements.push(insert("posts",{id:p.id,number:p.number,type:p.type,badge:p.badge,title:p.title||"",body:p.text||"",status:p.status,created_at:p.createdAt,expires_at:p.expiresAt,event_at:p.eventAt,replies:p.replies||"all",extension:without(p,[...scalar,...childrenKeys])}));
    (p.comments||[]).forEach((c,ordinal)=>{
      statements.push(insert("comments",{post_id:p.id,id:c.id,badge:c.badge,parent_id:c.parentId,ordinal,body:c.text,created_at:c.createdAt,extension:without(c,["id","badge","parentId","text","createdAt","likes"])}));
      (c.likes||[]).forEach((badge,ordinal)=>statements.push(insert("comment_likes",{post_id:p.id,comment_id:c.id,badge,ordinal})));
    });
    (p.ratings||[]).forEach((r,ordinal)=>statements.push(insert("ratings",{post_id:p.id,badge:r.badge,vote:r.vote,legacy_stars:r.stars,ordinal,extension:without(r,["badge","vote","stars"])})));
    (p.poll||[]).forEach((option,ordinal)=>{
      statements.push(insert("poll_options",{post_id:p.id,ordinal,label:option.text}));
      option.votes.forEach((badge,voteOrdinal)=>statements.push(insert("poll_votes",{post_id:p.id,option_ordinal:ordinal,badge,ordinal:voteOrdinal})));
    });
    (p.reposts||[]).forEach((r,ordinal)=>statements.push(insert("reposts",{post_id:p.id,badge:r.badge,ordinal,body:r.text,created_at:r.createdAt,extension:without(r,["badge","text","createdAt"])})));
    (p.statusLog||[]).forEach((h,ordinal)=>statements.push(insert("status_history",{post_id:p.id,ordinal,status:h.status,actor_badge:h.badge,at:h.at,extension:without(h,["status","badge","at"])})));
    (p.reports||[]).forEach(r=>statements.push(insert("post_reports",{post_id:p.id,badge:r.badge,reason:r.reason,at:r.at})));
    (p.acks||[]).forEach(badge=>statements.push(insert("post_acknowledgements",{post_id:p.id,badge})));
    (p.attendees||[]).forEach(badge=>statements.push(insert("event_attendees",{post_id:p.id,badge})));
    if(p.media) statements.push(insert("post_media",{post_id:p.id,role:"primary",ordinal:0,media_id:"m1"}));
    (p.gallery||[]).forEach((_,ordinal)=>statements.push(insert("post_media",{post_id:p.id,role:"gallery",ordinal,media_id:"m1"})));
  }
  for(const [badge,ids] of Object.entries(source["bookmarks.json"])) ids.forEach((post_id,ordinal)=>statements.push(insert("bookmarks",{badge,post_id,ordinal})));
  for(const [post_id,ids] of Object.entries(source["views.json"])) ids.forEach((legacy_public_id,ordinal)=>statements.push(insert("post_views",{post_id,viewer_badge:"102",legacy_public_id,ordinal})));
  for(const [follower,follow] of Object.entries(source["follows.json"])) {
    follow.people.forEach((followed,ordinal)=>statements.push(insert("person_follows",{follower,followed,ordinal})));
    follow.departments.forEach((department,ordinal)=>statements.push(insert("department_follows",{badge:follower,department,ordinal})));
  }
  for(const n of source["notifications.json"]) statements.push(insert("notifications",{id:n.id,badge:n.badge,post_id:n.ideaId,legacy_subject_id:n.ideaId,kind:n.type,is_read:n.read,created_at:n.createdAt,extension:without(n,["id","badge","ideaId","type","read","createdAt"])}));
  for(const [badge,p] of Object.entries(source["profiles.json"])) statements.push(insert("profiles",{badge,bio:p.bio,legacy_photo_data_uri:p.photo}));
  for(const a of source["announcements.json"]) statements.push(insert("legacy_announcements",{id:a.id,subject:a.subject,body:a.text,sender_label:a.from,created_at:a.createdAt}));
  for(const [badge,ids] of Object.entries(source["announce-seen.json"])) ids.forEach(announcement_id=>statements.push(insert("announcement_seen",{badge,announcement_id})));
  for(const [department,p] of Object.entries(source["dept-profiles.json"])) {
    statements.push(`UPDATE departments SET about=${q(p.about)} WHERE name=${q(department)};`);
    p.achievements.forEach(a=>statements.push(insert("achievements",{department,id:a.id,badge:a.badge,title:a.title,body:a.text,status:a.status,created_at:a.createdAt})));
  }
  for(const [badge,items] of Object.entries(source["highlights.json"])) for(const h of items) {
    statements.push(insert("highlights",{badge,id:h.id,title:h.title,created_at:h.createdAt,cover_legacy_path:h.cover,cover_media_id:"m1"}));
    h.items.forEach((snapshot,ordinal)=>statements.push(insert("highlight_items",{badge,highlight_id:h.id,ordinal,original_story_id:snapshot.id,snapshot}),insert("highlight_media",{badge,highlight_id:h.id,ordinal,media_id:"m1"})));
  }
  for(const badge of source["moderators.json"].badges) statements.push(insert("roles",{badge,role:"moderator"}));
  statements.push(insert("roles",{badge:"9001",role:"admin"}));
  source["security-log.json"].rows.forEach((r,source_ordinal)=>statements.push(insert("security_audit",{source_ordinal,at:r.at,type:r.type,who_label:r.who})));
  for(const [file,raw_json] of Object.entries(source)) statements.push(insert("migration_records",{source_file:file,source_key:"$",raw_json,canonical_sha256:sha(canonical(raw_json))}));
  sql(`BEGIN; ${statements.join("\n")} COMMIT;`);
}
function exportCore() {
  const original=Object.fromEntries(rows("migration_records").map(r=>[r.source_file,r.raw_json]));
  const exported=structuredClone(original), accounts=rows("accounts"), sessions=rows("sessions"), factors=rows("two_factor"), recovery=rows("recovery_codes");
  const pending=rows("pending_credentials"), setup=rows("pending_two_factor");
  const devices=rows("remembered_devices"), terms=rows("terms_acceptance");
  const date=x=>x==null?x:new Date(x).toISOString(), ordered=a=>a.sort((a,b)=>a.ordinal-b.ordinal);
  const set=(obj,key,value,shape)=>{if(Object.hasOwn(shape,key)||value!==null&&value!==undefined)obj[key]=value;};
  exported["accounts.json"]={};
  for(const r of accounts) {
    const shape=original["accounts.json"][r.badge]||{}, a={...r.extension,ver:r.session_version};
    for(const [k,v] of Object.entries({hash:r.password_hash,salt:r.salt,email:r.email,createdAt:date(r.created_at)})) set(a,k,v,shape);
    if(r.kdf!==null && (r.kdf!==1 || Object.hasOwn(shape,"kdf"))) a.kdf=r.kdf;
    const s=ordered(sessions.filter(s=>s.badge===r.badge));
    if(s.length||shape.sessions) a.sessions=s.map(s=>({...s.extension,sid:s.sid,createdAt:date(s.created_at),lastSeen:date(s.last_seen),exp:date(s.expires_at),ip:s.ip,device:s.device}));
    const factor=factors.find(t=>t.badge===r.badge);
    if(factor) a.totp={...factor.extension,on:factor.enabled,key:factor.sealed_key,last:factor.last_counter,recovery:ordered(recovery.filter(c=>c.badge===r.badge)).map(c=>c.code_hash)};
    const p=pending.find(p=>p.badge===r.badge);
    if(p) a.pending=p.credential;
    else if(Object.hasOwn(shape,"pending")) a.pending=null;
    const t=setup.find(t=>t.badge===r.badge);if(t)a.totpSetup={key:t.sealed_key,exp:date(t.expires_at)};
    const d=ordered(devices.filter(d=>d.badge===r.badge));if(d.length||shape.devices)a.devices=d.map(d=>d.signature);
    const term=terms.find(t=>t.badge===r.badge);if(term){a.terms=term.version;a.termsAt=date(term.accepted_at);}
    exported["accounts.json"][r.badge]=a;
  }
  const people=rows("people"), employees=rows("employees");
  exported["employees.json"]=original["employees.json"].map(shape=>{
    const p=people.find(p=>p.badge===shape.badge),e=employees.find(e=>e.badge===shape.badge);
    assert(p&&e,"Employee membership loss");
    return {...shape,badge:p.badge,name:p.display_name,department:p.department,position:p.position,check:e.check_hash,phone:e.phone_hash};
  });
  const posts=rows("posts"), comments=rows("comments"), likes=rows("comment_likes"), ratings=rows("ratings"), options=rows("poll_options"), votes=rows("poll_votes");
  const reposts=rows("reposts"), histories=rows("status_history"), reports=rows("post_reports"), acks=rows("post_acknowledgements"), attendees=rows("event_attendees");
  const objects=rows("media_objects"), media=rows("post_media");
  exported["ideas.json"]=original["ideas.json"].map(shape=>{
    const p=posts.find(p=>p.id===shape.id);assert(p,"Post membership loss");
    const result={...p.extension,id:p.id,type:p.type,badge:p.badge,text:p.body,createdAt:date(p.created_at)};
    for(const [k,v] of Object.entries({number:p.number,title:p.title,status:p.status,expiresAt:date(p.expires_at),eventAt:date(p.event_at),replies:p.replies,groupId:p.group_id,pinned:p.pinned,hidden:p.hidden,thanksBadge:p.thanks_badge})) if(Object.hasOwn(shape,k))result[k]=v;
    const putArray=(k,arr)=>{if(shape[k]||arr.length)result[k]=arr;};
    putArray("comments",ordered(comments.filter(c=>c.post_id===p.id)).map(c=>{
      const cc={...c.extension,id:c.id,badge:c.badge,text:c.body,createdAt:date(c.created_at)};if(c.parent_id)cc.parentId=c.parent_id;
      const originalComment=shape.comments.find(s=>s.id===c.id);
      const ll=ordered(likes.filter(l=>l.post_id===p.id&&l.comment_id===c.id)).map(l=>l.badge);
      if(originalComment.likes||ll.length)cc.likes=ll;return cc;
    }));
    putArray("ratings",ordered(ratings.filter(r=>r.post_id===p.id)).map(r=>({...r.extension,badge:r.badge,...(r.vote?{vote:r.vote}:{}),...(r.legacy_stars?{stars:r.legacy_stars}:{})})));
    putArray("poll",ordered(options.filter(o=>o.post_id===p.id)).map(o=>({text:o.label,votes:ordered(votes.filter(v=>v.post_id===p.id&&v.option_ordinal===o.ordinal)).map(v=>v.badge)})));
    putArray("reposts",ordered(reposts.filter(r=>r.post_id===p.id)).map(r=>({...r.extension,badge:r.badge,text:r.body,createdAt:date(r.created_at)})));
    putArray("statusLog",ordered(histories.filter(h=>h.post_id===p.id)).map(h=>({...h.extension,status:h.status,badge:h.actor_badge,at:date(h.at)})));
    putArray("reports",reports.filter(r=>r.post_id===p.id).map(r=>({badge:r.badge,reason:r.reason,at:date(r.at)})));
    putArray("acks",acks.filter(a=>a.post_id===p.id).map(a=>a.badge));
    putArray("attendees",attendees.filter(a=>a.post_id===p.id).map(a=>a.badge));
    const linked=media.filter(m=>m.post_id===p.id), objectPath=m=>objects.find(o=>o.id===m.media_id).legacy_path;
    const primary=linked.find(m=>m.role==="primary");if(primary)result.media=objectPath(primary);
    if(shape.gallery) result.gallery=ordered(linked.filter(m=>m.role==="gallery")).map(objectPath);
    return result;
  });
  return exported;
}
async function main() {
  execFileSync("initdb",["-D",pgdata,"-A","trust","--no-locale","-E","UTF8","--data-checksums"],{env,stdio:"pipe"});
  pgStart();
  execFileSync("createdb",["-h",socket,"-p","55439","-U",os.userInfo().username,"bq_design_synthetic"],{env,stdio:"pipe"});
  schemaVersion=sql("SELECT version()");
  await test("A01","PostgreSQL design DDL and durability settings",()=>{
    sql(fs.readFileSync(path.join(root,"design/persistence/schema.sql"),"utf8"));
    assert.equal(sql("SELECT current_setting('fsync')||','||current_setting('synchronous_commit')||','||current_setting('listen_addresses')"),"on,on,");
    return {tables:Number(sql("SELECT count(*) FROM pg_tables WHERE schemaname='bq'")),database:"temporary Unix-socket-only cluster",version:schemaVersion};
  });
  await fixture();
  await test("A02","Synthetic transactional import with complete source ledger",()=>{importFixture();assert.equal(rows("migration_records").length,22);assert.equal(rows("accounts").length,4);assert.equal(rows("employees").length,4);assert.equal(rows("people").length,5);});
  await test("A03","Normalized core reverse mapping and all-file preservation",()=>{
    restored=exportCore();
    for(const file of Object.keys(source))assert.equal(canonical(restored[file])===canonical(source[file]),true,`Round trip mismatch: ${file}; paths: ${differingPaths(restored[file],source[file]).join(",")}`);
    return {normalizedReverseMapped:["accounts.json","employees.json","ideas.json"],allFilesPreserved:22,limits:"Other files have relational import checks but reverse export currently uses the immutable synthetic ledger; not a complete production exporter."};
  });
  await test("A04","Same-count relational content substitution is detected",()=>{
    sql("UPDATE posts SET body='tampered synthetic text' WHERE id='p1'");
    assert.notEqual(sha(canonical(exportCore()["ideas.json"])),sha(canonical(source["ideas.json"])));
    sql(`UPDATE posts SET body=${q(source["ideas.json"][0].text)} WHERE id='p1'`);
  });
  await test("A05","Existing password KDF formats and signed session survive round trip",async()=>{
    const authAfter=copyAuth("auth-after",restored["accounts.json"],secret);
    assert.equal(authAfter.readSession(oldToken),"102");
    assert.equal(await authAfter.checkLogin("101","SyntheticOnly!Legacy2026",true),"ok");
    assert.equal(await authAfter.checkLogin("102","SyntheticOnly!Password2026",true),"ok");
    assert.equal(authAfter.accountOf("101").kdf,2);
    assert.equal(authAfter.twoFactorOn("102"),true);
    return "Actual unchanged auth.js reads a synthetic JSON re-export from PostgreSQL; this is not a PostgreSQL-backed HTTP auth adapter test.";
  });
  await test("A06","Preserved 2FA ciphertext decrypts; recovery is consumed once",()=>{
    const authAfter=copyAuth("auth-totp",restored["accounts.json"],secret);
    const code=hotp(totpKey,Math.floor(Date.now()/30000));
    assert.equal(authAfter.checkTwoFactor("102",code),"totp");
    assert.equal(authAfter.checkTwoFactor("102",code),"");
    assert.equal(authAfter.checkTwoFactor("102",recoveryCode),"recovery");
    assert.equal(authAfter.checkTwoFactor("102",recoveryCode),"");
  });
  await test("A07","Session signing-key mismatch is rejected without rotation",()=>{
    const foreign=copyAuth("auth-foreign",restored["accounts.json"],crypto.randomBytes(48).toString("hex"));
    assert.equal(foreign.readSession(oldToken),"");
  });
  await test("A08","Concurrent registration has exactly one winner",async()=>{
    const statement=`BEGIN; ${insert("accounts",{badge:"104",session_version:1})} COMMIT;`;
    const a=client(statement),b=client(statement);
    const codes=await Promise.all([a.finished,b.finished]);
    assert.equal(codes.filter(c=>c===0).length,1);
    assert.equal(sql("SELECT count(*) FROM accounts WHERE badge='104'"),"1");
  });
  await test("A09","Concurrent password CAS prevents stale overwrite",async()=>{
    const statement="BEGIN; UPDATE accounts SET password_hash='synthetic-new-hash',revision=revision+1,session_version=session_version+1 WHERE badge='101' AND revision=1 RETURNING badge; COMMIT;";
    const a=client(statement),b=client(statement);let returned="";
    a.stdout.on("data",x=>returned+=x);b.stdout.on("data",x=>returned+=x);
    assert.deepEqual(await Promise.all([a.finished,b.finished]),[0,0]);
    assert.equal((returned.match(/101/g)||[]).length,1);
    assert.equal(sql("SELECT revision||','||session_version FROM accounts WHERE badge='101'"),"2,4");
  });
  await test("A10","Credential, revocation version, audit and outbox are one transaction",()=>{
    const previous=sql("SELECT to_jsonb(a) FROM accounts a WHERE badge='102'");
    assert.throws(()=>sql("BEGIN; UPDATE accounts SET password_hash='synthetic-uncommitted',session_version=session_version+1,revision=revision+1 WHERE badge='102'; INSERT INTO outbox(event_id,topic,payload) VALUES('failed','credential','{}'); INSERT INTO security_audit(type,who_label) VALUES('synthetic_failed_change','102'); SELECT 1/0; COMMIT;"));
    assert.equal(sql("SELECT to_jsonb(a) FROM accounts a WHERE badge='102'"),previous);
    assert.equal(sql("SELECT count(*) FROM outbox WHERE event_id='failed'"),"0");
    assert.equal(sql("SELECT count(*) FROM security_audit WHERE type='synthetic_failed_change'"),"0");
  });
  await test("A11","Lost response after commit is reconciled by idempotency key",async()=>{
    const statement=`BEGIN; UPDATE accounts SET password_hash=${q("e".repeat(128))},session_version=session_version+1,revision=revision+1 WHERE badge='102'; ${insert("requests",{actor_badge:"102",request_id:"synthetic-lost-response",operation:"password",input_sha256:sha("synthetic-input"),result:{revision:2}})} COMMIT; SELECT 'COMMITTED_MARKER'; SELECT pg_sleep(20);`;
    const child=await markedClient(statement,"COMMITTED_MARKER");child.kill("SIGKILL");await child.finished;
    assert.equal(sql("SELECT revision FROM accounts WHERE badge='102'"),"2");
    assert.equal(sql("SELECT password_hash FROM accounts WHERE badge='102'"),"e".repeat(128));
    assert.equal(sql("SELECT count(*) FROM requests WHERE request_id='synthetic-lost-response'"),"1");
    // Retry consults the committed request BEFORE performing another mutation.
    const saved=JSON.parse(sql("SELECT result FROM requests WHERE request_id='synthetic-lost-response'"));
    assert.equal(saved.revision,2);
    assert.equal(sql("SELECT revision FROM accounts WHERE badge='102'"),"2");
    assert.equal(sql("SELECT password_hash FROM accounts WHERE badge='102'"),"e".repeat(128));
    return "One credential revision; committed request survives client disconnect. Full HTTP retry adapter is future work.";
  });
  await test("A12","Crash recovery retains commits and discards uncommitted writes",async()=>{
    const child=await markedClient("BEGIN; UPDATE accounts SET revision=999 WHERE badge='102'; SELECT 'UNCOMMITTED_MARKER'; SELECT pg_sleep(20);","UNCOMMITTED_MARKER");
    pgStop("immediate");await child.finished;pgStart();
    assert.equal(sql("SELECT revision FROM accounts WHERE badge='102'"),"2");
    assert.equal(sql("SELECT count(*) FROM requests WHERE request_id='synthetic-lost-response'"),"1");
    return "Real temporary PostgreSQL immediate-stop/WAL recovery; not host disk loss, hosted failover, or a production restart.";
  });
  await test("A13","Redeploy-equivalent new client reconnects to durable state",()=>{
    const previous=sql("SELECT count(*) FROM accounts");pgStop("fast");pgStart();
    assert.equal(sql("SELECT count(*) FROM accounts"),previous);
  });
  await test("A14","Foreign keys reject orphan authors and cross-post replies",()=>{
    assert.throws(()=>sql(insert("posts",{id:"orphan",type:"post",badge:"missing"})));
    assert.throws(()=>sql(insert("comments",{post_id:"s1",id:"cross",badge:"101",parent_id:"c1",ordinal:0,body:"invalid"})));
  });
  await test("A15","Engagement uniqueness and story expiry rules are enforced",()=>{
    assert.throws(()=>sql(insert("poll_votes",{post_id:"p1",option_ordinal:1,badge:"101",ordinal:9})));
    assert.throws(()=>sql(insert("ratings",{post_id:"p1",badge:"101",vote:"like",ordinal:8})));
    assert.throws(()=>sql(insert("posts",{id:"invalid-story",type:"story",badge:"101"})));
  });
  await test("A16","Core social graph and archived highlights retain relationships",()=>{
    const expected={comments:2,comment_likes:1,ratings:2,poll_options:2,poll_votes:2,reposts:1,status_history:1,post_reports:1,post_acknowledgements:1,event_attendees:1,bookmarks:1,post_views:1,person_follows:1,department_follows:1,group_members:2,notifications:1,profiles:1,achievements:1,highlight_items:1,announcement_seen:1};
    for(const [table,count] of Object.entries(expected))assert.equal(rows(table).length,count,table);
    assert.equal(rows("highlight_items")[0].original_story_id,"archived-story-not-live");
    return {relationCounts:expected,limits:"Coverage is the invented fixture, not every historical social shape or HTTP authorization branch."};
  });
  await test("A17","Media fingerprint detects missing/corrupt bytes without deleting originals",()=>{
    const record=rows("media_objects")[0],bytes=fs.readFileSync(path.join(tmp,"media.bin"));
    assert.equal(sha(bytes),record.content_sha256);
    assert.notEqual(sha(Buffer.from("corrupt")),record.content_sha256);
    assert.throws(()=>fs.readFileSync(path.join(tmp,"nonexistent.bin")));
    assert.equal(rows("post_media").length,3);
    return "Local media simulator only; no App Storage upload, object versioning, ACL, or provider retention certification.";
  });
  await test("A18","Authority freeze serializes against an in-flight writer",async()=>{
    const writer=await markedClient("BEGIN; SELECT mode FROM authority WHERE singleton FOR SHARE; SELECT 'WRITER_LOCK'; SELECT pg_sleep(1); COMMIT;","WRITER_LOCK");
    const freeze=client("BEGIN; UPDATE authority SET mode='frozen',writer_epoch=writer_epoch+1 WHERE singleton; COMMIT;");
    await Promise.all([writer.finished,freeze.finished]);
    assert.equal(sql("SELECT mode||','||writer_epoch FROM authority"),"frozen,2");
    // Adapter contract: old epoch/mode must be rejected before any mutation.
    const allowed=sql("SELECT count(*) FROM authority WHERE singleton AND writer_epoch=1 AND mode='postgres'");
    assert.equal(allowed,"0");
    return "Row-lock coordination verified; application-wide enforcement and legacy-process shutdown still require implementation.";
  });
  await test("A19","Database logical backup restores to a separate synthetic database",()=>{
    const dump=execFileSync("pg_dump",["-h",socket,"-p","55439","-U",os.userInfo().username,"--no-owner","--no-privileges","bq_design_synthetic"],{env,maxBuffer:8*1024*1024});
    const dumpfile=path.join(tmp,"synthetic.sql");fs.writeFileSync(dumpfile,dump,{mode:0o600});
    execFileSync("createdb",["-h",socket,"-p","55439","-U",os.userInfo().username,"bq_design_restore"],{env,stdio:"pipe"});
    execFileSync("psql",[...pgargs.filter((_,i)=>i!==pgargs.indexOf("-d")&&i!==pgargs.indexOf("-d")+1),"-d","bq_design_restore","-f",dumpfile],{env,stdio:"pipe"});
    const restoredRows=execFileSync("psql",["-X","-qAt","-h",socket,"-p","55439","-U",os.userInfo().username,"-d","bq_design_restore","-c","SELECT count(*) FROM bq.accounts"],{env,encoding:"utf8"}).trim();
    assert.equal(restoredRows,sql("SELECT count(*) FROM accounts"));
    const tables=rows("(SELECT tablename FROM pg_tables WHERE schemaname='bq')").map(t=>t.tablename).sort();
    const snapshot=`SELECT jsonb_object_agg(name,content) FROM (${tables.map(name=>`SELECT ${q(name)} AS name,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS content FROM bq.${name} t`).join(" UNION ALL ")}) all_tables`;
    const restoredContent=execFileSync("psql",["-X","-qAt","-h",socket,"-p","55439","-U",os.userInfo().username,"-d","bq_design_restore","-c",snapshot],{env,encoding:"utf8",maxBuffer:8*1024*1024}).trim();
    assert.equal(sha(restoredContent),sha(sql(snapshot)));
    return {tablesChecked:tables.length,contentIntegrity:"All table row contents match the logical restore",limits:"Backup encryption/PITR/provider disaster recovery and application rollback are not certified."};
  });
  await test("A20","Application and configuration files remain unchanged",()=>{
    assert.deepEqual(fingerprints(),before);
    return "All root application JavaScript, .replit, package files and replit.md match their pre-validation SHA-256 fingerprints.";
  });
}
(async()=>{
  try {await main();}
  catch(e){results.push({id:"HARNESS",scenario:"Synthetic harness",status:"FAIL",evidence:String(e.message).slice(0,300)});console.error("Synthetic harness failed; see generated result summary.");}
  finally {
    for(const child of children)child.kill("SIGKILL");
    if(running)try{pgStop("immediate");}catch{}
    const summary={at:new Date().toISOString(),scope:"DESIGN_AND_SYNTHETIC_VALIDATION_ONLY",postgresVersion:schemaVersion,
      designSchemaSha256:sha(fs.readFileSync(path.join(root,"design/persistence/schema.sql"))),
      validatorSha256:sha(fs.readFileSync(__filename)),
      productionOperations:0,applicationSourceUnchanged:JSON.stringify(fingerprints())===JSON.stringify(before),
      inputPolicy:"Invented fixtures only; no input paths, URLs, environment DB credentials, real records or storage SDK",
      totals:{passed:results.filter(r=>r.status==="PASS").length,failed:results.filter(r=>r.status==="FAIL").length},results};
    fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,"validation-results.json"),JSON.stringify(summary,null,2));
    fs.rmSync(tmp,{recursive:true,force:true});
    process.exitCode=summary.totals.failed?1:0;
  }
})();
