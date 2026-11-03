// Execute the original test files byte-for-byte. Only output writes/mkdirs are
// redirected, so all Phase 2B report/evidence files remain intact.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../.."),which=process.argv[2];
if(!["e2e","hardening"].includes(which))throw Error("Use e2e or hardening");
const from=path.join(root,"generated-artifacts/phase2b"),to=path.join(root,"generated-artifacts/phase2c/verification");
const redirect=p=>typeof p==="string"&&(p===from||p.startsWith(from+path.sep))?to+p.slice(from.length):p;
for(const method of ["writeFileSync","mkdirSync"]){const original=fs[method];fs[method]=function(p,...rest){return original.call(this,redirect(p),...rest);};}
process.argv[2]="phase2b";require(`./${which}.cjs`);
