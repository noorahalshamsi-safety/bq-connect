// Only runs copied production source with a filesystem mock and a sanitized env.
const path = require("node:path");
const fs = require("node:fs");
const { FileStorage, assertTemporary } = require("./file-storage.cjs");

const settings = JSON.parse(process.argv[2]);
const app = assertTemporary(settings.app);
const client = new FileStorage(settings.objects, settings.storageOptions);
const storage = require(path.join(app, "storage-sync.js"));
if (settings.failPromotion) {
  let promoting = false;
  const vault = require(path.join(app, "vault.js"));
  const applyRestore = vault.applyRestore;
  vault.applyRestore = async (...args) => {
    promoting = true;
    try { return await applyRestore(...args); } finally { promoting = false; }
  };
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (promoting && to === path.join(app, "data", settings.failPromotion)) throw new Error("injected promotion failure");
    return rename(from, to);
  };
}
storage.connect = async () => {
  if (settings.connectionFailure) throw new Error("injected connection failure");
  return client;
};
require(path.join(app, settings.localOnly ? "server.js" : "start.js"));
