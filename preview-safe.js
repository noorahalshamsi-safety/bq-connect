// Run the development preview against a disposable copy, never the imported data/.
const fs = require("fs");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");

const source = __dirname;
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "bq-connect-preview-"));
const modules = [
  "server.js",
  "auth.js",
  "backup.js",
  "moderation.js",
  "push.js",
  "spark-agent.js",
  "translate.js",
];

for (const file of modules) {
  fs.copyFileSync(path.join(source, file), path.join(sandbox, file));
}
fs.cpSync(path.join(source, "public"), path.join(sandbox, "public"), { recursive: true });
fs.mkdirSync(path.join(sandbox, "data"), { recursive: true });

const childEnv = {
  PATH: process.env.PATH || "",
  HOME: os.tmpdir(),
  TMPDIR: os.tmpdir(),
  PORT: "5000",
  HOST: "0.0.0.0",
  REPL_ID: "isolated-preview",
  BQ_TRANSLATE: "0",
  BQ_STORAGE_SYNC: "0",
};

console.log("Starting BQ Connect with an isolated, empty data directory.");
const child = spawn(process.execPath, [path.join(sandbox, "server.js")], {
  cwd: sandbox,
  env: childEnv,
  stdio: "inherit",
});

// Preserve the imported external-port mapping without changing production ports.
// The workflow uses 5000; the existing default preview route points to PORT (4173).
const routedPort = Number(process.env.PORT) || 4173;
const alias = routedPort === 5000 ? null : net.createServer((socket) => {
  const upstream = net.connect(5000, "127.0.0.1");
  socket.on("error", () => upstream.destroy());
  upstream.on("error", () => socket.destroy());
  socket.pipe(upstream).pipe(socket);
});
if (alias) {
  alias.on("error", () => {
    console.error("The isolated preview could not bind its imported port alias.");
    child.kill("SIGTERM");
  });
  alias.listen(routedPort, "0.0.0.0");
}

let stopping = false;
function cleanUp() {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (alias) alias.close();
  child.once("exit", () => {
    cleanUp();
    process.exit(0);
  });
  child.kill(signal);
  const forceTimer = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 5000);
  forceTimer.unref();
}

child.once("error", (error) => {
  console.error(`Preview failed to start: ${error.message}`);
  cleanUp();
  process.exit(1);
});
child.once("exit", (code) => {
  cleanUp();
  if (!stopping) process.exit(code === null ? 1 : code);
});
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
