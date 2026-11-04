// Narrow production SMS delivery boundary; no redirects or response-body logs.
const allowed=new Set(["api.twilio.com","api.taqnyat.sa","el.cloud.unifonic.com"]);
function validate(p){
  if(!p||!allowed.has(p.host)||typeof p.path!=="string"||!p.path.startsWith("/")||/[\r\n]/.test(p.path)||
    p.method!=="POST"||typeof p.body!=="string"||Buffer.byteLength(p.body)>65536||!p.headers||typeof p.headers!=="object")
    throw Error("sms_delivery_binding_invalid");
}
function sendSms(p,request){
  validate(p);
  return new Promise((resolve,reject)=>{
    const req=request({hostname:p.host,servername:p.host,port:443,path:p.path,method:"POST",headers:p.headers,
      rejectUnauthorized:true,minVersion:"TLSv1.2"},res=>{
      const status=res.statusCode||500;res.resume();
      res.on("end",()=>status>=200&&status<300?resolve():reject(Error("sms_delivery_failed")));
    });
    req.setTimeout(15000,()=>req.destroy(Error("sms_delivery_failed")));
    req.on("error",()=>reject(Error("sms_delivery_failed")));req.end(p.body);
  });
}
module.exports={validate,sendSms};
