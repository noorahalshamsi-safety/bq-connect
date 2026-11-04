// Standard Playwright launch only; no loader patches, authentication bypass or UI claims.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../../.."),out=path.join(root,"generated-artifacts/phase2g");
process.env.PLAYWRIGHT_BROWSERS_PATH=path.join(root,"generated-artifacts/playwright-browsers");
(async()=>{
 let browser;const evidence={status:"NOT TESTED",authenticatedActionsExecuted:0,configuration:"Installed @playwright/test; standard chromium.launch({headless:true,timeout:15000}); existing cached browser, no custom loader."};
 try{
  const {chromium}=require("../../../artifacts/mockup-sandbox/node_modules/@playwright/test");
  browser=await chromium.launch({headless:true,timeout:15000});
  evidence.launch="PASS";evidence.reason="Browser launches, but authenticated certification has not yet executed.";
 }catch(e){evidence.launch="BLOCKED";evidence.reason=e.message.slice(-6000);}
 finally{await browser?.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,"browser-environment.json"),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));}
})();
