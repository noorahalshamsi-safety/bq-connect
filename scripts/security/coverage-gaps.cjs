// Route/op entries that no prior synthetic suite exercised (scripts/security/route-inventory.cjs) - REL-015.
// Invented fixture accounts on the isolated local PostgreSQL harness; the positive place-name path is deliberately
// not called because it contacts an external reverse geocoder.
const {harness,ok}=require("../postgres/harness.cjs");
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const results=[];let h;
async function run(id,name,fn){
  try{results.push({id,name,status:"PASS",evidence:await fn()});}catch(e){results.push({id,name,status:"FAIL",error:e.message.slice(0,300)});}
  const r=results.at(-1);console.log(id,r.status,name,r.error||"");
}
const subscription=()=>{const e=crypto.createECDH("prime256v1");e.generateKeys();return{endpoint:`https://fcm.googleapis.com/fcm/send/invented-${crypto.randomUUID()}`,keys:{p256dh:e.getPublicKey().toString("base64url"),auth:crypto.randomBytes(16).toString("base64url")}};};
(async()=>{
  try{
    h=await harness(5148);await h.boot();
    await run("S01","/api/push key: employee only, reports only the caller's own subscription state",async()=>{
      ok(await h.request("/api/push",{op:"key"},null),401);
      const r=await h.request("/api/push",{op:"key",endpoint:"https://fcm.googleapis.com/fcm/send/unknown"});ok(r);
      assert.equal(typeof r.json.key,"string");assert.equal(r.json.active,false);
      ok(await h.request("/api/push",{op:"nope"}),400);
      return{unauthenticated:401,unknownEndpoint:"inactive",badOp:400};
    });
    await run("S02","/api/push unsubscribe: another employee cannot remove someone else's subscription",async()=>{
      const sub=subscription();
      ok(await h.request("/api/push",{op:"subscribe",subscription:sub,lang:"en"},"101"));
      assert.equal((await h.request("/api/push",{op:"key",endpoint:sub.endpoint},"101")).json.active,true);
      assert.equal((await h.request("/api/push",{op:"key",endpoint:sub.endpoint},"102")).json.active,false);
      ok(await h.request("/api/push",{op:"unsubscribe",endpoint:sub.endpoint},"102"));
      assert.equal((await h.request("/api/push",{op:"key",endpoint:sub.endpoint},"101")).json.active,true,"wrong-owner unsubscribe removed the subscription");
      ok(await h.request("/api/push",{op:"unsubscribe",endpoint:sub.endpoint},null),401);
      ok(await h.request("/api/push",{op:"unsubscribe",endpoint:sub.endpoint},"101"));
      assert.equal((await h.request("/api/push",{op:"key",endpoint:sub.endpoint},"101")).json.active,false);
      return{wrongOwner:"no effect",owner:"removed"};
    });
    await run("S03","/api/place-name: unauthenticated and invalid coordinates are refused before any lookup",async()=>{
      ok(await h.request("/api/place-name",{lat:24.7,lng:46.7},null),401);
      for(const bad of [{lat:91,lng:0},{lat:0,lng:181},{lat:"x",lng:1},{}])ok(await h.request("/api/place-name",bad),400);
      return{unauthenticated:401,invalid:400,positivePath:"NOT TESTED (external geocoder)"};
    });
    await run("S04","/api/sessions logout: revokes the caller's current session only",async()=>{
      ok(await h.request("/api/sessions",{op:"logout"},null),401);
      ok(await h.request("/api/session",{},"103"));
      ok(await h.request("/api/sessions",{op:"logout"},"103"));
      ok(await h.request("/api/session",{},"103"),401);
      ok(await h.request("/api/session",{},"101"));
      ok(await h.request("/api/sessions",{op:"logout"},"103"),401);
      return{loggedOutToken:401,otherEmployee:200,replayAfterLogout:401};
    });
  }catch(e){results.push({id:"HARNESS",name:"setup",status:"FAIL",error:e.message.slice(0,300)});console.log("HARNESS FAIL",e.message.slice(0,300));}
  finally{
    if(h)await h.close();
    const pass=results.filter(r=>r.status==="PASS").length;
    console.log(JSON.stringify({PASS:pass,FAIL:results.length-pass}));
    process.exitCode=pass===results.length?0:1;
  }
})();
