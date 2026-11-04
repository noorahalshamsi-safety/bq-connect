// Immutable, content-verified media objects for staging. There is deliberately
// no delete operation: retention and orphan handling stay with reviewed tooling.
// The Replit SDK has no create-if-absent precondition, so immutability comes
// from content-addressed keys plus verify-after-write.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const hash=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY=new RegExp(`^staging-synthetic-${UUID}/immutable/${UUID}/[0-9a-f]{64}$`);
const fault=(code,cause)=>Object.assign(Error(code),cause?{cause}:{});
class ImmutableStore {
  constructor(client,{dataset,timeoutMs=15000}={}) {
    if(!new RegExp(`^staging-synthetic-${UUID}$`).test(dataset||""))throw fault("synthetic_dataset_required");
    this.client=client;this.dataset=dataset;this.timeoutMs=timeoutMs;
  }
  key(id,sha){
    const key=`${this.dataset}/immutable/${id}/${sha}`;
    if(!KEY.test(key))throw fault("object_key_invalid");
    return key;
  }
  async call(method,...args){
    let timer;
    const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault("object_store_timeout")),this.timeoutMs);});
    try{
      const result=await Promise.race([this.client[method](...args),deadline]);
      if(!result?.ok)throw fault("object_store_unavailable",result?.error?.message);
      return result.value;
    }finally{clearTimeout(timer);}
  }
  async read(key,sha){
    if(!KEY.test(key)||!key.endsWith(`/${sha}`))throw fault("object_key_invalid");
    let value;
    try{value=await this.call("downloadAsBytes",key);}
    catch(e){
      if(e.message==="object_store_unavailable"&&await this.call("exists",key)===false)throw fault("object_missing");
      throw e;
    }
    const bytes=Array.isArray(value)?value[0]:value;
    if(!Buffer.isBuffer(bytes)||hash(bytes)!==sha)throw fault("object_corrupt");
    return bytes;
  }
  // Safe to retry: an existing key is verified, never overwritten.
  async put(id,bytes){
    const sha=hash(bytes),key=this.key(id,sha);
    if(await this.call("exists",key)){await this.read(key,sha);return {key,sha,state:"present"};}
    await this.call("uploadFromBytes",key,bytes);
    await this.read(key,sha);
    return {key,sha,state:"stored"};
  }
  // Cold-start: populate a local cache with verified bytes only; any missing or
  // corrupt object fails the whole restore rather than serving partial media.
  async restore(rows,dir,{concurrency=4}={}){
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    const counts={cached:0,restored:0},queue=[...rows];
    let active=0,peak=0;
    const worker=async()=>{
      for(let row=queue.shift();row;row=queue.shift()){
        active++;peak=Math.max(peak,active);
        try{
          const target=path.join(dir,row.id);
          if(fs.existsSync(target)&&hash(fs.readFileSync(target))===row.sha256){counts.cached++;continue;}
          const bytes=await this.read(row.object_key,row.sha256);
          const temp=`${target}.${crypto.randomUUID()}.partial`;
          const fd=fs.openSync(temp,"wx",0o600);
          try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
          fs.renameSync(temp,target);
          counts.restored++;
        }catch(e){queue.length=0;throw e;}
        finally{active--;}
      }
    };
    await Promise.all(Array.from({length:Math.max(1,concurrency)},worker));
    const directory=fs.openSync(dir,"r");try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
    return {...counts,peakConcurrency:peak};
  }
}
function fromProof(proof){
  if(!proof?.verifiedStaging)throw fault("staging_identity_required");
  const {Client}=require("@replit/object-storage");
  return new ImmutableStore(new Client({bucketId:proof.bucket}),{dataset:proof.dataset});
}
module.exports={ImmutableStore,fromProof,hash};
