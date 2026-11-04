// Temporary synthetic managed-development preview. Never modifies workflows.
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
if(process.env.REPLIT_DEPLOYMENT==="1")throw Error("managed_development_only");
const root=path.resolve(__dirname,"../../generated-artifacts/managed-development");
const keys=JSON.parse(fs.readFileSync(path.join(root,"keys.json"),"utf8"));
const directory=JSON.parse(fs.readFileSync(path.join(root,"mock-directory.json"),"utf8"));
const child=spawn(process.execPath,["scripts/managed/test-child.cjs",root],{cwd:path.resolve(__dirname,"../.."),env:{
  PATH:process.env.PATH,HOME:root,LANG:"C.UTF-8",REPL_ID:process.env.REPL_ID,DATABASE_URL:process.env.DATABASE_URL,
  BQ_MANAGED_MANIFEST_FILE:path.join(root,"manifest.json"),BQ_MANAGED_SESSION_KEY:keys.sessionKey,
  BQ_MANAGED_BACKUP_KEY:keys.backupKey,BQ_MANAGED_MOCK_DIRECTORY:directory,PORT:"5134",BQ_MANAGED_POOL_MAX:"3"
},stdio:["ignore","inherit","inherit"]});
process.on("SIGINT",()=>child.kill("SIGINT"));process.on("SIGTERM",()=>child.kill("SIGTERM"));
child.on("exit",code=>process.exit(code||0));
