const crypto=require("node:crypto");
const failure=(code,status=400,state="error")=>Object.assign(Error(code),{code,status,state});
function create(key,{ttlMs=120000,now=Date.now}={}){
 if(!Buffer.isBuffer(key)||key.length<32)throw Error("synthetic_cursor_key_required");
 const mac=s=>crypto.createHmac("sha256",key).update("feed-keyset-v1:"+s).digest();
 function sign(payload){const s=Buffer.from(JSON.stringify(payload)).toString("base64url");return s+"."+mac(s).toString("base64url");}
 function decode(token,{actor,scope,revision}){
  if(typeof token!=="string"||token.length>4096)throw failure("cursor_invalid");
  const parts=token.split(".");if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))throw failure("cursor_invalid");
  const sig=Buffer.from(parts[1],"base64url"),expected=mac(parts[0]);
  if(sig.length!==expected.length||!crypto.timingSafeEqual(sig,expected))throw failure("cursor_invalid");
  let p;try{p=JSON.parse(Buffer.from(parts[0],"base64url"));}catch{throw failure("cursor_invalid");}
  if(!p||p.v!==1||p.aud!=="synthetic-feed"||!Number.isSafeInteger(p.after)||p.after<0||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.exp<=p.iat||p.exp-p.iat>ttlMs||p.iat>now()+1000)throw failure("cursor_invalid");
  if(p.exp<=now())throw failure("cursor_expired",410,"restart");
  if(p.actor!==actor||p.scope!==scope)throw failure("cursor_actor_scope",403,"restart");
  if(p.revision!==revision)throw failure("cursor_revision_changed",409,"restart");
  return p;
 }
 return{sign,decode,initial:()=>({v:1,aud:"synthetic-feed",iat:now(),exp:now()+ttlMs})};
}
module.exports={create,failure};
