// Diagnostic liveness only. No runtime/importer, storage or database imports.
const http = require("node:http");
const publishingPort = 4173; // .replit: localPort 4173 -> externalPort 80
function resolvePort(env, explicit) {
  if (explicit === 0) return 0; // ephemeral local test listener only
  const value = explicit ?? env.PORT ?? publishingPort;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 65535)
    throw Error("maintenance listener configuration invalid");
  return Number(value);
}
async function start({ env = process.env, port } = {}) {
  const body = JSON.stringify({
    status: "maintenance", live: true, ready: false, error: "migration_not_activated"
  });
  const server = http.createServer((req, res) => {
    // Normalize only the query delimiter; never route to any application code.
    const pathname = (req.url || "").split("?", 1)[0];
    const live = ["GET", "HEAD"].includes(req.method) &&
      (pathname === "/" || pathname === "/health/live");
    res.writeHead(live ? 200 : 503, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "no-store",
      ...(live ? {} : { "Retry-After": "15" })
    });
    res.end(req.method === "HEAD" ? undefined : body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(resolvePort(env, port), "0.0.0.0", resolve);
  });
  return { server, close: () => new Promise(resolve => server.close(resolve)) };
}
module.exports = { start, resolvePort, publishingPort };
