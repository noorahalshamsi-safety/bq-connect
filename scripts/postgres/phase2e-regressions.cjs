// Redirect evidence only. Original suite files and assertions stay unchanged.
const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"../.."),which=process.argv[2];
const from=path.join(root,"generated-artifacts/phase2d"),to=path.join(root,"generated-artifacts/phase2e/regressions");
for(const method of ["mkdirSync","writeFileSync"]){const original=fs[method];fs[method]=function(p,...args){if(typeof p==="string"&&(p===from||p.startsWith(from+path.sep)))p=to+p.slice(from.length);return original.call(this,p,...args);};}
if(which==="background")require("./phase2d-tests.cjs");else require("./phase2d-regressions.cjs");
