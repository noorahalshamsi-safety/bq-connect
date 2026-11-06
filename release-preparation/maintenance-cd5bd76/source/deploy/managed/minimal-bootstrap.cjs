// FUTURE operator-approved publish command. The public listener never exposes
// login before the complete destination/custody/adoption gate succeeds.
const http=require("node:http"),{start}=require("./minimal-runtime.cjs");
async function launch({port=Number(process.env.PORT)||5000,startRuntime=start,retryMs=15000,maintenanceOnly=false}={}){
  let backend=null,running=null,stopping=false,timer,internal;
  const server=http.createServer((req,res)=>{
    if(!backend){
      // Replit's publishing probe needs GET / => 200. This is liveness only:
      // no app/login is served, and /health/ready and every API remain 503.
      const live=req.url==="/health/live"||(req.url==="/"&&["GET","HEAD"].includes(req.method));
      res.writeHead(live?200:503,{"Content-Type":"application/json","Cache-Control":"no-store","Retry-After":"15"});
      res.end(JSON.stringify({live:true,ready:false,error:"migration_not_activated"}));return;
    }
    const upstream=http.request({hostname:"127.0.0.1",port:backend,path:req.url,method:req.method,headers:req.headers},response=>{
      res.writeHead(response.statusCode,response.headers);response.pipe(res);
    });
    upstream.on("error",()=>{if(!res.headersSent)res.writeHead(503,{"Content-Type":"application/json"});res.end('{"error":"sql_runtime_unavailable"}');});
    req.pipe(upstream);
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"0.0.0.0",resolve);});
  let lastReason = null;
  async function attempt(){
    if(stopping)return;
    // The app binds loopback only; the maintenance/public listener stays open
    // throughout all failed approval/database/storage checks.
    const reservation=http.createServer();await new Promise(r=>reservation.listen(0,"127.0.0.1",r));
    internal=reservation.address().port;await new Promise(r=>reservation.close(r));
    process.env.PORT=String(internal);process.env.HOST="127.0.0.1";
    try{running=await startRuntime();if(stopping){await running.close();return;}backend=internal;}
    catch(error){
      const allowed = new Set([
        "fresh_activation_approval_required",
        "fresh_controlled_delivery_verification_required",
        "fresh_smtp_authentication_required",
        "fresh_production_secrets_required",
        "fresh_owner_binding_required",
        "fresh_destination_binding_mismatch",
        "fresh_bucket_binding_mismatch",
        "fresh_registration_policy_required"
      ]);
      const rawCode = typeof error?.code === "string" ? error.code : "";
      const rawMessage = typeof error?.message === "string" ? error.message : "";
      const code = /^fresh_[a-z_]+$/.test(rawCode)
        ? rawCode
        : /^fresh_[a-z_]+$/.test(rawMessage)
          ? rawMessage
          : rawCode;
      const reason = (
        allowed.has(code) ||
        /^fresh_[a-z_]+$/.test(code)
      ) ? code : (
        ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND",
         "ECONNRESET", "EAI_AGAIN"].includes(code)
          ? "NETWORK_" + code
          : "OTHER_BLOCKER"
      );
      if (!stopping) {
        if (reason !== lastReason) {
          console.log(JSON.stringify({
            FRESH_RUNTIME: "BLOCKED",
            reason,
            errorType: ["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError"].includes(error?.name)
              ? error.name : "OTHER",
            codePresent: typeof error?.code === "string"
          }));
          lastReason = reason;
        }
        timer = setTimeout(attempt, retryMs);
        timer.unref();
      }
    }
  }
  const initial=maintenanceOnly?undefined:setTimeout(attempt,50);initial?.unref();
  return {server,close:async()=>{stopping=true;clearTimeout(initial);clearTimeout(timer);await new Promise(r=>server.close(r));if(running)await running.close();}};
}
module.exports={launch};
if(require.main===module)launch().then(app=>{for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>app.close().finally(()=>process.exit(0)));})
  .catch(()=>{console.error("minimal_maintenance_listener_failed");process.exitCode=1;});
