// Evidence redirect only; original test bytes and assertions remain unchanged.
const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"../../.."),from=path.join(root,"generated-artifacts/phase2e"),to=path.join(root,"generated-artifacts/phase2f");
for(const method of ["mkdirSync","writeFileSync"]){const original=fs[method];fs[method]=function(p,...args){if(typeof p==="string"&&(p===from||p.startsWith(from+path.sep)))p=to+p.slice(from.length);return original.call(this,p,...args);};}
require("../phase2e-regressions.cjs");
