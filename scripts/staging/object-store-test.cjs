// Contract tests for the staging media adapter against the filesystem stand-in
// of the App Storage client. Provider behavior is NOT certified by this test.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto");
const {FileStorage}=require("../forensics/file-storage.cjs");
const {ImmutableStore,hash}=require("../../deploy/staging/object-store.cjs");
const results=[];
async function check(id,name,fn){try{results.push({id,name,result:"PASS",detail:await fn()});}catch(e){results.push({id,name,result:"FAIL",detail:e.message});}}
async function refused(code,fn){try{await fn();}catch(e){if(e.message===code)return code;throw Error(`expected ${code}, got ${e.message}`);}throw Error(`expected ${code}, accepted`);}
const root=fs.mkdtempSync(path.join(os.tmpdir(),"bq-forensics-objects-"));
const dataset=`staging-synthetic-${crypto.randomUUID()}`;
(async()=>{
  try{
    const bucket=new FileStorage(path.join(root,"bucket"));
    const store=new ImmutableStore(bucket,{dataset,timeoutMs:300});
    const items=Array.from({length:24},(_,i)=>({id:crypto.randomUUID(),bytes:crypto.randomBytes(1024+i*97)}));
    const stored=[];
    await check("O01","Upload stores under an immutable content key and verifies by read-back",async()=>{
      for(const item of items){const r=await store.put(item.id,item.bytes);if(r.state!=="stored")throw Error(r.state);stored.push({id:item.id,object_key:r.key,sha256:r.sha});}
      return `${stored.length} objects; downloads ${bucket.downloads} (one verification each)`;});
    await check("O02","Retried upload of the same media is idempotent and never overwrites",async()=>{
      const writes=bucket.writes,r=await store.put(items[0].id,items[0].bytes);
      if(r.state!=="present"||bucket.writes!==writes)throw Error("rewrote object");return "state present; zero writes";});
    await check("O03","Corrupt stored object is refused on read and on retry (not silently replaced)",async()=>{
      const victim=stored[1],file=bucket.file(victim.object_key),original=fs.readFileSync(file);
      fs.writeFileSync(file,Buffer.concat([original.subarray(0,10),Buffer.from("x")]));
      try{
        const a=await refused("object_corrupt",()=>store.read(victim.object_key,victim.sha256));
        const writes=bucket.writes;
        const b=await refused("object_corrupt",()=>store.put(items[1].id,items[1].bytes));
        if(bucket.writes!==writes)throw Error("corrupt object was overwritten");
        return `${a}; retry ${b}; no overwrite`;
      }finally{fs.writeFileSync(file,original);}});
    await check("O04","Missing object is reported as missing",async()=>{
      const sha=hash(Buffer.from("never-uploaded"));return refused("object_missing",()=>store.read(store.key(crypto.randomUUID(),sha),sha));});
    await check("O05","Provider outage is distinguished from a missing object",async()=>{
      bucket.options.failDownload=stored[2].object_key;
      try{return await refused("object_store_unavailable",()=>store.read(stored[2].object_key,stored[2].sha256));}finally{delete bucket.options.failDownload;}});
    await check("O06","A hung provider call times out within the bound",async()=>{
      const hung=new ImmutableStore({exists:()=>new Promise(()=>{}),downloadAsBytes:()=>new Promise(()=>{}),uploadFromBytes:()=>new Promise(()=>{})},{dataset,timeoutMs:200});
      const started=Date.now(),code=await refused("object_store_timeout",()=>hung.put(crypto.randomUUID(),Buffer.from("x")));
      const ms=Date.now()-started;if(ms>1000)throw Error(`${ms}ms`);return `${code} after ${ms}ms`;});
    await check("O07","Verify-after-write catches a truncated provider write",async()=>{
      const lying={...bucket,exists:n=>bucket.exists(n),downloadAsBytes:n=>bucket.downloadAsBytes(n),
        uploadFromBytes:(n,b)=>bucket.uploadFromBytes(n,b.subarray(0,b.length-1))};
      const s=new ImmutableStore(lying,{dataset,timeoutMs:300});
      return refused("object_corrupt",()=>s.put(crypto.randomUUID(),crypto.randomBytes(2048)));});
    await check("O08","Non-synthetic dataset and malformed keys are refused",async()=>{
      let code;try{new ImmutableStore(bucket,{dataset:"employees"});}catch(e){code=e.message;}
      if(code!=="synthetic_dataset_required")throw Error(String(code));
      const bad=await refused("object_key_invalid",()=>store.read(`${dataset}/immutable/../../escape/${stored[0].sha256}`,stored[0].sha256));
      const wrong=await refused("object_key_invalid",()=>store.read(stored[0].object_key,stored[1].sha256));
      return `${code}; ${bad}; ${wrong}`;});
    const cache=path.join(root,"cache");
    await check("O09","Cold-start restore writes only verified bytes with bounded concurrency",async()=>{
      const r=await store.restore(stored,cache,{concurrency:4});
      if(r.restored!==stored.length||r.peakConcurrency>4)throw Error(JSON.stringify(r));
      for(const row of stored)if(hash(fs.readFileSync(path.join(cache,row.id)))!==row.sha256)throw Error("cache mismatch");
      if(fs.readdirSync(cache).some(f=>f.endsWith(".partial")))throw Error("partial file left");
      const mode=fs.statSync(path.join(cache,stored[0].id)).mode&0o777;
      return `${r.restored} restored, peak concurrency ${r.peakConcurrency}, file mode ${mode.toString(8)}`;});
    await check("O10","Restore rerun uses verified cache and repairs a corrupt cache file",async()=>{
      fs.writeFileSync(path.join(cache,stored[3].id),"damaged");
      const r=await store.restore(stored,cache);
      if(r.restored!==1||r.cached!==stored.length-1)throw Error(JSON.stringify(r));return `cached ${r.cached}, repaired ${r.restored}`;});
    await check("O11","Restore fails closed when the bucket copy is corrupt",async()=>{
      const fresh=path.join(root,"cache-fresh"),victim=stored[5],file=bucket.file(victim.object_key),original=fs.readFileSync(file);
      fs.writeFileSync(file,"tampered");
      try{
        const code=await refused("object_corrupt",()=>store.restore(stored,fresh,{concurrency:2}));
        if(fs.existsSync(path.join(fresh,victim.id)))throw Error("corrupt bytes cached");
        for(const f of fs.readdirSync(fresh)){const row=stored.find(r=>r.id===f);if(!row||hash(fs.readFileSync(path.join(fresh,f)))!==row.sha256)throw Error("unverified file cached");}
        return `${code}; only verified files present`;
      }finally{fs.writeFileSync(file,original);}});
    await check("O12","Adapter exposes no delete path and never deleted an object",async()=>{
      if(typeof store.delete==="function"||Object.getOwnPropertyNames(ImmutableStore.prototype).some(n=>/delete|remove|purge/i.test(n)))throw Error("delete capability present");
      const listed=(await bucket.list({prefix:`${dataset}/`})).value.length;
      if(listed<stored.length)throw Error("objects disappeared");return `${listed} objects still present`;});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
  for(const r of results)console.log(`${r.id} ${r.result.padEnd(4)} ${r.name} — ${r.detail}`);
  const failed=results.filter(r=>r.result!=="PASS").length;
  console.log(`object-store: ${results.length-failed}/${results.length} PASS (filesystem stand-in; provider not certified)`);
  process.exit(failed?1:0);
})();
