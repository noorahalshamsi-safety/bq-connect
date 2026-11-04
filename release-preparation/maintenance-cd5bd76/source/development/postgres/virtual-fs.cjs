const fs=require("node:fs"),path=require("node:path"),{Readable}=require("node:stream"),crypto=require("node:crypto");
function install(proof,getContext) {
  const prefix=path.join(proof.app,"data"),original={};
  let fd=1000000;const fds=new Map();
  const scoped=p=>typeof p==="string"&&(p===prefix||p.startsWith(prefix+path.sep));
  const name=p=>path.relative(prefix,p).replaceAll(path.sep,"/");
  const current=()=>{const c=getContext();if(!c)throw Error("transaction_context_required");return c;};
  const err=()=>Object.assign(Error("virtual_entity_missing"),{code:"ENOENT"});
  function bytes(p) {
    const c=current(),key=name(p);
    if(key==="session.key")return Buffer.from(proof.sessionKey);
    if(key==="backup.key")return Buffer.from(proof.backupKey);
    if(c.temps.has(key))return c.temps.get(key);
    if(c.buffers.has(key))return c.buffers.get(key);
    if(key.startsWith("media/")) {
      const row=c.media.get("/"+key);if(!row)throw err();
      return row.bytes||original.readFileSync(row.object);
    }
    throw err();
  }
  function write(p,data) {
    const c=current(),key=name(p),b=Buffer.isBuffer(data)?data:Buffer.from(String(data));
    if(["session.key","backup.key","push-keys.json"].includes(key))throw Error("key_rotation_forbidden");
    if(key.startsWith("media/")) {
      const legacy="/"+key;if(c.media.has(legacy))throw Error("immutable_media_overwrite");
      const id=path.basename(key).split(".")[0],ext=path.extname(key).slice(1);
      c.media.set(legacy,{new:true,id,legacy,bytes:b,mime:{png:"image/png",jpg:"image/jpeg",webp:"image/webp",mp4:"video/mp4",mov:"video/quicktime",webm:"video/webm"}[ext]||"application/octet-stream",owner:c.actor||"synthetic"});
    } else if(key.endsWith(".json")) {
      if(!c.files.has(key))throw Error("unmapped_or_unprovisioned_entity");
      JSON.parse(b.toString());c.buffers.set(key,b);c.changed.add(key);
    } else c.temps.set(key,b);
  }
  function patch(method,fn){original[method]=fs[method];fs[method]=fn;}
  patch("readFileSync",(p,encoding,...rest)=>{
    if(!scoped(p))return original.readFileSync(p,encoding,...rest);
    const b=bytes(p);return typeof encoding==="string"||encoding?.encoding?b.toString(typeof encoding==="string"?encoding:encoding.encoding):Buffer.from(b);
  });
  patch("existsSync",p=>{
    if(!scoped(p))return original.existsSync(p);
    if(p===prefix||p===path.join(prefix,"media"))return true;
    try{bytes(p);return true;}catch(e){if(e.code==="ENOENT")return false;throw e;}
  });
  patch("mkdirSync",(p,...args)=>scoped(p)?undefined:original.mkdirSync(p,...args));
  patch("openSync",(p,flags,...args)=>{
    if(!scoped(p))return original.openSync(p,flags,...args);
    const c=current(),key=name(p);
    if(flags.includes("x")&&(c.temps.has(key)||c.buffers.has(key)))throw Object.assign(Error("held_virtual_lock"),{code:"EEXIST"});
    if(p!==prefix&&!flags.includes("w"))bytes(p);
    if(flags.includes("w"))c.temps.set(key,Buffer.alloc(0));
    const n=fd++;fds.set(n,p);return n;
  });
  patch("writeFileSync",(p,data,...args)=>{
    if(typeof p==="number"&&fds.has(p))return write(fds.get(p),data);
    return scoped(p)?write(p,data):original.writeFileSync(p,data,...args);
  });
  patch("fsyncSync",n=>fds.has(n)?undefined:original.fsyncSync(n));
  patch("closeSync",n=>fds.has(n)?fds.delete(n):original.closeSync(n));
  patch("renameSync",(from,to)=>{
    if(!scoped(from)&&!scoped(to))return original.renameSync(from,to);
    if(!scoped(from)||!scoped(to))throw Error("cross_boundary_file_move");
    const c=current(),b=bytes(from);write(to,b);c.temps.delete(name(from));
  });
  patch("unlinkSync",p=>{
    if(!scoped(p))return original.unlinkSync(p);
    const c=current(),key=name(p);
    if(key.startsWith("media/"))return; // Retain all immutable versions; no cleanup.
    if(c.temps.has(key)){c.temps.delete(key);return;}
    throw Error("entity_deletion_requires_repository");
  });
  patch("statSync",(p,...args)=>{
    if(!scoped(p))return original.statSync(p,...args);
    const isDir=p===prefix||p===path.join(prefix,"media"),c=current(),key=name(p),b=isDir?Buffer.alloc(0):bytes(p);
    const version=c.files.get(key)?.revision||1;
    return {size:b.length,mtimeMs:version+(c.changed.has(key)?0.5:0),isFile:()=>!isDir,isDirectory:()=>isDir,isSymbolicLink:()=>false};
  });
  patch("writeFile",(p,data,...args)=>{
    if(!scoped(p))return original.writeFile(p,data,...args);
    const cb=args.at(-1);queueMicrotask(()=>{try{write(p,data);cb(null);}catch(e){cb(e);}});
  });
  patch("stat",(p,...args)=>{
    if(!scoped(p))return original.stat(p,...args);
    const cb=args.at(-1);queueMicrotask(()=>{try{cb(null,fs.statSync(p));}catch(e){cb(e);}});
  });
  patch("unlink",(p,cb)=>scoped(p)?queueMicrotask(()=>{try{fs.unlinkSync(p);cb(null);}catch(e){cb(e);}}):original.unlink(p,cb));
  patch("createReadStream",(p,options={})=>{
    if(!scoped(p))return original.createReadStream(p,options);
    const b=bytes(p);return Readable.from([b.subarray(options.start||0,options.end===undefined?undefined:options.end+1)]);
  });
  patch("readdirSync",(p,opts)=>{
    if(!scoped(p))return original.readdirSync(p,opts);
    const c=current(),names=p===prefix?[...c.buffers.keys(),"session.key","backup.key","media"]:[...c.media.keys()].map(k=>k.slice(7));
    return opts?.withFileTypes?names.map(name=>({name,isDirectory:()=>name==="media",isFile:()=>name!=="media",isSymbolicLink:()=>false})):names;
  });
  return {original,scoped,restore(){for(const [k,v]of Object.entries(original))fs[k]=v;}};
}
module.exports={install};
