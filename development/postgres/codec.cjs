// Lossless relational compatibility codecs. No JSON file is a runtime authority.
// Each collection/relationship has its own table. Unknown scalar/extensions stay
// JSONB; known nested collections are removed and stored as FK-linked rows.
const object = (table, children={}) => ({table, kind:"object", children});
const array = (table, item) => ({table, kind:"array", item});
const map = (table, item) => ({table, kind:"map", item});
const scalar = table => ({table,kind:"value"});
const session=object("sessions"), account=object("accounts",{
  sessions:array("session_lists",session),
  devices:array("device_lists",scalar("devices")),
  pending:object("pending_credentials"),
  totp:object("two_factor",{recovery:array("recovery_lists",scalar("recovery_codes"))}),
  totpSetup:object("pending_two_factor"),
});
const comment=object("comments",{likes:array("comment_like_lists",scalar("comment_likes"))});
const post=object("posts",{
  comments:array("comment_lists",comment),
  ratings:array("rating_lists",object("ratings")),
  reposts:array("repost_lists",object("reposts")),
  poll:array("poll_lists",object("poll_options",{votes:array("poll_vote_lists",scalar("poll_votes"))})),
  statusLog:array("status_lists",object("status_history")),
  reports:array("report_lists",object("reports")),
  acks:array("ack_lists",scalar("acknowledgements")),
  attendees:array("attendee_lists",scalar("event_attendees")),
  gallery:array("gallery_lists",scalar("gallery_entries")),
});
const specs={
  "accounts.json":map("account_root",account),
  "employees.json":array("employee_root",object("employees")),
  "ideas.json":array("post_root",post),
  "notifications.json":array("notification_root",object("notifications")),
  "bookmarks.json":map("bookmark_root",array("bookmark_lists",scalar("bookmarks"))),
  "views.json":map("view_root",array("view_lists",scalar("views"))),
  "follows.json":map("follow_root",object("follows",{
    people:array("person_follow_lists",scalar("person_follows")),
    departments:array("department_follow_lists",scalar("department_follows")),
  })),
  "profiles.json":map("profile_root",object("profiles")),
  "groups.json":array("group_root",object("groups",{members:array("member_lists",scalar("group_members"))})),
  "daily-sparks.json":object("spark_settings",{items:map("spark_items",object("sparks"))}),
  "dept-profiles.json":map("department_root",object("departments",{achievements:array("achievement_lists",object("achievements"))})),
  "announcements.json":array("announcement_root",object("announcements")),
  "announce-seen.json":map("seen_root",array("seen_lists",scalar("announcement_seen"))),
  "highlights.json":map("highlight_root",array("highlight_lists",object("highlights",{
    items:array("highlight_item_lists",object("highlight_items")),
  }))),
  "moderators.json":object("moderator_settings",{badges:array("moderator_lists",scalar("moderator_grants"))}),
  "security.json":object("security_settings",{
    admins:array("admin_lists",scalar("admin_grants")),
    adminAccount:object("admin_identity"),announcer:object("announcer_identity"),
    emailDomains:array("email_domain_lists",scalar("email_domains")),
  }),
  "security-log.json":object("audit_settings",{rows:array("audit_lists",object("security_audit"))}),
  "sms.json":object("sms_settings"),"smtp.json":object("smtp_settings"),
  "backup-status.json":object("backup_status"),
  // Intentionally opaque: no inference about contents/provenance.
  "mail.json":scalar("opaque_mail"),"messages.json":scalar("opaque_messages"),
  "conduct.json":object("conduct_settings",{
    warnings:array("warning_lists",object("warnings")),bans:map("ban_root",object("bans")),resets:map("reset_root",scalar("warning_resets")),
  }),
  "join-requests.json":array("join_root",object("join_requests")),
  "push-keys.json":object("push_keys"),
  "push-subs.json":map("push_root",array("push_lists",object("push_subscriptions"))),
  "backup.json":object("backup_settings"),"vault-status.json":object("vault_status"),
};
const tables=new Map();
function visit(spec,parent=null) {
  if(tables.has(spec.table)) throw Error("Duplicate codec table");
  tables.set(spec.table,{...spec,parent});
  if(spec.item)visit(spec.item,spec.table);
  for(const child of Object.values(spec.children||{}))visit(child,spec.table);
}
for(const spec of Object.values(specs))visit(spec);
const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
function encode(file,input) {
  const root=specs[file];if(!root)throw Error("unmapped_entity");
  const result=[];
  function node(spec,value,parent,key,ordinal,segments) {
    const id=JSON.stringify([file,...segments]), shape={kind:"opaque"};
    let attrs=structuredClone(value);
    const add=()=>result.push({table:spec.table,id,parent,entry_key:key,ordinal,attrs,shape});
    if(spec.kind==="map"&&isObject(value)) {
      shape.kind="map";attrs=null;add();
      Object.entries(value).forEach(([key,value],ordinal)=>node(spec.item,value,id,key,ordinal,[...segments,key]));
    } else if(spec.kind==="array"&&Array.isArray(value)) {
      shape.kind="array";attrs=null;add();
      value.forEach((value,ordinal)=>node(spec.item,value,id,null,ordinal,[...segments,ordinal]));
    } else if(spec.kind==="object"&&isObject(value)) {
      shape.kind="object";shape.children=[];attrs={...value};
      for(const key of Object.keys(spec.children))if(Object.hasOwn(value,key)){
        delete attrs[key];shape.children.push(key);
      }
      add();
      shape.children.forEach((key,ordinal)=>node(spec.children[key],value[key],id,key,ordinal,[...segments,key]));
    } else add(); // Explicit nulls/unknown legacy shapes are never normalized away.
  }
  node(root,input,null,null,0,[]);
  return result;
}
function decode(file,records) {
  if(!specs[file])throw Error("unmapped_entity");
  const grouped=new Map();
  for(const row of records){const key=`${row.table}:${row.parent||""}`;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row);}
  const children=(spec,parent)=>(grouped.get(`${spec.table}:${parent||""}`)||[]).sort((a,b)=>a.ordinal-b.ordinal);
  function node(spec,row) {
    if(row.shape.kind==="map") {
      const value={};for(const child of children(spec.item,row.id))Object.defineProperty(value,child.entry_key,{value:node(spec.item,child),enumerable:true,writable:true,configurable:true});
      return value;
    }
    if(row.shape.kind==="array")return children(spec.item,row.id).map(r=>node(spec.item,r));
    if(row.shape.kind==="object") {
      const value=structuredClone(row.attrs);
      for(const key of row.shape.children){const child=children(spec.children[key],row.id)[0];if(!child)throw Error("incomplete_relation");value[key]=node(spec.children[key],child);}
      return value;
    }
    return structuredClone(row.attrs);
  }
  const roots=children(specs[file],null);if(roots.length!==1)throw Error("incomplete_entity");
  return node(specs[file],roots[0]);
}
function ddl() {
  const statements=[`CREATE SCHEMA dev;
    CREATE TABLE dev.authority(singleton boolean PRIMARY KEY CHECK(singleton),dataset_id text NOT NULL,seal text NOT NULL,epoch bigint NOT NULL CHECK(epoch>0),mode text NOT NULL CHECK(mode IN('synthetic','frozen')));
    CREATE TABLE dev.files(name text PRIMARY KEY,revision bigint NOT NULL DEFAULT 1 CHECK(revision>0));
    CREATE TABLE dev.runtime_state(name text PRIMARY KEY,value jsonb NOT NULL);
    CREATE TABLE dev.requests(actor text NOT NULL,request_key text NOT NULL,digest text NOT NULL,status integer NOT NULL,headers jsonb NOT NULL,body bytea NOT NULL,PRIMARY KEY(actor,request_key));
    CREATE TABLE dev.outbox(id uuid PRIMARY KEY,topic text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),delivered_at timestamptz,attempts int NOT NULL DEFAULT 0,fixture_receipt jsonb);
    CREATE INDEX outbox_pending ON dev.outbox(created_at) WHERE delivered_at IS NULL;
    CREATE TABLE dev.media(id uuid PRIMARY KEY,legacy_path text UNIQUE NOT NULL,object_key text UNIQUE NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),size bigint NOT NULL CHECK(size>=0),mime text NOT NULL,owner text NOT NULL,state text NOT NULL CHECK(state IN('pending','ready','retained')),revision bigint NOT NULL DEFAULT 1);
    CREATE TABLE dev.media_links(source_file text NOT NULL,source_path text NOT NULL,legacy_path text NOT NULL REFERENCES dev.media(legacy_path),PRIMARY KEY(source_file,source_path));
    CREATE TABLE dev.backups(id uuid PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),ciphertext bytea NOT NULL,manifest jsonb NOT NULL);`];
  statements.push("CREATE TABLE dev.test_faults(request_key text PRIMARY KEY,point text NOT NULL CHECK(point IN('before_commit','after_commit_drop')));");
  for(const [table,s] of tables) {
    statements.push(`CREATE TABLE dev.${table}(id text PRIMARY KEY,file_name text NOT NULL REFERENCES dev.files(name) ON DELETE CASCADE,parent text ${s.parent?`REFERENCES dev.${s.parent}(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED`:""},entry_key text,ordinal int NOT NULL CHECK(ordinal>=0),attrs jsonb NOT NULL,shape jsonb NOT NULL); CREATE INDEX ${table}_file ON dev.${table}(file_name); CREATE INDEX ${table}_parent ON dev.${table}(parent,ordinal);`);
  }
  for(const table of ["posts","comments","groups","notifications","join_requests"]) {
    statements.push(`ALTER TABLE dev.${table} ADD COLUMN external_id text GENERATED ALWAYS AS(attrs->>'id') STORED;CREATE UNIQUE INDEX ${table}_external ON dev.${table}(file_name,external_id) WHERE external_id IS NOT NULL;`);
  }
  statements.push(`CREATE UNIQUE INDEX employee_badge ON dev.employees((attrs->>'badge')) WHERE attrs->>'badge' IS NOT NULL;
    CREATE UNIQUE INDEX account_badge ON dev.accounts(entry_key);
    ALTER TABLE dev.accounts ADD CONSTRAINT account_version CHECK(NOT(attrs ? 'ver') OR attrs->>'ver' IS NULL OR (attrs->>'ver')::bigint>=1);
    ALTER TABLE dev.posts ADD CONSTRAINT post_type CHECK(NOT(attrs ? 'type') OR attrs->>'type' IN('post','idea','suggestion','complaint','thanks','story','poll','article','announcement','event'));
    CREATE UNIQUE INDEX session_sid ON dev.sessions(parent,(attrs->>'sid')) WHERE attrs->>'sid' IS NOT NULL;
    CREATE UNIQUE INDEX unique_rating ON dev.ratings(parent,(attrs->>'badge')) WHERE attrs->>'badge' IS NOT NULL;
    CREATE UNIQUE INDEX unique_repost ON dev.reposts(parent,(attrs->>'badge')) WHERE attrs->>'badge' IS NOT NULL;`);
  return statements.join("\n");
}
module.exports={specs,tables,encode,decode,ddl};
