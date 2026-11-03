// Private extension: a scan window is a continuation, not a truncated result.
// All original graph/byte/query guards stay in the Phase 2E implementation.
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const filename=path.resolve(__dirname,"../phase2e-candidate.cjs"),source=fs.readFileSync(filename,"utf8"),marker='if(scanned>=maxScanned)fail("component_scan_budget");';
if(!source.includes(marker))throw Error("candidate_source_contract_changed");
const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
m._compile(source.replace(marker,"if(scanned>=maxScanned)break;"),filename);
module.exports=m.exports;
