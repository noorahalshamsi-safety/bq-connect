const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {save,output}=require("./phase2c-support.cjs");
const code=`
 const assert=require("node:assert/strict");
 let network=0;
 for(const name of ["http","https"]){const m=require(name);m.request=m.get=()=>{network++;throw Error("Offline SDK smoke: network forbidden");};}
 global.fetch=()=>{network++;throw Error("Offline SDK smoke: network forbidden");};
 const sdk=require("@replit/object-storage"),uuid=require("uuid");
 assert.equal(typeof sdk.Client,"function");
 const methods=Object.getOwnPropertyNames(sdk.Client.prototype);
 for(const method of ["list","uploadFromBytes","downloadAsBytes","delete"])assert(methods.includes(method));
 assert.match(uuid.v4(),/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
 console.log(JSON.stringify({status:"PASS",exports:Object.keys(sdk),methods,networkAttempts:network,
 limits:"No client instantiated, no provider CRUD or production credential access; package APIs unchanged, not hosted-storage certification."}));
`;
const child=spawnSync(process.execPath,["-e",code],{cwd:path.resolve(__dirname,"../.."),env:{PATH:process.env.PATH,HOME:output},encoding:"utf8",timeout:20000});
let smoke;try{smoke=JSON.parse(child.stdout.trim());}catch{smoke={status:"BLOCKED",reason:"Offline module smoke did not complete"};}
const result={
 status:"OPEN",severity:"HIGH",installed:"uuid@9.0.1",
 paths:["@replit/object-storage@1.0.0 > @google-cloud/storage@7.22.0 > gaxios@6.7.1 > uuid@9.0.1","@replit/object-storage@1.0.0 > @google-cloud/storage@7.22.0 > teeny-request@9.0.0 > uuid@9.0.1"],
 registryEvidence:{sdkLatest:"1.0.0",sdkStorageRange:"^7.7.0",storageLatest:"8.4.0",storageLatestGaxios:"^7.1.4",storageLatestTeeny:"^11.0.1",checked:"2026-11-03"},
 callSiteReview:["gaxios multipart boundary uses uuid.v4()","teeny-request multipart boundary uses uuid.v4()"],
 advisoryScope:"Reported advisory affects v3/v5/v6 caller-supplied output-buffer bounds. Reviewed call sites use v4. This does not erase the advisory or certify all transitive reachability.",
 remediation:"No supported SDK release with a compatible fixed dependency chain was identified. Storage 8.x is outside the SDK's declared 7.x range. No forced major override, package change, SDK replacement or provider test.",
 smoke
};
save("dependency-review.json",result);console.log(JSON.stringify({advisory:result.status,smoke:smoke.status}));
