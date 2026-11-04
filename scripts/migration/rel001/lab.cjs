const C=require("./common.cjs"),S=require("./source.cjs");
const {fs,path,crypto,os,execFileSync,hash,digest,write,atomic}=C;
const codec=require("../../../development/postgres/codec.cjs");
function invented(){
 const session=crypto.randomBytes(48).toString("hex"),backup=crypto.randomBytes(32).toString("hex");
 const fixture=require("../../../development/postgres/fixtures.cjs").create(session),v=fixture.files;
 const now=new Date().toISOString(),future=new Date(Date.now()+86400000).toISOString();
 v["employees.json"].push({badge:"Ab07",name:"Invented case A",department:"Synthetic"},{badge:"ab07",name:"Invented case B",department:"Synthetic"});
 v["accounts.json"]["101"].pending={hash:v["accounts.json"]["101"].hash,salt:v["accounts.json"]["101"].salt,kdf:2,exp:future,extension:{preserve:[]}};
 v["accounts.json"]["103"].totpSetup={key:v["accounts.json"]["103"].totp.key,exp:future};
 delete v["accounts.json"]["00106"].pending;
 v["groups.json"]=[{id:"invented-group",name:"مجموعة مصطنعة",members:["101","00106"],history:{unknown:[null,{},[]]}}];
 const types=["post","idea","suggestion","complaint","thanks","story","poll","article","announcement","event"];
 v["ideas.json"]=types.map((type,i)=>({
  id:"invented-"+type,number:i+1,badge:i%2?"00106":"101",type,text:"Invented only / بيانات مصطنعة",createdAt:now,
  ...(type==="story"?{expiresAt:future}:{}),...(i===0?{groupId:"invented-group"}:{}),
  comments:[{id:"comment-"+i,badge:"102",text:"Invented reply",createdAt:now,likes:["101"],unknown:{keep:null}},
    {id:"reply-"+i,badge:"101",text:"Nested invented reply",parentId:"comment-"+i,createdAt:now,likes:[]}],
  ratings:[{badge:"102",stars:5,legacyVote:"up"}],reposts:[{badge:"103",at:now,snapshot:{historical:true}}],
  poll:type==="poll"?[{text:"نعم",votes:["101","00106"]},{text:"No",votes:["102"]}]:[],
  statusLog:[{status:"review",at:now}],reports:[{badge:"104",at:now}],acks:["101"],attendees:["102"],
  gallery:["/media/invented.png"],unknownExtension:{absentSibling:null,ordered:[3,1,2],emptyObject:{},emptyArray:[],historical:{v:0}}
 }));
 delete v["ideas.json"][1].statusLog;v["ideas.json"][2].statusLog=null;
 // Null known collections are intentionally preserved where not contradictory.
 v["profiles.json"]={"101":{bio:"Invented profile",avatar:"/media/invented.png",unknown:false}};
 v["notifications.json"]=[{id:"invented-notification",badge:"101",subject:"invented-post",read:false,createdAt:now,unknown:null}];
 v["bookmarks.json"]={"101":["invented-poll","invented-post"],"00106":[]};
 v["views.json"]={"invented-post":["101","00106"]};
 v["follows.json"]={"101":{people:["00106","103"],departments:["Engineering"],extension:[]}};
 v["dept-profiles.json"]={Engineering:{achievements:[{id:"invented-achievement",status:"approved",at:now,legacy:{keep:true}}]}};
 v["announce-seen.json"]={"101":["synthetic-legacy-announcement"]};
 v["highlights.json"]={"101":[{id:"invented-highlight",title:"Archived invented story",items:[{id:"deleted-story-reference",type:"story",badge:"101",media:"/media/invented.png",createdAt:now,unknownSnapshot:{retain:null}}]}]};
 v["security-log.json"]={rows:[{id:"invented-audit",badge:"9001",action:"synthetic",at:now,unknown:{preserve:true}}]};
 v["conduct.json"]={warnings:[{badge:"104",reason:"invented",at:now}],bans:{},resets:{"101":0}};
 v["join-requests.json"]=[{id:"invented-join",badge:"700",name:"Invented join",createdAt:now}];
 v["backup-status.json"]={last:now,extension:null};
 v["vault-status.json"]={status:"invented",historical:[null,{},[]]};
 v["push-subs.json"]={"101":[{endpoint:"https://example.invalid/push",keys:{auth:"invented-only",p256dh:"invented-only"}}]};
 // Opaque roots intentionally contain semantics the tool does not interpret.
 v["mail.json"]={unknownBusinessShape:[null,{"__historical":"retain"}]};
 v["messages.json"]=[{unknownKind:"invented",attachments:[],nested:null}];
 Object.defineProperty(v["profiles.json"]["101"],"__proto__",{value:{preserved:"ordinary JSON field"},enumerable:true});
 return{values:v,session:Buffer.from(session+"\n"),backup:Buffer.from(backup+"\n"),reference:fixture.credentials.tokens,
  media:{"invented.png":Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=","base64"),
    "retained-unreferenced.bin":Buffer.from("Invented retained object; no deletion inferred.")}};
}
async function create(options={}){
 C.environment();fs.mkdirSync(C.base,{recursive:true,mode:0o700});
 if(fs.realpathSync(C.base)!==C.base)C.fail("lab_base_symlink");
 const lab="lab-"+crypto.randomUUID(),root=path.join(C.base,lab);
 fs.mkdirSync(root,{mode:0o700});
 const meta={kind:"REL001_SYNTHETIC_STAGING_ONLY",lab,sourceId:"source-"+crypto.randomUUID(),targetId:"target-"+crypto.randomUUID(),database:"migration_"+crypto.randomBytes(12).toString("hex")};
 const seed=options.seed?structuredClone(options.seed):invented();
 seed.session=Buffer.from(seed.session);seed.backup=Buffer.from(seed.backup);
 seed.media=Object.fromEntries(Object.entries(seed.media).map(([n,b])=>[n,Buffer.from(b)]));
 options.mutate?.(seed);
 const source=path.join(root,"source"),target=path.join(root,"target");
 for(const d of [source,target,path.join(root,"recovery"),path.join(source,"data"),path.join(source,"custody"),path.join(source,"media")])fs.mkdirSync(d,{mode:0o700});
 for(const f of S.files)write(path.join(source,"data",f),Buffer.from(JSON.stringify(seed.values[f],null,2)+"\n"),true);
 write(path.join(source,"custody/session.key"),seed.session,true);write(path.join(source,"custody/backup.key"),seed.backup,true);
 write(path.join(source,"custody/reference-sessions.json"),JSON.stringify(seed.reference),true);
 for(const [n,b]of Object.entries(seed.media))write(path.join(source,"media",n),b,true);
 options.afterWrite?.(source);
 const identities={accountMembership:digest(Object.keys(seed.values["accounts.json"]).sort()),employeeMembership:digest(seed.values["employees.json"].map(x=>x.badge).sort()),
  postMembership:digest(seed.values["ideas.json"].map(x=>x.id).sort()),stories:digest(seed.values["ideas.json"].filter(p=>p.type==="story").map(p=>p.id).sort()),auth:digest(seed.values["accounts.json"])};
 const inventory=C.walk(source).map(p=>{const b=C.safeFile(path.join(source,p));return{path:p,size:b.length,sha256:hash(b)};});
 const manifest={kind:"INVENTED_REL001_SOURCE",sourceId:meta.sourceId,generation:1,inventory,identities,
  sessionKeySha:hash(seed.session),backupKeySha:hash(seed.backup)};
 const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+"\n");write(path.join(source,"manifest.json"),manifestBytes,true);
 meta.manifestSha=hash(manifestBytes);atomic(path.join(root,"lab.json"),meta);
 for(const p of C.walk(source))fs.chmodSync(path.join(source,p),0o400);
 const socket=path.join(os.tmpdir(),"bq-mig-"+hash(meta.targetId).slice(0,16));fs.mkdirSync(socket,{mode:0o700});
 const c={root,meta,target,socket};
 atomic(path.join(target,"identity.json"),{sourceId:meta.sourceId,targetId:meta.targetId,manifestSha:meta.manifestSha,state:"creating"});
 const env=C.pgEnv(c);
 let p;
 try{
  execFileSync("initdb",["-D",path.join(target,"pgdata"),"-A","trust","--no-locale","-E","UTF8","--data-checksums"],{env,stdio:"pipe"});
  C.resume(c);
  execFileSync("createdb",["-h",socket,"-p","55449","-U",os.userInfo().username,meta.database],{env,stdio:"pipe"});
  p=C.pool(c);const client=await p.connect();
  try{
   await client.query("BEGIN");await client.query(codec.ddl());
   await client.query(`CREATE SCHEMA migration;
    CREATE TABLE migration.target(target_id text PRIMARY KEY,source_id text NOT NULL,manifest_sha text NOT NULL,mode text NOT NULL CHECK(mode='staging'));
    CREATE TABLE migration.receipt(singleton boolean PRIMARY KEY CHECK(singleton),source_id text NOT NULL,manifest_sha text NOT NULL,semantic_sha text NOT NULL,media_sha text NOT NULL,committed_at timestamptz NOT NULL DEFAULT clock_timestamp());
    CREATE TABLE migration.source_files(path text PRIMARY KEY,sha256 text NOT NULL,size bigint NOT NULL);
    CREATE TABLE migration.media(legacy text PRIMARY KEY,sha256 text NOT NULL,size bigint NOT NULL,bytes bytea NOT NULL);
    CREATE TABLE migration.media_refs(source_file text NOT NULL,pointer text NOT NULL,legacy text NOT NULL REFERENCES migration.media(legacy),PRIMARY KEY(source_file,pointer));`);
   await client.query("INSERT INTO migration.target VALUES($1,$2,$3,'staging')",[meta.targetId,meta.sourceId,meta.manifestSha]);
   const systemId=(await client.query("SELECT system_identifier::text AS id FROM pg_control_system()")).rows[0].id;
   await client.query("COMMIT");
   atomic(path.join(target,"identity.json"),{sourceId:meta.sourceId,targetId:meta.targetId,manifestSha:meta.manifestSha,state:"created",systemId});
  }finally{client.release();}
 }catch(e){try{C.stop(c);}catch{}throw e;}finally{await p?.end();}
 atomic(path.join(target,"journal.json"),{state:"ready",sourceId:meta.sourceId,targetId:meta.targetId,manifestSha:meta.manifestSha});
 return{root,expected:{sourceId:meta.sourceId,targetId:meta.targetId,manifestSha:meta.manifestSha}};
}
module.exports={invented,create};
