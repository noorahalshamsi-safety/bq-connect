const {Readable}=require("node:stream");
const staticRequest=req=>["GET","HEAD"].includes(req.method)&&!/^\/(api(?:\/|$)|media(?:\/|$)|avatar(?:\/|$)|health(?:\/|$))/.test(req.url.split("?")[0]);
function originAllowed(req) {
  if(req.headers["sec-fetch-site"]==="cross-site")return false;
  if(!req.headers.origin)return true; // Bearer-in-body API, not cookie auth.
  try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}
}
async function bufferRequest(req) {
  if(["GET","HEAD"].includes(req.method))return {req,bytes:Buffer.alloc(0)};
  const limit=req.url.split("?")[0]==="/api/media"?30*1024*1024:1000000;
  const bytes=await new Promise((resolve,reject)=>{
    let length=0;const chunks=[];
    const fail=(message)=>{clearTimeout(timer);req.removeListener("data",data);req.removeListener("end",end);req.resume();reject(Error(message));};
    const timer=setTimeout(()=>fail("body_timeout"),15000);
    const data=chunk=>{length+=chunk.length;if(length>limit)fail("body_too_large");else chunks.push(chunk);};
    const end=()=>{clearTimeout(timer);resolve(Buffer.concat(chunks));};
    req.on("data",data);req.once("end",end);req.once("error",()=>fail("body_aborted"));req.once("aborted",()=>fail("body_aborted"));
  });
  const replay=Readable.from([bytes]);
  for(const key of ["method","url","headers","rawHeaders","httpVersion","socket"])replay[key]=req[key];
  return {req:replay,bytes};
}
module.exports={staticRequest,originAllowed,bufferRequest};
