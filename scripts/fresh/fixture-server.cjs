// Test-only child. No Production secrets/environment or App Storage capability.
const fs = require("node:fs"), path = require("node:path");
if (process.env.REPLIT_DEPLOYMENT || !process.send) throw Error("isolated_fixture_process_required");
const { base } = require("../../deploy/fresh/config.cjs");
const proof = require(path.join(base, "development/postgres/isolation.cjs")).verify(process.argv[2]);
const { Repository } = require(path.join(base, "development/postgres/repository.cjs"));
const repo = new Repository(proof);
const configured = process.argv[3] !== "providers-off";
require(path.join(base, "development/postgres/runtime.cjs")).serve(proof, repo, {
  minimalRelease: true, freshInstall: true,
  freshEmailDomains: ["binquraya.com"],
  freshProviders: configured ? {
    "smtp.json": { host: "synthetic.invalid", port: 465, user: "synthetic@example.invalid",
      pass: "SYNTHETIC-ONLY", fromName: "Synthetic BQ" },
    "sms.json": { provider: "twilio", sid: "synthetic", token: "SYNTHETIC-ONLY", from: "+15550000000" }
  } : {},
  deliverMail: async (to, subject, text) => { process.send({ kind: "mail", to, text }); },
  deliverSms: async payload => { process.send({ kind: "sms", body: payload.body }); }
}).then(app => {
  process.send({ kind: "ready", port: app.server.address().port });
  process.on("SIGTERM", () => app.close().finally(() => process.exit(0)));
}).catch(() => { process.send({ kind: "blocked" }); process.exit(1); });
