// Scoped copies only: legacy/shared public assets are never overwritten.
const fs = require("node:fs"), path = require("node:path");
const { need } = require("./config.cjs");
function transform(source) {
  const begin = source.indexOf('document.querySelector("#register-form").addEventListener');
  const end = source.indexOf('document.querySelector("#forgot-form").addEventListener', begin);
  need(begin > 0 && end > begin, "fresh_client_registration_contract_changed");
  source = source.slice(0, begin) + fs.readFileSync(path.join(__dirname, "registration-client.txt"), "utf8") +
    "\n" + source.slice(end);
  const forgot = source.indexOf('document.querySelector("#forgot-form").addEventListener');
  const forgotEnd = source.indexOf("const JOIN_ERRORS", forgot);
  need(forgot > 0 && forgotEnd > forgot, "fresh_client_recovery_contract_changed");
  source = source.slice(0, forgot) + fs.readFileSync(path.join(__dirname, "recovery-client.txt"), "utf8") +
    "\n" + source.slice(forgotEnd);
  const paint = "  tfaOnView(body, data.status);";
  need(source.includes(paint), "fresh_client_optional_totp_contract_changed");
  source = source.replace(paint, `
  if (data.status.enabled) { tfaOnView(body, data.status); return; }
  const password = tfaInput("password"), enable = tfaButton("Enable Authenticator / تفعيل المصادقة", "primary");
  password.placeholder = "Current password / كلمة المرور الحالية";
  enable.addEventListener("click", async () => {
    enable.disabled = true;
    const setup = await tfaCall({ op: "setup", password: password.value }, error);
    enable.disabled = false;
    if (!setup) return;
    tfaSetupView(body, setup, async (code, codeError) => {
      const enrolled = await tfaCall({ op: "enroll", password: password.value, code }, codeError);
      if (!enrolled) return false;
      tfaState(enrolled.status);
      tfaRecoveryView(body, enrolled.recovery, false);
      return true;
    });
  });
  body.replaceChildren(password, error, enable);`);
  return source;
}
function prepare(publicDir, workspace) {
  const htmlFile = path.join(publicDir, "index.html");
  let html = fs.readFileSync(htmlFile, "utf8");
  need(html.includes('content="width=device-width, initial-scale=1"'), "fresh_mobile_viewport_contract_changed");
  html = html.replace('content="width=device-width, initial-scale=1"',
    'content="width=device-width, initial-scale=1, viewport-fit=cover"')
    .replace("</head>", '<link rel="stylesheet" href="/css/fresh-mobile.css"></head>');
  fs.writeFileSync(htmlFile, html);
  const cssDir = path.join(publicDir, "css");
  if (fs.lstatSync(cssDir).isSymbolicLink()) fs.unlinkSync(cssDir);
  fs.mkdirSync(cssDir, { recursive: true });
  for (const item of fs.readdirSync(path.join(workspace, "public/css"))) {
    const dest = path.join(cssDir, item);
    if (!fs.existsSync(dest)) fs.symlinkSync(path.join(workspace, "public/css", item), dest);
  }
  fs.copyFileSync(path.join(__dirname, "mobile-layout.css"), path.join(cssDir, "fresh-mobile.css"));
  const dir = path.join(publicDir, "js");
  if (fs.lstatSync(dir).isSymbolicLink()) fs.unlinkSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  for (const item of fs.readdirSync(path.join(workspace, "public/js"))) {
    const dest = path.join(dir, item);
    if (item === "secure.js")
      fs.writeFileSync(dest, transform(fs.readFileSync(path.join(workspace, "public/js", item), "utf8")));
    else if (item === "app.js") {
      // Replace only the fresh runtime's copy, not a symlink into the source.
      if (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink()) fs.unlinkSync(dest);
      fs.writeFileSync(dest, require("./mobile-client.cjs").transform(require("./post-client.cjs").transform(
        fs.readFileSync(path.join(workspace, "public/js", item), "utf8"))));
    }
    else if (!fs.existsSync(dest)) fs.symlinkSync(path.join(workspace, "public/js", item), dest);
  }
  const css = fs.readFileSync(path.join(__dirname, "mobile-layout.css"));
  const revision = require("node:crypto").createHash("sha256").update(css)
    .update(fs.readFileSync(path.join(dir, "app.js"))).digest("hex").slice(0, 16);
  let worker = fs.readFileSync(path.join(workspace, "public/sw.js"), "utf8");
  need(/const CACHE = "[^"]+";/.test(worker) && worker.includes('  "/css/app.css",'), "fresh_worker_cache_contract_changed");
  worker = worker.replace(/const CACHE = "[^"]+";/, `const CACHE = "bq-fresh-mobile-${revision}";`)
    .replace('  "/css/app.css",', '  "/css/app.css",\n  "/css/fresh-mobile.css",\n  "/synthetic-request.js",');
  const swFile = path.join(publicDir, "sw.js");
  if (fs.existsSync(swFile) && fs.lstatSync(swFile).isSymbolicLink()) fs.unlinkSync(swFile);
  fs.writeFileSync(swFile, worker);
}
module.exports = { transform, prepare };
