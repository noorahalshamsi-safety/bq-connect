const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const sparkAgent = require("./spark-agent");
const translator = require("./translate");
const auth = require("./auth");
const backup = require("./backup");
const moderation = require("./moderation");

let runBackup = () => backup.createBackup();

const PORT = Number(process.env.PORT) || 4173;
const ON_REPLIT = Boolean(process.env.REPL_ID);
const HOST = process.env.HOST || (ON_REPLIT ? "0.0.0.0" : "127.0.0.1");
// Number of reverse proxies in front of the app that append to X-Forwarded-For.
const PROXY_HOPS = Math.max(0, Math.min(5, Math.floor(Number(process.env.TRUST_PROXY ?? (ON_REPLIT ? 1 : 0)) || 0)));
const ROOT = path.resolve(__dirname, "public");
const DATA = path.join(__dirname, "data", "ideas.json");
const NOTES = path.join(__dirname, "data", "notifications.json");
const MARKS = path.join(__dirname, "data", "bookmarks.json");
const VIEWS = path.join(__dirname, "data", "views.json");
const FOLLOWS = path.join(__dirname, "data", "follows.json");
const PROFILES = path.join(__dirname, "data", "profiles.json");
const GROUPS = path.join(__dirname, "data", "groups.json");
const SPARKS = path.join(__dirname, "data", "daily-sparks.json");
const POST_TYPES = new Set(["post", "idea", "suggestion", "complaint", "thanks", "story", "poll", "article", "announcement", "event"]);
const PINNABLE = new Set(["announcement", "event"]);
const EVENT_REMIND_MS = 60 * 60 * 1000;
const ALL_STATUSES = new Set(["received", "review", "project", "resolved"]);
const DIRECTORY = path.join(__dirname, "data", "employees.json");
const SMS = path.join(__dirname, "data", "sms.json");
const DEPTS = path.join(__dirname, "data", "dept-profiles.json");
const ANNOUNCE = path.join(__dirname, "data", "announcements.json");
const SEEN = path.join(__dirname, "data", "announce-seen.json");
const HIGHLIGHTS = path.join(__dirname, "data", "highlights.json");
const MODERATORS = path.join(__dirname, "data", "moderators.json");
const AUDIT = path.join(__dirname, "data", "security-log.json");
const CONDUCT = path.join(__dirname, "data", "conduct.json");
const CONDUCT_LIMIT = 3;
const CONDUCT_KEEP = 5000;
const REPORT_REASONS = new Set(["spam", "offensive", "false", "private", "other"]);
const AUTO_HIDE_REPORTS = 3;
const GALLERY_MAX = 10;
const MEDIA_DIR = path.join(__dirname, "data", "media");
const MEDIA_TYPES = {
  "image/jpeg": { ext: "jpg", max: 4 * 1024 * 1024 },
  "image/png": { ext: "png", max: 4 * 1024 * 1024 },
  "image/webp": { ext: "webp", max: 4 * 1024 * 1024 },
  "video/mp4": { ext: "mp4", max: 30 * 1024 * 1024 },
  "video/webm": { ext: "webm", max: 30 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", max: 30 * 1024 * 1024 },
};
const MEDIA_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const AVATAR_PATH = /^\/avatar\/([0-9a-f]{16})-([0-9a-f]{12})$/;
const MEDIA_PATH = /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp|mp4|webm|mov)$/;
const BASE_SHARED = 0;
const BASE_REVIEW = 0;
const BASE_PROJECTS = 0;
const STATUSES = new Set(["received", "review", "project"]);
const PEPPER = "bq-rd-ideas-2026";
const TERMS_VERSION = "2026-10-29";
const REPLY_SCOPES = new Set(["all", "department", "none"]);
const attempts = new Map();
const pendingOtp = new Map();
const pendingEmail = new Map();
const SETUP_TICKET_MS = 15 * 60 * 1000;
const EMAIL_CODE_MS = 10 * 60 * 1000;
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

function loadDirectory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DIRECTORY, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const directory = loadDirectory();
const byBadge = new Map(directory.map((person) => [String(person.badge), person]));

function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function publicId(badge) {
  return crypto.createHmac("sha256", PEPPER).update(`pid:${badge}`).digest("hex").slice(0, 16);
}

function announcerPerson() {
  const cfg = auth.securityConfig().announcer;
  if (!cfg.badge || byBadge.has(cfg.badge)) return null;
  return { badge: cfg.badge, name: cfg.name, department: "", position: "", official: true };
}

function adminPerson() {
  const cfg = auth.securityConfig().adminAccount;
  if (!cfg.badge || byBadge.has(cfg.badge)) return null;
  return { badge: cfg.badge, name: cfg.name, department: "", position: "", system: true, official: true };
}

function systemPeople() {
  return [announcerPerson(), adminPerson()].filter(Boolean);
}

function isOfficialBadge(badge) {
  const key = String(badge || "");
  return Boolean(key) && systemPeople().some((person) => person.badge === key);
}

function lookupPerson(badge) {
  const key = String(badge || "");
  if (!key) return null;
  const known = byBadge.get(key);
  if (known) return known;
  return systemPeople().find((person) => person.badge === key) || null;
}

function isAnnouncer(person) {
  const official = announcerPerson();
  return Boolean(person && official && String(person.badge) === official.badge);
}

function isAdminAccount(person) {
  const admin = adminPerson();
  return Boolean(person && admin && String(person.badge) === admin.badge);
}

function adminBadges() {
  const listed = readJson(MODERATORS, {});
  const all = new Set(auth.securityConfig().admins);
  (Array.isArray(listed.badges) ? listed.badges : []).forEach((badge) => all.add(String(badge)));
  return all;
}

function isAdmin(person) {
  return Boolean(person) && adminBadges().has(String(person.badge));
}

function termsAccepted(person) {
  const account = person ? auth.accountOf(person.badge) : null;
  return Boolean(account && account.terms === TERMS_VERSION);
}

function personByPid(pid) {
  const key = String(pid || "");
  const found = directory.find((person) => publicId(person.badge) === key);
  if (found) return found;
  return systemPeople().find((person) => publicId(person.badge) === key) || null;
}

function profileOf(badge) {
  const all = readJson(PROFILES, {});
  return all[String(badge)] || {};
}

function followsFor(badge) {
  const all = readJson(FOLLOWS, {});
  const row = all[String(badge)] || {};
  return {
    people: Array.isArray(row.people) ? row.people.map(String) : [],
    departments: Array.isArray(row.departments) ? row.departments.map(String) : [],
  };
}

function cardOf(person) {
  const profile = profileOf(person.badge);
  return {
    pid: publicId(person.badge),
    name: person.name || "",
    department: person.department || "",
    position: person.position || "",
    bio: profile.bio || "",
    photo: profile.photo || "",
    official: Boolean(person.official),
  };
}

function lightCard(person) {
  return {
    pid: publicId(person.badge),
    name: person.name || "",
    department: person.department || "",
    position: person.position || "",
    photo: avatarOf(person.badge),
    official: Boolean(person.official),
  };
}

function directoryCard(person) {
  return {
    pid: publicId(person.badge),
    name: person.name || "",
    department: person.department || "",
    position: person.position || "",
    photo: avatarOf(person.badge),
    official: Boolean(person.official),
  };
}

let avatarCache = { stamp: "", byBadge: new Map(), byPid: new Map() };

function avatarIndex() {
  let stamp = "none";
  try {
    const info = fs.statSync(PROFILES);
    stamp = `${info.mtimeMs}:${info.size}`;
  } catch {}
  if (stamp === avatarCache.stamp) return avatarCache;
  const byBadge = new Map();
  const byPid = new Map();
  Object.entries(readJson(PROFILES, {})).forEach(([badge, profile]) => {
    const photo = profile && typeof profile.photo === "string" ? profile.photo : "";
    if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(photo)) return;
    const pid = publicId(badge);
    const version = crypto.createHmac("sha256", PEPPER).update(`avatar:${photo}`).digest("hex").slice(0, 12);
    byBadge.set(String(badge), `/avatar/${pid}-${version}`);
    byPid.set(pid, { version, photo });
  });
  avatarCache = { stamp, byBadge, byPid };
  return avatarCache;
}

function avatarOf(badge) {
  return badge ? avatarIndex().byBadge.get(String(badge)) || "" : "";
}

function serveAvatar(res, urlPath) {
  const match = AVATAR_PATH.exec(urlPath);
  const entry = match ? avatarIndex().byPid.get(match[1]) : null;
  const data = entry && entry.version === match[2] ? /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(entry.photo) : null;
  if (!data) {
    res.writeHead(404);
    res.end();
    return;
  }
  const body = Buffer.from(data[2], "base64");
  const kind = data[1].toLowerCase() === "jpg" ? "jpeg" : data[1].toLowerCase();
  res.writeHead(200, {
    "Content-Type": `image/${kind}`,
    "Content-Length": body.length,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function safeMedia(value) {
  const media = String(value || "");
  const stored = MEDIA_PATH.exec(media);
  if (stored) return fs.existsSync(path.join(MEDIA_DIR, `${stored[1]}.${stored[2]}`)) ? media : "";
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(media) && media.length <= 180000 ? media : "";
}

function isVideoMedia(media) {
  return /\.(mp4|webm|mov)$/i.test(String(media || ""));
}

function cleanGallery(value, media) {
  if (!media || isVideoMedia(media)) return [];
  const extras = [];
  for (const item of Array.isArray(value) ? value : []) {
    const safe = safeMedia(item);
    if (safe && !isVideoMedia(safe) && safe !== media && !extras.includes(safe)) extras.push(safe);
    if (extras.length >= GALLERY_MAX - 1) break;
  }
  return extras;
}

function mediaSetOf(idea) {
  return [idea.media, ...(Array.isArray(idea.gallery) ? idea.gallery : [])].filter(Boolean);
}

function mediaLooksRight(ext, head) {
  if (ext === "jpg") return head[0] === 0xff && head[1] === 0xd8;
  if (ext === "png") return head.slice(0, 4).toString("hex") === "89504e47";
  if (ext === "webp") return head.slice(0, 4).toString("ascii") === "RIFF" && head.slice(8, 12).toString("ascii") === "WEBP";
  if (ext === "webm") return head.slice(0, 4).toString("hex") === "1a45dfa3";
  return head.slice(4, 8).toString("ascii") === "ftyp";
}

function removeStoredMedia(media) {
  const stored = MEDIA_PATH.exec(String(media || ""));
  if (!stored) return;
  const inHighlight = Object.values(readJson(HIGHLIGHTS, {})).some((list) =>
    (Array.isArray(list) ? list : []).some((row) => (row.items || []).some((item) => item.media === media)));
  if (!inHighlight) fs.unlink(path.join(MEDIA_DIR, `${stored[1]}.${stored[2]}`), () => {});
}

function highlightsOf(badge) {
  const list = readJson(HIGHLIGHTS, {})[String(badge)];
  return Array.isArray(list) ? list : [];
}

function publicHighlights(badge) {
  return highlightsOf(badge).map((row) => ({
    id: row.id,
    title: row.title || "",
    cover: row.cover || (row.items[0] && row.items[0].media) || "",
    items: (row.items || []).map((item) => ({ id: item.id, media: item.media, text: item.text || "", createdAt: item.createdAt })),
  }));
}

function storyArchive(badge) {
  return readIdeas()
    .filter((idea) => idea.type === "story" && String(idea.badge) === String(badge) && safeMedia(idea.media))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 120)
    .map((idea) => ({ id: idea.id, media: idea.media, text: idea.text || "", createdAt: idea.createdAt }));
}

function receiveMedia(req, res) {
  const person = personFromToken(req.headers["x-session"]);
  if (!person) {
    send(res, 401, { error: "employee_required" });
    return;
  }
  const kind = MEDIA_TYPES[String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase()];
  if (!kind) {
    send(res, 415, { error: "bad_type" });
    return;
  }
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > kind.max) {
    send(res, 413, { error: "too_large" });
    req.destroy();
    return;
  }
  const chunks = [];
  let size = 0;
  let failed = false;
  req.on("data", (chunk) => {
    if (failed) return;
    size += chunk.length;
    if (size > kind.max) {
      failed = true;
      send(res, 413, { error: "too_large" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (failed) return;
    const data = Buffer.concat(chunks);
    if (data.length < 16 || !mediaLooksRight(kind.ext, data.subarray(0, 16))) {
      send(res, 415, { error: "bad_type" });
      return;
    }
    const name = `${crypto.randomUUID()}.${kind.ext}`;
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFile(path.join(MEDIA_DIR, name), data, (error) => {
      if (error) send(res, 500, { error: "server" });
      else send(res, 201, { url: `/media/${name}` });
    });
  });
  req.on("error", () => {
    failed = true;
  });
}

function serveMedia(req, res, urlPath) {
  const stored = MEDIA_PATH.exec(urlPath);
  if (!stored) {
    res.writeHead(404);
    res.end();
    return;
  }
  const file = path.join(MEDIA_DIR, `${stored[1]}.${stored[2]}`);
  fs.stat(file, (error, info) => {
    if (error || !info.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const headers = {
      "Content-Type": MEDIA_MIME[stored[2]],
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      let end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
        res.end();
        return;
      }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": end - start + 1 });
      if (req.method === "HEAD") res.end();
      else fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, "Content-Length": info.size });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(file).pipe(res);
  });
}

function publicGroup(group) {
  return {
    id: group.id,
    name: group.name,
    department: group.department || "",
    kind: group.kind || "",
    members: Array.isArray(group.members) ? group.members.length : 0,
  };
}

function deptTopRank(department) {
  let top = 9;
  directory.forEach((item) => {
    if (item.department === department) top = Math.min(top, rankTitle(item.position));
  });
  return top;
}

function deptApprover(person, department) {
  if (!person) return false;
  if (isAdmin(person)) return true;
  if (String(person.department || "") !== String(department)) return false;
  const top = deptTopRank(department);
  return top <= 8 && rankTitle(person.position) === top;
}

function deptApproverBadges(department) {
  const top = deptTopRank(department);
  const badges = top <= 8
    ? directory.filter((item) => item.department === department && rankTitle(item.position) === top).map((item) => String(item.badge))
    : [...adminBadges()];
  return badges.slice(0, 10);
}

function lastStatusEntry(idea, status) {
  const log = Array.isArray(idea.statusLog) ? idea.statusLog : [];
  for (let index = log.length - 1; index >= 0; index -= 1) {
    if (log[index] && log[index].status === status) return log[index];
  }
  return null;
}

function autoAchievements(department) {
  const byBadge = new Map(directory.map((item) => [String(item.badge), item]));
  const rows = [];
  readIdeas().forEach((idea) => {
    if (idea.hidden) return;
    const type = idea.type || "idea";
    const title = String(idea.title || idea.text || "").slice(0, 80);
    if (type === "idea" && idea.status === "project" && idea.department === department) {
      const entry = lastStatusEntry(idea, "project");
      rows.push({ id: `auto-project-${idea.id}`, kind: "project", ideaId: idea.id, title, name: idea.name || "", position: idea.position || "", createdAt: (entry && entry.at) || idea.createdAt || "" });
    }
    if (type === "complaint" && idea.status === "resolved") {
      const entry = lastStatusEntry(idea, "resolved");
      if (entry && entry.department === department) {
        rows.push({ id: `auto-resolved-${idea.id}`, kind: "resolved", ideaId: idea.id, title, name: entry.name || "", position: entry.position || "", createdAt: entry.at || "" });
      }
    }
    if (type === "thanks" && idea.thanksBadge) {
      const person = byBadge.get(String(idea.thanksBadge));
      if (person && person.department === department) {
        rows.push({ id: `auto-thanks-${idea.id}`, kind: "thanks", ideaId: idea.id, title, name: person.name || "", position: person.position || "", createdAt: idea.createdAt || "" });
      }
    }
  });
  return rows;
}

function departmentProfile(department, viewer) {
  const all = readJson(DEPTS, {});
  const row = all[String(department)] || {};
  const list = Array.isArray(row.achievements) ? row.achievements : [];
  const canApprove = deptApprover(viewer, department);
  const manual = list
    .filter((item) => item.status !== "rejected")
    .filter((item) => item.status !== "pending" || canApprove || (viewer && String(item.badge) === String(viewer.badge)))
    .map((item) => ({
      id: item.id,
      kind: "manual",
      title: item.title || "",
      text: item.text || "",
      name: item.name || "",
      position: item.position || "",
      createdAt: item.createdAt || "",
      pending: item.status === "pending",
      mine: Boolean(viewer && String(item.badge) === String(viewer.badge)),
    }));
  const auto = autoAchievements(String(department));
  const counts = { project: 0, resolved: 0, thanks: 0, manual: manual.filter((item) => !item.pending).length };
  auto.forEach((item) => { counts[item.kind] += 1; });
  const achievements = manual.concat(auto)
    .sort((left, right) => Number(right.pending) - Number(left.pending) || String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 40);
  return {
    about: row.about || "",
    canPost: Boolean(viewer && viewer.department === department),
    canApprove,
    counts,
    achievements,
  };
}

const HIDDEN_DEPTS = new Set(["BQ Family"]);

function ensureDailySparks() {
  const date = sparkAgent.riyadhDate();
  const current = readJson(SPARKS, {});
  if (current.date === date && current.items && current.v === 2) return current;
  const names = [...new Set(directory.map((person) => String(person.department || "").trim()).filter((name) => name && !HIDDEN_DEPTS.has(name)))];
  const next = { v: 2, date, items: sparkAgent.build(date, names, sparkSignals()) };
  writeJson(SPARKS, next);
  return next;
}

function topKey(counts, min) {
  let best = "";
  let most = min - 1;
  counts.forEach((count, key) => {
    if (count > most) {
      best = key;
      most = count;
    }
  });
  return best;
}

function sparkSignals() {
  const since = Date.now() - 7 * 86400000;
  const tags = new Map();
  const topics = new Map();
  const byDept = new Map();
  readIdeas().forEach((idea) => {
    if (idea.hidden || new Date(idea.createdAt).getTime() < since) return;
    const text = `${idea.title || ""} ${idea.text || ""}`;
    if (idea.type === "complaint") {
      const topic = sparkAgent.topicOf(text);
      if (!topic) return;
      topics.set(topic, (topics.get(topic) || 0) + 1);
      const department = String(idea.department || "");
      if (!byDept.has(department)) byDept.set(department, new Map());
      byDept.get(department).set(topic, (byDept.get(department).get(topic) || 0) + 1);
      return;
    }
    if (idea.type === "story") return;
    new Set((text.match(/#[\p{L}\p{N}_]{2,30}/gu) || []).map((tag) => tag.slice(1).toLowerCase())).forEach((tag) => {
      tags.set(tag, (tags.get(tag) || 0) + 1);
    });
  });
  const deptTopics = {};
  byDept.forEach((counts, department) => {
    const topic = topKey(counts, 2);
    if (department && topic) deptTopics[department] = topic;
  });
  return { tag: topKey(tags, 2), topic: topKey(topics, 2), deptTopics };
}

function sparkFor(person) {
  const pack = ensureDailySparks();
  const department = String(person && person.department || "").trim();
  const custom = pack.override && pack.override.date === pack.date && pack.override.ar ? pack.override : null;
  const row = !custom && department && !HIDDEN_DEPTS.has(department) ? pack.items[department] : null;
  const chosen = custom || row || pack.items["*"] || { ar: "", en: "" };
  const names = Object.keys(pack.items).filter((name) => name !== "*" && name !== department);
  const start = names.length ? hashSpark(pack.date) % names.length : 0;
  const others = names.slice(start).concat(names.slice(0, start)).slice(0, 4).map((name) => ({
    department: name,
    ar: pack.items[name].ar || "",
    en: pack.items[name].en || "",
  }));
  return { date: pack.date, department: row ? department : "", ar: chosen.ar || "", en: chosen.en || "", reason: chosen.reason || null, others };
}

function hashSpark(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

function ensureDepartmentGroups() {
  const groups = Array.isArray(readJson(GROUPS, [])) ? readJson(GROUPS, []) : [];
  const members = new Map();
  directory.forEach((person) => {
    const name = String(person.department || "").trim();
    if (!name || HIDDEN_DEPTS.has(name)) return;
    const list = members.get(name) || [];
    list.push(String(person.badge));
    members.set(name, list);
  });
  const next = groups.filter((group) => group.kind !== "department");
  members.forEach((badges, name) => {
    const existing = groups.find((group) => group.kind === "department" && group.department === name);
    next.push({
      id: existing ? existing.id : crypto.randomUUID(),
      name,
      department: name,
      kind: "department",
      members: badges,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    });
  });
  writeJson(GROUPS, next);
}

function sessionPerson(person) {
  const profile = profileOf(person.badge);
  const account = auth.accountOf(person.badge) || {};
  const admin = isAdmin(person);
  return {
    badge: person.badge,
    pid: publicId(person.badge),
    name: person.name,
    department: person.department,
    position: person.position,
    bio: profile.bio || "",
    photo: profile.photo || "",
    moderator: admin,
    dashboard: admin,
    announcer: isAnnouncer(person),
    adminAccount: isAdminAccount(person),
    official: isOfficialBadge(person.badge),
    terms: account.terms === TERMS_VERSION,
    termsVersion: TERMS_VERSION,
    email: auth.maskEmail(account.email),
    twoFactor: Boolean(account.totp && account.totp.on),
  };
}

function liveIdeas(ideas) {
  const now = Date.now();
  return ideas.filter((idea) => (idea.type || "idea") !== "story" || !idea.expiresAt || Date.parse(idea.expiresAt) >= now);
}

function filteredIdeas(ideas, voter, params) {
  const groupId = String(params.get("group") || "");
  let list = liveIdeas(ideas).filter((idea) => (groupId ? idea.groupId === groupId : !idea.groupId));
  if (groupId) {
    const groups = readJson(GROUPS, []);
    const group = groups.find((item) => item.id === groupId);
    if (!group || !(group.members || []).map(String).includes(String(voter))) return { error: 403, list: [] };
    list = list.filter((idea) => idea.groupId === groupId);
    return { list };
  }
  const feed = params.get("feed") || "company";
  if (feed === "following") {
    const follow = followsFor(voter);
    const official = announcerPerson();
    const officialBadge = official ? String(official.badge) : "";
    list = list.filter((idea) => {
      const badge = String(idea.badge || "");
      return follow.people.includes(badge) || follow.departments.includes(String(idea.department || "")) || badge === String(voter) || (officialBadge && badge === officialBadge);
    });
  } else if (feed === "today") {
    const start = Date.now() - 24 * 60 * 60 * 1000;
    list = list.filter((idea) => Date.parse(idea.createdAt) >= start);
  }
  return { list };
}

function asciiDigits(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function cleanBadge(value) {
  const digits = asciiDigits(value).replace(/\D/g, "").replace(/^0+/, "");
  return digits;
}

function cleanCode(value) {
  const digits = asciiDigits(value).replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

function codeHash(badge, code) {
  return crypto.createHmac("sha256", PEPPER).update(`${badge}:${code}`).digest("hex");
}

function accountEmail(person) {
  const account = auth.accountOf(person.badge) || {};
  if (account.email) return account.email;
  return isAnnouncer(person) ? auth.securityConfig().announcer.email : "";
}

function accountReady(person) {
  return auth.twoFactorOn(person.badge) && Boolean(accountEmail(person));
}

function personFromToken(token) {
  const badge = auth.readSession(token);
  const person = badge && !isBanned(badge) ? lookupPerson(badge) : null;
  return person && accountReady(person) ? person : null;
}

let conductCache = { stamp: "", data: null };

function conductData() {
  let stamp = "";
  try {
    const info = fs.statSync(CONDUCT);
    stamp = `${info.mtimeMs}:${info.size}`;
  } catch {}
  if (!conductCache.data || conductCache.stamp !== stamp) {
    const raw = readJson(CONDUCT, {});
    conductCache = {
      stamp,
      data: {
        warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
        bans: raw.bans && typeof raw.bans === "object" ? raw.bans : {},
        resets: raw.resets && typeof raw.resets === "object" ? raw.resets : {},
      },
    };
  }
  return conductCache.data;
}

function saveConduct(data) {
  data.warnings = data.warnings.slice(-CONDUCT_KEEP);
  writeJson(CONDUCT, data);
  conductCache = { stamp: "", data: null };
}

function isBanned(badge) {
  return Boolean(conductData().bans[String(badge)]);
}

function activeWarnings(data, badge) {
  const since = Date.parse(data.resets[badge] || "") || 0;
  return data.warnings.filter((row) => row.badge === badge && (Date.parse(row.at) || 0) > since).length;
}

function warningCount(badge) {
  return activeWarnings(conductData(), String(badge));
}

function screenText(res, person, where, parts) {
  const text = parts.flat().filter((part) => typeof part === "string" && part.trim()).join("\n");
  const words = text ? moderation.scan(text) : [];
  if (!words.length) return false;
  const badge = String(person.badge);
  const data = conductData();
  const at = new Date().toISOString();
  data.warnings.push({ id: crypto.randomUUID(), badge, at, where, text: text.slice(0, 500), words });
  const count = activeWarnings(data, badge);
  const exempt = isOfficialBadge(badge) || auth.securityConfig().admins.has(badge);
  const banned = count >= CONDUCT_LIMIT && !exempt;
  if (banned && !data.bans[badge]) data.bans[badge] = { at, count };
  saveConduct(data);
  auth.audit(banned ? "conduct_banned" : "conduct_warning", publicId(badge));
  if (banned) auth.revokeSessions(badge);
  send(res, 422, { error: "offensive", words, count: Math.min(count, CONDUCT_LIMIT), limit: CONDUCT_LIMIT, banned });
  return true;
}

const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

function clientIp(req) {
  const peer = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  const local = peer === "127.0.0.1" || peer === "::1";
  const hops = PROXY_HOPS || (local ? 1 : 0);
  const chain = hops ? String(req.headers["x-forwarded-for"] || "").split(",").map((item) => item.trim()).filter(Boolean) : [];
  const forwarded = chain.length ? chain[Math.max(0, chain.length - hops)] : "";
  const ip = (forwarded || peer || "local").replace(/^::ffff:/, "");
  return ip === "::1" ? "127.0.0.1" : ip.slice(0, 64);
}

function deviceOf(req, body) {
  const ua = String(req.headers["user-agent"] || "").slice(0, 400);
  let os = "other";
  if (/iPhone|iPod/.test(ua)) os = "iOS";
  else if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))) os = "iPadOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let browser = "other";
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  const kind = os === "iPadOS" || /Tablet/.test(ua) || (os === "Android" && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { os, browser, kind, app: Boolean(body && body.app === true) };
}

function deviceText(device) {
  const kinds = { mobile: "جوال", tablet: "تابلت", desktop: "كمبيوتر" };
  const browser = device.browser === "other" ? "متصفح" : device.browser;
  const os = device.os === "other" ? "" : ` على ${device.os}`;
  return `${kinds[device.kind] || "جهاز"} · ${device.app ? "تطبيق BQ Connect" : browser}${os}`;
}

function loginInfo(req, body) {
  return { ip: clientIp(req), device: deviceOf(req, body) };
}

function sessionTtl(person) {
  return isAdmin(person) ? ADMIN_SESSION_MS : 0;
}

const apiHits = new Map();
function apiLimited(ip) {
  const now = Date.now();
  let row = apiHits.get(ip);
  if (!row || now - row.start > 60 * 1000) {
    row = { start: now, n: 0 };
    apiHits.set(ip, row);
  }
  row.n += 1;
  return row.n > 1500;
}

setInterval(() => {
  const now = Date.now();
  apiHits.forEach((row, ip) => {
    if (now - row.start > 60 * 1000) apiHits.delete(ip);
  });
}, 5 * 60 * 1000).unref();

const ipFailures = new Map();
function ipBlocked(ip) {
  const row = ipFailures.get(ip);
  return Boolean(row && Date.now() < row.reset && row.n >= 40);
}

function noteIpFailure(ip) {
  const now = Date.now();
  const row = ipFailures.get(ip) || { n: 0, reset: now + 10 * 60 * 1000 };
  if (now > row.reset) {
    row.n = 0;
    row.reset = now + 10 * 60 * 1000;
  }
  row.n += 1;
  ipFailures.set(ip, row);
}

function passwordMail(name, password, reason) {
  const lead = {
    register: "تم ربط إيميلك بحسابك في BQ Connect. هذه كلمة المرور لدخولك:",
    reset: "طلبت كلمة مرور جديدة لحسابك في BQ Connect. هذه كلمة المرور الجديدة:",
  }[reason];
  const tail = reason === "reset"
    ? "إذا ما طلبت هذا، تجاهل الرسالة. كلمة مرورك الحالية تظل شغالة ما لم تدخل بالجديدة، والجديدة تنتهي بعد 24 ساعة."
    : "إذا ما سجلت أنت، كلّم قسم تقنية المعلومات فوراً.";
  return [
    `مرحباً ${name || ""}،`,
    "",
    lead,
    "",
    password,
    "",
    "ادخل برقم البطاقة وهذه الكلمة، وغيّرها من الإعدادات > الخصوصية والأمان بعد الدخول.",
    "لا تشارك كلمة المرور مع أي أحد، وفريق BQ Connect ما يطلبها منك أبداً.",
    tail,
    "",
    "BQ Connect - بن قريعة",
  ].join("\n");
}

function noticeMail(email, text) {
  if (!email || !auth.mailConfigured()) return;
  auth.sendMail(email, "تنبيه أمني من BQ Connect", `${text}\n\nإذا ما كنت أنت، كلّم قسم تقنية المعلومات فوراً.\n\nBQ Connect - بن قريعة`).catch(() => {});
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const row = attempts.get(ip) || { n: 0, reset: now + 10 * 60 * 1000 };
  if (now > row.reset) {
    row.n = 0;
    row.reset = now + 10 * 60 * 1000;
  }
  row.n += 1;
  attempts.set(ip, row);
  return row.n > 8;
}

const translateUse = new Map();

function translateLimited(badge) {
  const now = Date.now();
  const row = translateUse.get(String(badge)) || { n: 0, reset: now + 60 * 1000 };
  if (now > row.reset) {
    row.n = 0;
    row.reset = now + 60 * 1000;
  }
  row.n += 1;
  translateUse.set(String(badge), row);
  if (translateUse.size > 5000) translateUse.forEach((value, key) => { if (now > value.reset) translateUse.delete(key); });
  return row.n > 30;
}

function codesMatch(person, badge, code) {
  const actual = Buffer.from(String(person.check || ""));
  const expected = Buffer.from(codeHash(badge, code));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizeMobile(value) {
  const digits = asciiDigits(value).replace(/\D/g, "");
  if (digits.length < 9) return "";
  return digits.slice(-9);
}

function phoneHash(badge, digits) {
  return crypto.createHmac("sha256", PEPPER).update(`phone:${badge}:${digits}`).digest("hex");
}

function phoneMatch(person, badge, mobile) {
  if (!person.phone) return true;
  const digits = normalizeMobile(mobile);
  if (!digits) return false;
  const actual = Buffer.from(String(person.phone));
  const expected = Buffer.from(phoneHash(badge, digits));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function otpHash(badge, otp) {
  return crypto.createHmac("sha256", PEPPER).update(`otp:${badge}:${otp}`).digest("hex");
}

function sameHash(left, right) {
  const actual = Buffer.from(String(left));
  const expected = Buffer.from(String(right));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function beginOtp(badge, mobile) {
  const now = Date.now();
  const digits = normalizeMobile(mobile);
  const current = pendingOtp.get(badge);
  if (current && current.mobile === digits && now < current.exp && now - current.sentAt < 60000) return null;
  const otp = String(crypto.randomInt(100000, 1000000));
  pendingOtp.set(badge, { hash: otpHash(badge, otp), exp: now + 5 * 60 * 1000, sentAt: now, tries: 0, mobile: digits });
  return otp;
}

function acceptOtp(badge, otp, mobile) {
  const row = pendingOtp.get(badge);
  const digits = normalizeMobile(mobile);
  if (!row || row.exp < Date.now() || row.mobile !== digits || String(otp || "").length !== 6) return false;
  row.tries += 1;
  if (row.tries > 5) {
    pendingOtp.delete(badge);
    return false;
  }
  if (!sameHash(otpHash(badge, otp), row.hash)) return false;
  pendingOtp.delete(badge);
  return true;
}

function postHttps(url, headers, body) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(payload) } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(res.statusCode || 500));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function smsConfigured() {
  const cfg = readJson(SMS, {});
  const provider = String(cfg.provider || "twilio").toLowerCase();
  const token = String(cfg.token || process.env.SMS_TOKEN || "").trim();
  if (!token) return false;
  if (provider === "twilio") {
    return Boolean(String(cfg.sid || process.env.TWILIO_SID || "").trim() && String(cfg.from || process.env.TWILIO_FROM || "").trim());
  }
  return true;
}

async function sendSms(mobile, otp) {
  const cfg = readJson(SMS, {});
  const provider = String(cfg.provider || "twilio").toLowerCase();
  const token = String(cfg.token || process.env.SMS_TOKEN || "").trim();
  const to = `+966${normalizeMobile(mobile)}`;
  if (!token || !to.startsWith("+9665")) throw new Error("sms");
  const text = `رمز التحقق لدخول بن قريعة: ${otp}`;
  let status = 500;
  if (provider === "twilio") {
    const sid = String(cfg.sid || process.env.TWILIO_SID || "").trim();
    const from = String(cfg.from || process.env.TWILIO_FROM || "").trim();
    if (!sid || !from) throw new Error("sms");
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    status = await postHttps(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    }, new URLSearchParams({ To: to, From: from, Body: text }).toString());
  } else if (provider === "unifonic") {
    status = await postHttps("https://el.cloud.unifonic.com/rest/SMS/messages", { "Content-Type": "application/x-www-form-urlencoded" }, new URLSearchParams({ AppSid: token, SenderID: String(cfg.sender || "BinQuraya"), Recipient: to.replace("+", ""), Body: text }).toString());
  } else {
    status = await postHttps("https://api.taqnyat.sa/v1/messages", { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, { recipients: [to.replace("+", "")], body: text, sender: String(cfg.sender || "BinQuraya") });
  }
  if (status >= 300) throw new Error("sms");
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function readIdeas() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIdeas(ideas) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.writeFileSync(DATA, JSON.stringify(ideas, null, 2));
}

function readNotes() {
  try {
    const parsed = JSON.parse(fs.readFileSync(NOTES, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(notes) {
  fs.mkdirSync(path.dirname(NOTES), { recursive: true });
  fs.writeFileSync(NOTES, JSON.stringify(notes.slice(-400), null, 2));
}

function savedBy(badge, ideaId) {
  const marks = readMarks();
  const list = marks[String(badge)] || [];
  return list.includes(ideaId);
}

function readMarks() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MARKS, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMarks(marks) {
  fs.mkdirSync(path.dirname(MARKS), { recursive: true });
  fs.writeFileSync(MARKS, JSON.stringify(marks, null, 2));
}

let viewCache = null;

function readViews() {
  if (viewCache) return viewCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(VIEWS, "utf8"));
    viewCache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    viewCache = {};
  }
  return viewCache;
}

function viewsOf(ideaId) {
  const list = readViews()[ideaId];
  return Array.isArray(list) ? list.length : 0;
}

function addViews(badge, ids, ideas) {
  const views = readViews();
  const key = publicId(badge);
  const byId = new Map(ideas.map((idea) => [idea.id, idea]));
  const counts = {};
  let changed = false;
  for (const id of ids) {
    const idea = byId.get(id);
    if (!idea || !visibleTo(idea, badge)) continue;
    if (String(idea.badge || "") !== String(badge)) {
      const list = Array.isArray(views[id]) ? views[id] : (views[id] = []);
      if (!list.includes(key)) {
        list.push(key);
        changed = true;
      }
    }
    counts[id] = viewsOf(id);
  }
  if (changed) {
    fs.mkdirSync(path.dirname(VIEWS), { recursive: true });
    fs.writeFileSync(VIEWS, JSON.stringify(views));
  }
  return counts;
}

function toggleMark(badge, ideaId) {
  const marks = readMarks();
  const key = String(badge);
  const list = new Set(Array.isArray(marks[key]) ? marks[key] : []);
  if (list.has(ideaId)) list.delete(ideaId);
  else list.add(ideaId);
  marks[key] = [...list];
  writeMarks(marks);
  return list.has(ideaId);
}

function badgeFrom(token) {
  const person = personFromToken(token);
  return person ? String(person.badge) : "";
}

function pushNote(recipientBadge, note) {
  if (!recipientBadge || String(recipientBadge) === String(note.actorBadge || "")) return;
  const notes = readNotes();
  notes.push({
    id: crypto.randomUUID(),
    badge: String(recipientBadge),
    read: false,
    createdAt: new Date().toISOString(),
    type: note.type,
    ideaId: note.ideaId,
    ideaTitle: note.ideaTitle || "",
    actorName: note.actorName || "",
    text: note.text || "",
  });
  writeNotes(notes);
}

function publicNote(note) {
  return {
    id: note.id,
    type: note.type,
    ideaId: note.ideaId,
    ideaTitle: note.ideaTitle || "",
    actorName: note.actorName || "",
    text: note.text || "",
    createdAt: note.createdAt,
    read: Boolean(note.read),
  };
}

function statsFor(ideas) {
  return {
    shared: ideas.length,
    review: ideas.filter((idea) => idea.status === "review").length,
    projects: ideas.filter((idea) => idea.status === "project").length,
    nextNumber: ideas.reduce((max, idea) => Math.max(max, Number(idea.number) || 0), 0) + 1,
  };
}

function accountOf(badge) {
  const person = byBadge.get(String(badge || ""));
  if (!person) return null;
  return {
    name: person.name || "",
    department: person.department || "",
    position: person.position || "",
  };
}

function engagementOf(idea) {
  const likes = [];
  const dislikes = [];
  for (const rating of Array.isArray(idea.ratings) ? idea.ratings : []) {
    const vote = voteOf(rating);
    const account = accountOf(rating.badge);
    if (!account || (vote !== "like" && vote !== "dislike")) continue;
    (vote === "like" ? likes : dislikes).push(account);
  }
  const saves = [];
  for (const [badge, ids] of Object.entries(readMarks())) {
    if (!Array.isArray(ids) || !ids.includes(idea.id)) continue;
    const account = accountOf(badge);
    if (account) saves.push(account);
  }
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), "ar");
  likes.sort(byName);
  dislikes.sort(byName);
  saves.sort(byName);
  const reposts = [];
  for (const item of Array.isArray(idea.reposts) ? idea.reposts : []) {
    const account = accountOf(item.badge);
    if (account) reposts.push(account);
  }
  reposts.sort(byName);
  return { likes, dislikes, saves, reposts };
}

function voteOf(rating) {
  if (rating.vote === "like" || rating.vote === "dislike") return rating.vote;
  const stars = Number(rating.stars);
  if (stars >= 4) return "like";
  if (stars > 0 && stars <= 2) return "dislike";
  return "";
}

function ratingSummary(idea, voter) {
  const ratings = Array.isArray(idea.ratings) ? idea.ratings : [];
  let likes = 0;
  let dislikes = 0;
  let mine = "";
  ratings.forEach((rating) => {
    const vote = voteOf(rating);
    if (vote === "like") likes += 1;
    if (vote === "dislike") dislikes += 1;
    if (String(rating.badge || rating.voter || "") === String(voter)) mine = vote;
  });
  return { likes, dislikes, mine };
}

function cleanLines(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/\n+/);
  return list.map((line) => String(line).trim().slice(0, 160)).filter(Boolean).slice(0, 8);
}

function cleanText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function cleanEventAt(value) {
  const at = Date.parse(String(value || ""));
  if (!Number.isFinite(at)) return "";
  const year = 365 * 24 * 60 * 60 * 1000;
  if (Math.abs(at - Date.now()) > year) return "";
  return new Date(at).toISOString();
}

let audienceSize = 0;
function audienceCount() {
  if (!audienceSize) audienceSize = directory.filter((person) => !HIDDEN_DEPTS.has(String(person.department || ""))).length;
  return audienceSize;
}

function canPin(person, idea) {
  if (!person || !idea || !PINNABLE.has(idea.type)) return false;
  return String(idea.badge || "") === String(person.badge) || isAdmin(person);
}

function remindEvents() {
  const ideas = readIdeas();
  const now = Date.now();
  let changed = false;
  ideas.forEach((idea) => {
    if (idea.type !== "event" || idea.reminded || idea.hidden) return;
    const gap = Date.parse(idea.eventAt) - now;
    if (!(gap > 0 && gap <= EVENT_REMIND_MS)) return;
    idea.reminded = true;
    changed = true;
    (Array.isArray(idea.attendees) ? idea.attendees : []).forEach((badge) => {
      pushNote(badge, { type: "event", ideaId: idea.id, ideaTitle: idea.title || "", actorName: "", actorBadge: "", text: idea.eventAt });
    });
  });
  if (changed) writeIdeas(ideas);
}

function csvCell(value) {
  let text = String(value == null ? "" : value).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const STATUS_AR = { received: "مستلمة", review: "قيد المراجعة", project: "أصبحت مشروعاً", resolved: "تم الحل" };
const TYPE_AR = { idea: "فكرة", suggestion: "اقتراح", complaint: "شكوى" };

function exportPlace(value) {
  const match = /^geo:(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(String(value || ""));
  return match ? `https://www.google.com/maps/search/?api=1&query=${match[1]},${match[2]}` : String(value || "");
}

function exportCsv(kind, days) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const rows = readIdeas().filter((idea) => !idea.hidden && !HIDDEN_DEPTS.has(String(idea.department || "")) && Date.parse(idea.createdAt) >= since);
  if (kind === "departments") {
    const header = ["القسم", "عدد الموظفين", "المشاركون", "نسبة المشاركة %", "المنشورات", "الأفكار", "المشاريع"];
    return toCsv([header, ...departmentRows(rows.filter((idea) => (idea.type || "idea") !== "story")).map((row) => [row.department, row.headcount, row.people, row.participation, row.posts, row.ideas, row.projects])]);
  }
  const header = ["الرقم", "النوع", "العنوان", "النص", "القسم", "صاحب المشاركة", "المنصب", "الحالة", "تاريخ الإرسال", "آخر تحديث للحالة", "الإعجابات", "التعليقات", "المكان", "المشروع"];
  const list = rows
    .filter((idea) => TYPE_AR[idea.type || "idea"])
    .sort((left, right) => (Number(left.number) || 0) - (Number(right.number) || 0))
    .map((idea) => {
      const log = Array.isArray(idea.statusLog) ? idea.statusLog : [];
      const last = log.length ? log[log.length - 1].at : "";
      const likes = (Array.isArray(idea.ratings) ? idea.ratings : []).filter((rating) => voteOf(rating) === "like").length;
      return [
        idea.number || "",
        TYPE_AR[idea.type || "idea"],
        idea.title || "",
        idea.text || "",
        idea.department || "",
        idea.name || "",
        idea.position || "",
        STATUS_AR[idea.status || "received"] || "",
        String(idea.createdAt || "").slice(0, 10),
        String(last).slice(0, 10),
        likes,
        Array.isArray(idea.comments) ? idea.comments.length : 0,
        exportPlace(idea.place),
        idea.project || "",
      ];
    });
  return toCsv([header, ...list]);
}

function publicComment(comment) {
  return {
    id: comment.id,
    text: comment.text,
    media: safeMedia(comment.media),
    createdAt: comment.createdAt,
    author: { name: comment.name || "", department: comment.department || "", position: comment.position || "", pid: comment.badge ? publicId(comment.badge) : "", photo: avatarOf(comment.badge), official: isOfficialBadge(comment.badge) },
  };
}

function statusEntry(person, status) {
  return {
    status,
    at: new Date().toISOString(),
    badge: String(person.badge),
    name: person.name || "",
    department: person.department || "",
    position: person.position || "",
  };
}

function publicHistory(idea) {
  const log = Array.isArray(idea.statusLog) ? idea.statusLog : [];
  return log.slice(-40).map((entry) => ({
    status: ALL_STATUSES.has(entry.status) ? entry.status : "received",
    at: entry.at || "",
    name: entry.name || "",
    department: entry.department || "",
    position: entry.position || "",
    official: isOfficialBadge(entry.badge),
  }));
}

function rankTitle(position) {
  const title = String(position || "");
  if (/\b(ceo|chief)\b/i.test(title)) return 0;
  if (/\bdirector\b/i.test(title)) return 1;
  if (/\bgeneral manager\b/i.test(title)) return 2;
  if (/\b(manager|head)\b/i.test(title)) {
    if (/\b(assistant|asst\.?|deputy)\b/i.test(title)) return 5;
    if (/\b(senior|sr\.?)\b/i.test(title)) return 3;
    return 4;
  }
  if (/\bsuperintendent\b/i.test(title)) return 6;
  if (/\bsupervisor\b/i.test(title)) return 7;
  if (/\b(foreman|leadman)\b/i.test(title) || /\blead\b/i.test(title)) return 8;
  return 9;
}

function byImportance(left, right) {
  const gap = rankTitle(left.position) - rankTitle(right.position);
  if (gap) return gap;
  return String(left.name || "").localeCompare(String(right.name || ""), "en", { sensitivity: "base" });
}

function canChangeStatus(actor, idea) {
  if (!actor || !idea) return false;
  if (String(actor.badge) === String(idea.badge || "")) return false;
  return isAdmin(actor);
}

function isModerator(person) {
  return isAdmin(person);
}

function canSeeDashboard(person) {
  return isAdmin(person);
}

const ADMIN_PAGE = 30;

function adminPostRow(idea) {
  return {
    id: idea.id,
    number: idea.number || 0,
    type: idea.type || "idea",
    title: idea.title || String(idea.text || "").slice(0, 80),
    status: idea.status || "received",
    name: idea.name || "",
    department: idea.department || "",
    createdAt: idea.createdAt || "",
    likes: ratingSummary(idea, "").likes,
    comments: Array.isArray(idea.comments) ? idea.comments.length : 0,
    hidden: Boolean(idea.hidden),
  };
}

const ADMIN_DAYS = new Set([7, 30, 90, 365]);

function adminSince(body) {
  const days = Number(body.days);
  return ADMIN_DAYS.has(days) ? Date.now() - days * 86400000 : 0;
}

function adminPosts(body) {
  const kind = body.kind === "complaint" ? "complaint" : "idea";
  const query = String(body.q || "").trim().toLowerCase().slice(0, 80);
  const since = adminSince(body);
  const pool = readIdeas().filter((idea) => (idea.type || "idea") === kind && (!since || Date.parse(idea.createdAt) >= since));
  const counts = { all: pool.length };
  pool.forEach((idea) => {
    const status = idea.status || "received";
    counts[status] = (counts[status] || 0) + 1;
  });
  const status = String(body.status || "all");
  const list = pool
    .filter((idea) => status === "all" || (idea.status || "received") === status)
    .filter((idea) => !query || `${idea.title || ""} ${idea.text || ""} ${idea.name || ""} ${idea.department || ""} ${idea.number || ""}`.toLowerCase().includes(query))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const offset = Math.max(0, Number(body.offset) || 0);
  return { kind, counts, total: list.length, items: list.slice(offset, offset + ADMIN_PAGE).map(adminPostRow) };
}

function moderatorBadges() {
  const listed = readJson(MODERATORS, {});
  return new Set((Array.isArray(listed.badges) ? listed.badges : []).map(String));
}

function adminUserRow(person, mods, configured) {
  const account = auth.accountOf(person.badge);
  const badge = String(person.badge);
  const sessions = account && account.hash ? auth.listSessions(badge) : [];
  return {
    pid: publicId(badge),
    name: person.name,
    department: person.department || "",
    position: person.position || "",
    photo: avatarOf(badge),
    admin: configured.has(badge) || mods.has(badge),
    fixedAdmin: configured.has(badge),
    registered: Boolean(account && account.hash),
    locked: auth.locked(badge) || auth.locked(`2fa:${badge}`),
    twoFactor: Boolean(account && account.totp && account.totp.on),
    devices: sessions.length,
    lastSeen: sessions.reduce((latest, row) => (row.lastSeen > latest ? row.lastSeen : latest), ""),
    banned: isBanned(badge),
    warnings: warningCount(badge),
  };
}

function liftBan(badge) {
  const data = conductData();
  delete data.bans[badge];
  data.resets[badge] = new Date().toISOString();
  saveConduct(data);
  auth.audit("unbanned_by_admin", publicId(badge));
}

function conductCard(badge) {
  const person = lookupPerson(badge) || { name: "", department: "", position: "" };
  return { pid: publicId(badge), name: person.name || "", department: person.department || "", position: person.position || "", photo: avatarOf(badge) };
}

function adminConduct(body) {
  const data = conductData();
  const query = String(body.q || "").trim().toLowerCase().slice(0, 60);
  const filter = body.filter === "banned" ? "banned" : "all";
  const now = Date.now();
  const counts = new Map();
  data.warnings.forEach((row) => {
    if ((Date.parse(row.at) || 0) > (Date.parse(data.resets[row.badge] || "") || 0)) counts.set(row.badge, (counts.get(row.badge) || 0) + 1);
  });
  const matches = (badge, extra) => {
    if (!query) return true;
    const card = conductCard(badge);
    return `${card.name} ${card.department} ${card.position} ${extra || ""}`.toLowerCase().includes(query);
  };
  const bans = Object.keys(data.bans)
    .filter((badge) => matches(badge))
    .map((badge) => ({ person: conductCard(badge), at: data.bans[badge].at || "", count: data.bans[badge].count || CONDUCT_LIMIT, total: data.warnings.filter((row) => row.badge === badge).length }))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
  const rows = filter === "banned" ? [] : data.warnings
    .filter((row) => matches(row.badge, row.text))
    .slice()
    .reverse();
  const offset = Math.max(0, Number(body.offset) || 0);
  return {
    stats: {
      warnings: data.warnings.length,
      week: data.warnings.filter((row) => now - (Date.parse(row.at) || 0) < 7 * 24 * 60 * 60 * 1000).length,
      people: new Set(data.warnings.map((row) => row.badge)).size,
      banned: Object.keys(data.bans).length,
      limit: CONDUCT_LIMIT,
      library: moderation.size(),
    },
    bans,
    total: rows.length,
    items: rows.slice(offset, offset + ADMIN_PAGE).map((row) => ({
      id: row.id,
      at: row.at,
      where: row.where,
      text: row.text,
      words: Array.isArray(row.words) ? row.words : [],
      count: counts.get(row.badge) || 0,
      banned: Boolean(data.bans[row.badge]),
      person: conductCard(row.badge),
    })),
  };
}

function adminUsers(body) {
  const query = String(body.q || "").trim().toLowerCase().slice(0, 60);
  const filter = String(body.filter || "all");
  const mods = moderatorBadges();
  const configured = auth.securityConfig().admins;
  const list = directory.filter((person) => {
    if (query && !`${person.name} ${person.department || ""} ${person.position || ""}`.toLowerCase().includes(query)) return false;
    const badge = String(person.badge);
    if (filter === "admins") return configured.has(badge) || mods.has(badge);
    if (filter === "registered") {
      const account = auth.accountOf(badge);
      return Boolean(account && account.hash);
    }
    if (filter === "locked") return auth.locked(badge);
    if (filter === "banned") return isBanned(badge);
    return true;
  });
  const offset = Math.max(0, Number(body.offset) || 0);
  return { total: list.length, items: list.slice(offset, offset + ADMIN_PAGE).map((person) => adminUserRow(person, mods, configured)) };
}

function adminPendingAchievements() {
  const all = readJson(DEPTS, {});
  const rows = [];
  Object.keys(all).forEach((department) => {
    (Array.isArray(all[department].achievements) ? all[department].achievements : [])
      .filter((item) => item.status === "pending")
      .forEach((item) => rows.push({ department, id: item.id, title: item.title || "", text: item.text || "", name: item.name || "", position: item.position || "", createdAt: item.createdAt || "" }));
  });
  return rows.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

const LOG_GROUPS = {
  logins: new Set(["login", "logout", "register"]),
  failures: new Set(["login_fail", "login_locked", "login_2fa_fail", "login_2fa_locked", "register_fail", "password_fail", "mail_fail", "backup_fail", "2fa_recovery_used"]),
  admin: new Set(["admin_grant", "admin_revoke", "sessions_revoked_by_admin", "session_revoked_by_admin", "unlocked_by_admin", "2fa_reset_by_admin", "admin_delete_post", "admin_delete_comment", "admin_remove_like", "backup_manual", "unbanned_by_admin"]),
};
const LOG_FAILS = new Set(["login_fail", "login_locked", "login_2fa_fail", "login_2fa_locked"]);
const LOG_LOCKS = new Set(["login_locked", "login_2fa_locked"]);
const LOG_PAGE = 60;

function logGroup(type) {
  return Object.keys(LOG_GROUPS).find((key) => LOG_GROUPS[key].has(type)) || "security";
}

function riyadhHour(at) {
  return new Date(Date.parse(at) + 3 * 3600000).getUTCHours();
}

function topCounts(map, limit) {
  return [...map.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
}

function adminLog(body) {
  const audit = readJson(AUDIT, { rows: [] });
  const days = Number(body.days);
  const since = days === 1 ? Date.now() - 86400000 : adminSince(body);
  const base = (Array.isArray(audit.rows) ? audit.rows : []).filter((row) => !since || Date.parse(row.at) >= since);
  const mods = moderatorBadges();
  const configured = auth.securityConfig().admins;
  const people = new Map();
  const personOf = (who) => {
    if (people.has(who)) return people.get(who);
    const person = /^[0-9a-f]{16}$/.test(who) ? personByPid(who) : null;
    let card = null;
    if (person) {
      const badge = String(person.badge);
      const account = auth.accountOf(badge) || {};
      card = {
        pid: who,
        official: Boolean(person.system),
        name: person.name,
        department: person.department || "",
        position: person.position || "",
        photo: avatarOf(badge),
        admin: configured.has(badge) || mods.has(badge),
        registered: Boolean(account.hash),
        twoFactor: Boolean(account.totp && account.totp.on),
        email: Boolean(account.email),
        locked: auth.locked(badge) || auth.locked(`2fa:${badge}`),
        devices: account.hash ? auth.listSessions(badge).length : 0,
      };
    }
    people.set(who, card);
    return card;
  };

  const hours = Array(24).fill(0);
  const kinds = { mobile: 0, tablet: 0, desktop: 0 };
  const browsers = new Map();
  const systems = new Map();
  const loginPeople = new Set();
  const ips = new Set();
  let logins = 0;
  let fails = 0;
  let locks = 0;
  let app = 0;
  base.forEach((row) => {
    const type = String(row.type || "");
    if (row.ip && (type === "login" || LOG_FAILS.has(type))) ips.add(row.ip);
    if (LOG_FAILS.has(type)) fails += 1;
    if (LOG_LOCKS.has(type)) locks += 1;
    if (type !== "login") return;
    logins += 1;
    loginPeople.add(String(row.who || ""));
    hours[riyadhHour(row.at)] += 1;
    const device = row.device || {};
    if (kinds[device.kind] != null) kinds[device.kind] += 1;
    if (device.app) app += 1;
    const browser = device.app ? "app" : device.browser && device.browser !== "other" ? device.browser : "other";
    browsers.set(browser, (browsers.get(browser) || 0) + 1);
    const os = device.os && device.os !== "other" ? device.os : "other";
    systems.set(os, (systems.get(os) || 0) + 1);
  });

  const group = ["logins", "failures", "security", "admin"].includes(body.group) ? body.group : "all";
  const query = String(body.q || "").trim().toLowerCase().slice(0, 60);
  const groupCounts = { all: base.length, logins: 0, failures: 0, security: 0, admin: 0 };
  base.forEach((row) => { groupCounts[logGroup(String(row.type || ""))] += 1; });
  const list = base
    .filter((row) => group === "all" || logGroup(String(row.type || "")) === group)
    .filter((row) => {
      if (!query) return true;
      const card = personOf(String(row.who || ""));
      const device = row.device || {};
      return `${card ? `${card.name} ${card.department} ${card.position}` : ""} ${row.ip || ""} ${device.os || ""} ${device.browser || ""}`.toLowerCase().includes(query);
    })
    .reverse();
  const offset = Math.max(0, Number(body.offset) || 0);
  const items = list.slice(offset, offset + LOG_PAGE).map((row) => {
    const who = String(row.who || "");
    const type = String(row.type || "");
    return {
      at: row.at || "",
      type,
      group: logGroup(type),
      ip: row.ip || "",
      device: row.device || null,
      person: personOf(who),
      unknown: who === "unknown",
      system: who === "system" || who === "local",
    };
  });
  return {
    total: list.length,
    counts: groupCounts,
    items,
    stats: {
      logins,
      fails,
      locks,
      people: loginPeople.size,
      ips: ips.size,
      successRate: logins + fails ? Math.round((logins / (logins + fails)) * 100) : null,
      hours,
      kinds,
      app,
      browsers: topCounts(browsers, 5),
      systems: topCounts(systems, 5),
    },
  };
}

function adminSummary() {
  const ideas = readIdeas();
  const count = (type) => ideas.filter((idea) => (idea.type || "idea") === type).length;
  const today = sparkAgent.riyadhDate();
  const audit = readJson(AUDIT, { rows: [] });
  const logins = (Array.isArray(audit.rows) ? audit.rows : []).filter((row) => row.type === "login" && sparkAgent.riyadhDate(new Date(row.at)) === today).length;
  const registered = directory.filter((person) => {
    const account = auth.accountOf(person.badge);
    return Boolean(account && account.hash);
  }).length;
  return {
    employees: directory.length,
    registered,
    loginsToday: logins,
    posts: ideas.filter((idea) => idea.type !== "story").length,
    ideas: count("idea"),
    ideasWaiting: ideas.filter((idea) => (idea.type || "idea") === "idea" && (idea.status || "received") === "received").length,
    complaintsOpen: ideas.filter((idea) => idea.type === "complaint" && idea.status !== "resolved").length,
    reported: ideas.filter((idea) => openReports(idea).length).length,
    hidden: ideas.filter((idea) => idea.hidden).length,
    achievementsPending: adminPendingAchievements().length,
    conductToday: conductData().warnings.filter((row) => Date.now() - (Date.parse(row.at) || 0) < 24 * 60 * 60 * 1000).length,
    banned: Object.keys(conductData().bans).length,
    backup: backup.status(),
  };
}

function adminSpark() {
  const pack = ensureDailySparks();
  const custom = pack.override && pack.override.date === pack.date ? pack.override : null;
  const base = pack.items["*"] || { ar: "", en: "" };
  return { date: pack.date, auto: { ar: base.ar || "", en: base.en || "" }, custom: custom ? { ar: custom.ar, en: custom.en || "" } : null };
}

function adminContent(body) {
  const kind = ["posts", "comments", "likes"].includes(body.kind) ? body.kind : "posts";
  const query = String(body.q || "").trim().toLowerCase().slice(0, 80);
  const since = adminSince(body);
  const fresh = (at) => !since || Date.parse(at) >= since;
  const all = readIdeas().filter((idea) => (idea.type || "idea") !== "story" && !HIDDEN_DEPTS.has(String(idea.department || "")));
  const titleOf = (idea) => idea.title || String(idea.text || "").slice(0, 80);
  let rows = [];
  if (kind === "posts") {
    rows = all.filter((idea) => fresh(idea.createdAt)).map((idea) => ({
      ...adminPostRow(idea),
      text: String(idea.text || "").slice(0, 220),
      media: safeMedia(idea.media),
      official: isOfficialBadge(idea.badge),
    }));
  }
  if (kind === "comments") {
    all.forEach((idea) => {
      (Array.isArray(idea.comments) ? idea.comments : []).filter((comment) => fresh(comment.createdAt)).forEach((comment) => rows.push({
        id: comment.id,
        postId: idea.id,
        postTitle: titleOf(idea),
        text: String(comment.text || "").slice(0, 280),
        media: safeMedia(comment.media),
        name: comment.name || "",
        department: comment.department || "",
        official: isOfficialBadge(comment.badge),
        createdAt: comment.createdAt || "",
      }));
    });
  }
  if (kind === "likes") {
    all.filter((idea) => fresh(idea.createdAt)).forEach((idea) => {
      (Array.isArray(idea.ratings) ? idea.ratings : []).filter((rating) => voteOf(rating) === "like").forEach((rating) => {
        const voter = lookupPerson(rating.badge || rating.voter);
        if (!voter) return;
        rows.push({
          postId: idea.id,
          postTitle: titleOf(idea),
          pid: publicId(voter.badge),
          name: voter.name || "",
          department: voter.department || "",
          position: voter.position || "",
          createdAt: idea.createdAt || "",
        });
      });
    });
  }
  const list = rows
    .filter((row) => !query || `${row.title || ""} ${row.postTitle || ""} ${row.text || ""} ${row.name || ""} ${row.department || ""}`.toLowerCase().includes(query))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const offset = Math.max(0, Number(body.offset) || 0);
  return { kind, total: list.length, items: list.slice(offset, offset + ADMIN_PAGE) };
}

function canReply(person, idea) {
  if (!person || !idea) return false;
  if (String(idea.badge || "") === String(person.badge) || isAdmin(person)) return true;
  if (idea.replies === "none") return false;
  if (idea.replies === "department") return Boolean(idea.department) && String(person.department || "") === String(idea.department);
  return true;
}

function openReports(idea) {
  const reviewed = Date.parse(idea.modReviewedAt || 0) || 0;
  return (Array.isArray(idea.reports) ? idea.reports : []).filter((row) => Date.parse(row.at) > reviewed);
}

function visibleTo(idea, voter) {
  const key = String(voter || "");
  if (String(idea.badge || "") === key) return true;
  if (idea.hidden) return false;
  return !(Array.isArray(idea.reports) && idea.reports.some((row) => String(row.badge) === key));
}

function notifyModerators(idea, type, text) {
  adminBadges().forEach((badge) => {
    pushNote(badge, { type, ideaId: idea.id, ideaTitle: idea.title || String(idea.text || "").slice(0, 80), actorName: "", actorBadge: "", text });
  });
}

function modItem(idea, viewer) {
  const open = openReports(idea);
  const reasons = {};
  open.forEach((row) => {
    reasons[row.reason] = (reasons[row.reason] || 0) + 1;
  });
  return {
    ...publicIdea(idea, viewer),
    hidden: Boolean(idea.hidden),
    hiddenBy: idea.hidden ? idea.hiddenBy || "moderator" : "",
    reportCount: open.length,
    reasons,
    lastReportAt: open.length ? open[open.length - 1].at : "",
  };
}

function moderationQueue(viewer) {
  return readIdeas()
    .filter((idea) => idea.hidden || openReports(idea).length)
    .map((idea) => modItem(idea, viewer))
    .sort((left, right) => Number(right.reportCount > 0) - Number(left.reportCount > 0) || Date.parse(right.lastReportAt || right.createdAt) - Date.parse(left.lastReportAt || left.createdAt));
}

function departmentRows(list) {
  const isIdea = (idea) => (idea.type || "idea") === "idea";
  const headcount = new Map();
  directory.forEach((person) => {
    const name = String(person.department || "").trim();
    if (name && !HIDDEN_DEPTS.has(name)) headcount.set(name, (headcount.get(name) || 0) + 1);
  });
  const depts = new Map();
  list.forEach((idea) => {
    const name = String(idea.department || "").trim();
    if (!name) return;
    if (!depts.has(name)) depts.set(name, { department: name, posts: 0, ideas: 0, projects: 0, people: new Set() });
    const row = depts.get(name);
    row.posts += 1;
    if (isIdea(idea)) row.ideas += 1;
    if (idea.status === "project") row.projects += 1;
    row.people.add(String(idea.badge));
  });
  return [...depts.values()]
    .map((row) => ({
      department: row.department,
      posts: row.posts,
      ideas: row.ideas,
      projects: row.projects,
      people: row.people.size,
      headcount: headcount.get(row.department) || 0,
      participation: headcount.get(row.department) ? Math.round((row.people.size / headcount.get(row.department)) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.ideas - left.ideas || right.posts - left.posts);
}

function dashboardStats(days) {
  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;
  const all = readIdeas().filter((idea) => (idea.type || "idea") !== "story" && !HIDDEN_DEPTS.has(String(idea.department || "")));
  const inRange = all.filter((idea) => Date.parse(idea.createdAt) >= since);
  const isIdea = (idea) => (idea.type || "idea") === "idea";
  const likesOf = (idea) => (Array.isArray(idea.ratings) ? idea.ratings : []).filter((rating) => voteOf(rating) === "like").length;
  const commentsOf = (idea) => (Array.isArray(idea.comments) ? idea.comments : []);
  const active = new Set();
  let comments = 0;
  all.forEach((idea) => {
    if (Date.parse(idea.createdAt) >= since) active.add(String(idea.badge));
    commentsOf(idea).forEach((comment) => {
      if (Date.parse(comment.createdAt) < since) return;
      comments += 1;
      active.add(String(comment.badge));
    });
  });
  const ideasAll = all.filter(isIdea);
  const reachedAt = (idea, status) => {
    const entry = (Array.isArray(idea.statusLog) ? idea.statusLog : []).find((row) => row.status === status);
    return entry ? Date.parse(entry.at) : NaN;
  };
  const averageDays = (list, status) => {
    const gaps = list.map((idea) => (reachedAt(idea, status) - Date.parse(idea.createdAt)) / 86400000).filter((gap) => Number.isFinite(gap) && gap >= 0);
    return gaps.length ? Math.round((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) * 10) / 10 : null;
  };
  const complaints = all.filter((idea) => idea.type === "complaint");
  const departments = departmentRows(inRange).slice(0, 10);

  const week = 7 * 24 * 60 * 60 * 1000;
  const weeks = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = now - (i + 1) * week;
    const end = now - i * week;
    const rows = all.filter((idea) => {
      const at = Date.parse(idea.createdAt);
      return at >= start && at < end;
    });
    weeks.push({ start: new Date(start).toISOString(), posts: rows.length, ideas: rows.filter(isIdea).length });
  }

  const score = (idea) => likesOf(idea) + commentsOf(idea).length * 2 + (Array.isArray(idea.reposts) ? idea.reposts.length : 0);
  const topIdeas = inRange
    .filter(isIdea)
    .sort((left, right) => score(right) - score(left))
    .slice(0, 5)
    .map((idea) => ({
      id: idea.id,
      number: idea.number,
      title: idea.title || String(idea.text || "").slice(0, 80),
      department: idea.department || "",
      status: idea.status || "received",
      likes: likesOf(idea),
      comments: commentsOf(idea).length,
    }));

  const people = new Map();
  inRange.forEach((idea) => {
    const key = String(idea.badge || "");
    const person = byBadge.get(key);
    if (!person) return;
    const row = people.get(key) || { ...lightCard(person), posts: 0, ideas: 0, points: 0 };
    row.posts += 1;
    if (isIdea(idea)) row.ideas += 1;
    row.points += (isIdea(idea) ? 10 : 4) + likesOf(idea) * 2 + commentsOf(idea).length * 3;
    people.set(key, row);
  });
  const contributors = [...people.values()].sort((left, right) => right.points - left.points).slice(0, 5);

  const before = since - days * 24 * 60 * 60 * 1000;
  const previous = { posts: 0, comments: 0, likes: 0 };
  const previousActive = new Set();
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  const mark = (at) => {
    const local = new Date(Date.parse(at) + 3 * 3600000);
    heat[local.getUTCDay()][local.getUTCHours()] += 1;
  };
  const mix = {};
  let commented = 0;
  let reposts = 0;
  all.forEach((idea) => {
    const at = Date.parse(idea.createdAt);
    if (at >= since) {
      mark(idea.createdAt);
      const type = idea.type || "idea";
      mix[type] = (mix[type] || 0) + 1;
      if (commentsOf(idea).length) commented += 1;
      reposts += Array.isArray(idea.reposts) ? idea.reposts.length : 0;
    } else if (at >= before) {
      previous.posts += 1;
      previous.likes += likesOf(idea);
      previousActive.add(String(idea.badge));
    }
    commentsOf(idea).forEach((comment) => {
      const when = Date.parse(comment.createdAt);
      if (when >= since) mark(comment.createdAt);
      else if (when >= before) {
        previous.comments += 1;
        previousActive.add(String(comment.badge));
      }
    });
  });
  previous.active = previousActive.size;

  const security = { employees: directory.length, registered: 0, twoFactor: 0, email: 0, locked: 0, sessions: 0, logins: 0, fails: 0, people: 0 };
  directory.forEach((person) => {
    const badge = String(person.badge);
    const account = auth.accountOf(badge);
    if (auth.locked(badge) || auth.locked(`2fa:${badge}`)) security.locked += 1;
    if (!account || !account.hash) return;
    security.registered += 1;
    if (account.totp && account.totp.on) security.twoFactor += 1;
    if (account.email) security.email += 1;
    security.sessions += auth.listSessions(badge).length;
  });
  const loginDays = [];
  const dayKey = (ms) => new Date(ms + 3 * 3600000).toISOString().slice(0, 10);
  for (let i = 13; i >= 0; i -= 1) loginDays.push({ date: dayKey(now - i * 86400000), logins: 0, fails: 0 });
  const dayIndex = new Map(loginDays.map((row, index) => [row.date, index]));
  const loginPeople = new Set();
  const audit = readJson(AUDIT, { rows: [] });
  (Array.isArray(audit.rows) ? audit.rows : []).forEach((row) => {
    const at = Date.parse(row.at);
    const type = String(row.type || "");
    const fail = LOG_FAILS.has(type);
    if (type !== "login" && !fail) return;
    if (at >= since) {
      if (fail) security.fails += 1;
      else {
        security.logins += 1;
        loginPeople.add(String(row.who || ""));
      }
    }
    const index = dayIndex.get(dayKey(at));
    if (index != null) loginDays[index][fail ? "fails" : "logins"] += 1;
  });
  security.people = loginPeople.size;

  const totalLikes = inRange.reduce((sum, idea) => sum + likesOf(idea), 0);
  return {
    days,
    previous,
    security,
    loginDays,
    heat,
    mix,
    engagement: {
      likesPerPost: inRange.length ? Math.round((totalLikes / inRange.length) * 10) / 10 : 0,
      commentsPerPost: inRange.length ? Math.round((comments / inRange.length) * 10) / 10 : 0,
      commentedShare: inRange.length ? Math.round((commented / inRange.length) * 100) : 0,
      reposts,
    },
    totals: {
      posts: inRange.length,
      ideas: inRange.filter(isIdea).length,
      comments,
      likes: inRange.reduce((sum, idea) => sum + likesOf(idea), 0),
      active: active.size,
      employees: directory.length,
    },
    funnel: {
      received: ideasAll.filter((idea) => (idea.status || "received") === "received").length,
      review: ideasAll.filter((idea) => idea.status === "review").length,
      project: ideasAll.filter((idea) => idea.status === "project").length,
      total: ideasAll.length,
      reviewDays: averageDays(ideasAll, "review"),
      projectDays: averageDays(ideasAll, "project"),
    },
    complaints: {
      open: complaints.filter((idea) => idea.status !== "resolved").length,
      resolved: complaints.filter((idea) => idea.status === "resolved").length,
      resolveDays: averageDays(complaints, "resolved"),
    },
    moderation: {
      reported: all.filter((idea) => openReports(idea).length).length,
      hidden: all.filter((idea) => idea.hidden).length,
    },
    departments,
    weeks,
    topIdeas,
    contributors,
  };
}

function publicIdea(idea, voter) {
  const follow = followsFor(voter);
  const type = POST_TYPES.has(idea.type) ? idea.type : "idea";
  const thanks = idea.thanksBadge ? personByPid(publicId(idea.thanksBadge)) || byBadge.get(String(idea.thanksBadge)) : null;
  const poll = Array.isArray(idea.poll)
    ? idea.poll.map((option, index) => ({
        index,
        text: option.text,
        votes: Array.isArray(option.votes) ? option.votes.length : 0,
        mine: Array.isArray(option.votes) && option.votes.map(String).includes(String(voter)),
      }))
    : [];
  const reposts = Array.isArray(idea.reposts) ? idea.reposts : [];
  const media = safeMedia(idea.media);
  const extras = media && Array.isArray(idea.gallery) ? idea.gallery.map(safeMedia).filter(Boolean) : [];
  const viewer = lookupPerson(voter);
  const pinner = canPin(viewer, { ...idea, type });
  const acks = Array.isArray(idea.acks) ? idea.acks.map(String) : [];
  const attendees = Array.isArray(idea.attendees) ? idea.attendees.map(String) : [];
  return {
    id: idea.id,
    number: idea.number,
    type,
    title: idea.title || String(idea.text || "").slice(0, 80),
    text: idea.text,
    media,
    gallery: extras.length ? [media, ...extras] : [],
    hidden: Boolean(idea.hidden),
    problem: idea.problem || "",
    pros: Array.isArray(idea.pros) ? idea.pros : [],
    cons: Array.isArray(idea.cons) ? idea.cons : [],
    impact: idea.impact || "",
    place: idea.place || "",
    project: idea.project || "",
    mine: Boolean(voter) && String(idea.badge || "") === String(voter),
    canStatus: type === "idea" || type === "complaint" ? canChangeStatus(viewer, idea) : false,
    replies: REPLY_SCOPES.has(idea.replies) ? idea.replies : "all",
    canReply: canReply(viewer, idea),
    saved: Boolean(voter) && savedBy(voter, idea.id),
    followed: follow.people.includes(String(idea.badge || "")),
    pid: idea.badge ? publicId(idea.badge) : "",
    status: idea.status || "",
    history: publicHistory(idea),
    createdAt: idea.createdAt,
    expiresAt: idea.expiresAt || "",
    groupId: idea.groupId || "",
    groupName: idea.groupName || "",
    thanksTo: thanks ? { pid: publicId(thanks.badge), name: thanks.name, department: thanks.department || "", position: thanks.position || "", photo: avatarOf(thanks.badge) } : null,
    poll,
    reposts: reposts.length,
    reposted: reposts.some((item) => String(item.badge) === String(voter)),
    views: viewsOf(idea.id),
    author: { name: idea.name || "", department: idea.department || "", position: idea.position || "", pid: idea.badge ? publicId(idea.badge) : "", photo: avatarOf(idea.badge), official: isOfficialBadge(idea.badge) },
    rating: ratingSummary(idea, voter),
    comments: (Array.isArray(idea.comments) ? idea.comments : []).map(publicComment),
    pinned: PINNABLE.has(type) && Boolean(idea.pinned),
    canPin: pinner,
    ack: type === "announcement" ? { mine: acks.includes(String(voter)), count: acks.length, total: pinner ? audienceCount() : 0 } : null,
    event: type === "event" ? { at: idea.eventAt || "", going: attendees.length, mine: attendees.includes(String(voter)) } : null,
  };
}

function publicList(ideas, voter) {
  return ideas.filter((idea) => visibleTo(idea, voter)).map((idea) => publicIdea(idea, voter));
}

function acceptsGzip(req) {
  return Boolean(req) && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""));
}

function send(res, code, data) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Accept-Encoding",
  };
  let body = Buffer.from(JSON.stringify(data));
  if (body.length > 1400 && acceptsGzip(res.req)) {
    body = zlib.gzipSync(body, { level: 5 });
    headers["Content-Encoding"] = "gzip";
  }
  headers["Content-Length"] = body.length;
  res.writeHead(code, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 420000) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function ideaRoute(urlPath) {
  if (!urlPath.startsWith("/api/ideas/")) return null;
  const rest = urlPath.slice("/api/ideas/".length);
  const [rawId, action = ""] = rest.split("/");
  let id = "";
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return null;
  if (action && !["rating", "comments", "bookmark", "engagement", "repost", "poll", "report", "ack", "pin", "rsvp"].includes(action)) return null;
  return { id, action };
}

function finishLogin(res, badge, person, info, extra = {}) {
  auth.audit("login", publicId(badge), info);
  const token = auth.signSession(badge, info, sessionTtl(person));
  const signature = `${info.device.kind}|${info.device.os}|${info.device.browser}|${info.device.app ? "app" : "web"}`;
  if (auth.rememberDevice(badge, signature)) {
    const when = new Date().toLocaleString("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" });
    pushNote(badge, { type: "login_new", ideaId: "", ideaTitle: deviceText(info.device), actorName: "", actorBadge: "", text: info.ip });
    const account = auth.accountOf(badge);
    noticeMail(account && account.email, `تم الدخول لحسابك في BQ Connect من جهاز جديد.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}\nالوقت: ${when}\n\nتقدر تشوف كل الأجهزة وتطلّع أي جهاز من: الإعدادات > الخصوصية والأمان.`);
  }
  send(res, 200, { ...extra, token, person: sessionPerson(person) });
}

function afterTwoFactor(res, badge, person, info, extra = {}) {
  if (accountEmail(person)) {
    finishLogin(res, badge, person, info, extra);
    return;
  }
  send(res, 200, { ...extra, needEmail: true, mailOn: auth.mailConfigured(), ticket: auth.signTicket(badge, "email", SETUP_TICKET_MS) });
}

function emailCodeHash(key, code) {
  return crypto.createHmac("sha256", PEPPER).update(`${key}:${code}`).digest("hex");
}

async function sendEmailCode(key, badge, email) {
  if (!auth.mailConfigured()) return "mail_off";
  if (!auth.mailAllowed(key)) return "mail_wait";
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  try {
    await auth.sendMail(email, "كود تأكيد الإيميل في BQ Connect", `هذا كود تأكيد إيميلك في BQ Connect:\n\n${code}\n\nالكود صالح 10 دقائق. إذا ما طلبته أنت، تجاهل الرسالة.\n\nBQ Connect - بن قريعة`);
  } catch {
    auth.audit("mail_fail", publicId(badge));
    return "mail_failed";
  }
  auth.noteMail(key);
  pendingEmail.set(key, { email, hash: emailCodeHash(key, code), exp: Date.now() + EMAIL_CODE_MS, tries: 0 });
  return "";
}

function takeEmailCode(key, code) {
  const pending = pendingEmail.get(key);
  if (!pending || pending.exp < Date.now() || pending.tries >= 5) {
    pendingEmail.delete(key);
    return { error: "code_expired" };
  }
  const given = Buffer.from(emailCodeHash(key, String(code || "").replace(/\D/g, "")));
  const right = Buffer.from(pending.hash);
  if (given.length !== right.length || !crypto.timingSafeEqual(given, right)) {
    pending.tries += 1;
    return { error: "bad_code" };
  }
  pendingEmail.delete(key);
  return { email: pending.email };
}

const MAIL_ERRORS = { mail_off: 503, mail_wait: 429, mail_failed: 503 };

async function confirmPassword(badge, password) {
  if (auth.locked(`pw:${badge}`)) return "limited";
  if (!(await auth.checkLogin(badge, password, true))) {
    auth.noteFailure(`pw:${badge}`);
    return "wrong_password";
  }
  auth.clearFailures(`pw:${badge}`);
  return "";
}

async function handleApi(req, res, urlPath, params) {
  if (req.method === "POST" && urlPath === "/api/login-2fa") {
    const ip = clientIp(req);
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const op = String(body.op || "verify");
    const stage = op === "email" || op === "email-confirm" ? "email" : "2fa";
    const badge = auth.readTicket(body.ticket, stage);
    const person = badge ? lookupPerson(badge) : null;
    if (!person) {
      send(res, 401, { error: "expired" });
      return;
    }
    const lockKey = stage === "email" ? `link:${badge}` : `2fa:${badge}`;
    if (auth.locked(lockKey) || ipBlocked(ip)) {
      send(res, 429, { error: "limited" });
      return;
    }
    const info = loginInfo(req, body);
    if (op === "setup" || op === "enroll") {
      if (auth.twoFactorOn(badge)) {
        send(res, 400, { error: "already_on" });
        return;
      }
      if (op === "setup") {
        send(res, 200, auth.beginTwoFactor(badge));
        return;
      }
      const codes = auth.confirmTwoFactor(badge, body.code);
      if (!codes) {
        const nowLocked = auth.noteFailure(lockKey);
        noteIpFailure(ip);
        send(res, nowLocked ? 429 : 400, { error: nowLocked ? "limited" : "bad_code" });
        return;
      }
      auth.useTicket(body.ticket);
      auth.clearFailures(lockKey);
      auth.audit("2fa_on", publicId(badge), info);
      noticeMail(accountEmail(person), `تم تفعيل التحقق بخطوتين لحسابك في BQ Connect.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
      afterTwoFactor(res, badge, person, info, { recovery: codes });
      return;
    }
    if (op === "email" || op === "email-confirm") {
      if (accountEmail(person)) {
        auth.useTicket(body.ticket);
        finishLogin(res, badge, person, info);
        return;
      }
      if (op === "email") {
        const email = auth.validEmail(body.email);
        if (!email) {
          send(res, 400, { error: "bad_email" });
          return;
        }
        const problem = await sendEmailCode(lockKey, badge, email);
        if (problem) {
          send(res, MAIL_ERRORS[problem], { error: problem });
          return;
        }
        send(res, 200, { sent: true, email: auth.maskEmail(email) });
        return;
      }
      const taken = takeEmailCode(lockKey, body.code);
      if (taken.error) {
        const nowLocked = taken.error === "bad_code" && auth.noteFailure(lockKey);
        send(res, nowLocked ? 429 : 400, { error: nowLocked ? "limited" : taken.error });
        return;
      }
      auth.clearFailures(lockKey);
      auth.linkEmail(badge, taken.email);
      auth.useTicket(body.ticket);
      auth.audit("email_linked", publicId(badge), info);
      finishLogin(res, badge, person, info);
      return;
    }
    if (!auth.twoFactorOn(badge)) {
      send(res, 401, { error: "expired" });
      return;
    }
    const how = auth.checkTwoFactor(badge, body.code);
    if (!how) {
      const nowLocked = auth.noteFailure(`2fa:${badge}`);
      noteIpFailure(ip);
      auth.audit(nowLocked ? "login_2fa_locked" : "login_2fa_fail", publicId(badge), info);
      if (nowLocked) {
        noticeMail((auth.accountOf(badge) || {}).email, `أحد كتب كلمة المرور الصحيحة لحسابك في BQ Connect، بس فشل في كود التحقق 5 مرات، فقفلنا الدخول 15 دقيقة.\nإذا مو أنت، غيّر كلمة المرور فوراً.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
      }
      send(res, nowLocked ? 429 : 401, { error: nowLocked ? "limited" : "invalid" });
      return;
    }
    auth.useTicket(body.ticket);
    auth.clearFailures(`2fa:${badge}`);
    if (how === "recovery") {
      auth.audit("2fa_recovery_used", publicId(badge), info);
      const left = auth.twoFactorStatus(badge).recoveryLeft;
      noticeMail((auth.accountOf(badge) || {}).email, `تم الدخول لحسابك في BQ Connect بكود احتياطي. باقي عندك ${left} أكواد.\nإذا مو أنت، غيّر كلمة المرور فوراً.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
    }
    afterTwoFactor(res, badge, person, info);
    return;
  }

  if (req.method === "POST" && urlPath === "/api/email") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const badge = String(person.badge);
    const key = `chg:${badge}`;
    const info = loginInfo(req, body);
    if (auth.locked(key)) {
      send(res, 429, { error: "limited" });
      return;
    }
    if (body.op === "send") {
      const email = auth.validEmail(body.email);
      if (!email) {
        send(res, 400, { error: "bad_email" });
        return;
      }
      if (email === accountEmail(person)) {
        send(res, 400, { error: "same_email" });
        return;
      }
      const problem = await confirmPassword(badge, body.password);
      if (problem) {
        if (problem === "wrong_password") auth.audit("password_fail", publicId(badge), info);
        send(res, problem === "limited" ? 429 : 400, { error: problem });
        return;
      }
      const mailProblem = await sendEmailCode(key, badge, email);
      if (mailProblem) {
        send(res, MAIL_ERRORS[mailProblem], { error: mailProblem });
        return;
      }
      send(res, 200, { sent: true, email: auth.maskEmail(email) });
      return;
    }
    if (body.op === "confirm") {
      const taken = takeEmailCode(key, body.code);
      if (taken.error) {
        const nowLocked = taken.error === "bad_code" && auth.noteFailure(key);
        send(res, nowLocked ? 429 : 400, { error: nowLocked ? "limited" : taken.error });
        return;
      }
      const previous = accountEmail(person);
      auth.clearFailures(key);
      auth.linkEmail(badge, taken.email);
      auth.audit("email_changed", publicId(badge), info);
      noticeMail(previous, `تم تغيير الإيميل المربوط بحسابك في BQ Connect إلى ${auth.maskEmail(taken.email)}.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
      send(res, 200, { person: sessionPerson(person) });
      return;
    }
    send(res, 400, { error: "bad_op" });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/2fa") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const badge = String(person.badge);
    const op = String(body.op || "status");
    const info = loginInfo(req, body);
    if (op === "recovery") {
      const problem = await confirmPassword(badge, body.password);
      if (problem) {
        if (problem === "wrong_password") auth.audit("password_fail", publicId(badge), info);
        send(res, problem === "limited" ? 429 : 400, { error: problem });
        return;
      }
      if (auth.locked(`2fa:${badge}`)) {
        send(res, 429, { error: "limited" });
        return;
      }
      if (!auth.checkTwoFactor(badge, body.code)) {
        auth.noteFailure(`2fa:${badge}`);
        send(res, 400, { error: "bad_code" });
        return;
      }
      auth.clearFailures(`2fa:${badge}`);
      const codes = auth.renewRecovery(badge);
      auth.audit("2fa_recovery_new", publicId(badge), info);
      send(res, 200, { recovery: codes, status: auth.twoFactorStatus(badge) });
      return;
    }
    send(res, 200, { status: auth.twoFactorStatus(badge) });
    return;
  }

  if (req.method === "POST" && (urlPath === "/api/login" || urlPath === "/api/register" || urlPath === "/api/forgot")) {
    const ip = clientIp(req);
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const badge = cleanBadge(body.badge).slice(0, 16);

    if (urlPath === "/api/login") {
      if (!badge || auth.locked(badge) || ipBlocked(ip)) {
        send(res, 429, { error: "limited" });
        return;
      }
      const person = lookupPerson(badge);
      const info = loginInfo(req, body);
      const ok = await auth.checkLogin(badge, body.password, Boolean(person));
      if (!ok || !person) {
        const nowLocked = auth.noteFailure(badge);
        noteIpFailure(ip);
        auth.audit(nowLocked ? "login_locked" : "login_fail", person ? publicId(badge) : "unknown", info);
        if (nowLocked && person) {
          const account = auth.accountOf(badge);
          noticeMail(account && account.email, `صار فيه 5 محاولات دخول فاشلة على حسابك في BQ Connect، فقفلنا الدخول 15 دقيقة.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
        }
        send(res, nowLocked ? 429 : 401, { error: nowLocked ? "limited" : "invalid" });
        return;
      }
      auth.clearFailures(badge);
      if (isBanned(badge)) {
        auth.audit("login_banned", publicId(badge), info);
        send(res, 403, { error: "banned" });
        return;
      }
      if (auth.twoFactorOn(badge)) send(res, 200, { needTotp: true, ticket: auth.signTicket(badge) });
      else send(res, 200, { needSetup: true, ticket: auth.signTicket(badge, "2fa", SETUP_TICKET_MS) });
      return;
    }

    if (urlPath === "/api/forgot") {
      if (!auth.mailConfigured()) {
        send(res, 503, { error: "mail_off" });
        return;
      }
      send(res, 200, { sent: true });
      const person = lookupPerson(badge);
      if (!person || !auth.mailAllowed(`reset:${badge}`)) return;
      const official = isAnnouncer(person) ? auth.securityConfig().announcer : null;
      const account = auth.accountOf(badge);
      const email = official ? official.email : account && account.email;
      if (!email) return;
      auth.noteMail(`reset:${badge}`);
      const password = auth.newPassword();
      try {
        await auth.setPending(badge, password, official ? { email } : null);
        await auth.sendMail(email, "كلمة مرور جديدة لـ BQ Connect", passwordMail(person.name, password, "reset"));
        auth.audit("reset_sent", publicId(badge), loginInfo(req, body));
      } catch {
        auth.audit("mail_fail", publicId(badge));
      }
      return;
    }

    if (!auth.strongPassword(body.password)) {
      send(res, 400, { error: "weak" });
      return;
    }
    if (!badge || auth.locked(`reg:${badge}`) || ipBlocked(ip)) {
      send(res, 429, { error: "limited" });
      return;
    }
    const code = cleanCode(body.code);
    const person = byBadge.get(badge);
    const identity = person && code.length === 4 && codesMatch(person, badge, code) && phoneMatch(person, badge, body.mobile);
    if (!identity) {
      auth.noteFailure(`reg:${badge}`);
      auth.audit("register_fail", person ? publicId(badge) : "unknown", loginInfo(req, body));
      if (tooManyAttempts(ip)) send(res, 429, { error: "limited" });
      else send(res, 401, { error: "mismatch" });
      return;
    }
    if (person.phone && smsConfigured()) {
      const entered = String(body.otp || "").replace(/\D/g, "");
      if (!entered) {
        const otp = beginOtp(badge, body.mobile);
        if (otp) {
          try {
            await sendSms(body.mobile, otp);
          } catch {
            pendingOtp.delete(badge);
            send(res, 503, { error: "sms" });
            return;
          }
        }
        send(res, 200, { needOtp: true });
        return;
      }
      if (!acceptOtp(badge, entered, body.mobile)) {
        auth.noteFailure(`reg:${badge}`);
        if (tooManyAttempts(ip)) send(res, 429, { error: "limited" });
        else send(res, 401, { error: "otp" });
        return;
      }
    }
    auth.clearFailures(`reg:${badge}`);
    if (auth.twoFactorOn(badge)) {
      send(res, 409, { error: "already_registered" });
      return;
    }
    await auth.setPassword(badge, String(body.password));
    const info = loginInfo(req, body);
    auth.audit("register", publicId(badge), info);
    noticeMail((auth.accountOf(badge) || {}).email, `تم تسجيل حسابك في BQ Connect من جديد بكلمة مرور جديدة.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
    send(res, 200, {
      registered: true,
      person: { name: person.name, department: person.department || "", position: person.position || "" },
      needSetup: true,
      ticket: auth.signTicket(badge, "2fa", SETUP_TICKET_MS),
    });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/translate") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    if (!translator.enabled()) {
      send(res, 503, { error: "translate_off" });
      return;
    }
    const from = body.from === "en" ? "en" : "ar";
    const to = body.to === "ar" ? "ar" : "en";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (from === to || !text || text.length > translator.MAX_TEXT) {
      send(res, 400, { error: "bad_text" });
      return;
    }
    if (translateLimited(person.badge)) {
      res.setHeader("Retry-After", "60");
      send(res, 429, { error: "limited" });
      return;
    }
    try {
      const translated = await translator.translate(text, from, to);
      send(res, translated ? 200 : 503, translated ? { text: translated, from, to } : { error: "translate_failed" });
    } catch {
      send(res, 503, { error: "translate_failed" });
    }
    return;
  }

  if (req.method === "POST" && urlPath === "/api/views") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((id) => typeof id === "string" && id.length <= 80))].slice(0, 60) : [];
    send(res, 200, { views: ids.length ? addViews(person.badge, ids, readIdeas()) : {} });
    return;
  }

  if (req.method === "POST" && (urlPath === "/api/password" || urlPath === "/api/logout-all" || urlPath === "/api/terms")) {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const badge = String(person.badge);
    if (urlPath === "/api/terms") {
      auth.acceptTerms(badge, TERMS_VERSION);
      auth.audit("terms", publicId(badge));
      send(res, 200, { person: sessionPerson(person) });
      return;
    }
    if (urlPath === "/api/logout-all") {
      auth.revokeSessions(badge);
      auth.audit("logout_all", publicId(badge), loginInfo(req, body));
      send(res, 200, { ok: true });
      return;
    }
    if (auth.locked(`pw:${badge}`)) {
      send(res, 429, { error: "limited" });
      return;
    }
    const next = String(body.next || "");
    if (!auth.strongPassword(next)) {
      send(res, 400, { error: "weak" });
      return;
    }
    if (!(await auth.checkLogin(badge, body.current, true))) {
      auth.noteFailure(`pw:${badge}`);
      auth.audit("password_fail", publicId(badge), loginInfo(req, body));
      send(res, 400, { error: "wrong_password" });
      return;
    }
    if (next === String(body.current || "")) {
      send(res, 400, { error: "same" });
      return;
    }
    await auth.setPassword(badge, next);
    auth.clearFailures(`pw:${badge}`);
    const info = loginInfo(req, body);
    auth.audit("password", publicId(badge), info);
    noticeMail((auth.accountOf(badge) || {}).email, `تم تغيير كلمة المرور لحسابك في BQ Connect، وانقفلت كل الجلسات القديمة.\nالجهاز: ${deviceText(info.device)}\nعنوان IP: ${info.ip}`);
    send(res, 200, { token: auth.signSession(badge, info, sessionTtl(person)), person: sessionPerson(person) });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/sessions") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const badge = String(person.badge);
    const current = auth.currentSessionId(body.token);
    if (body.op === "logout") {
      if (current) auth.revokeSession(badge, current);
      auth.audit("logout", publicId(badge), loginInfo(req, body));
      send(res, 200, { ok: true });
      return;
    }
    if (body.op === "revoke") {
      const id = String(body.id || "");
      if (!id || id === current || !auth.revokeSession(badge, id)) {
        send(res, 400, { error: "bad_session" });
        return;
      }
      auth.audit("session_revoked", publicId(badge), loginInfo(req, body));
    }
    send(res, 200, { sessions: auth.listSessions(badge).map((row) => ({ ...row, current: row.id === current })).reverse() });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/session") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    send(res, 200, { person: sessionPerson(person) });
    return;
  }

  if (req.method === "POST" && (urlPath === "/api/notifications" || urlPath === "/api/notifications/read")) {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const notes = readNotes();
    const mine = notes.filter((note) => String(note.badge) === String(person.badge));
    if (urlPath === "/api/notifications/read") {
      mine.forEach((note) => {
        note.read = true;
      });
      writeNotes(notes);
      markAnnouncementsRead(person.badge);
    }
    const visible = [...announcementsFor(person.badge), ...mine.slice().reverse().map(publicNote)]
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    send(res, 200, { notifications: visible });
    return;
  }

  if (req.method === "GET" && urlPath === "/api/spark") {
    const person = personFromToken(req.headers["x-session"]);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    send(res, 200, sparkFor(person));
    return;
  }

  if (req.method === "GET" && urlPath === "/api/ideas") {
    const voter = badgeFrom(req.headers["x-session"]);
    if (!voter) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const ideas = readIdeas();
    const filtered = filteredIdeas(ideas, voter, params);
    if (filtered.error) {
      send(res, filtered.error, { error: "forbidden" });
      return;
    }
    send(res, 200, { ideas: publicList(filtered.list, voter), stats: statsFor(ideas) });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/social") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    const action = String(body.action || "");
    if (action === "search") {
      const query = String(body.q || "").trim().toLowerCase();
      const people = query.length < 2 ? [] : directory.filter((item) => `${item.name} ${item.department} ${item.position}`.toLowerCase().includes(query)).slice(0, 8).map(cardOf);
      const departments = [...new Set(directory.map((item) => item.department).filter((name) => name && !HIDDEN_DEPTS.has(name)))].filter((name) => name.toLowerCase().includes(query)).slice(0, 6);
      send(res, 200, { people, departments });
      return;
    }
    if (action === "department") {
      const name = String(body.department || "");
      if (HIDDEN_DEPTS.has(name)) {
        send(res, 404, { error: "not_found" });
        return;
      }
      const query = String(body.q || "").trim().toLowerCase();
      const page = Math.max(0, Math.min(200, Number(body.page) || 0));
      const all = directory.filter((item) => item.department === name);
      const matched = (query
        ? all.filter((item) => `${item.name} ${item.position}`.toLowerCase().includes(query))
        : all
      ).slice().sort(byImportance);
      const following = new Set(followsFor(person.badge).people.map(String));
      const people = matched.slice(page * 12, page * 12 + 12).map((item) => ({
        ...directoryCard(item),
        followed: following.has(String(item.badge)),
      }));
      const roles = new Map();
      all.forEach((item) => {
        const title = String(item.position || "").trim();
        if (!title) return;
        roles.set(title, (roles.get(title) || 0) + 1);
      });
      send(res, 200, {
        total: all.length,
        matched: matched.length,
        people,
        roles: [...roles.entries()].sort((left, right) => {
          const gap = rankTitle(left[0]) - rankTitle(right[0]);
          if (gap) return gap;
          return right[1] - left[1];
        }).slice(0, 6).map(([title, count]) => ({ title, count })),
        followed: followsFor(person.badge).departments.includes(name),
        profile: departmentProfile(name, person),
      });
      return;
    }
    if (action === "achievement") {
      const department = String(body.department || "");
      const title = cleanText(body.title, 80);
      const text = cleanText(body.text, 500);
      if (!department || person.department !== department || !title || !text) {
        send(res, 400, { error: "text_required" });
        return;
      }
      if (screenText(res, person, "achievement", [title, text])) return;
      const all = readJson(DEPTS, {});
      const row = all[department] || { about: "", achievements: [] };
      row.achievements = Array.isArray(row.achievements) ? row.achievements : [];
      const approved = deptApprover(person, department);
      row.achievements.push({
        id: crypto.randomUUID(),
        title,
        text,
        badge: String(person.badge),
        name: person.name,
        position: person.position || "",
        createdAt: new Date().toISOString(),
        status: approved ? "approved" : "pending",
      });
      row.achievements = row.achievements.slice(-80);
      all[department] = row;
      writeJson(DEPTS, all);
      if (!approved) {
        deptApproverBadges(department).forEach((badge) => {
          pushNote(badge, { type: "achievement", ideaId: "", ideaTitle: title, actorName: person.name, actorBadge: String(person.badge), text: department });
        });
      }
      send(res, 201, { pending: !approved, profile: departmentProfile(department, person) });
      return;
    }
    if (action === "achievement-review") {
      const department = String(body.department || "");
      if (!department || !deptApprover(person, department)) {
        send(res, 403, { error: "forbidden" });
        return;
      }
      const all = readJson(DEPTS, {});
      const row = all[department];
      const item = row && Array.isArray(row.achievements) ? row.achievements.find((entry) => entry.id === body.id) : null;
      if (!item || item.status !== "pending") {
        send(res, 404, { error: "not_found" });
        return;
      }
      item.status = body.approve ? "approved" : "rejected";
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = person.name;
      writeJson(DEPTS, all);
      pushNote(item.badge, { type: body.approve ? "achievement-ok" : "achievement-no", ideaId: "", ideaTitle: item.title || "", actorName: person.name, actorBadge: String(person.badge), text: department });
      send(res, 200, { profile: departmentProfile(department, person) });
      return;
    }
    if (action === "follow") {
      const target = personByPid(body.pid);
      if (!target || String(target.badge) === String(person.badge)) {
        send(res, 400, { error: "bad_person" });
        return;
      }
      const all = readJson(FOLLOWS, {});
      const row = followsFor(person.badge);
      const key = String(target.badge);
      row.people = row.people.includes(key) ? row.people.filter((item) => item !== key) : [...row.people, key];
      all[String(person.badge)] = row;
      writeJson(FOLLOWS, all);
      send(res, 200, { followed: row.people.includes(key), person: cardOf(target) });
      return;
    }
    if (action === "person") {
      const target = personByPid(body.pid);
      if (!target) {
        send(res, 404, { error: "not_found" });
        return;
      }
      const key = String(target.badge);
      const followers = Object.values(readJson(FOLLOWS, {})).filter((row) => row && Array.isArray(row.people) && row.people.map(String).includes(key)).length;
      send(res, 200, {
        person: {
          ...lightCard(target),
          bio: profileOf(key).bio || "",
          official: isOfficialBadge(key),
          mine: key === String(person.badge),
          followed: followsFor(person.badge).people.includes(key),
          followers,
          following: followsFor(key).people.length,
        },
      });
      return;
    }
    if (action === "follow-department") {
      const department = String(body.department || "");
      if (!department) {
        send(res, 400, { error: "bad_department" });
        return;
      }
      const all = readJson(FOLLOWS, {});
      const row = followsFor(person.badge);
      row.departments = row.departments.includes(department) ? row.departments.filter((item) => item !== department) : [...row.departments, department];
      all[String(person.badge)] = row;
      writeJson(FOLLOWS, all);
      send(res, 200, { followed: row.departments.includes(department), department });
      return;
    }
    if (action === "profile") {
      const all = readJson(PROFILES, {});
      const photo = String(body.photo || "");
      const safePhoto = /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(photo) && photo.length <= 160000 ? photo : profileOf(person.badge).photo || "";
      const bio = cleanText(body.bio, 160);
      if (bio !== (profileOf(person.badge).bio || "") && screenText(res, person, "bio", [bio])) return;
      all[String(person.badge)] = { bio, photo: body.photo === "" ? "" : safePhoto };
      writeJson(PROFILES, all);
      send(res, 200, { person: sessionPerson(person) });
      return;
    }
    if (action === "profile-meta") {
      const target = body.pid ? personByPid(body.pid) : person;
      if (!target) {
        send(res, 404, { error: "not_found" });
        return;
      }
      send(res, 200, { highlights: publicHighlights(target.badge) });
      return;
    }
    if (action === "story-archive") {
      send(res, 200, { stories: storyArchive(person.badge) });
      return;
    }
    if (action === "highlight-save") {
      const archive = new Map(storyArchive(person.badge).map((item) => [item.id, item]));
      const picked = [...new Set((Array.isArray(body.storyIds) ? body.storyIds : []).map(String))].filter((id) => archive.has(id)).slice(0, 50);
      if (!picked.length) {
        send(res, 400, { error: "stories_required" });
        return;
      }
      const all = readJson(HIGHLIGHTS, {});
      const list = highlightsOf(person.badge);
      const existing = body.id ? list.find((row) => row.id === String(body.id)) : null;
      if (body.id && !existing) {
        send(res, 404, { error: "not_found" });
        return;
      }
      if (!existing && list.length >= 30) {
        send(res, 400, { error: "too_many" });
        return;
      }
      const items = picked.map((id) => archive.get(id));
      const coverId = archive.has(String(body.coverId)) && picked.includes(String(body.coverId)) ? String(body.coverId) : picked[0];
      const highlightTitle = cleanText(body.title, 24);
      if (screenText(res, person, "highlight", [highlightTitle])) return;
      const row = existing || { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      row.title = highlightTitle;
      row.items = items;
      row.cover = archive.get(coverId).media;
      all[String(person.badge)] = existing ? list : [...list, row];
      writeJson(HIGHLIGHTS, all);
      send(res, 200, { highlights: publicHighlights(person.badge) });
      return;
    }
    if (action === "highlight-delete") {
      const all = readJson(HIGHLIGHTS, {});
      all[String(person.badge)] = highlightsOf(person.badge).filter((row) => row.id !== String(body.id));
      writeJson(HIGHLIGHTS, all);
      send(res, 200, { highlights: publicHighlights(person.badge) });
      return;
    }
    if (action === "mod-queue" || action === "mod-action") {
      if (!isModerator(person)) {
        send(res, 403, { error: "forbidden" });
        return;
      }
      if (action === "mod-action") {
        const decision = String(body.decision || "");
        const ideas = readIdeas();
        const idea = ideas.find((item) => item.id === String(body.id || ""));
        if (!idea || !["hide", "restore", "dismiss"].includes(decision)) {
          send(res, idea ? 400 : 404, { error: idea ? "bad_decision" : "not_found" });
          return;
        }
        const at = new Date().toISOString();
        const wasHidden = Boolean(idea.hidden);
        if (decision === "hide") {
          idea.hidden = true;
          idea.hiddenBy = "moderator";
          idea.hiddenAt = at;
        }
        if (decision === "restore") {
          idea.hidden = false;
          idea.hiddenBy = "";
        }
        idea.modReviewedAt = at;
        idea.modLog = (Array.isArray(idea.modLog) ? idea.modLog : []).concat([{ decision, badge: String(person.badge), at }]).slice(-20);
        writeIdeas(ideas);
        if (decision === "hide" && !wasHidden) pushNote(idea.badge, { type: "hidden", ideaId: idea.id, ideaTitle: idea.title || String(idea.text || "").slice(0, 80), actorName: "", actorBadge: person.badge });
        if (decision === "restore" && wasHidden) pushNote(idea.badge, { type: "restored", ideaId: idea.id, ideaTitle: idea.title || String(idea.text || "").slice(0, 80), actorName: "", actorBadge: person.badge });
      }
      send(res, 200, { items: moderationQueue(String(person.badge)) });
      return;
    }
    if (action.startsWith("admin-")) {
      if (!isAdmin(person)) {
        send(res, 403, { error: "forbidden" });
        return;
      }
      if (action === "admin-summary") {
        send(res, 200, adminSummary());
        return;
      }
      if (action === "admin-conduct") {
        send(res, 200, adminConduct(body));
        return;
      }
      if (action === "admin-unban") {
        const target = personByPid(body.pid);
        if (!target || !isBanned(target.badge)) {
          send(res, target ? 400 : 404, { error: target ? "not_banned" : "not_found" });
          return;
        }
        liftBan(String(target.badge));
        send(res, 200, adminConduct(body));
        return;
      }
      if (action === "admin-backup") {
        const last = Date.parse(backup.status().lastAt) || 0;
        if (Date.now() - last < 5 * 60 * 1000) {
          send(res, 429, { error: "limited" });
          return;
        }
        try {
          await runBackup();
          auth.audit("backup_manual", publicId(person.badge));
          send(res, 200, { backup: backup.status() });
        } catch {
          send(res, 500, { error: "backup_failed", backup: backup.status() });
        }
        return;
      }
      if (action === "admin-posts") {
        send(res, 200, adminPosts(body));
        return;
      }
      if (action === "admin-content") {
        send(res, 200, adminContent(body));
        return;
      }
      if (action === "admin-delete-post" || action === "admin-delete-comment" || action === "admin-remove-like") {
        const ideas = readIdeas();
        const index = ideas.findIndex((item) => item.id === String(body.id || ""));
        if (index === -1) {
          send(res, 404, { error: "not_found" });
          return;
        }
        const idea = ideas[index];
        if (action === "admin-delete-post") {
          mediaSetOf(idea).forEach(removeStoredMedia);
          (Array.isArray(idea.comments) ? idea.comments : []).forEach((comment) => removeStoredMedia(comment.media));
          ideas.splice(index, 1);
          writeIdeas(ideas);
          writeNotes(readNotes().filter((note) => note.ideaId !== idea.id));
          auth.audit("admin_delete_post", idea.badge ? publicId(idea.badge) : "unknown");
        }
        if (action === "admin-delete-comment") {
          const comments = Array.isArray(idea.comments) ? idea.comments : [];
          const comment = comments.find((item) => item.id === String(body.commentId || ""));
          if (!comment) {
            send(res, 404, { error: "not_found" });
            return;
          }
          removeStoredMedia(comment.media);
          idea.comments = comments.filter((item) => item !== comment);
          writeIdeas(ideas);
          auth.audit("admin_delete_comment", comment.badge ? publicId(comment.badge) : "unknown");
        }
        if (action === "admin-remove-like") {
          const pid = String(body.pid || "");
          const ratings = Array.isArray(idea.ratings) ? idea.ratings : [];
          const kept = ratings.filter((rating) => publicId(rating.badge || rating.voter || "") !== pid);
          if (kept.length === ratings.length) {
            send(res, 404, { error: "not_found" });
            return;
          }
          idea.ratings = kept;
          writeIdeas(ideas);
          auth.audit("admin_remove_like", pid);
        }
        send(res, 200, { ok: true });
        return;
      }
      if (action === "admin-post") {
        const idea = readIdeas().find((item) => item.id === String(body.id || ""));
        if (!idea) {
          send(res, 404, { error: "not_found" });
          return;
        }
        send(res, 200, { idea: publicIdea(idea, String(person.badge)) });
        return;
      }
      if (action === "admin-users") {
        send(res, 200, adminUsers(body));
        return;
      }
      if (action === "admin-user") {
        const target = personByPid(body.pid);
        const op = String(body.op || "");
        if (!target || target.system || !["admin-on", "admin-off", "revoke", "unlock", "reset-2fa", "unban"].includes(op)) {
          send(res, target ? 400 : 404, { error: target ? "bad_op" : "not_found" });
          return;
        }
        const badge = String(target.badge);
        if (op === "reset-2fa") {
          if (badge === String(person.badge) || !auth.twoFactorOn(badge)) {
            send(res, 400, { error: "bad_op" });
            return;
          }
          auth.disableTwoFactor(badge);
          auth.revokeSessions(badge);
          auth.audit("2fa_reset_by_admin", publicId(badge));
          noticeMail((auth.accountOf(badge) || {}).email, "المشرف أوقف التحقق بخطوتين لحسابك في BQ Connect، وطلّع حسابك من كل الأجهزة. أول ما تدخل من جديد بيطلب منك تفعيله مرة ثانية.\nإذا ما طلبت هذا، كلّم الإدارة فوراً.");
        }
        if (op === "admin-on" || op === "admin-off") {
          if (auth.securityConfig().admins.has(badge) || (op === "admin-off" && badge === String(person.badge))) {
            send(res, 400, { error: "fixed_admin" });
            return;
          }
          const listed = readJson(MODERATORS, {});
          const badges = new Set((Array.isArray(listed.badges) ? listed.badges : []).map(String));
          if (op === "admin-on") badges.add(badge);
          else badges.delete(badge);
          writeJson(MODERATORS, { ...listed, badges: [...badges] });
          auth.audit(op === "admin-on" ? "admin_grant" : "admin_revoke", publicId(badge));
        }
        if (op === "revoke") {
          auth.revokeSessions(badge);
          auth.audit("sessions_revoked_by_admin", publicId(badge));
        }
        if (op === "unlock") {
          auth.clearFailures(badge);
          auth.clearFailures(`2fa:${badge}`);
          auth.clearFailures(`pw:${badge}`);
          auth.audit("unlocked_by_admin", publicId(badge));
        }
        if (op === "unban") liftBan(badge);
        send(res, 200, { user: adminUserRow(target, moderatorBadges(), auth.securityConfig().admins) });
        return;
      }
      if (action === "admin-sessions") {
        const target = personByPid(body.pid);
        if (!target) {
          send(res, 404, { error: "not_found" });
          return;
        }
        const badge = String(target.badge);
        if (body.revoke) {
          if (!auth.revokeSession(badge, body.revoke)) {
            send(res, 400, { error: "bad_session" });
            return;
          }
          auth.audit("session_revoked_by_admin", publicId(badge));
        }
        send(res, 200, { sessions: auth.listSessions(badge).reverse() });
        return;
      }
      if (action === "admin-achievements") {
        send(res, 200, { items: adminPendingAchievements() });
        return;
      }
      if (action === "admin-log") {
        send(res, 200, adminLog(body));
        return;
      }
      if (action === "admin-spark") {
        if (body.op === "set" || body.op === "clear") {
          const pack = ensureDailySparks();
          const ar = cleanText(body.ar, 200);
          const en = cleanText(body.en, 200);
          if (body.op === "set" && !ar) {
            send(res, 400, { error: "text_required" });
            return;
          }
          pack.override = body.op === "set" ? { date: pack.date, ar, en } : null;
          writeJson(SPARKS, pack);
        }
        send(res, 200, adminSpark());
        return;
      }
      send(res, 404, { error: "not_found" });
      return;
    }
    if (action === "dashboard") {
      if (!canSeeDashboard(person)) {
        send(res, 403, { error: "forbidden" });
        return;
      }
      const days = [7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
      send(res, 200, dashboardStats(days));
      return;
    }
    if (action === "export") {
      if (!canSeeDashboard(person)) {
        send(res, 403, { error: "forbidden" });
        return;
      }
      const days = [7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
      const kind = body.kind === "departments" ? "departments" : "ideas";
      send(res, 200, { csv: exportCsv(kind, days), kind, days });
      return;
    }
    if (action === "groups") {
      const badge = String(person.badge);
      const groups = readJson(GROUPS, []).filter((group) => {
        if (group.kind === "department") return Boolean(String(group.department || "").trim()) && !HIDDEN_DEPTS.has(group.department);
        return (group.members || []).map(String).includes(badge);
      });
      groups.sort((left, right) => {
        const leftMine = (left.members || []).map(String).includes(badge) ? 1 : 0;
        const rightMine = (right.members || []).map(String).includes(badge) ? 1 : 0;
        if (leftMine !== rightMine) return rightMine - leftMine;
        return (right.members || []).length - (left.members || []).length;
      });
      send(res, 200, {
        groups: groups.map((group) => ({
          ...publicGroup(group),
          mine: (group.members || []).map(String).includes(badge),
        })),
      });
      return;
    }
    if (action === "create-group") {
      const name = cleanText(body.name, 60);
      if (!name) {
        send(res, 400, { error: "text_required" });
        return;
      }
      if (screenText(res, person, "group", [name])) return;
      const groups = readJson(GROUPS, []);
      const group = { id: crypto.randomUUID(), name, department: person.department || "", members: [String(person.badge)], createdAt: new Date().toISOString() };
      groups.push(group);
      writeJson(GROUPS, groups);
      send(res, 201, { group: publicGroup(group) });
      return;
    }
    if (action === "join-group") {
      const groups = readJson(GROUPS, []);
      const group = groups.find((item) => item.id === body.groupId);
      if (!group || group.kind === "department") {
        send(res, group ? 403 : 404, { error: group ? "forbidden" : "not_found" });
        return;
      }
      const members = new Set((group.members || []).map(String));
      if (members.has(String(person.badge))) members.delete(String(person.badge));
      else members.add(String(person.badge));
      group.members = [...members];
      writeJson(GROUPS, groups);
      send(res, 200, { group: publicGroup(group), joined: group.members.includes(String(person.badge)) });
      return;
    }
    send(res, 404, { error: "not_found" });
    return;
  }

  if (req.method === "POST" && urlPath === "/api/ideas") {
    let body;
    try {
      body = await readBody(req);
    } catch {
      send(res, 400, { error: "bad_json" });
      return;
    }
    const type = POST_TYPES.has(body.type) ? body.type : "idea";
    const title = cleanText(body.title, type === "article" ? 120 : 80);
    const text = cleanText(body.text, type === "article" ? 4000 : 1000);
    const media = type === "poll" ? "" : safeMedia(body.media);
    const problem = cleanText(body.problem, 400);
    const impact = cleanText(body.impact, 240);
    const place = cleanText(body.place, 80);
    const pros = cleanLines(body.pros);
    const cons = cleanLines(body.cons);
    const person = personFromToken(body.token);
    if (!person) {
      send(res, 401, { error: "employee_required" });
      return;
    }
    if (!termsAccepted(person)) {
      send(res, 403, { error: "terms" });
      return;
    }
    const official = isAnnouncer(person);
    const officialOnly = type === "announcement" || type === "event";
    if (isAdminAccount(person) || (officialOnly ? !official : official && type !== "post")) {
      send(res, 403, { error: "forbidden" });
      return;
    }
    const thanks = type === "thanks" ? personByPid(body.thanksPid) : null;
    const poll = type === "poll" ? (Array.isArray(body.options) ? body.options : []).map((option) => cleanText(option, 80)).filter(Boolean).slice(0, 4).map((option) => ({ text: option, votes: [] })) : [];
    const eventAt = type === "event" ? cleanEventAt(body.eventAt) : "";
    if ((type === "idea" || type === "suggestion" || type === "complaint" || type === "poll" || type === "article" || type === "event") && !title) {
      send(res, 400, { error: "text_required" });
      return;
    }
    if (type === "event" && !(Date.parse(eventAt) > Date.now())) {
      send(res, 400, { error: "bad_date" });
      return;
    }
    if (type === "story" && !media) {
      send(res, 400, { error: "media_required" });
      return;
    }
    if (!text && type !== "poll" && type !== "event" && !(media && (type === "post" || type === "story" || type === "thanks" || type === "announcement"))) {
      send(res, 400, { error: "text_required" });
      return;
    }
    if (type === "thanks" && !thanks) {
      send(res, 400, { error: "bad_person" });
      return;
    }
    if (type === "poll" && poll.length < 2) {
      send(res, 400, { error: "text_required" });
      return;
    }
    if (screenText(res, person, type, [title, text, problem, impact, place, pros, cons, poll.map((option) => option.text), cleanText(body.project, 60), cleanText(body.groupName, 60)])) return;
    const ideas = readIdeas();
    const idea = {
      id: crypto.randomUUID(),
      number: statsFor(ideas).nextNumber,
      type,
      badge: person.badge,
      name: person.name,
      department: person.department,
      position: person.position,
      title,
      text,
      media,
      gallery: type === "story" ? [] : cleanGallery(body.gallery, media),
      problem: type === "idea" ? problem : "",
      pros: type === "idea" ? pros : [],
      cons: type === "idea" ? cons : [],
      impact: type === "idea" ? impact : "",
      place,
      project: cleanText(body.project, 60),
      thanksBadge: thanks ? String(thanks.badge) : "",
      poll,
      groupId: cleanText(body.groupId, 80),
      groupName: cleanText(body.groupName, 60),
      replies: REPLY_SCOPES.has(body.replies) ? body.replies : "all",
      status: type === "idea" || type === "complaint" ? "received" : "",
      statusLog: type === "idea" || type === "complaint" ? [statusEntry(person, "received")] : [],
      createdAt: new Date().toISOString(),
      expiresAt: type === "story" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : "",
      ...(type === "event" ? { eventAt, attendees: [String(person.badge)] } : {}),
      ...(type === "announcement" ? { acks: [String(person.badge)] } : {}),
      ratings: [],
      comments: [],
      reposts: [],
    };
    ideas.push(idea);
    writeIdeas(ideas);
    if (thanks) {
      pushNote(thanks.badge, { type: "thanks", ideaId: idea.id, ideaTitle: title || text.slice(0, 80), actorName: person.name, actorBadge: person.badge, text: text.slice(0, 140) });
    }
    if (type === "complaint") {
      adminBadges().forEach((badge) => {
        pushNote(badge, { type: "complaint", ideaId: idea.id, ideaTitle: title, actorName: person.name, actorBadge: person.badge, text: text.slice(0, 140) });
      });
    }
    (Array.isArray(body.mentions) ? body.mentions : []).slice(0, 6).forEach((pid) => {
      const mentioned = personByPid(pid);
      if (mentioned) pushNote(mentioned.badge, { type: "mention", ideaId: idea.id, ideaTitle: title || text.slice(0, 80), actorName: person.name, actorBadge: person.badge });
    });
    const voter = String(person.badge);
    send(res, 201, { idea: publicIdea(idea, voter), ideas: publicList(ideas, voter), stats: statsFor(ideas) });
    return;
  }

  const route = ideaRoute(urlPath);
  if (route) {
    const ideas = readIdeas();
    const index = ideas.findIndex((idea) => idea.id === route.id);
    if (index === -1) {
      send(res, 404, { error: "not_found" });
      return;
    }
    let body = {};
    if (req.method === "POST" || req.method === "PATCH") {
      try {
        body = await readBody(req);
      } catch {
        send(res, 400, { error: "bad_json" });
        return;
      }
    }
    const actor = personFromToken(body.token || req.headers["x-session"]);
    if (actor && !visibleTo(ideas[index], actor.badge) && !isModerator(actor)) {
      send(res, 404, { error: "not_found" });
      return;
    }

    if (req.method === "POST" && route.action === "report") {
      if (!actor) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      const key = String(actor.badge);
      if (String(ideas[index].badge || "") === key) {
        send(res, 400, { error: "own_post" });
        return;
      }
      const reports = Array.isArray(ideas[index].reports) ? ideas[index].reports : [];
      if (!reports.some((row) => String(row.badge) === key)) {
        reports.push({ badge: key, reason: REPORT_REASONS.has(body.reason) ? body.reason : "other", at: new Date().toISOString() });
        ideas[index].reports = reports;
        const open = openReports(ideas[index]).length;
        const autoHide = !ideas[index].hidden && open >= AUTO_HIDE_REPORTS;
        if (autoHide) {
          ideas[index].hidden = true;
          ideas[index].hiddenBy = "auto";
          ideas[index].hiddenAt = new Date().toISOString();
        }
        writeIdeas(ideas);
        if (open === 1 || autoHide) notifyModerators(ideas[index], "report", autoHide ? "auto" : "");
      }
      send(res, 200, { ideas: publicList(ideas, key), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "POST" && route.action === "rating") {
      const vote = body.vote === "like" || body.vote === "dislike" ? body.vote : "";
      const person = personFromToken(body.token);
      if (!person || !vote) {
        send(res, person ? 400 : 401, { error: person ? "bad_rating" : "employee_required" });
        return;
      }
      const key = String(person.badge);
      const ratings = Array.isArray(ideas[index].ratings) ? ideas[index].ratings : [];
      const existing = ratings.find((rating) => String(rating.badge || "") === key);
      let active = vote;
      if (existing && voteOf(existing) === vote) {
        ideas[index].ratings = ratings.filter((rating) => String(rating.badge || "") !== key);
        active = "";
      } else if (existing) {
        existing.vote = vote;
        delete existing.stars;
        ideas[index].ratings = ratings;
      } else {
        ratings.push({ badge: key, vote });
        ideas[index].ratings = ratings;
      }
      writeIdeas(ideas);
      if (active) {
        pushNote(ideas[index].badge, {
          type: active,
          ideaId: ideas[index].id,
          ideaTitle: ideas[index].title || "",
          actorName: person.name,
          actorBadge: key,
        });
      }
      send(res, 200, { idea: publicIdea(ideas[index], key), ideas: publicList(ideas, key), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "POST" && route.action === "bookmark") {
      const person = personFromToken(body.token || req.headers["x-session"]);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      toggleMark(person.badge, ideas[index].id);
      const voter = String(person.badge);
      send(res, 200, { idea: publicIdea(ideas[index], voter), ideas: publicList(ideas, voter), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "POST" && route.action === "engagement") {
      const person = personFromToken(body.token || req.headers["x-session"]);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      send(res, 200, engagementOf(ideas[index]));
      return;
    }

    if (req.method === "POST" && route.action === "repost") {
      const person = personFromToken(body.token || req.headers["x-session"]);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      const reposts = Array.isArray(ideas[index].reposts) ? ideas[index].reposts : [];
      const key = String(person.badge);
      const exists = reposts.some((item) => String(item.badge) === key);
      if (!exists && screenText(res, person, "repost", [cleanText(body.text, 240)])) return;
      ideas[index].reposts = exists ? reposts.filter((item) => String(item.badge) !== key) : reposts.concat([{ badge: key, name: person.name, department: person.department || "", position: person.position || "", text: cleanText(body.text, 240), createdAt: new Date().toISOString() }]);
      writeIdeas(ideas);
      if (!exists) {
        pushNote(ideas[index].badge, { type: "repost", ideaId: ideas[index].id, ideaTitle: ideas[index].title || "", actorName: person.name, actorBadge: key });
      }
      send(res, 200, { idea: publicIdea(ideas[index], key), ideas: publicList(ideas, key), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "POST" && (route.action === "ack" || route.action === "pin" || route.action === "rsvp")) {
      if (!actor) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      const idea = ideas[index];
      const key = String(actor.badge);
      if (route.action === "ack") {
        if (idea.type !== "announcement") {
          send(res, 400, { error: "bad_type" });
          return;
        }
        const acks = (Array.isArray(idea.acks) ? idea.acks : []).map(String);
        if (!acks.includes(key)) idea.acks = acks.concat([key]);
      }
      if (route.action === "pin") {
        if (!canPin(actor, idea)) {
          send(res, 403, { error: "forbidden" });
          return;
        }
        idea.pinned = !idea.pinned;
      }
      if (route.action === "rsvp") {
        if (idea.type !== "event" || !(Date.parse(idea.eventAt) > Date.now())) {
          send(res, 400, { error: "closed" });
          return;
        }
        const going = (Array.isArray(idea.attendees) ? idea.attendees : []).map(String);
        idea.attendees = going.includes(key) ? going.filter((badge) => badge !== key) : going.concat([key]);
      }
      writeIdeas(ideas);
      send(res, 200, { idea: publicIdea(idea, key), ideas: publicList(ideas, key), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "POST" && route.action === "poll") {
      const person = personFromToken(body.token || req.headers["x-session"]);
      const option = Number(body.option);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      if (!Array.isArray(ideas[index].poll) || !ideas[index].poll[option]) {
        send(res, 400, { error: "bad_rating" });
        return;
      }
      const key = String(person.badge);
      ideas[index].poll.forEach((item) => {
        item.votes = (item.votes || []).map(String).filter((badge) => badge !== key);
      });
      ideas[index].poll[option].votes.push(key);
      writeIdeas(ideas);
      send(res, 200, { idea: publicIdea(ideas[index], key), ideas: publicList(ideas, key), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "POST" && route.action === "comments") {
      const person = personFromToken(body.token);
      const text = cleanText(body.text, 500);
      const media = safeMedia(body.media);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      if (!termsAccepted(person)) {
        send(res, 403, { error: "terms" });
        return;
      }
      if (!canReply(person, ideas[index])) {
        send(res, 403, { error: "replies_closed" });
        return;
      }
      if (!text && !media) {
        send(res, 400, { error: "text_required" });
        return;
      }
      if (screenText(res, person, "comment", [text])) return;
      const comments = Array.isArray(ideas[index].comments) ? ideas[index].comments : [];
      comments.push({
        id: crypto.randomUUID(),
        text,
        media,
        badge: person.badge,
        name: person.name,
        department: person.department,
        position: person.position,
        createdAt: new Date().toISOString(),
      });
      ideas[index].comments = comments;
      writeIdeas(ideas);
      pushNote(ideas[index].badge, {
        type: "comment",
        ideaId: ideas[index].id,
        ideaTitle: ideas[index].title || "",
        actorName: person.name,
        actorBadge: person.badge,
        text: text.slice(0, 140),
      });
      const voter = String(person.badge);
      send(res, 201, { idea: publicIdea(ideas[index], voter), ideas: publicList(ideas, voter), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "PATCH" && !route.action) {
      const person = personFromToken(body.token || req.headers["x-session"]);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      const owner = String(ideas[index].badge || "") === String(person.badge);
      if (body.title != null || body.text != null) {
        if (!owner) {
          send(res, 403, { error: "forbidden" });
          return;
        }
        const kind = POST_TYPES.has(ideas[index].type) ? ideas[index].type : "idea";
        const title = cleanText(body.title, kind === "article" ? 120 : 80);
        const text = cleanText(body.text, kind === "article" ? 4000 : 1000);
        const media = kind === "poll" ? "" : safeMedia(body.media);
        const needsTitle = kind === "idea" || kind === "suggestion" || kind === "complaint" || kind === "poll" || kind === "article" || kind === "event";
        const imageOnly = media && (kind === "post" || kind === "story" || kind === "thanks" || kind === "announcement");
        if ((needsTitle && !title) || (!text && kind !== "poll" && kind !== "event" && !imageOnly) || (kind === "story" && !media)) {
          send(res, 400, { error: "text_required" });
          return;
        }
        if (screenText(res, person, "edit", [title, text, cleanText(body.problem, 400), cleanText(body.impact, 240), cleanText(body.place, 80), cleanText(body.project, 60), cleanLines(body.pros), cleanLines(body.cons)])) return;
        if (kind === "event") {
          const eventAt = cleanEventAt(body.eventAt);
          if (!eventAt) {
            send(res, 400, { error: "bad_date" });
            return;
          }
          if (eventAt !== ideas[index].eventAt) ideas[index].reminded = false;
          ideas[index].eventAt = eventAt;
        }
        const gallery = kind === "story" ? [] : cleanGallery(body.gallery, media);
        const kept = new Set([media, ...gallery]);
        mediaSetOf(ideas[index]).filter((item) => !kept.has(item)).forEach(removeStoredMedia);
        ideas[index].title = title;
        ideas[index].text = text;
        ideas[index].media = media;
        ideas[index].gallery = gallery;
        ideas[index].problem = cleanText(body.problem, 400);
        ideas[index].impact = cleanText(body.impact, 240);
        ideas[index].place = cleanText(body.place, 80);
        ideas[index].project = cleanText(body.project, 60);
        ideas[index].pros = cleanLines(body.pros);
        ideas[index].cons = cleanLines(body.cons);
        if (REPLY_SCOPES.has(body.replies)) ideas[index].replies = body.replies;
      } else if (body.replies != null) {
        if (!owner || !REPLY_SCOPES.has(body.replies)) {
          send(res, owner ? 400 : 403, { error: owner ? "bad_replies" : "forbidden" });
          return;
        }
        ideas[index].replies = body.replies;
      }
      if (body.status) {
        const allowed = ideas[index].type === "complaint" ? new Set(["received", "review", "resolved"]) : STATUSES;
        if (!allowed.has(body.status)) {
          send(res, 400, { error: "bad_status" });
          return;
        }
        if (ideas[index].status !== body.status) {
          if (!canChangeStatus(person, ideas[index])) {
            send(res, 403, { error: "manager_required" });
            return;
          }
          ideas[index].status = body.status;
          const log = Array.isArray(ideas[index].statusLog) ? ideas[index].statusLog : [];
          log.push(statusEntry(person, body.status));
          ideas[index].statusLog = log.slice(-40);
          pushNote(ideas[index].badge, {
            type: "status",
            ideaId: ideas[index].id,
            ideaTitle: ideas[index].title || "",
            actorName: person.name,
            actorBadge: person.badge,
            text: body.status,
          });
        }
      }
      writeIdeas(ideas);
      const voter = String(person.badge);
      send(res, 200, { idea: publicIdea(ideas[index], voter), ideas: publicList(ideas, voter), stats: statsFor(ideas) });
      return;
    }

    if (req.method === "DELETE" && !route.action) {
      const person = personFromToken(req.headers["x-session"] || body.token);
      if (!person) {
        send(res, 401, { error: "employee_required" });
        return;
      }
      if (String(ideas[index].badge || "") !== String(person.badge)) {
        send(res, 403, { error: "forbidden" });
        return;
      }
      const removed = ideas[index];
      mediaSetOf(removed).forEach(removeStoredMedia);
      ideas.splice(index, 1);
      writeIdeas(ideas);
      writeNotes(readNotes().filter((note) => note.ideaId !== removed.id));
      send(res, 200, { ideas: publicList(ideas, String(person.badge)), stats: statsFor(ideas) });
      return;
    }
  }

  send(res, 404, { error: "not_found" });
}

function serveStatic(req, res, urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.resolve(ROOT, `.${requested}`);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (resolved !== ROOT && !resolved.startsWith(rootWithSep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(resolved, (statError, info) => {
    if (statError || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    const headers = { "Content-Type": type, "Cache-Control": "no-cache", ETag: etag, Vary: "Accept-Encoding" };
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const accept = String(req.headers["accept-encoding"] || "");
    const encoding = COMPRESSIBLE.has(ext) ? (/\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : "") : "";
    const cacheKey = `${resolved}|${encoding}`;
    const cached = staticCache.get(cacheKey);
    const reply = (body) => {
      if (encoding) headers["Content-Encoding"] = encoding;
      headers["Content-Length"] = body.length;
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
    };
    if (cached && cached.etag === etag) {
      reply(cached.body);
      return;
    }
    fs.readFile(resolved, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      let body = data;
      if (encoding === "br") body = zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length } });
      else if (encoding === "gzip") body = zlib.gzipSync(data, { level: 9 });
      if (data.length < 4 * 1024 * 1024) staticCache.set(cacheKey, { etag, body });
      reply(body);
    });
  });
}

const COMPRESSIBLE = new Set([".html", ".css", ".js", ".mjs", ".svg", ".json", ".webmanifest", ".txt"]);
const staticCache = new Map();

function announcementsFor(badge) {
  const rows = readJson(ANNOUNCE, []);
  const seen = new Set((readJson(SEEN, {})[String(badge)] || []).map(String));
  return (Array.isArray(rows) ? rows : []).slice(-40).map((item) => ({
    id: item.id,
    type: "announce",
    ideaId: "",
    ideaTitle: item.subject || "",
    actorName: item.from || "",
    text: item.text || "",
    createdAt: item.createdAt || "",
    read: seen.has(String(item.id)),
  }));
}

function markAnnouncementsRead(badge) {
  const seen = readJson(SEEN, {});
  const ids = new Set((seen[String(badge)] || []).map(String));
  (Array.isArray(readJson(ANNOUNCE, [])) ? readJson(ANNOUNCE, []) : []).forEach((item) => ids.add(String(item.id)));
  seen[String(badge)] = [...ids].slice(-120);
  writeJson(SEEN, seen);
}

const API_PATHS = new Set(["/api/ideas", "/api/login", "/api/login-2fa", "/api/2fa", "/api/email", "/api/register", "/api/forgot", "/api/password", "/api/logout-all", "/api/terms", "/api/sessions", "/api/views", "/api/translate", "/api/spark", "/api/session", "/api/notifications", "/api/notifications/read", "/api/social"]);

function securityHeaders(res) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

const server = http.createServer((req, res) => {
  securityHeaders(res);
  const rawUrl = req.url || "/";
  const splitAt = rawUrl.indexOf("?");
  let urlPath = splitAt === -1 ? rawUrl : rawUrl.slice(0, splitAt);
  try {
    urlPath = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const params = new URLSearchParams(splitAt === -1 ? "" : rawUrl.slice(splitAt + 1));
  if (urlPath.startsWith("/api/") && apiLimited(clientIp(req))) {
    res.setHeader("Retry-After", "60");
    send(res, 429, { error: "limited" });
    return;
  }
  if (req.method === "POST" && urlPath === "/api/media") {
    receiveMedia(req, res);
    return;
  }
  if ((req.method === "GET" || req.method === "HEAD") && urlPath.startsWith("/media/")) {
    serveMedia(req, res, urlPath);
    return;
  }
  if ((req.method === "GET" || req.method === "HEAD") && urlPath.startsWith("/avatar/")) {
    serveAvatar(res, urlPath);
    return;
  }
  if (API_PATHS.has(urlPath) || urlPath.startsWith("/api/ideas/")) {
    handleApi(req, res, urlPath, params).catch(() => {
      if (!res.headersSent) send(res, 500, { error: "server" });
    });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }
  serveStatic(req, res, urlPath);
});

server.headersTimeout = 20 * 1000;
server.requestTimeout = 3 * 60 * 1000;
server.keepAliveTimeout = 5 * 1000;
server.maxHeadersCount = 60;

server.listen(PORT, HOST, () => {
  ensureDepartmentGroups();
  ensureDailySparks();
  console.log(`BQ Connect: http://${HOST}:${PORT}`);
  if (!auth.mailConfigured()) console.log("Password email is off: add the Gmail address and app password to data/smtp.json");
  setTimeout(() => translator.warm(), 3000);
  setInterval(ensureDailySparks, 15 * 60 * 1000);
  remindEvents();
  setInterval(remindEvents, 60 * 1000);
  runBackup = backup.schedule((error) => {
    if (error) {
      console.log("Backup failed: check the backup folder in data/backup.json");
      auth.audit("backup_fail", "system");
    }
  });
});
