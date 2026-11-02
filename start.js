// Entry point for Replit. Restores data from App Storage before the server reads any file,
// then keeps App Storage up to date while the app runs.
const http = require("http");
const path = require("path");
const storage = require("./storage-sync");

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const RESTORE_WINDOW_MS = Number(process.env.BQ_STORAGE_WAIT_MS) || 60000;
const STARTING_PAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="4"><title>BQ Connect</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif;background:#0b0c0f;color:#fff"><p>BQ Connect يجهز، لحظات...</p></body></html>`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function holdPort() {
  const placeholder = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "4" });
    res.end(STARTING_PAGE);
  });
  return new Promise((resolve) => {
    placeholder.once("error", () => resolve(null));
    placeholder.listen(PORT, HOST, () => resolve(placeholder));
  });
}

function releasePort(placeholder) {
  if (!placeholder) return Promise.resolve();
  return new Promise((resolve) => {
    placeholder.close(() => resolve());
    if (placeholder.closeAllConnections) placeholder.closeAllConnections();
  });
}

async function restoreWithRetry(preferLocal) {
  const started = Date.now();
  let delay = 1000;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const sync = storage.createSync({ client: await storage.connect(), dirs: ["data", "backups"], preferLocal });
      await sync.restore();
      return sync;
    } catch (error) {
      const left = RESTORE_WINDOW_MS - (Date.now() - started);
      console.error(`App Storage not ready (attempt ${attempt}): ${error.message}`);
      if (left <= 0) return null;
      await wait(Math.min(delay, left));
      delay = Math.min(delay * 2, 8000);
    }
  }
}

async function main() {
  if (!storage.enabled()) {
    require("./server");
    return;
  }
  process.env.BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");
  const preferLocal = String(process.env.BQ_PREFER_LOCAL || "").split(",").map((name) => name.trim()).filter(Boolean);
  const placeholder = await holdPort();
  const sync = await restoreWithRetry(preferLocal);
  await releasePort(placeholder);
  if (!sync) {
    console.error("App Storage unavailable: running on the bundled data folder. Changes in this run are NOT copied to App Storage. Check the App Storage tab, then republish.");
    require("./server");
    return;
  }
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
