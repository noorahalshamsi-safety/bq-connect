// Runs original auth against a disposable reconstructed COPY, never the source,
// target or application's existing data. Factor checks may mutate this copy.
const C=require("./common.cjs"),{fs,path,write,digest,hash}=C,assert=require("node:assert/strict");
async function prove(c,source,reverse){
 const dir=path.join(c.root,"auth-proof-"+C.crypto.randomUUID());fs.mkdirSync(dir,{mode:0o700});fs.mkdirSync(path.join(dir,"data"),{mode:0o700});
 for(const n of ["auth.js","persistence-safety.js"])write(path.join(dir,n),fs.readFileSync(path.join(C.workspace,n)),true);
 for(const f of ["accounts.json","security.json","smtp.json","security-log.json"])write(path.join(dir,"data",f),fs.readFileSync(path.join(C.workspace,reverse.destination,"data",f)),true);
 write(path.join(dir,"data/session.key"),source.bytes.get("custody/session.key"),true);
 const auth=require(path.join(dir,"auth.js")),reference=C.parse(source.bytes.get("custody/reference-sessions.json"));
 let accepted=0;for(const [badge,token]of Object.entries(reference)){assert.equal(auth.readSession(token),badge);accepted++;}
 const reconstructed=C.parse(fs.readFileSync(path.join(C.workspace,reverse.destination,"data/accounts.json")));
 for(const [badge,account]of Object.entries(source.values["accounts.json"])){
  const r=reconstructed[badge];
  for(const k of ["hash","salt","kdf","sessions","pending","totp","totpSetup"]){
   assert.equal(Object.hasOwn(account,k),Object.hasOwn(r,k));
   if(Object.hasOwn(account,k))assert.equal(C.canonical(account[k]),C.canonical(r[k]));
  }
 }
 // Exact password hash checks without invoking login's legacy-KDF upgrade.
 let hashes=0;
 for(const a of Object.values(reconstructed)){
  const actual=C.crypto.scryptSync(require("../../../development/postgres/fixtures.cjs").password,Buffer.from(a.salt,"hex"),64,{N:32768,r:8,p:a.kdf===2?3:1,maxmem:96*1024*1024}).toString("hex");
  assert.equal(actual,a.hash);hashes++;
 }
 const key=source.bytes.get("custody/session.key").toString().trim(),S=require("./source.cjs");
 let factors=0;for(const a of Object.values(reconstructed))for(const k of ["totp","totpSetup"])if(a[k]?.key){assert.equal(S.unseal(key,a[k].key).length,20);factors++;}
 const first=reconstructed["101"],factor=S.unseal(key,first.totp.key);
 const code=require("../../../development/postgres/fixtures.cjs").code(factor.toString("hex"));
 assert.equal(auth.checkTwoFactor("101",code),"totp");
 const pending=reconstructed["103"].totpSetup;
 assert.equal(S.unseal(key,pending.key).length,20);
 return{status:"PASS",originalSignedSessionsAccepted:accepted,passwordHashesVerified:hashes,activeAndPendingFactorCiphertextsDecrypted:factors,
  originalAuthTotpCheck:"PASS on disposable reconstructed copy",pendingFactor:"Exact presence/bytes/domain preserved and decryptable; no activation",
  accountSemanticSha:digest(reconstructed),signingKeyBytesSha:hash(source.bytes.get("custody/session.key")),backupKeyBytesSha:hash(source.bytes.get("custody/backup.key")),
  scope:"Original auth.readSession and checkTwoFactor used; no real accounts, no UI login, no SQL authority activation, no credential values in report."};
}
module.exports={prove};
