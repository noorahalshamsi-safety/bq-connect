// Entry point for Replit. Restores data from App Storage before the server reads any file,
// then keeps App Storage up to date while the app runs.
const path = require("path");
const storage = require("./storage-sync");

async function main() {
  if (!storage.enabled()) {
    require("./server");
    return;
  }
  process.env.BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");
  const preferLocal = String(process.env.BQ_PREFER_LOCAL || "").split(",").map((name) => name.trim()).filter(Boolean);
  const sync = storage.createSync({ client: await storage.connect(), dirs: ["data", "backups"], preferLocal });
  await sync.restore();
  sync.start();
  require("./server");
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await sync.stop();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
