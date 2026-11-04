// Invented identities only. Never import a workspace data directory.
const crypto=require("node:crypto"),{specs}=require("./codec.cjs");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const password="SyntheticOnly!Pass2026", pepper="bq-rd-ideas-2026";
function seal(secret,bytes) {
  const key=crypto.createHmac("sha256",secret).update("totp-vault").digest(),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  return [iv,Buffer.concat([cipher.update(bytes),cipher.final()]),cipher.getAuthTag()].map(x=>x.toString("base64url")).join(".");
}
function code(key,counter=Math.floor(Date.now()/30000)) {
  const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));
  const digest=crypto.createHmac("sha1",Buffer.from(key,"hex")).update(b).digest(),offset=digest.at(-1)&15;
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,"0");
}
// Staging passes random credentials: the defaults are published in this repository.
function create(secret,{password:secretPassword=password,recovery="ABCDEFGHJK"}={}) {
  const files=Object.fromEntries(Object.keys(specs).map(f=>[f,{}]));
  const now=new Date().toISOString(),exp=Date.now()+2*86400000,accounts={},tokens={},totpKeys={};
  const people=[
    ["101","Synthetic Engineer One","Engineering","Engineer"],
    ["102","Synthetic Moderator Two","Engineering","Engineer"],
    ["103","Synthetic Manager Three","Engineering","Manager"],
    ["104","Synthetic Visitor Four","Operations","Engineer"],
    ["105","Synthetic Pending Five","Engineering","Engineer"],
    ["00106","Synthetic Legacy Six","Engineering","Engineer"],
    ["107","Synthetic Unregistered Seven","Operations","Engineer"],
    ["108","Synthetic Unregistered Eight","Engineering","Engineer"],
  ];
  const hmac=s=>crypto.createHmac("sha256",pepper).update(s).digest("hex");
  files["employees.json"]=people.map(([badge,name,department,position])=>({badge,name,department,position,check:hmac(`${badge}:1234`),phone:hmac(`phone:${badge}:512345678`)}));
  for(const badge of ["101","102","103","104","00106","9001","9002"]) {
    const salt=crypto.randomBytes(16).toString("hex"),legacy=badge==="00106",key=crypto.randomBytes(20);
    const hash=crypto.scryptSync(secretPassword,Buffer.from(salt,"hex"),64,{N:32768,r:8,p:legacy?1:3,maxmem:96*1024*1024}).toString("hex");
    const recoveryHash=crypto.createHmac("sha256",secret).update(`recovery:${badge}:${recovery}`).digest("hex");
    const sid=crypto.randomBytes(12).toString("base64url"),payload=`${badge}.1.${exp}.${sid}`;
    tokens[badge]=Buffer.from(`${payload}.${crypto.createHmac("sha256",secret).update(`session:${payload}`).digest("hex")}`).toString("base64url");
    totpKeys[badge]=key.toString("hex");
    accounts[badge]={hash,salt,...(!legacy?{kdf:2}:{}),ver:1,email:`fixture-${badge}@example.invalid`,createdAt:now,pending:null,
      totp:{on:true,key:seal(secret,key),last:0,at:now,recovery:[recoveryHash]},
      sessions:[{sid,createdAt:now,lastSeen:now,exp:new Date(exp).toISOString(),ip:"192.0.2.1",device:{label:"Synthetic fixture"}}],
      terms:"2026-10-29",termsAt:now,unknownFixtureField:{preserve:null}};
  }
  files["accounts.json"]=accounts;files["ideas.json"]=[];files["notifications.json"]=[];
  files["groups.json"]=[];files["announcements.json"]=[{id:"synthetic-legacy-announcement",subject:"Synthetic announcement",text:"Invented only",from:"Synthetic system",createdAt:now}];
  files["security.json"]={admins:["9001"],adminAccount:{badge:"9001",name:"Synthetic Administrator"},announcer:{badge:"9002",name:"Synthetic Announcer",email:"fixture-9002@example.invalid"},emailDomains:["example.invalid"]};
  files["moderators.json"]={badges:["102"]};files["security-log.json"]={rows:[]};
  files["conduct.json"]={warnings:[],bans:{},resets:{}};
  files["join-requests.json"]=[];files["daily-sparks.json"]={v:2,date:now.slice(0,10),items:{}};
  const pair=crypto.generateKeyPairSync("ec",{namedCurve:"prime256v1"}),jwk=pair.privateKey.export({format:"jwk"});
  files["push-keys.json"]={publicKey:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,"base64url"),Buffer.from(jwk.y,"base64url")]).toString("base64url"),privateJwk:jwk};
  files["smtp.json"]={host:"synthetic.invalid",port:465,user:"synthetic@example.invalid",pass:"SYNTHETIC-NOT-A-CREDENTIAL",fromName:"Synthetic BQ"};
  files["sms.json"]={provider:"twilio",token:"SYNTHETIC-NOT-A-CREDENTIAL",sid:"synthetic",from:"+15550000000"};
  files["backup.json"]={enabled:false};
  files["mail.json"]={opaque:"synthetic-preserved-without-interpretation"};
  files["messages.json"]=[{opaque:"synthetic-preserved-without-interpretation"}];
  return {files,credentials:{password:secretPassword,tokens,totpKeys,check:"1234",mobile:"512345678",recovery:`${recovery.slice(0,5)}-${recovery.slice(5)}`},sha};
}
module.exports={create,code,password};
