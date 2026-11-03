// Original assertions and bytes are unchanged. Redirect only evidence writes.
const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"../.."),which=process.argv[2];
if(!["e2e","hardening","parity"].includes(which))throw Error("Use e2e, hardening or parity");
const to=path.join(root,"generated-artifacts/phase2d/verification"),prefixes=["phase2b","phase2c"].map(p=>path.join(root,"generated-artifacts",p));
const redirect=p=>{if(typeof p!=="string")return p;for(const from of prefixes)if(p===from||p.startsWith(from+path.sep))return to+p.slice(from.length);return p;};
for(const method of ["mkdirSync","writeFileSync"]){const original=fs[method];fs[method]=function(p,...rest){return original.call(this,redirect(p),...rest);};}
process.argv[2]="phase2b";require(which==="parity"?"./phase2c-parity.cjs":`./${which}.cjs`);
