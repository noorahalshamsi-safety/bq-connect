const assert=require("node:assert/strict"),crypto=require("node:crypto");
const {membership}=require("./membership-evidence.cjs");
const key=crypto.randomBytes(32),base={domain:"accounts",sourceFingerprint:"a".repeat(64),generation:"invented-frozen-1",identifiers:["00101","Ab07","ab07"]};
const results=[];
function test(name,fn){try{fn();results.push({name,status:"PASS"});}catch{results.push({name,status:"FAIL"});}}
test("Reports only algorithm/domain/count/keyed fingerprint",()=>assert.deepEqual(Object.keys(membership(base,key)).sort(),["algorithm","count","domain","fingerprint"]));
test("Order-independent membership without source mutation",()=>{const before=[...base.identifiers];assert.deepEqual(membership(base,key),membership({...base,identifiers:[...before].reverse()},key));assert.deepEqual(base.identifiers,before);});
test("Equal-count substitution changes fingerprint",()=>assert.notEqual(membership(base,key).fingerprint,membership({...base,identifiers:["00101","Ab07","other"]},key).fingerprint));
test("Leading zeros are not normalized",()=>assert.notEqual(membership(base,key).fingerprint,membership({...base,identifiers:["101","Ab07","ab07"]},key).fingerprint));
test("Case is not folded",()=>assert.notEqual(membership(base,key).fingerprint,membership({...base,identifiers:["00101","AB07","ab07"]},key).fingerprint));
test("Context and domain are bound",()=>{for(const change of [{domain:"employees"},{generation:"invented-frozen-2"},{sourceFingerprint:"b".repeat(64)}])assert.notEqual(membership(base,key).fingerprint,membership({...base,...change},key).fingerprint);});
test("Independent audit keys produce different evidence",()=>assert.notEqual(membership(base,key).fingerprint,membership(base,crypto.randomBytes(32)).fingerprint));
test("Absent/short custody key is refused",()=>{for(const bad of [undefined,Buffer.alloc(4)])assert.throws(()=>membership(base,bad),{code:"audit_key_required"});});
test("Duplicate and coerced identifiers are refused",()=>{assert.throws(()=>membership({...base,identifiers:["x","x"]},key),{code:"duplicate_inventory_identifier"});assert.throws(()=>membership({...base,identifiers:[101]},key),{code:"stable_string_identifiers_required"});});
test("Missing source/generation context is refused",()=>assert.throws(()=>membership({...base,generation:undefined},key),{code:"inventory_context_required"}));
console.log(JSON.stringify({scope:"invented identities only; no protected source read",pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length,results}));
if(results.some(r=>r.status!=="PASS"))process.exitCode=1;
