// Client-IP trust behaviour of server.js clientIp() under spoofed X-Forwarded-For (REL-010).
// Evaluates the unmodified function source with each TRUST_PROXY hop count; invented documentation addresses only.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const src=fs.readFileSync(path.resolve(__dirname,"../../server.js"),"utf8");
const fn=src.match(/function clientIp\(req\) \{[\s\S]*?\n\}/)?.[0];
const hopsLine=src.match(/const PROXY_HOPS = .*;/)?.[0];
const results=[];
function check(id,name,body){
  try{results.push({id,name,status:"PASS",evidence:body()});}catch(e){results.push({id,name,status:"FAIL",error:e.message.slice(0,300)});}
  const r=results.at(-1);console.log(id,r.status,name,r.error||"");
}
const ipFor=(hops)=>vm.runInNewContext(`const PROXY_HOPS=${hops};(${fn})`);
const req=(peer,xff)=>({socket:{remoteAddress:peer},headers:xff===undefined?{}:{"x-forwarded-for":xff}});
const REMOTE="198.51.100.7",SPOOF="203.0.113.66",EDGE="192.0.2.10";

check("F00","clientIp and PROXY_HOPS sources found; hop count is clamped to 0..5",()=>{
  assert(fn&&hopsLine,"source changed");
  assert(/Math\.max\(0, Math\.min\(5,/.test(hopsLine));
  return{default:"TRUST_PROXY ?? (ON_REPLIT ? 1 : 0)"};
});
check("F01","No trusted proxy: a remote peer cannot choose its IP with X-Forwarded-For",()=>{
  assert.equal(ipFor(0)(req(REMOTE,`${SPOOF}`)),REMOTE);
  assert.equal(ipFor(0)(req(`::ffff:${REMOTE}`,`${SPOOF}, ${EDGE}`)),REMOTE);
  return{ip:"peer"};
});
check("F02","One trusted hop: only the right-most entry (appended by the proxy) is used; client-supplied prefixes are ignored",()=>{
  assert.equal(ipFor(1)(req(EDGE,`${SPOOF}, ${REMOTE}`)),REMOTE);
  assert.equal(ipFor(1)(req(EDGE,`${SPOOF},${SPOOF}, ${REMOTE}`)),REMOTE);
  return{ip:"right-most"};
});
check("F03","Two trusted hops select the second entry from the right",()=>{
  assert.equal(ipFor(2)(req(EDGE,`${SPOOF}, ${REMOTE}, ${EDGE}`)),REMOTE);
  return{ip:"second from right"};
});
check("F04","Missing or empty header falls back to the socket peer",()=>{
  assert.equal(ipFor(1)(req(EDGE)),EDGE);
  assert.equal(ipFor(1)(req(EDGE," , ")),EDGE);
  return{ip:"peer"};
});
check("F05","Fewer entries than hops uses the left-most entry, never an empty key",()=>{
  assert.equal(ipFor(3)(req(EDGE,REMOTE)),REMOTE);
  return{ip:"left-most"};
});
check("F06","Over-long forwarded values are bounded to 64 characters",()=>{
  assert.equal(ipFor(1)(req(EDGE,"x".repeat(500))).length,64);
  return{max:64};
});
check("F07","Loopback peers are treated as one local proxy hop even when TRUST_PROXY=0 (documented observation)",()=>{
  assert.equal(ipFor(0)(req("127.0.0.1",`${SPOOF}`)),SPOOF);
  assert.equal(ipFor(0)(req("::1")),"127.0.0.1");
  return{note:"any process on the host can set the rate-limit IP; acceptable only when the loopback peer is a trusted reverse proxy"};
});
check("F08","Identity locks exist independently of client IP for login, 2FA, registration and password change",()=>{
  for(const key of ["auth.locked(badge)","auth.locked(`2fa:${badge}`)","auth.locked(`reg:${badge}`)","auth.locked(`pw:${badge}`)"])assert(src.includes(key),`missing ${key}`);
  return{keys:4};
});
const pass=results.filter(r=>r.status==="PASS").length;
console.log(JSON.stringify({PASS:pass,FAIL:results.length-pass}));
if(pass!==results.length)process.exitCode=1;
