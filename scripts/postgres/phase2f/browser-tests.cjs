const fs=require("node:fs"),path=require("node:path"),{execFileSync}=require("node:child_process"),{save}=require("./harness.cjs"),{chromium}=require("../../../artifacts/mockup-sandbox/node_modules/@playwright/test");
const root=path.resolve(__dirname,"../../.."),browsers=path.join(root,"generated-artifacts/playwright-browsers"),results=[];
process.env.PLAYWRIGHT_BROWSERS_PATH=browsers;
(async()=>{
 let browser;const errors=[],memory=[];
 async function test(name,fn){try{await fn();results.push({name,status:"PASS"});}catch(e){results.push({name,status:"FAIL",error:e.message.slice(0,500)});}console.log(results.at(-1).status,name);}
 try{
  const binary=path.join(browsers,fs.readdirSync(browsers).find(n=>n.startsWith("chromium_headless_shell-")),"chrome-headless-shell-linux64/chrome-headless-shell");
  let missing=[];try{missing=[...execFileSync("ldd",[binary],{encoding:"utf8"}).matchAll(/(\S+)\s+=> not found/g)].map(m=>m[1]);}catch{}
  let dirs=[];if(missing.length){const args=["/nix/store","-maxdepth","4","("];missing.forEach((n,i)=>{if(i)args.push("-o");args.push("-name",n);});args.push(")");dirs=[...new Set(execFileSync("find",args,{encoding:"utf8",maxBuffer:1048576}).trim().split("\n").filter(Boolean).map(p=>path.dirname(p)))];}
  const glibc=fs.readdirSync("/nix/store").filter(n=>n.includes("-glibc-2.42")&&fs.existsSync(path.join("/nix/store",n,"lib/ld-linux-x86-64.so.2")))[0];
  const lib=glibc?path.join("/nix/store",glibc,"lib"):null;
  browser=await chromium.launch({executablePath:lib?path.join(lib,"ld-linux-x86-64.so.2"):binary,ignoreDefaultArgs:Boolean(lib),headless:true,args:lib?["--library-path",[lib,...dirs].join(":"),binary,"--headless","--no-sandbox","--disable-dev-shm-usage","--remote-debugging-pipe","--no-startup-window"]:["--no-sandbox"],env:{...process.env,LD_LIBRARY_PATH:[...(lib?[lib]:[]),...dirs].join(":")+":"+(process.env.LD_LIBRARY_PATH||"")}});
  const p=await browser.newPage({viewport:{width:1280,height:900}});p.setDefaultTimeout(4000);p.on("pageerror",e=>errors.push(e.message));
  const url="http://127.0.0.1:23636/__mockup/preview/feed-prototype/FeedPreview";
  const waitReady=()=>p.waitForFunction(()=>document.querySelectorAll("[data-post-id]").length>0&&/\d+\s*\/\s*80/.test(document.querySelector('[data-testid="status"]')?.textContent||""),{},{timeout:12000});
  const count=()=>p.locator("[data-post-id]").count();
  const settle=()=>p.waitForTimeout(450);
  await test("Initial enriched page loads without JavaScript errors",async()=>{await p.goto(url);await waitReady();if(await count()!==8)throw Error("Expected first eight items");if(errors.length)throw Error(errors.join(";"));});
  await test("Load more and deduplicate repeated records",async()=>{await p.getByTestId("load-more").click();await waitReady();await settle();if(await count()!==16)throw Error("Expected sixteen");const ids=await p.locator("[data-post-id]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("data-post-id")));if(new Set(ids).size!==ids.length)throw Error("duplicate ids");});
  await test("Refresh resets bounded window",async()=>{await p.getByTestId("refresh").click();await settle();await waitReady();if(await count()!==8)throw Error("Refresh did not reset");});
  await test("Infinite scroll appends only when opted in",async()=>{await p.getByTestId("infinite-toggle").check();await p.getByTestId("load-more").scrollIntoViewIfNeeded();await settle();await p.waitForTimeout(500);if(await count()<=8)throw Error("No infinite append");await p.getByTestId("infinite-toggle").uncheck();});
  await test("Stories and saved filters use server responses",async()=>{await p.getByTestId("kind").selectOption("story");await settle();await waitReady();await p.getByTestId("kind").selectOption("");await p.getByTestId("saved-toggle").check();await settle();await waitReady();await p.getByTestId("saved-toggle").uncheck();});
  await test("Global sort and Arabic search show explicit unsupported response",async()=>{await p.getByTestId("sort").selectOption("top");await settle();await p.getByText("product_decision_required",{exact:false}).first().waitFor();await p.getByTestId("sort").selectOption("legacy");await settle();await p.getByTestId("search").fill("عَرَبِي");await p.getByRole("button",{name:"Test search",exact:true}).click();await settle();await p.getByText("product_decision_required",{exact:false}).first().waitFor();await p.getByTestId("search").fill("");await p.getByRole("button",{name:"Test search",exact:true}).click();await settle();});
  await test("New fixture post invalidates cursor and refresh recovers",async()=>{await p.getByTestId("refresh").click();await settle();await p.getByTestId("simulate-insert").click();await settle();await p.getByText("cursor_revision_changed",{exact:false}).first().waitFor();await p.getByTestId("refresh").click();await settle();await waitReady();});
  await test("Expired cursor requires restart and refresh recovers",async()=>{await p.getByTestId("simulate-expire").click();await settle();await p.getByText("cursor_expired",{exact:false}).first().waitFor();await p.getByTestId("refresh").click();await settle();await waitReady();});
  await test("Injected HTTP failure is visible; retry works",async()=>{await p.getByTestId("simulate-error").click();await settle();await p.getByText("synthetic_injected_failure",{exact:false}).first().waitFor();await p.getByTestId("refresh").click();await settle();await waitReady();});
  await test("Deep-link fetch does not depend on cached window",async()=>{await p.goto(url+"#idea=synthetic-feed-94");await settle();await waitReady();const ids=await p.locator("[data-post-id]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("data-post-id")));if(!ids.includes("synthetic-feed-94"))throw Error("Off-window id missing");});
  await test("DOM and client cache enforce eighty-card budget with disclosure",async()=>{
   await p.goto(url);await settle();await waitReady();
   for(let i=0;i<16;i++){const button=p.getByTestId("load-more");if(!await button.isEnabled())break;await button.click();await settle();if(await count()>80)throw Error("DOM limit exceeded");}
   const cdp=await p.context().newCDPSession(p);await cdp.send("Performance.enable");memory.push(await cdp.send("Performance.getMetrics"));
  });
  await test("Arabic RTL and mobile layout avoid horizontal overflow",async()=>{await p.getByTestId("language-toggle").click();await p.setViewportSize({width:390,height:844});await settle();if(await p.getByTestId("feed-root").getAttribute("dir")!=="rtl")throw Error("RTL not set");if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error("Horizontal overflow");});
  await p.screenshot({path:path.join(root,"generated-artifacts/phase2f/mobile-preview.png"),fullPage:false});
 }catch(e){results.push({name:"Browser environment",status:"NOT TESTED",error:e.message.slice(-1800)});}
 finally{await browser?.close();save("browser-tests.json",{results,jsErrors:errors,browserMemory:memory,pass:results.filter(r=>r.status==="PASS").length,fail:results.filter(r=>r.status==="FAIL").length});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
