// Called only by the existing isolated PostgreSQL fixture.
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const fs = require("node:fs"), path = require("node:path"), { spawnSync } = require("node:child_process");
async function run({ root, repo, getPort, token, otherToken, body, request, restart }) {
  const video = path.join(root, "synthetic.mp4"), image = path.join(root, "synthetic.jpg");
  for (const [dest, args] of [[video, ["-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]],
    [image, ["-frames:v", "1"]]]) {
    const generated = spawnSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i",
      "color=c=blue:s=64x64:r=10", ...args, "-y", dest], { encoding: "utf8" });
    assert.equal(generated.status, 0, "synthetic_media_generation");
  }
  async function upload(file, mime, key = crypto.randomUUID(), credential = token) {
    const r = await fetch(`http://127.0.0.1:${getPort()}/api/media`, {
      method: "POST", headers: { "Content-Type": mime, "X-Session": credential, "Idempotency-Key": key },
      body: fs.readFileSync(file), signal: AbortSignal.timeout(30000)
    });
    return { status: r.status, json: await r.json() };
  }
  const refs = [], evidence = {};
  let postId;
  for (const [kind, file, mime] of [["image", image, "image/jpeg"], ["video", video, "video/mp4"]]) {
    const media = await upload(file, mime);
    assert.equal(media.status, 201, JSON.stringify(media.json));
    assert(media.json.url.startsWith("/media/")); refs.push(media.json.url);
    for (const type of ["post", "story"]) {
      const posted = await request("/api/ideas", { ...body, token, type, media: media.json.url,
        text: `Synthetic ${kind} ${type}` });
      assert.equal(posted.status, 201, JSON.stringify(posted.json));
      assert.equal(posted.json.idea.media, media.json.url);
      if (!postId && type === "post") postId = posted.json.idea.id;
      evidence[`${kind}_${type}`] = "PASS";
    }
  }
  const profilePhoto = "data:image/jpeg;base64," + fs.readFileSync(image).toString("base64");
  const profile = await request("/api/social", { token, action: "profile", bio: "Synthetic profile", photo: profilePhoto });
  assert.equal(profile.status, 200, JSON.stringify(profile.json));
  assert(profile.json.person.photo?.startsWith("data:image/jpeg;base64,"));
  evidence.profile = "PASS";
  const comment = await request(`/api/ideas/${postId}/comments`, { token, text: "Synthetic media comment", media: refs[0] });
  assert.equal(comment.status, 201, JSON.stringify(comment.json));
  assert(comment.json.idea.comments.some(c => c.media === refs[0]));
  evidence.commentAttachment = "PASS";
  const simultaneous = await Promise.all([upload(video, "video/mp4"),
    upload(image, "image/jpeg", crypto.randomUUID(), otherToken)]);
  assert(simultaneous.every(result => result.status === 201));
  assert.notEqual(simultaneous[0].json.url, simultaneous[1].json.url);
  const owners = await repo.pool.query("SELECT owner FROM dev.media WHERE legacy_path=ANY($1::text[])",
    [simultaneous.map(result => result.json.url)]);
  assert.equal(new Set(owners.rows.map(row => row.owner)).size, 2);
  evidence.simultaneousEmployees = "PASS";
  const before = Number((await repo.pool.query("SELECT count(*) AS n FROM dev.media WHERE state='ready'")).rows[0].n);
  const lostKey = crypto.randomUUID();
  await repo.pool.query("INSERT INTO dev.test_faults(request_key,point) VALUES($1,'after_commit_drop')", [lostKey]);
  await upload(video, "video/mp4", lostKey).catch(() => null);
  assert.equal(Number((await repo.pool.query("SELECT count(*) AS n FROM dev.media WHERE state='ready'")).rows[0].n), before + 1);
  const retry = await upload(video, "video/mp4", lostKey);
  assert([201, 409].includes(retry.status));
  assert.equal(Number((await repo.pool.query("SELECT count(*) AS n FROM dev.media WHERE state='ready'")).rows[0].n), before + 1);
  evidence.lostResponseNoDuplicate = "PASS";
  const rollbackKey = crypto.randomUUID();
  await repo.pool.query("INSERT INTO dev.test_faults(request_key,point) VALUES($1,'before_commit')", [rollbackKey]);
  const failed = await upload(image, "image/jpeg", rollbackKey);
  assert.equal(failed.status, 503);
  assert.equal(Number((await repo.pool.query("SELECT count(*) AS n FROM dev.media WHERE state='ready'")).rows[0].n), before + 1);
  assert(Number((await repo.pool.query("SELECT count(*) AS n FROM dev.media WHERE state='pending'")).rows[0].n) >= 1);
  await repo.pool.query("DELETE FROM dev.test_faults WHERE request_key=$1", [rollbackKey]);
  assert.equal((await upload(image, "image/jpeg", rollbackKey)).status, 201);
  evidence.rollbackNoVisibleMedia = "PASS";
  assert.equal((await upload(image, "image/gif")).status, 415);
  assert.equal((await upload(video, "video/mp4", crypto.randomUUID(), "SYNTHETIC_INVALID")).status, 401);
  await restart();
  const session = await request("/api/session", { token });
  assert.equal(session.status, 200); evidence.sessionAfterRestart = "PASS";
  const restoredProfile = await request("/api/session", { token });
  assert(restoredProfile.json.person.photo?.startsWith("data:image/jpeg;base64,"));
  for (const url of refs) {
    const r = await fetch(`http://127.0.0.1:${getPort()}${url}`, { headers: { "X-Session": token },
      signal: AbortSignal.timeout(30000) });
    assert.equal(r.status, 200); assert((await r.arrayBuffer()).byteLength > 16);
  }
  evidence.mediaAfterRestart = "PASS";
  const logout = await request("/api/sessions", { token, op: "logout" });
  assert.equal(logout.status, 200);
  assert.equal((await request("/api/session", { token })).status, 401);
  evidence.logoutRevocation = "PASS";
  return evidence;
}
module.exports = { run };
