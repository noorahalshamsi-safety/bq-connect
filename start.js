// Development safety repair: deployment activation is intentionally fenced.
// Do not publish until manifest adoption and a durable commit provider are approved.
const http = require("http");
const path = require("path");
const storage = require("./storage-sync");
const vault = require("./vault");
const safety = require("./persistence-safety");

const AUTO_SNAPSHOT_MS = 6 * 60 * 60 * 1000;
const STOP_SNAPSHOT_MS = 15000;
const DROP_HINT = "Review the repair report. Do not restore/import/reset or override integrity checks without explicit approval.";

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const STARTING_PAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10"><title>BQ Connect</title></head><body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif;background:#0b0c0f;color:#fff;text-align:center"><div><p style="font-size:1.2rem;font-weight:700">BQ Connect تحت الصيانة، ارجع بعد دقائق</p><p style="opacity:.7">BQ Connect is under maintenance, please check back in a few minutes</p></div></body></html>`;
const LINK_HINT = "Storage activation is blocked. Operator review is required; the authenticated application remains unavailable.";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function holdPort() {
  const placeholder = http.createServer((req, res) => {
    const route = (req.url || "").split("?")[0];
    if (route === "/health/live" || route === "/health/ready") {
      res.writeHead(route === "/health/live" ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify({ live: true, ready: false }));
    }
    res.writeHead(503, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "10" });
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
  let delay = 1000;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const client = await storage.connect();
      await safety.preflight(client);
      const sync = storage.createSync({ client, dirs: ["data", "backups"], preferLocal });
      await sync.restore();
      return { client, sync };
    } catch (error) {
      if (attempt <= 3 || attempt % 10 === 0) console.error(`App Storage not ready (attempt ${attempt}): ${error.message}`);
      if (attempt === 4) console.error(LINK_HINT);
      await wait(delay);
      delay = Math.min(delay * 2, 15000);
    }
  }
}

async function main() {
  if (!storage.enabled()) {
    if (process.env.REPLIT_DEPLOYMENT) throw safety.fault("deployment_storage_disabled");
    require("./server");
    return;
  }
  process.env.BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "backups");
  const preferLocal = String(process.env.BQ_PREFER_LOCAL || "").split(",").map((name) => name.trim()).filter(Boolean);
  const placeholder = await holdPort();
  const { client, sync } = await restoreWithRetry(preferLocal);
  const request = await vault.pendingRestore(client);
  const merge = await vault.pendingImport(client);
  if (request) {
    const result = await vault.applyRestore(client, request);
    if (!result.ok) return;
    if (result.ok) sync.trust();
  } else {
    const drop = await vault.checkDrop(client);
    if (drop) {
      console.error(`Vault: ${drop}. ${DROP_HINT}`);
      return;
    }
  }
  if (merge) {
    const result = await vault.applyImport(client, merge);
    if (!result.ok) return;
  }
  await releasePort(placeholder);
  sync.start();
  require("./server");
  vault.snapshot(client, request ? "restored" : merge ? "merged" : "start").catch((error) => console.error(`Vault: ${error.message}`));
  const auto = setInterval(() => {
    if (vault.changed()) vault.snapshot(client, "auto").catch((error) => console.error(`Vault: ${error.message}`));
  }, AUTO_SNAPSHOT_MS);
  auto.unref();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(auto);
    await sync.stop();
    if (vault.changed()) {
      await Promise.race([vault.snapshot(client, "stop").catch((error) => console.error(`Vault: ${error.message}`)), wait(STOP_SNAPSHOT_MS)]);
    }
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
