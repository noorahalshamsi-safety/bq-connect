const C=require("./common.cjs");
function args(argv){
 const [command,...rest]=argv,allowed=["--lab","--source-id","--target-id","--manifest-sha"],o={};
 for(let i=0;i<rest.length;i+=2){if(!allowed.includes(rest[i])||!rest[i+1]||Object.hasOwn(o,rest[i]))C.fail("unsupported_option");o[rest[i]]=rest[i+1];}
 if(command==="new-lab"){if(rest.length)C.fail("new_lab_takes_no_target");return{command};}
 if(!["import","reconcile","reverse","resume","stop","status"].includes(command))C.fail("unsupported_command");
 if(allowed.some(k=>!o[k]))C.fail("explicit_identity_required");
 return{command,root:o["--lab"],expected:{sourceId:o["--source-id"],targetId:o["--target-id"],manifestSha:o["--manifest-sha"]}};
}
async function main(argv){
 const a=args(argv);
 if(a.command==="new-lab")return require("./lab.cjs").create();
 if(a.command==="import")return require("./import.cjs").importSource(a.root,a.expected);
 if(a.command==="reconcile")return require("./reconcile.cjs").reconcile(a.root,a.expected);
 if(a.command==="reverse")return require("./export.cjs").reverse(a.root,a.expected);
 const c=C.context(a.root,a.expected);
 if(a.command==="stop"){C.stop(c);return{status:"OWNED_CLUSTER_STOPPED"};}
 if(a.command==="resume"){C.resume(c);return{status:"OWNED_CLUSTER_RESUMED_WITHOUT_INITIALIZATION"};}
 const p=C.pool(c);
 try{const client=await p.connect();try{await C.attest(client,c);return{sourceId:c.meta.sourceId,targetId:c.meta.targetId,
   journal:C.parse(C.safeFile(C.path.join(c.target,"journal.json"))),receiptCount:(await client.query("SELECT count(*)::int AS n FROM migration.receipt")).rows[0].n,authority:"NOT ACTIVATED / STAGING ONLY"};}finally{client.release();}}finally{await p.end();}
}
if(require.main===module)main(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{
 // Do not print PG detail/values, credentials, source records or stack traces.
 console.error(JSON.stringify({status:"REFUSED",code:/^[a-zA-Z0-9_:.,/-]+$/.test(e.code||"")?e.code:"migration_operation_failed"}));process.exitCode=1;
});
module.exports={args,main};
