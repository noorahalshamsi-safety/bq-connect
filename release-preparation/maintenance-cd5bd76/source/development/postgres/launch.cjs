// Only the development workflow uses this launcher. Never use it in deployment.
const fs=require("node:fs"),path=require("node:path"),net=require("node:net");
const {spawn}=require("node:child_process");
const {prepare}=require("./isolation.cjs"),{Repository}=require("./repository.cjs"),{create}=require("./fixtures.cjs");
async function launch(root) {
  const proof=prepare(root),repo=new Repository(proof);
  const exists=await repo.pool.query("SELECT to_regclass('dev.authority') AS found");
  if(!exists.rows[0].found){
    const fixture=create(proof.sessionKey);
    await repo.initialize(fixture.files);
    fs.writeFileSync(path.join(proof.root,"synthetic-credentials.json"),JSON.stringify(fixture.credentials),{mode:0o600,flag:"wx"});
  } else {const c=await repo.pool.connect();try{await repo.verify(c);}finally{c.release();}}
  await repo.pool.end();
  const child=spawn(process.execPath,[path.join(__dirname,"runtime.cjs"),proof.root],{cwd:proof.app,env:proof.childEnv,stdio:"inherit"});
  return {proof,child};
}
if(require.main===module)launch(process.argv[2]).then(({proof,child})=>{
  console.log("Synthetic PostgreSQL development only; no production storage is connected.");
  const routed=Number(process.env.PORT)||4173;
  const alias=routed===5000?null:net.createServer(socket=>{const target=net.connect(5000,"127.0.0.1");socket.on("error",()=>target.destroy());target.on("error",()=>socket.destroy());socket.pipe(target).pipe(socket);});
  alias?.listen(routed,"0.0.0.0");
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;alias?.close();child.kill("SIGTERM");};
  process.on("SIGINT",stop);process.on("SIGTERM",stop);
  child.on("exit",code=>{alias?.close();try{proof.stop();}catch{}process.exit(code||0);});
}).catch(e=>{console.error("Synthetic development refused:",e.code||e.message);process.exit(1);});
module.exports={launch};
