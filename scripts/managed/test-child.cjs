// Test-only client outage injection and actual SQL audit. Never loaded by CLI.
const fs=require("node:fs"),path=require("node:path"),pg=require("pg");
const root=process.argv[2],Original=pg.Pool;
pg.Pool=class extends Original{
  constructor(options){
    super(options);
    this.on("connect",client=>{
      const query=client.query;
      client.query=function(...args){
        const sql=typeof args[0]==="string"?args[0]:args[0]?.text||"";
        if(/\b(CREATE|ALTER|DROP|TRUNCATE)\s+(TABLE|SCHEMA|INDEX|ROLE|FUNCTION|TRIGGER)/i.test(sql))
          fs.writeFileSync(path.join(root,"runtime-ddl-detected"),"unexpected DDL",{mode:0o600});
        return query.apply(this,args);
      };
    });
  }
  connect(...args){
    if(fs.existsSync(path.join(root,"inject-client-outage"))){
      const error=Object.assign(Error("injected_client_connection_loss"),{code:"ECONNREFUSED"});
      const callback=args.at(-1);
      if(typeof callback==="function"){queueMicrotask(()=>callback(error));return;}
      return Promise.reject(error);
    }
    return super.connect(...args);
  }
};
const {FileStorage}=require("../forensics/file-storage.cjs");
const {start}=require("../../deploy/managed/runtime.cjs");
(async()=>{
  const app=await start({storeClient:new FileStorage(process.env.BQ_MANAGED_MOCK_DIRECTORY)});
  let closing=false;const stop=()=>{if(closing)return;closing=true;app.close().then(()=>process.exit(0),()=>process.exit(1));};
  process.on("SIGTERM",stop);process.on("SIGINT",stop);
})().catch(e=>{console.error(JSON.stringify({refused:e.code||e.message}));process.exit(1);});
