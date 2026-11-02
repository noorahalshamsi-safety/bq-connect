// Local admin tool: set a sign-in password for a badge without email.
// Run on the server machine only: node set-password.js
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const auth = require("./auth");

function cleanBadge(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .replace(/^0+/, "");
}

function knownBadge(badge) {
  if (!badge) return false;
  const cfg = auth.securityConfig();
  if (badge === cfg.announcer.badge || badge === cfg.adminAccount.badge) return true;
  try {
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "employees.json"), "utf8"));
    return Array.isArray(list) && list.some((person) => String(person.badge) === badge);
  } catch {
    return false;
  }
}

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
    console.log("Run this in an interactive terminal: node set-password.js");
    process.exit(1);
  }
  const badge = cleanBadge(await ask("Badge: "));
  if (!knownBadge(badge)) {
    console.log("This badge is not in the employee directory.");
    process.exit(1);
  }
  const password = await askHidden("New password (10+ chars, letters and digits): ");
  if (!auth.strongPassword(password)) {
    console.log("Weak password: use at least 10 characters with letters and digits.");
    process.exit(1);
  }
  if ((await askHidden("Repeat password: ")) !== password) {
    console.log("Passwords do not match.");
    process.exit(1);
  }
  const emailText = await ask("Email (optional, press Enter to skip): ");
  const email = emailText ? auth.validEmail(emailText) : "";
  if (emailText && !email) {
    console.log("Invalid email (or not in the allowed domains).");
    process.exit(1);
  }
  const resetTwoFactor = auth.twoFactorOn(badge) && /^y(es)?$/i.test(await ask("Two-step verification is on for this badge. Turn it off? (y/N): "));
  await auth.setPassword(badge, password, email ? { email } : null);
  auth.clearFailures(badge);
  auth.audit("password_local", "local");
  if (resetTwoFactor) {
    auth.disableTwoFactor(badge);
    auth.audit("2fa_off_local", "local");
    console.log("Two-step verification turned off. The employee sets it up again at the next sign-in.");
  }
  console.log("Done. Sign in with this badge and password at http://127.0.0.1:4173");
}

main().catch(() => {
  console.log("Failed to save the password.");
  process.exit(1);
});
