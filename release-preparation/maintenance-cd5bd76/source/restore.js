// Run in the Repl Shell. Works on the published app's App Storage, never on the workspace data/ folder.
//   node restore.js            list the vault snapshots and what App Storage holds now
//   node restore.js <number>   restore that snapshot on the next publish (a snapshot of the current data is taken first)
//   node restore.js merge <file.bqb> <key>   add what an older backup has and App Storage lacks, on the next publish
//   node restore.js cancel     drop a pending restore or merge
//   node restore.js check      compare App Storage with the newest snapshot (update.sh runs this)
const fs = require("fs");
const os = require("os");
const path = require("path");
const backup = require("./backup");
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
    await client.delete(vault.IMPORT_REQUEST, { ignoreNotFound: true });
    console.log("Pending restore and merge cancelled");
    return;
  }

  if (command === "merge") {
    const [file, keyFile] = process.argv.slice(3);
    if (!file || !keyFile || !fs.existsSync(file) || !fs.existsSync(keyFile)) {
      console.log("Usage: node restore.js merge <old-backup.bqb> <its backup.key>  (upload both files to the Repl first)");
      process.exitCode = 1;
      return;
    }
    const key = vault.keyFrom(fs.readFileSync(keyFile, "utf8"));
    if (!key) {
      console.log("FAILED: the key file is not a backup key.");
      process.exitCode = 1;
      return;
    }
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), "bq-merge-"));
    const preview = fs.mkdtempSync(path.join(os.tmpdir(), "bq-live-"));
    try {
      await backup.openBackup(file, async (rel, data) => {
        const out = path.resolve(stage, rel);
        if (!out.startsWith(stage + path.sep)) throw new Error("bad_path");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, data);
      }, key);
    } catch {
      console.log("FAILED: the backup does not open with that key.");
      fs.rmSync(stage, { recursive: true, force: true });
      fs.rmSync(preview, { recursive: true, force: true });
      process.exitCode = 1;
      return;
    }
    for (const name of ["accounts.json", "ideas.json"]) {
      const { ok, value } = await client.downloadAsText(`data/${name}`);
      if (ok) fs.writeFileSync(path.join(preview, name), value);
    }
    const added = vault.mergeInto(preview, stage);
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(preview, { recursive: true, force: true });
    const stamp = Date.now();
    const remoteFile = `${vault.IMPORT_DIR}${stamp}.bqb`;
    const remoteKey = `${vault.IMPORT_DIR}${stamp}.key`;
    const sentFile = await client.uploadFromBytes(remoteFile, fs.readFileSync(file));
    const sentKey = await client.uploadFromText(remoteKey, key.toString("hex"));
    if (!sentFile.ok || !sentKey.ok) {
      console.log("FAILED: could not upload to App Storage. Try again.");
      process.exitCode = 1;
      return;
    }
    await client.uploadFromText(vault.IMPORT_REQUEST, JSON.stringify({ file: remoteFile, key: remoteKey, at: new Date().toISOString() }));
    console.log(`Merge scheduled: adds about ${added.accounts} accounts, ${added.posts} posts, ${added.media} media files. Nothing that exists now is changed or removed.`);
    console.log("Now open Deployments and press Republish. Then delete the two uploaded files from the Repl.");
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
