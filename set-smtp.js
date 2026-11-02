// Local admin tool: save the Gmail account that sends BQ Connect emails.
// Run on the server machine only: node set-smtp.js
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const auth = require("./auth");

const SMTP_FILE = path.join(__dirname, "data", "smtp.json");

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  return new Promise((resolve) => {
    const input = process.stdin;
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          input.removeListener("data", onData);
          input.setRawMode(false);
          input.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          process.stdout.write("\nCancelled.\n");
          process.exit(1);
        }
        if (ch === "\b" || ch === "\u007f") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (ch >= " ") {
          value += ch;
          process.stdout.write("*");
        }
      }
    };
    input.on("data", onData);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    console.log("Run this in an interactive terminal: node set-smtp.js");
    process.exit(1);
  }
  const user = (await ask("Gmail address that sends the emails: ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
    console.log("That is not a valid email address.");
    process.exit(1);
  }
  console.log("Use a Google App Password (16 letters), not your normal Gmail password.");
  console.log("Create one at myaccount.google.com > Security > 2-Step Verification > App passwords.");
  const pass = (await askHidden("App password: ")).replace(/\s+/g, "");
  if (pass.length < 16) {
    console.log("App passwords are 16 letters. Nothing was saved.");
    process.exit(1);
  }
  let current = {};
  try {
    current = JSON.parse(fs.readFileSync(SMTP_FILE, "utf8"));
  } catch {}
  const next = { host: current.host || "smtp.gmail.com", port: current.port || 465, user, pass, fromName: current.fromName || "BQ Connect" };
  fs.writeFileSync(SMTP_FILE, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  console.log("Saved. Sending a test email to the same address...");
  try {
    await auth.sendMail(user, "BQ Connect test", "Email sending works. BQ Connect can now send confirmation codes.");
    console.log("Test email sent. Check the inbox. No restart is needed.");
  } catch (error) {
    const reason = error && error.reason;
    if (reason === "certificate") {
      console.log("The test email failed: the secure connection to Gmail was intercepted by an antivirus or firewall (mail/HTTPS scanning).");
      console.log("Turn off outgoing mail (SMTP) scanning in the antivirus, then run this again.");
    } else if (reason === "auth") {
      console.log("The test email failed: Google rejected the address or the app password.");
      console.log("Make sure 2-Step Verification is on and paste a newly created App Password. Company (Workspace) accounts may need IT to allow app passwords.");
    } else if (reason === "network" || reason === "timeout") {
      console.log("The test email failed: could not reach smtp.gmail.com on port 465. Check the internet connection or firewall.");
    } else {
      console.log(`The test email failed (${reason || "unknown"}). Check the address and the app password, then run this again.`);
    }
    process.exit(1);
  }
}

main().catch(() => {
  console.log("Failed to save the email settings.");
  process.exit(1);
});
