const {Pool}=require("pg");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const codec=require("./codec.cjs");
const {vault}=require("./sealed.cjs");
const hash=value=>crypto.createHash("sha256").update(value).digest("hex");
function receipt(proof,state,exclusive=false) {
  const fd=fs.openSync(path.join(proof.root,"provision-receipt.json"),exclusive?"wx":"w",0o600);
  try{fs.writeFileSync(fd,JSON.stringify({dataset:proof.dataset,seal:proof.seal,state}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  const directory=fs.openSync(proof.root,"r");try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
}
class Repository {
  constructor(proof) {
    const checked=require("./isolation.cjs").verify(proof?.root||"");
    if(!proof?.verifiedSynthetic||proof.dataset!==checked.dataset||proof.seal!==checked.seal||proof.socket!==checked.socket)throw Error("synthetic_identity_required");
    this.proof=checked;
    this.vault=vault(checked);
    this.pool=new Pool({host:checked.socket,port:55441,user:checked.user,database:"bq_synthetic_development",max:4,
      connectionTimeoutMillis:2500,idleTimeoutMillis:10000,statement_timeout:20000,lock_timeout:12000});
    this.pool.on("error",()=>{}); // Requests still fail closed; no file fallback.
    // pg emits an error on checked-out clients as well as rejecting queries.
    // Handle the event without swallowing the query rejection/rollback path.
    this.pool.on("connect",client=>client.on("error",()=>{}));
  }
  async verify(client) {
    const provision=JSON.parse(fs.readFileSync(path.join(this.proof.root,"provision-receipt.json"),"utf8"));
    if(provision.dataset!==this.proof.dataset||provision.seal!==this.proof.seal||provision.state!=="committed")throw Error("synthetic_provision_not_committed");
    const r=await client.query("SELECT * FROM dev.authority WHERE singleton FOR SHARE");
    const a=r.rows[0];
    if(!a||a.dataset_id!==this.proof.dataset||a.seal!==this.proof.seal||a.mode!=="synthetic"||String(a.epoch)!=="1")throw Error("synthetic_authority_refused");
    return a;
  }
  async hardenControls() {
    // Additive dev-only control migration, never a node-schema replacement.
    const c=await this.pool.connect();
    try {
      await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(1793705963)");await this.verify(c);
      const columns=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='dev' AND table_name='requests'");
      if(!columns.rows.some(r=>r.column_name==="expires_at")){
        await c.query("ALTER TABLE dev.requests ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp(), ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '5 minutes'), ADD COLUMN policy text NOT NULL DEFAULT 'encrypted'");
        // Old rows cannot be classified safely: preserve dedupe tombstones but
        // retire plaintext response material, including credentials/tokens.
        await c.query("UPDATE dev.requests SET body=''::bytea,headers='{}'::jsonb,policy='retired'");
      }
      await c.query("ALTER TABLE dev.test_faults DROP CONSTRAINT IF EXISTS test_faults_point_check");
      await c.query("ALTER TABLE dev.test_faults ADD CONSTRAINT test_faults_point_check CHECK(point IN('before_commit','during_commit','unknown_commit','after_commit_drop','handler_timeout'))");
      for(const r of (await c.query("SELECT * FROM dev.runtime_state")).rows)if(!r.value?.sealed)
        await c.query("UPDATE dev.runtime_state SET value=$2::jsonb WHERE name=$1",[r.name,JSON.stringify(this.vault.json(r.value,`state:${r.name}`))]);
      for(const r of (await c.query("SELECT id,payload FROM dev.outbox")).rows)if(!r.payload?.sealed&&!r.payload?.redacted)
        await c.query("UPDATE dev.outbox SET payload=$2::jsonb WHERE id=$1",[r.id,JSON.stringify(this.vault.json(r.payload,`outbox:${r.id}`))]);
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
  }
  async initialize(fixtures) {
    const c=await this.pool.connect();
    try {
      const exists=await c.query("SELECT to_regclass('dev.authority') AS found");
      if(exists.rows[0].found){await this.verify(c);return;}
      // Independent durable evidence prevents an empty/lost SQL schema from
      // being mistaken for permission to provision fresh fixture accounts.
      if(fs.existsSync(path.join(this.proof.root,"provision-receipt.json")))throw Error("previously_provisioned_schema_missing");
      receipt(this.proof,"initializing",true);
      await c.query("BEGIN");
      await c.query(codec.ddl());
      await c.query("INSERT INTO dev.authority VALUES(true,$1,$2,1,'synthetic')",[this.proof.dataset,this.proof.seal]);
      for(const [file,value] of Object.entries(fixtures))await this.save(c,file,value,null);
      await c.query("COMMIT");
      receipt(this.proof,"committed");
    } catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
  }
  async load(c) {
    const files=await c.query("SELECT * FROM dev.files ORDER BY name"),records=[];
    for(const table of codec.tables.keys()) {
      const r=await c.query(`SELECT id,file_name,parent,entry_key,ordinal,attrs,shape FROM dev.${table}`);
      records.push(...r.rows.map(row=>({...row,table})));
    }
    const result=new Map();
    for(const file of files.rows)result.set(file.name,{value:codec.decode(file.name,records.filter(r=>r.file_name===file.name)),revision:Number(file.revision)});
    return result;
  }
  async save(c,file,value,revision) {
    // A SQL revision check, not a cache/file write, arbitrates each projection.
    if(revision===null) await c.query("INSERT INTO dev.files(name) VALUES($1)",[file]);
    else {
      const r=await c.query("UPDATE dev.files SET revision=revision+1 WHERE name=$1 AND revision=$2 RETURNING name",[file,revision]);
      if(r.rowCount!==1)throw Error("stale_entity_revision");
      await c.query(`DELETE FROM dev.${codec.specs[file].table} WHERE file_name=$1`,[file]);
    }
    for(const row of codec.encode(file,value))await c.query(`INSERT INTO dev.${row.table}(id,file_name,parent,entry_key,ordinal,attrs,shape) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [row.id,file,row.parent,row.entry_key,row.ordinal,JSON.stringify(row.attrs),JSON.stringify(row.shape)]);
  }
  async begin() {
    const started=performance.now();
    const c=await this.pool.connect();
    const acquired=performance.now();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(1793705963)");
      const locked=performance.now();
      await this.verify(c);
      // Compatibility code has process-local object graphs. Serialize requests
      // across app processes, then refresh every graph from these locked rows.
      await c.query("SELECT name FROM dev.files ORDER BY name FOR UPDATE");
      const loading=performance.now(),files=await this.load(c);
      // A placeholder may lack credentials; an authenticated session may not.
      // Preserve legacy KDF records, but never treat lost credential columns as
      // an unregistered account while its session children still exist.
      for(const row of Object.values(files.get("accounts.json")?.value||{})){
        if(row.sessions?.length&&(!row.hash||!row.salt))throw Error("critical_accounts_session_credentials");
      }
      return {client:c,files,started,metrics:{poolWaitMs:acquired-started,advisoryWaitMs:locked-acquired,loadMs:performance.now()-loading,loadQueries:codec.tables.size}};
    } catch(e){await c.query("ROLLBACK").catch(()=>{});c.release(e);throw e;}
  }
  async importSynthetic(files) {
    if(!files||typeof files!=="object")throw Error("synthetic_fixture_required");
    const t=await this.begin();
    try {
      for(const [file,value] of Object.entries(files)){
        if(!codec.specs[file])throw Error("unmapped_entity");
        await this.save(t.client,file,value,t.files.get(file)?.revision??null);
      }
      await t.client.query("COMMIT");
    } catch(e){await t.client.query("ROLLBACK");throw e;}finally{t.client.release();}
  }
  async exportSynthetic() {
    const t=await this.begin();
    try{return Object.fromEntries([...t.files].map(([f,r])=>[f,r.value]));}
    finally{await t.client.query("ROLLBACK");t.client.release();}
  }
  async enqueue(c,topic,payload) {
    const id=crypto.randomUUID();
    await c.query("INSERT INTO dev.outbox(id,topic,payload) VALUES($1,$2,$3::jsonb)",[id,topic,JSON.stringify(this.vault.json(payload,`outbox:${id}`))]);
  }
  async fixtureEvents(topic) {
    const rows=await this.pool.query("SELECT id,payload,delivered_at FROM dev.outbox WHERE topic=$1 ORDER BY created_at DESC",[topic]);
    return rows.rows.filter(r=>r.payload?.sealed).map(r=>({...r,payload:this.vault.decode(r.payload,`outbox:${r.id}`)}));
  }
  async commitMedia(c,media,files) {
    for(const row of media.values())if(row.new) {
      const key=`${this.proof.dataset}/immutable/${row.id}/${hash(row.bytes)}`;
      const dest=path.join(this.proof.objects,row.id);
      if(fs.existsSync(dest))throw Error("immutable_object_already_exists");
      // Intent durability is separate from readiness/attachment. A failed
      // request leaves an inspectable pending intent, never a visible attachment.
      const intent=await this.pool.connect();
      try {
        await intent.query("BEGIN");await this.verify(intent);
        await intent.query("INSERT INTO dev.media(id,legacy_path,object_key,sha256,size,mime,owner,state) VALUES($1,$2,$3,$4,$5,$6,$7,'pending')",
          [row.id,row.legacy,key,hash(row.bytes),row.bytes.length,row.mime,row.owner]);
        await intent.query("COMMIT");
      }catch(e){await intent.query("ROLLBACK").catch(()=>{});throw e;}finally{intent.release();}
      const fd=fs.openSync(dest,"wx",0o600);try{fs.writeFileSync(fd,row.bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      const directory=fs.openSync(this.proof.objects,"r");
      try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
      if(hash(fs.readFileSync(dest))!==hash(row.bytes))throw Error("media_checksum");
      await c.query("UPDATE dev.media SET state='ready' WHERE id=$1",[row.id]);
      row.object=dest;
    }
    await c.query("DELETE FROM dev.media_links");
    function refs(v,at,result) {
      if(typeof v==="string"&&v.startsWith("/media/"))result.push([at,v]);
      else if(v&&typeof v==="object")for(const [k,x] of Object.entries(v))refs(x,`${at}/${k}`,result);
    }
    for(const [file,record] of files) {
      // Opaque legacy files are not interpreted or treated as live media.
      if(["mail.json","messages.json"].includes(file))continue;
      const found=[];refs(record.value,"",found);
      for(const [sourcePath,legacy] of found) {
        const r=await c.query("SELECT * FROM dev.media WHERE legacy_path=$1 AND state IN('ready','retained') FOR SHARE",[legacy]);
        if(!r.rowCount)throw Error("referenced_media_not_ready");
        const object=path.join(this.proof.objects,r.rows[0].id);
        if(!fs.existsSync(object)||hash(fs.readFileSync(object))!==r.rows[0].sha256)throw Error("referenced_media_missing_or_corrupt");
        await c.query("INSERT INTO dev.media_links VALUES($1,$2,$3)",[file,sourcePath,legacy]);
      }
    }
  }
  async drainFixtureOutbox() {
    // Synthetic delivery receipts, never real SMTP/SMS/push/provider traffic.
    const c=await this.pool.connect();
    try {
      await c.query("BEGIN");await this.verify(c);
      await c.query("UPDATE dev.requests SET body=''::bytea,headers='{}'::jsonb,policy='expired' WHERE expires_at<clock_timestamp() AND policy='encrypted'");
      await c.query("DELETE FROM dev.requests WHERE created_at<clock_timestamp()-interval '24 hours'");
      await c.query("UPDATE dev.outbox SET payload='{\"redacted\":true}'::jsonb WHERE delivered_at IS NOT NULL AND created_at<clock_timestamp()-interval '5 minutes' AND NOT(payload ? 'redacted')");
      const r=await c.query("SELECT id,topic FROM dev.outbox WHERE delivered_at IS NULL FOR UPDATE SKIP LOCKED LIMIT 25");
      for(const row of r.rows)await c.query("UPDATE dev.outbox SET attempts=attempts+1,delivered_at=clock_timestamp(),fixture_receipt=$2::jsonb WHERE id=$1",
        [row.id,JSON.stringify({transport:"isolated-synthetic",event:row.id,topic:row.topic})]);
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK").catch(()=>{});throw e;}finally{c.release();}
  }
}
module.exports={Repository,hash};
