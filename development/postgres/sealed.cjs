const crypto=require("node:crypto");
function vault(proof) {
  const key=crypto.createHmac("sha256",proof.sessionKey).update("bq-development-control-v2").digest();
  const aad=context=>Buffer.from(`${proof.dataset}:${context}`);
  return {
    digest(value){return crypto.createHmac("sha256",key).update(value).digest("hex");},
    seal(value,context){
      const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(aad(context));
      return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]);
    },
    open(bytes,context){
      const decipher=crypto.createDecipheriv("aes-256-gcm",key,bytes.subarray(0,12));decipher.setAAD(aad(context));decipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]);
    },
    json(value,context){return {sealed:this.seal(Buffer.from(JSON.stringify(value)),context).toString("base64")};},
    decode(value,context){if(!value?.sealed)throw Error("unencrypted_control_value");return JSON.parse(this.open(Buffer.from(value.sealed,"base64"),context));}
  };
}
const sensitive=new Set(["/api/login","/api/login-2fa","/api/2fa","/api/email","/api/register","/api/forgot","/api/password","/api/logout-all","/api/sessions","/api/session","/api/terms"]);
const scope=files=>JSON.stringify([...files].map(([file,r])=>[file,r.revision]).sort((a,b)=>a[0].localeCompare(b[0])));
module.exports={vault,sensitive,scope};
