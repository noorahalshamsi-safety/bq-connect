// Run in the Repl Shell. Works on the published app's App Storage, never on the workspace data/ folder.
//   node restore.js            list the vault snapshots and what App Storage holds now
//   node restore.js <number>   restore that snapshot on the next publish (a snapshot of the current data is taken first)
//   node restore.js cancel     drop a pending restore
//   node restore.js check      compare App Storage with the newest snapshot (update.sh runs this)
const fs = require("fs");
const vault = require("./vault");

function riyadh(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "?";
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 16);
}

function line(counts) {
  return counts ? `${counts.accounts} accounts, ${counts.posts} posts, ${counts.employees} employees` : "";
}

async function backupKey(client) {
  const { ok, value } = await client.downloadAsText("data/backup.key");
  const hex = ok ? String(value).trim() : "";
  return /^[0-9a-f]{64}$/.test(hex) ? Buffer.from(hex, "hex") : null;
}

async function main() {
  const { Client } = await import("@replit/object-storage");
  const client = new Client();
  const [command] = process.argv.slice(2);
  const list = await vault.readIndex(client);
  const now = await vault.remoteCounts(client);

  if (command === "check") {
    const last = list[0];
    console.log(`App Storage now: ${line(now)}`);
    if (!last) {
      console.log("Vault: no snapshot yet (the first one is made when the app starts after this update)");
      return;
    }
    console.log(`Newest snapshot: ${riyadh(last.at)} Riyadh, ${line(last.counts)}`);
    const was = last.counts || {};
    if (now.accounts < was.accounts || now.employees < was.employees) {
      console.log("WARNING: App Storage has less than the newest snapshot. Do not republish; run node restore.js");
      process.exitCode = 1;
    } else {
      console.log("OK: safe to republish");
    }
    return;
  }

  if (command === "cancel") {
    await client.delete(vault.REQUEST, { ignoreNotFound: true });
    console.log("Pending restore cancelled");
    return;
  }

  if (command) {
    const pick = /^\d+$/.test(command) ? list[Number(command) - 1] : list.find((item) => item.name === command);
    if (!pick) {
      console.log("No snapshot with that number. Run node restore.js to see the list.");
      process.exitCode = 1;
      return;
    }
    const key = await backupKey(client);
    if (!key) {
      console.log("FAILED: data/backup.key is missing in App Storage, so snapshots cannot be opened.");
      process.exitCode = 1;
      return;
    }
    const stage = await vault.unpack(client, pick.name, key).catch(() => null);
    if (!stage) {
      console.log("FAILED: that snapshot does not open with the current backup.key. Pick another one.");
      process.exitCode = 1;
      return;
    }
    const inside = vault.localCounts(stage);
    fs.rmSync(stage, { recursive: true, force: true });
    await client.uploadFromText(vault.REQUEST, JSON.stringify({ name: pick.name, at: new Date().toISOString() }));
    console.log(`Restore scheduled: ${riyadh(pick.at)} Riyadh, ${line(inside)}`);
    console.log("Now open Deployments and press Republish. The current data is saved as a snapshot first, so this can be undone.");
    return;
  }

  console.log(`App Storage now: ${line(now)}`);
  const pending = await vault.pendingRestore(client);
  if (pending) console.log(`Pending restore on next publish: ${pending.name}`);
  const result = await vault.remoteJson(client, vault.RESULT, null);
  if (result && result.name) console.log(`Last restore: ${riyadh(result.at)} Riyadh, ${result.ok ? `done (${line(result.counts)})` : `failed: ${result.error}`}`);
  if (!list.length) {
    console.log("Vault: no snapshot yet (the first one is made when the app starts after this update)");
    return;
  }
  console.log("Snapshots (newest first):");
  list.forEach((item, index) => {
    console.log(`  ${String(index + 1).padStart(2)}. ${riyadh(item.at)} Riyadh  ${item.reason.padEnd(10)} ${line(item.counts)}`);
  });
  console.log("To restore one: node restore.js <number>, then Republish.");
}

main().catch((error) => {
  console.log(`FAILED: ${error.message}`);
  process.exitCode = 1;
});
