// Scoped copies only: legacy/shared public assets are never overwritten.
const fs = require("node:fs"), path = require("node:path");
const { need } = require("./config.cjs");
function transform(source) {
  const begin = source.indexOf('document.querySelector("#register-form").addEventListener');
  const end = source.indexOf('document.querySelector("#forgot-form").addEventListener', begin);
  need(begin > 0 && end > begin, "fresh_client_registration_contract_changed");
  source = source.slice(0, begin) + fs.readFileSync(path.join(__dirname, "registration-client.txt"), "utf8") +
    "\n" + source.slice(end);
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
  const dir = path.join(publicDir, "js");
  if (fs.lstatSync(dir).isSymbolicLink()) fs.unlinkSync(dir);
  fs.mkdirSync(dir, { recursive: true });
  for (const item of fs.readdirSync(path.join(workspace, "public/js"))) {
    const dest = path.join(dir, item);
    if (item === "secure.js")
      fs.writeFileSync(dest, transform(fs.readFileSync(path.join(workspace, "public/js", item), "utf8")));
    else if (!fs.existsSync(dest)) fs.symlinkSync(path.join(workspace, "public/js", item), dest);
  }
}
module.exports = { transform, prepare };
