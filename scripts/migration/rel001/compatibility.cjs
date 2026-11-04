// Run unchanged original compatibility assertions; redirect evidence only.
const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"../../..");
const which=process.argv[2];
if(!["e2e","parity"].includes(which))throw Error("Use e2e or parity");
const from=path.join(root,"generated-artifacts/phase2d"),to=path.join(root,"generated-artifacts/rel001-evidence/compatibility");
for(const method of ["mkdirSync","writeFileSync"]){
 const original=fs[method];
 fs[method]=function(p,...args){if(typeof p==="string"&&(p===from||p.startsWith(from+path.sep)))p=to+p.slice(from.length);return original.call(this,p,...args);};
}
require("../../postgres/phase2d-regressions.cjs");
