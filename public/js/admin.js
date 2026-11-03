let dashDays = 30;
const REASON_KEYS = { spam: "reasonSpam", offensive: "reasonOffensive", false: "reasonFalse", private: "reasonPrivate", other: "reasonOther" };

function adminNumber(value) {
  return Number(value || 0).toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB");
}

function adminNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function adminNotice(box, key) {
  box.replaceChildren(adminNode("p", "empty", t(key)));
}

function modTarget() {
  return document.querySelector(view === "dashboard" ? "#adm-body" : "#mod-list");
}

async function renderModeration() {
  const list = modTarget();
  if (view === "dashboard") admLoading(list, 3);
  else adminNotice(list, "dashLoading");
  const data = await social("mod-queue", {});
  paintModeration(data ? data.items : null);
}

function paintModeration(items) {
  const list = modTarget();
  if (!items) {
    adminNotice(list, "dashFail");
    return;
  }
  if (!items.length) {
    if (view === "dashboard") admEmpty(list, "modEmpty", "reports");
    else adminNotice(list, "modEmpty");
    return;
  }
  list.replaceChildren(...items.map(modCard));
}

function modThumb(item) {
  if (item.media && !isVideoSrc(item.media)) {
    const thumb = adminNode("button", "mod-thumb");
    thumb.type = "button";
    thumb.style.backgroundImage = `url("${item.media}")`;
    thumb.setAttribute("aria-label", t("modOpen"));
    thumb.addEventListener("click", () => openLightbox(item.media));
    return thumb;
  }
  const colors = PROFILE_TILE_COLORS[item.type] || PROFILE_TILE_COLORS.post;
  const thumb = adminNode("span", "mod-thumb text");
  thumb.style.background = `linear-gradient(150deg, ${colors[0]}, ${colors[1]})`;
  if (isVideoSrc(item.media)) thumb.appendChild(svgIcon("M8 5.5v13l10.5-6.5z"));
  else thumb.textContent = typeLabel(item.type || "idea");
  return thumb;
}

function modCard(item) {
  const card = adminNode("article", "mod-card");
  card.classList.toggle("is-hidden", item.hidden);
  const top = adminNode("div", "mod-top");
  const copy = adminNode("div", "mod-copy");
  const bits = authorBits(item);
  copy.append(
    adminNode("strong", "", bits.name),
    adminNode("span", "mod-meta", [bits.meta, timeAgo(item.createdAt)].filter(Boolean).join(" · ")),
  );
  const body = adminNode("p", "mod-text");
  body.textContent = [item.title && item.title !== item.text ? item.title : "", excerpt(item.text, 220)].filter(Boolean).join(" — ");
  copy.appendChild(body);
  top.append(modThumb(item), copy);
  if (view === "dashboard") {
    const open = adminNode("button", "adm-round small", null);
    open.type = "button";
    open.setAttribute("aria-label", t("admOpenPost"));
    open.appendChild(admIcon("open"));
    open.addEventListener("click", () => admOpen(item.id));
    top.appendChild(open);
  }

  const tags = adminNode("div", "mod-tags");
  if (item.reportCount) tags.appendChild(adminNode("span", "mod-pill red", tf("modReports", { n: item.reportCount })));
  if (item.hidden) tags.appendChild(adminNode("span", "mod-pill", t(item.hiddenBy === "auto" ? "modHiddenAuto" : "modHiddenMod")));
  Object.entries(item.reasons || {}).forEach(([reason, count]) => {
    tags.appendChild(adminNode("span", "mod-pill soft", `${t(REASON_KEYS[reason] || "reasonOther")} × ${count}`));
  });

  const actions = adminNode("div", "mod-actions");
  const act = (key, decision, primary) => {
    const button = adminNode("button", primary ? "mod-btn primary" : "mod-btn", t(key));
    button.type = "button";
    button.addEventListener("click", async () => {
      actions.querySelectorAll("button").forEach((node) => {
        node.disabled = true;
      });
      const data = await social("mod-action", { id: item.id, decision });
      paintModeration(data ? data.items : null);
      loadIdeas();
      if (view === "dashboard") admRefresh();
    });
    return button;
  };
  if (item.hidden) actions.appendChild(act("modRestore", "restore", true));
  else actions.appendChild(act("modHide", "hide", true));
  if (item.reportCount) actions.appendChild(act("modDismiss", "dismiss", false));
  card.append(top, tags, actions);
  return card;
}

async function renderDashboard() {
  admPaintToday();
  document.querySelectorAll("#adm-tabs [data-adm]").forEach((button) => {
    const on = button.dataset.adm === admTab;
    button.classList.toggle("on", on);
    button.setAttribute("aria-selected", String(on));
    if (on) button.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  document.querySelector('[data-adm-pane="overview"]').hidden = admTab !== "overview";
  document.querySelector('[data-adm-pane="tool"]').hidden = admTab === "overview";
  admRefresh();
  if (admTab !== "overview") {
    renderAdmTool();
    return;
  }
  const summary = document.querySelector("#adm-summary");
  if (!summary.children.length) admLoading(summary, 2);
  renderDashStats();
}

async function renderDashStats() {
  const body = document.querySelector("#dash-body");
  document.querySelectorAll("#dash-range [data-days]").forEach((button) => {
    button.classList.toggle("on", Number(button.dataset.days) === dashDays);
  });
  admLoading(body, 3);
  const data = await social("dashboard", { days: dashDays });
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  paintDashboard(data);
}

function dashCard(titleKey) {
  const card = adminNode("section", "dash-card");
  if (titleKey) card.appendChild(adminNode("h2", "dash-h", t(titleKey)));
  return card;
}

function dashDelta(now, before) {
  if (before == null) return null;
  const pill = adminNode("em", "dash-delta");
  if (!before) {
    if (!now) return null;
    pill.classList.add("up");
    pill.textContent = t("dashNew");
    return pill;
  }
  const change = Math.round(((now - before) / before) * 100);
  pill.classList.add(change > 0 ? "up" : change < 0 ? "down" : "flat");
  pill.textContent = `${change > 0 ? "▲" : change < 0 ? "▼" : "•"} ${Math.abs(change)}%`;
  pill.title = tf("dashVsPrev", { n: adminNumber(before) });
  return pill;
}

function dashKpis(data) {
  const grid = adminNode("div", "dash-kpis");
  const prev = data.previous || {};
  [
    ["dashPosts", data.totals.posts, prev.posts, ADM_ICONS.content, () => admGoContent("posts")],
    ["dashIdeas", data.totals.ideas, null, ADM_ICONS.ideas, () => {
      Object.assign(admQuery.ideas, { status: "all", q: "", offset: 0, days: dashDays });
      showAdmTab("ideas");
    }],
    ["dashComments", data.totals.comments, prev.comments, ICONS.reply, () => admGoContent("comments")],
    ["dashLikes", data.totals.likes, prev.likes, ICONS.like, () => admGoContent("likes")],
  ].forEach(([key, value, before, icon, open]) => {
    const box = adminNode("button", "dash-kpi is-link");
    box.type = "button";
    const top = adminNode("span", "dash-kpi-top");
    const badge = adminNode("span", "dash-kpi-icon");
    badge.appendChild(svgIcon(icon));
    top.appendChild(badge);
    const delta = dashDelta(value, before);
    if (delta) top.appendChild(delta);
    box.append(top, adminNode("b", "", adminNumber(value)), adminNode("span", "", t(key)));
    box.addEventListener("click", open);
    grid.appendChild(box);
  });
  const active = adminNode("div", "dash-kpi wide");
  const share = data.totals.employees ? Math.round((data.totals.active / data.totals.employees) * 1000) / 10 : 0;
  const activeTop = adminNode("span", "dash-kpi-top");
  const activeIcon = adminNode("span", "dash-kpi-icon");
  activeIcon.appendChild(admIcon("users"));
  activeTop.appendChild(activeIcon);
  const activeDelta = dashDelta(data.totals.active, prev.active);
  if (activeDelta) activeTop.appendChild(activeDelta);
  active.append(
    activeTop,
    adminNode("b", "", adminNumber(data.totals.active)),
    adminNode("span", "", t("dashActive")),
    adminNode("small", "", `${tf("dashOfEmployees", { n: adminNumber(data.totals.employees) })} · ${share}%`),
  );
  const meter = adminNode("i", "dash-meter");
  const fill = adminNode("u");
  fill.style.width = `${Math.min(100, share)}%`;
  meter.appendChild(fill);
  active.appendChild(meter);
  grid.appendChild(active);
  return grid;
}

function dashWeeks(data) {
  const card = dashCard("dashWeekly");
  const max = Math.max(1, ...data.weeks.map((week) => week.posts));
  const chart = adminNode("div", "dash-bars");
  data.weeks.forEach((week) => {
    const col = adminNode("div", "dash-bar");
    col.title = `${formatShortDate(week.start)} · ${t("dashPosts")} ${week.posts} · ${t("dashIdeas")} ${week.ideas}`;
    const posts = adminNode("i");
    posts.style.height = `${(week.posts / max) * 100}%`;
    const ideasBar = adminNode("b");
    ideasBar.style.height = `${(week.ideas / max) * 100}%`;
    col.append(posts, ideasBar);
    chart.appendChild(col);
  });
  const axis = adminNode("div", "dash-axis");
  axis.append(adminNode("span", "", formatShortDate(data.weeks[0].start)), adminNode("span", "", formatShortDate(data.weeks[data.weeks.length - 1].start)));
  const legend = adminNode("div", "dash-legend");
  legend.append(adminNode("span", "posts", t("dashPosts")), adminNode("span", "ideas", t("dashIdeas")));
  card.append(chart, axis, legend);
  return card;
}

function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short" });
}

function dashFunnel(data) {
  const card = dashCard("dashFunnel");
  const total = Math.max(1, data.funnel.total);
  [["received", "statusReceived"], ["review", "statusReview"], ["project", "statusProject"]].forEach(([key, label]) => {
    const row = adminNode("div", `dash-row ${key}`);
    const head = adminNode("div", "dash-row-head");
    head.append(adminNode("span", "", t(label)), adminNode("b", "", adminNumber(data.funnel[key])));
    const bar = adminNode("i", "dash-track");
    const fill = adminNode("u");
    fill.style.width = `${(data.funnel[key] / total) * 100}%`;
    bar.appendChild(fill);
    row.append(head, bar);
    card.appendChild(row);
  });
  const notes = adminNode("div", "dash-notes");
  notes.appendChild(adminNode("p", "", tf("dashConversion", { n: Math.round((data.funnel.project / total) * 100) })));
  if (data.funnel.reviewDays != null) notes.appendChild(adminNode("p", "", tf("dashReviewDays", { n: data.funnel.reviewDays })));
  if (data.funnel.projectDays != null) notes.appendChild(adminNode("p", "", tf("dashProjectDays", { n: data.funnel.projectDays })));
  card.appendChild(notes);
  return card;
}

function dashComplaints(data) {
  const card = dashCard("dashComplaints");
  const split = adminNode("div", "dash-split");
  [["dashOpen", data.complaints.open, "open"], ["dashResolved", data.complaints.resolved, "done"]].forEach(([key, value, kind]) => {
    const box = adminNode("div", `dash-mini ${kind}`);
    box.append(adminNode("b", "", adminNumber(value)), adminNode("span", "", t(key)));
    split.appendChild(box);
  });
  card.appendChild(split);
  if (data.complaints.resolveDays != null) card.appendChild(adminNode("p", "dash-foot", tf("dashResolveDays", { n: data.complaints.resolveDays })));
  return card;
}

function dashDepartments(data) {
  const card = dashCard("dashDepts");
  if (!data.departments.length) {
    card.appendChild(adminNode("p", "empty", t("dashEmpty")));
    return card;
  }
  const max = Math.max(1, ...data.departments.map((row) => row.posts));
  data.departments.forEach((row, index) => {
    const line = adminNode("div", "dash-dept");
    const head = adminNode("div", "dash-row-head");
    head.append(adminNode("span", "", `${index + 1}. ${deptLabel(row.department) || row.department}`), adminNode("b", "", adminNumber(row.posts)));
    const bar = adminNode("i", "dash-track");
    const fill = adminNode("u");
    fill.style.width = `${(row.posts / max) * 100}%`;
    bar.appendChild(fill);
    const meta = adminNode("small", "", [`${t("dashIdeas")} ${adminNumber(row.ideas)}`, tf("dashParticipation", { n: row.participation })].join(" · "));
    line.append(head, bar, meta);
    card.appendChild(line);
  });
  return card;
}

function dashTopIdeas(data) {
  const card = dashCard("dashTopIdeas");
  if (!data.topIdeas.length) {
    card.appendChild(adminNode("p", "empty", t("dashEmpty")));
    return card;
  }
  data.topIdeas.forEach((idea) => {
    const row = adminNode("button", "dash-item");
    row.type = "button";
    const copy = adminNode("span", "dash-item-copy");
    copy.append(
      adminNode("strong", "", idea.title),
      adminNode("small", "", [idea.number ? `#${pad(idea.number)}` : "", deptLabel(idea.department), statusLabel(idea.status)].filter(Boolean).join(" · ")),
    );
    const score = adminNode("span", "dash-score");
    score.append(svgIcon(ICONS.like), document.createTextNode(adminNumber(idea.likes)), svgIcon(ICONS.reply), document.createTextNode(adminNumber(idea.comments)));
    row.append(copy, score);
    row.addEventListener("click", () => admOpen(idea.id));
    card.appendChild(row);
  });
  return card;
}

function dashContributors(data) {
  const card = dashCard("dashContributors");
  if (!data.contributors.length) {
    card.appendChild(adminNode("p", "empty", t("dashEmpty")));
    return card;
  }
  data.contributors.forEach((person, index) => {
    const row = adminNode("div", "dash-person");
    const medal = adminNode("span", `medal m${index + 1}`, String(index + 1));
    const copy = adminNode("span", "dash-item-copy");
    copy.append(adminNode("strong", "", person.name), adminNode("small", "", [deptLabel(person.department), person.position].filter(Boolean).join(" · ")));
    row.append(medal, copy, adminNode("em", "", tf("dashPoints", { n: adminNumber(person.points) })));
    card.appendChild(row);
  });
  return card;
}

function dashMeterRow(label, value, total, tone) {
  const row = adminNode("div", `dash-row ${tone || ""}`);
  const head = adminNode("div", "dash-row-head");
  const share = total ? Math.round((value / total) * 100) : 0;
  head.append(adminNode("span", "", label), adminNode("b", "", `${adminNumber(value)} · ${share}%`));
  const bar = adminNode("i", "dash-track");
  const fill = adminNode("u");
  fill.style.width = `${share}%`;
  bar.appendChild(fill);
  row.append(head, bar);
  return row;
}

function dashSecurity(data) {
  const sec = data.security;
  const card = dashCard("dashSecurity");
  const top = adminNode("div", "dash-sec-top");
  top.appendChild(admRing(sec.employees ? Math.round((sec.registered / sec.employees) * 100) : 0, t("dashSecRegistered")));
  const minis = adminNode("div", "dash-sec-minis");
  [
    ["dashSecLogins", sec.logins, "green", () => {
      Object.assign(admQuery.log, { group: "logins", q: "", offset: 0, days: Math.min(dashDays, 90) });
      showAdmTab("log");
    }],
    ["dashSecFails", sec.fails, "red", () => {
      Object.assign(admQuery.log, { group: "failures", q: "", offset: 0, days: Math.min(dashDays, 90) });
      showAdmTab("log");
    }],
    ["dashSecPeople", sec.people, "blue", null],
    ["dashSecSessions", sec.sessions, "violet", null],
    ["dashSecLocked", sec.locked, sec.locked ? "red" : "gray", () => {
      Object.assign(admQuery.users, { filter: "locked", q: "", offset: 0 });
      showAdmTab("users");
    }],
  ].forEach(([key, value, tone, open]) => {
    const box = adminNode(open ? "button" : "div", `adm-log-kpi tone-${tone}`);
    if (open) {
      box.type = "button";
      box.addEventListener("click", open);
    }
    box.append(adminNode("b", "", adminNumber(value)), adminNode("span", "", t(key)));
    minis.appendChild(box);
  });
  top.appendChild(minis);
  card.append(
    top,
    dashMeterRow(t("dashSecRegisteredOf"), sec.registered, sec.employees, "project"),
    dashMeterRow(t("dashSec2fa"), sec.twoFactor, sec.registered, "review"),
    dashMeterRow(t("dashSecEmail"), sec.email, sec.registered, "received"),
  );
  return card;
}

function dashLoginDays(data) {
  const card = dashCard("dashLoginDays");
  const max = Math.max(1, ...data.loginDays.map((day) => day.logins + day.fails));
  const chart = adminNode("div", "dash-bars dash-days");
  data.loginDays.forEach((day) => {
    const col = adminNode("div", "dash-bar dash-stack");
    col.title = `${formatShortDate(`${day.date}T12:00:00Z`)} · ${t("dashSecLogins")} ${day.logins} · ${t("dashSecFails")} ${day.fails}`;
    const ok = adminNode("i");
    ok.style.height = `${(day.logins / max) * 100}%`;
    const bad = adminNode("b");
    bad.style.height = `${(day.fails / max) * 100}%`;
    bad.style.bottom = `${(day.logins / max) * 100}%`;
    col.append(ok, bad);
    chart.appendChild(col);
  });
  const axis = adminNode("div", "dash-axis");
  axis.append(adminNode("span", "", formatShortDate(`${data.loginDays[0].date}T12:00:00Z`)), adminNode("span", "", t("admToday")));
  const legend = adminNode("div", "dash-legend");
  legend.append(adminNode("span", "ok", t("dashSecLogins")), adminNode("span", "bad", t("dashSecFails")));
  card.append(chart, axis, legend);
  return card;
}

function dashHeat(data) {
  const card = dashCard("dashHeat");
  const max = Math.max(1, ...data.heat.flat());
  const grid = adminNode("div", "dash-heat");
  const names = lang === "ar" ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let best = { day: 0, hour: 0, count: 0 };
  data.heat.forEach((hours, day) => {
    grid.appendChild(adminNode("span", "dash-heat-day", names[day]));
    hours.forEach((count, hour) => {
      const cell = adminNode("i", "");
      cell.style.setProperty("--a", count ? String(0.15 + (count / max) * 0.85) : "0");
      cell.title = `${names[day]} ${String(hour).padStart(2, "0")}:00 · ${adminNumber(count)}`;
      grid.appendChild(cell);
      if (count > best.count) best = { day, hour, count };
    });
  });
  const axis = adminNode("div", "dash-heat-axis");
  axis.appendChild(adminNode("span"));
  ["00", "06", "12", "18", "23"].forEach((label) => axis.appendChild(adminNode("span", "", label)));
  card.append(grid, axis);
  card.appendChild(adminNode("p", "dash-foot", best.count ? tf("dashHeatPeak", { day: names[best.day], time: `${String(best.hour).padStart(2, "0")}:00` }) : t("dashEmpty")));
  return card;
}

function dashMix(data) {
  const card = dashCard("dashMix");
  const rows = Object.entries(data.mix || {}).sort((left, right) => right[1] - left[1]);
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  if (!total) card.appendChild(adminNode("p", "empty", t("dashEmpty")));
  else {
    const split = adminNode("div", "adm-split-bar dash-mix-bar");
    const legend = adminNode("div", "adm-split-legend");
    rows.forEach(([type, count]) => {
      const color = type === "post" || type === "article" ? "#64748b" : (PROFILE_TILE_COLORS[type] || ["#64748b"])[0];
      const part = adminNode("i");
      part.style.width = `${(count / total) * 100}%`;
      part.style.background = color;
      split.appendChild(part);
      const item = adminNode("span");
      const dot = adminNode("u");
      dot.style.background = color;
      item.append(dot, adminNode("b", "", adminNumber(count)), document.createTextNode(` ${typeLabel(type)}`));
      legend.appendChild(item);
    });
    card.append(split, legend);
  }
  const eng = data.engagement || {};
  const stats = adminNode("div", "dash-eng");
  [
    ["dashEngLikes", eng.likesPerPost],
    ["dashEngComments", eng.commentsPerPost],
    ["dashEngCommented", `${eng.commentedShare || 0}%`],
    ["dashEngReposts", adminNumber(eng.reposts)],
  ].forEach(([key, value]) => {
    const box = adminNode("div", "dash-mini");
    box.append(adminNode("b", "", String(value ?? 0)), adminNode("span", "", t(key)));
    stats.appendChild(box);
  });
  card.appendChild(stats);
  return card;
}

function paintDashboard(data) {
  const body = document.querySelector("#dash-body");
  const wide = adminNode("div", "dash-wide");
  wide.append(dashWeeks(data), dashFunnel(data));
  const parts = [dashKpis(data)];
  if (data.security) {
    const pair = adminNode("div", "dash-pair");
    pair.append(dashSecurity(data), dashLoginDays(data));
    parts.push(pair);
  }
  parts.push(wide);
  if (data.heat) {
    const pair = adminNode("div", "dash-pair");
    pair.append(dashHeat(data), dashMix(data));
    parts.push(pair);
  }
  parts.push(dashComplaints(data), dashDepartments(data), dashTopIdeas(data), dashContributors(data), dashExport());
  body.replaceChildren(...parts);
}

function dashExport() {
  const card = dashCard("exportTitle");
  card.appendChild(adminNode("p", "dash-note", t("exportLead")));
  const row = adminNode("div", "dash-export");
  const status = adminNode("p", "dash-note", "");
  [["ideas", "exportIdeas"], ["departments", "exportDepts"]].forEach(([kind, key]) => {
    const button = admBtn(t(key), "ghost", "download");
    button.addEventListener("click", async () => {
      button.disabled = true;
      status.textContent = "";
      const data = await social("export", { kind, days: dashDays });
      button.disabled = false;
      if (!data || typeof data.csv !== "string") {
        status.textContent = t("exportFailed");
        return;
      }
      const blob = new Blob(["\ufeff", data.csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `bq-${kind}-${dashDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    });
    row.appendChild(button);
  });
  card.append(row, status);
  return card;
}

document.querySelectorAll("#dash-range [data-days]").forEach((button) => {
  button.addEventListener("click", () => {
    dashDays = Number(button.dataset.days) || 30;
    renderDashStats();
  });
});

let admTab = "overview";
const admQuery = {
  ideas: { status: "all", q: "", offset: 0, days: 0 },
  complaints: { status: "all", q: "", offset: 0, days: 0 },
  users: { filter: "all", q: "", offset: 0 },
  content: { kind: "posts", q: "", offset: 0, days: 30 },
  log: { group: "all", q: "", offset: 0, days: 7 },
  conduct: { filter: "all", q: "", offset: 0 },
};
const ADM_CONDUCT_FILTERS = [["all", "admConductAll"], ["banned", "admConductBannedOnly"]];
const ADM_CONDUCT_WHERE = { comment: "admWhereComment", bio: "admWhereBio", highlight: "admWhereHighlight", achievement: "admWhereAchievement", group: "admWhereGroup", repost: "admWhereRepost", edit: "admWhereEdit", story: "admWhereStory" };
const ADM_PERIODS = [[0, "admPeriodAll"], [7, "dash7"], [30, "dash30"], [90, "dash90"], [365, "dash365"]];
const ADM_LOG_PERIODS = [[1, "admLast24h"], [7, "dash7"], [30, "dash30"], [90, "dash90"], [0, "admPeriodAll"]];
const ADM_LOG_GROUPS = [["all", "admAll"], ["logins", "admLogGroupLogins"], ["failures", "admLogGroupFails"], ["security", "admLogGroupSecurity"], ["admin", "admLogGroupAdmin"]];
const ADM_LOG_RESULT = { green: "admResultOk", red: "admResultFail", violet: "admResultAdmin", gray: "admResultInfo" };
const ADM_CONTENT_KINDS = [["posts", "admPosts"], ["comments", "admComments"], ["likes", "admLikes"]];
let admTimer = 0;
const admPeek = new Map();

const ADM_STATUSES = {
  ideas: ["all", "received", "review", "project"],
  complaints: ["all", "received", "review", "resolved"],
};
const ADM_USER_FILTERS = [["all", "admUsersAll"], ["admins", "admUsersAdmins"], ["registered", "admUsersRegistered"], ["locked", "admUsersLocked"], ["banned", "admUsersBanned"]];
const ADM_TAB_COUNTS = { ideas: "ideasWaiting", complaints: "complaintsOpen", reports: "reported", achievements: "achievementsPending", conduct: "conductToday", joins: "joinsPending" };
const ADM_LOG_KEYS = {
  login: "admLogLogin",
  login_fail: "admLogLoginFail",
  login_locked: "admLogLocked",
  register: "admLogRegister",
  register_fail: "admLogRegisterFail",
  password: "admLogPassword",
  password_local: "admLogPasswordLocal",
  reset_sent: "admLogReset",
  mail_fail: "admLogMailFail",
  terms: "admLogTerms",
  logout_all: "admLogLogoutAll",
  admin_grant: "admLogGrant",
  admin_revoke: "admLogRevoke",
  sessions_revoked_by_admin: "admLogForceOut",
  unlocked_by_admin: "admLogUnlock",
  admin_delete_post: "admLogDeletePost",
  admin_delete_comment: "admLogDeleteComment",
  admin_remove_like: "admLogRemoveLike",
  logout: "admLogLogout",
  password_fail: "admLogPasswordFail",
  session_revoked: "admLogSessionRevoked",
  session_revoked_by_admin: "admLogSessionRevokedAdmin",
  backup_fail: "admLogBackupFail",
  backup_manual: "admLogBackupManual",
  login_2fa_fail: "admLog2faFail",
  login_2fa_locked: "admLog2faLocked",
  "2fa_on": "admLog2faOn",
  email_linked: "admLogEmailLinked",
  email_changed: "admLogEmailChanged",
  "2fa_off": "admLog2faOff",
  "2fa_off_local": "admLog2faOff",
  "2fa_recovery_used": "admLog2faRecoveryUsed",
  "2fa_recovery_new": "admLog2faRecoveryNew",
  "2fa_reset_by_admin": "admLog2faReset",
  conduct_warning: "admLogConductWarn",
  conduct_banned: "admLogConductBan",
  login_banned: "admLogLoginBanned",
  unbanned_by_admin: "admLogUnban",
  join_request: "admLogJoinRequest",
  join_approved: "admLogJoinApproved",
  join_rejected: "admLogJoinRejected",
  join_exists: "admLogJoinRejected",
  employee_added: "admLogEmployeeAdded",
};
const ADM_LOG_TONE = {
  conduct_warning: "red",
  conduct_banned: "red",
  login_banned: "red",
  unbanned_by_admin: "violet",
  backup_fail: "red",
  login_2fa_fail: "red",
  login_2fa_locked: "red",
  "2fa_on": "green",
  email_linked: "green",
  email_changed: "green",
  "2fa_off": "red",
  "2fa_recovery_used": "red",
  "2fa_reset_by_admin": "violet",
  password_fail: "red",
  session_revoked_by_admin: "violet",
  admin_delete_post: "violet",
  admin_delete_comment: "violet",
  admin_remove_like: "violet",
  login: "green",
  register: "green",
  login_fail: "red",
  login_locked: "red",
  register_fail: "red",
  mail_fail: "red",
  admin_grant: "violet",
  admin_revoke: "violet",
  sessions_revoked_by_admin: "violet",
  unlocked_by_admin: "violet",
  join_approved: "green",
  employee_added: "green",
  join_rejected: "violet",
};
const ADM_ICONS = {
  joins: "M10 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM4 19.5c1-3 3.2-4.5 6-4.5 1.3 0 2.5.3 3.4.9M18 13.5v6M15 16.5h6",
  users: "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3.5 19.5c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5M16 4.8a3 3 0 0 1 0 6M17.5 14.5c1.6.5 2.6 2 3 5",
  log: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
  ideas: "M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.7.5-1.1 1.2-1.2 2.1h-4.6c-.1-.9-.5-1.6-1.2-2.1A6 6 0 0 1 12 3z",
  complaints: "M4 5.5h16v10.5H9.5L4 20zM12 8.5v3.2M12 13.8v.01",
  reports: "M5.5 21V4.5M5.5 4.5h12l-2.4 4.2 2.4 4.3h-12",
  conduct: "M12 3.5 2.8 19.5h18.4zM12 10v4.2M12 16.8v.01",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  achievements: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7",
  spark: "M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1L5 10.5l5.1-1.9z",
  search: "M11 17.8a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM20.5 20.5l-4.6-4.6",
  shield: "M12 3.5 5 6.3v5.2c0 4.4 2.9 7.7 7 9 4.1-1.3 7-4.6 7-9V6.3z",
  logout: "M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9.5",
  devices: "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2",
  unlock: "M7.5 11V8a4.5 4.5 0 0 1 8.7-1.6M5.5 11h13v9.5h-13z",
  hide: "M3 3l18 18M10.6 6.1A9.9 9.9 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.4.7-1.4 2-2.8 3.3M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  show: "M2.5 12C3.5 10.5 7 6 12 6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6S3.5 13.5 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6 6 18",
  open: "M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  trash: "M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M10 11v5.5M14 11v5.5",
  content: "M5 4.5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM8 9h8M8 12.5h8M8 16h5",
  heartOff: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20zM4 4l16 16",
};

function admGoContent(kind) {
  Object.assign(admQuery.content, { kind, q: "", offset: 0, days: dashDays });
  showAdmTab("content");
}

function admPeriod(state, rerender, periods) {
  const row = adminNode("div", "adm-seg adm-period");
  (periods || ADM_PERIODS).forEach(([days, key]) => {
    const button = adminNode("button", days === (state.days || 0) ? "on" : "", t(key));
    button.type = "button";
    button.addEventListener("click", () => {
      state.days = days;
      rerender();
    });
    row.appendChild(button);
  });
  return row;
}

function admDeletePost(id, onDone) {
  admConfirm(t("admConfirmDeletePost"), t("admDelete"), async () => {
    const data = await social("admin-delete-post", { id });
    if (!data) return;
    admPeek.delete(id);
    loadIdeas();
    admRefresh();
    onDone();
  });
}

function admIcon(name) {
  return svgIcon(ADM_ICONS[name]);
}

function admBtn(label, kind, icon) {
  const button = adminNode("button", kind ? `adm-btn ${kind}` : "adm-btn");
  button.type = "button";
  if (icon) button.appendChild(admIcon(icon));
  button.appendChild(adminNode("span", "", label));
  return button;
}

function admLoading(box, rows) {
  box.replaceChildren(...Array.from({ length: rows || 4 }, () => adminNode("div", "adm-skel")));
}

function admEmpty(box, key, icon) {
  const empty = adminNode("div", "adm-empty");
  const badge = adminNode("span", "adm-empty-icon");
  badge.appendChild(admIcon(icon || "check"));
  empty.append(badge, adminNode("p", "", t(key)));
  box.replaceChildren(empty);
}

function admConfirm(message, label, run) {
  openSheet(message, "", [{ label, danger: true, run }]);
}

async function admOpen(id) {
  if (!ideas.some((idea) => idea.id === id)) {
    const data = await social("admin-post", { id });
    if (!data || !data.idea) return;
    admPeek.set(id, data.idea);
  }
  openThread(id);
}

function admPaintToday() {
  const kicker = document.querySelector(".adm-kicker");
  if (kicker && selectedPerson && selectedPerson.official) {
    kicker.textContent = selectedPerson.name;
    kicker.appendChild(officialMark());
  }
  const node = document.querySelector("#adm-today");
  if (!node) return;
  node.textContent = new Date().toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function showAdmTab(tab) {
  admTab = tab;
  renderDashboard();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll("#adm-tabs [data-adm]").forEach((button) => {
  button.addEventListener("click", () => showAdmTab(button.dataset.adm));
});

document.querySelector("#adm-menu").addEventListener("click", (event) => {
  event.stopPropagation();
  openDrawer();
});

async function admRefresh() {
  const data = await social("admin-summary", {});
  document.querySelectorAll("#adm-tabs [data-adm]").forEach((button) => {
    const key = ADM_TAB_COUNTS[button.dataset.adm];
    const value = key && data ? Number(data[key]) || 0 : 0;
    let badge = button.querySelector(".adm-count");
    if (!value) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = adminNode("b", "adm-count");
      button.appendChild(badge);
    }
    badge.textContent = value > 99 ? "99+" : adminNumber(value);
  });
  if (admTab === "overview" && view === "dashboard") paintAdmSummary(data);
}

function admTile(label, value, icon, tone, onClick, extra) {
  const tile = adminNode("button", `adm-tile tone-${tone}`);
  tile.type = "button";
  const badge = adminNode("span", "adm-tile-icon");
  badge.appendChild(admIcon(icon));
  const number = adminNode("b", "", adminNumber(value));
  if (extra) number.appendChild(adminNode("small", "", extra));
  tile.append(badge, number, adminNode("span", "adm-tile-label", label));
  tile.addEventListener("click", onClick);
  return tile;
}

function paintAdmSummary(data) {
  const box = document.querySelector("#adm-summary");
  if (!data) {
    box.replaceChildren();
    return;
  }
  const people = adminNode("div", "adm-pair");
  people.append(
    admTile(t("admSumRegistered"), data.registered, "users", "blue", () => {
      admQuery.users.filter = "registered";
      admQuery.users.offset = 0;
      showAdmTab("users");
    }, ` / ${adminNumber(data.employees)}`),
    admTile(t("admSumLogins"), data.loginsToday, "log", "violet", () => showAdmTab("log")),
  );
  const waiting = [
    [t("admSumIdeasWaiting"), data.ideasWaiting, "ideas", () => {
      admQuery.ideas.status = "received";
      admQuery.ideas.offset = 0;
      showAdmTab("ideas");
    }],
    [t("admSumComplaints"), data.complaintsOpen, "complaints", () => showAdmTab("complaints")],
    [t("admSumReported"), data.reported, "reports", () => showAdmTab("reports")],
    [t("admSumAchievements"), data.achievementsPending, "achievements", () => showAdmTab("achievements")],
    [t("admSumConduct"), data.conductToday, "conduct", () => showAdmTab("conduct")],
    [t("admJoins"), data.joinsPending, "joins", () => showAdmTab("joins")],
  ];
  const total = waiting.reduce((sum, row) => sum + (Number(row[1]) || 0), 0);
  const attention = adminNode("section", "adm-attention");
  const head = adminNode("div", "adm-attention-head");
  head.append(adminNode("h2", "", t("admAttention")), adminNode("span", total ? "adm-dot-live" : "adm-dot-calm"));
  const grid = adminNode("div", "adm-grid");
  waiting.forEach(([label, value, icon, onClick]) => {
    const tile = admTile(label, value, icon, Number(value) ? "hot" : "calm", onClick);
    grid.appendChild(tile);
  });
  attention.append(head, grid);
  if (!total) attention.appendChild(adminNode("p", "adm-attention-note", t("admAttentionNone")));
  const strip = admBackupStrip(data.backup);
  box.replaceChildren(...(strip ? [strip] : []), people, attention);
}

function admBackupStrip(info) {
  if (!info) return null;
  const stale = !info.lastAt || Date.now() - Date.parse(info.lastAt) > 8 * 24 * 60 * 60 * 1000;
  const bad = stale || info.failed;
  const strip = adminNode("section", `adm-backup${bad ? " is-bad" : ""}`);
  const icon = adminNode("span", "adm-backup-icon");
  icon.appendChild(admIcon(bad ? "shield" : "check"));
  const title = info.failed ? "admBackupFailed" : !info.lastAt ? "admBackupNever" : stale ? "admBackupStale" : "admBackupOk";
  const line = info.lastAt
    ? tf("admBackupLine", { time: timeAgo(info.lastAt), n: adminNumber(info.kept), size: `${(info.size / 1024 / 1024).toFixed(1)} MB` })
    : t("admBackupFirst");
  const copy = adminNode("div", "adm-backup-copy");
  copy.append(adminNode("strong", "", t(title)), adminNode("span", "", line));
  if (info.vault) copy.appendChild(adminNode("span", "", tf("admVaultLine", { time: timeAgo(info.vault.lastAt), n: adminNumber(info.vault.kept) })));
  const run = admBtn(t("admBackupNow"), bad ? "primary" : "ghost", "download");
  run.addEventListener("click", async () => {
    run.disabled = true;
    copy.lastChild.textContent = t("admBackupRunning");
    await social("admin-backup", {});
    admRefresh();
  });
  strip.append(icon, copy, run);
  return strip;
}

function renderAdmTool() {
  const body = document.querySelector("#adm-body");
  if (admTab === "reports") {
    renderModeration();
    return;
  }
  admLoading(body, 4);
  if (admTab === "ideas" || admTab === "complaints") renderAdmPosts(body, admTab);
  else if (admTab === "content") renderAdmContent(body);
  else if (admTab === "users") renderAdmUsers(body);
  else if (admTab === "achievements") renderAdmAchievements(body);
  else if (admTab === "joins") renderAdmJoins(body);
  else if (admTab === "spark") renderAdmSpark(body);
  else if (admTab === "log") renderAdmLog(body);
  else if (admTab === "conduct") renderAdmConduct(body);
}

function admSearch(state, placeholderKey, rerender) {
  const wrap = adminNode("label", "adm-searchbox");
  const input = adminNode("input", "adm-search");
  input.type = "search";
  input.maxLength = 60;
  input.value = state.q;
  input.placeholder = t(placeholderKey);
  input.addEventListener("input", () => {
    clearTimeout(admTimer);
    admTimer = setTimeout(() => {
      state.q = input.value.trim();
      state.offset = 0;
      rerender().then(() => {
        const next = document.querySelector("#adm-body .adm-search");
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
    }, 300);
  });
  wrap.append(admIcon("search"), input);
  return wrap;
}

function admChips(options, current, onPick) {
  const row = adminNode("div", "adm-filter");
  options.forEach(([value, label, count]) => {
    const chip = adminNode("button", value === current ? "on" : "", label);
    chip.type = "button";
    if (count != null) chip.appendChild(adminNode("b", "", adminNumber(count)));
    chip.addEventListener("click", () => onPick(value));
    row.appendChild(chip);
  });
  return row;
}

function admMore(shown, total, onMore) {
  if (shown >= total) return null;
  const more = admBtn(t("loadMore"), "ghost wide load-more");
  more.addEventListener("click", onMore);
  return more;
}

async function admSetStatus(id, status) {
  try {
    const response = await fetch(`/api/ideas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session": selectedPerson ? selectedPerson.token : "" },
      body: JSON.stringify({ status, token: selectedPerson ? selectedPerson.token : "" }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function renderAdmPosts(body, tab, append) {
  const state = admQuery[tab];
  const data = await social("admin-posts", { kind: tab === "complaints" ? "complaint" : "idea", status: state.status, q: state.q, offset: state.offset, days: state.days });
  if (admTab !== tab) return;
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  const rerender = () => {
    state.offset = 0;
    return renderAdmPosts(body, tab);
  };
  let list = body.querySelector(".adm-list");
  if (!append || !list) {
    const statuses = ADM_STATUSES[tab].map((status) => [status, status === "all" ? t("admAll") : statusLabel(status), data.counts[status] || 0]);
    list = adminNode("div", "adm-list");
    const bar = adminNode("div", "adm-toolbar");
    bar.append(
      admSearch(state, "admSearchPosts", rerender),
      admPeriod(state, rerender),
      admChips(statuses, state.status, (value) => {
        state.status = value;
        rerender();
      }),
    );
    body.replaceChildren(bar, list);
  }
  body.querySelector(".load-more")?.remove();
  if (!data.items.length && !append) admEmpty(list, "dashEmpty", tab);
  data.items.forEach((item) => list.appendChild(admPostRow(item, tab, rerender)));
  const more = admMore(state.offset + data.items.length, data.total, () => {
    state.offset += 30;
    renderAdmPosts(body, tab, true);
  });
  if (more) body.appendChild(more);
}

function admStatusPill(status) {
  return adminNode("span", `adm-status s-${status}`, statusLabel(status));
}

function admPostRow(item, tab, rerender) {
  const row = adminNode("article", "adm-card adm-post");
  row.classList.toggle("is-hidden", item.hidden);
  const head = adminNode("div", "adm-card-head");
  const pill = admStatusPill(item.status);
  if (item.number) head.appendChild(adminNode("span", "adm-num", `#${pad(item.number)}`));
  head.appendChild(pill);
  if (item.hidden) head.appendChild(adminNode("span", "adm-status s-hidden", t("modHiddenMod")));
  head.appendChild(adminNode("time", "adm-time", timeAgo(item.createdAt)));
  const title = adminNode("button", "adm-title", item.title || "—");
  title.type = "button";
  title.addEventListener("click", () => admOpen(item.id));
  const who = adminNode("p", "adm-who", [item.name, deptLabel(item.department)].filter(Boolean).join(" · "));

  const foot = adminNode("div", "adm-card-foot");
  const stats = adminNode("span", "adm-stats");
  stats.append(svgIcon(ICONS.like), adminNode("span", "", adminNumber(item.likes)), svgIcon(ICONS.reply), adminNode("span", "", adminNumber(item.comments)));
  const tools = adminNode("div", "adm-tools");
  const select = adminNode("select", `adm-select s-${item.status}`);
  select.setAttribute("aria-label", t("admStatus"));
  ADM_STATUSES[tab].slice(1).forEach((status) => {
    const option = adminNode("option", "", statusLabel(status));
    option.value = status;
    option.selected = status === item.status;
    select.appendChild(option);
  });
  select.addEventListener("change", async () => {
    select.disabled = true;
    const ok = await admSetStatus(item.id, select.value);
    select.disabled = false;
    if (!ok) {
      select.value = item.status;
      return;
    }
    item.status = select.value;
    select.className = `adm-select s-${item.status}`;
    pill.className = `adm-status s-${item.status}`;
    pill.textContent = statusLabel(item.status);
    loadIdeas();
    admRefresh();
  });
  const hide = admBtn(t(item.hidden ? "modRestore" : "modHide"), "ghost", item.hidden ? "show" : "hide");
  hide.addEventListener("click", async () => {
    hide.disabled = true;
    const data = await social("mod-action", { id: item.id, decision: item.hidden ? "restore" : "hide" });
    if (data) {
      loadIdeas();
      rerender();
    } else hide.disabled = false;
  });
  const remove = admBtn(t("admDelete"), "danger", "trash");
  remove.addEventListener("click", () => admDeletePost(item.id, rerender));
  tools.append(select, hide, remove);
  foot.append(stats, tools);
  row.append(head, title, who, foot);
  return row;
}

async function renderAdmContent(body, append) {
  const state = admQuery.content;
  const kind = state.kind;
  const data = await social("admin-content", { kind, q: state.q, offset: state.offset, days: state.days });
  if (admTab !== "content" || state.kind !== kind) return;
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  const rerender = () => {
    state.offset = 0;
    return renderAdmContent(body);
  };
  let list = body.querySelector(".adm-list");
  if (!append || !list) {
    list = adminNode("div", kind === "likes" ? "adm-list adm-people" : "adm-list");
    const bar = adminNode("div", "adm-toolbar");
    bar.append(
      admChips(ADM_CONTENT_KINDS.map(([value, key]) => [value, t(key)]), kind, (value) => {
        state.kind = value;
        state.q = "";
        rerender();
      }),
      admSearch(state, "admSearchContent", rerender),
      admPeriod(state, rerender),
      adminNode("p", "adm-count-line", tf("admResults", { n: adminNumber(data.total) })),
    );
    body.replaceChildren(bar, list);
  }
  body.querySelector(".load-more")?.remove();
  if (!data.items.length && !append) admEmpty(list, "dashEmpty", kind === "likes" ? "heartOff" : "content");
  const paint = kind === "comments" ? admCommentRow : kind === "likes" ? admLikeRow : admContentPostRow;
  data.items.forEach((item) => list.appendChild(paint(item, rerender)));
  const more = admMore(state.offset + data.items.length, data.total, () => {
    state.offset += 30;
    renderAdmContent(body, true);
  });
  if (more) body.appendChild(more);
}

function admNameLine(name, official, extra) {
  const line = adminNode("strong", "adm-name", name || "—");
  if (official) line.appendChild(officialMark());
  if (extra) line.appendChild(adminNode("small", "", extra));
  return line;
}

function admContentPostRow(item, rerender) {
  const row = adminNode("article", "adm-card adm-post");
  row.classList.toggle("is-hidden", item.hidden);
  const head = adminNode("div", "adm-card-head");
  head.appendChild(adminNode("span", "adm-status s-type", typeLabel(item.type || "post")));
  if (item.type === "idea" || item.type === "complaint") head.appendChild(admStatusPill(item.status));
  if (item.hidden) head.appendChild(adminNode("span", "adm-status s-hidden", t("modHiddenMod")));
  head.appendChild(adminNode("time", "adm-time", timeAgo(item.createdAt)));
  const main = adminNode("div", "adm-post-main");
  const copy = adminNode("div", "adm-post-copy");
  const title = adminNode("button", "adm-title", item.title || excerpt(item.text, 80) || "—");
  title.type = "button";
  title.addEventListener("click", () => admOpen(item.id));
  copy.appendChild(title);
  if (item.text && item.text.trim() !== String(item.title || "").trim()) copy.appendChild(adminNode("p", "adm-card-text clamp", item.text));
  copy.appendChild(admNameLine(item.name, item.official, deptLabel(item.department) ? ` · ${deptLabel(item.department)}` : ""));
  main.appendChild(copy);
  if (item.media && !isVideoSrc(item.media)) {
    const thumb = adminNode("button", "adm-thumb");
    thumb.type = "button";
    thumb.style.backgroundImage = `url("${item.media}")`;
    thumb.setAttribute("aria-label", t("admOpenPost"));
    thumb.addEventListener("click", () => admOpen(item.id));
    main.appendChild(thumb);
  }
  const foot = adminNode("div", "adm-card-foot");
  const stats = adminNode("span", "adm-stats");
  stats.append(svgIcon(ICONS.like), adminNode("span", "", adminNumber(item.likes)), svgIcon(ICONS.reply), adminNode("span", "", adminNumber(item.comments)));
  const tools = adminNode("div", "adm-tools");
  const hide = admBtn(t(item.hidden ? "modRestore" : "modHide"), "ghost", item.hidden ? "show" : "hide");
  hide.addEventListener("click", async () => {
    hide.disabled = true;
    const data = await social("mod-action", { id: item.id, decision: item.hidden ? "restore" : "hide" });
    if (data) {
      loadIdeas();
      admRefresh();
      rerender();
    } else hide.disabled = false;
  });
  const remove = admBtn(t("admDelete"), "danger", "trash");
  remove.addEventListener("click", () => admDeletePost(item.id, rerender));
  tools.append(hide, remove);
  foot.append(stats, tools);
  row.append(head, main, foot);
  return row;
}

function admCommentRow(item, rerender) {
  const row = adminNode("article", "adm-card adm-comment");
  const head = adminNode("div", "adm-card-head");
  head.append(admNameLine(item.name, item.official, deptLabel(item.department) ? ` · ${deptLabel(item.department)}` : ""), adminNode("time", "adm-time", timeAgo(item.createdAt)));
  row.appendChild(head);
  if (item.text) row.appendChild(adminNode("p", "adm-card-text", item.text));
  if (item.media && !isVideoSrc(item.media)) {
    const thumb = adminNode("button", "adm-thumb wide");
    thumb.type = "button";
    thumb.style.backgroundImage = `url("${item.media}")`;
    thumb.addEventListener("click", () => openLightbox(item.media));
    row.appendChild(thumb);
  }
  const post = adminNode("button", "adm-on-post", tf("admOnPost", { title: item.postTitle || "—" }));
  post.type = "button";
  post.addEventListener("click", () => admOpen(item.postId));
  const tools = adminNode("div", "adm-tools");
  const remove = admBtn(t("admDelete"), "danger", "trash");
  remove.addEventListener("click", () => {
    admConfirm(t("admConfirmDeleteComment"), t("admDelete"), async () => {
      const data = await social("admin-delete-comment", { id: item.postId, commentId: item.id });
      if (!data) return;
      admPeek.delete(item.postId);
      loadIdeas();
      rerender();
    });
  });
  tools.appendChild(remove);
  const foot = adminNode("div", "adm-card-foot");
  foot.append(post, tools);
  row.appendChild(foot);
  return row;
}

function admLikeRow(item, rerender) {
  const row = adminNode("article", "adm-card adm-user");
  const top = adminNode("div", "adm-user-top");
  const face = avatarNode({ name: item.name, initial: String(item.name || "•").trim().charAt(0) || "•" });
  const copy = adminNode("div", "adm-user-copy");
  copy.append(adminNode("strong", "", item.name), adminNode("small", "", [item.position, deptLabel(item.department)].filter(Boolean).join(" · ")));
  top.append(face, copy);
  const post = adminNode("button", "adm-on-post", tf("admLikedPost", { title: item.postTitle || "—" }));
  post.type = "button";
  post.addEventListener("click", () => admOpen(item.postId));
  const tools = adminNode("div", "adm-tools");
  const remove = admBtn(t("admRemoveLike"), "danger", "heartOff");
  remove.addEventListener("click", () => {
    admConfirm(tf("admConfirmRemoveLike", { name: item.name }), t("admRemoveLike"), async () => {
      const data = await social("admin-remove-like", { id: item.postId, pid: item.pid });
      if (!data) return;
      admPeek.delete(item.postId);
      loadIdeas();
      rerender();
    });
  });
  tools.appendChild(remove);
  row.append(top, post, tools);
  return row;
}

async function renderAdmUsers(body, append) {
  const state = admQuery.users;
  const data = await social("admin-users", { q: state.q, filter: state.filter, offset: state.offset });
  if (admTab !== "users") return;
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  const rerender = () => {
    state.offset = 0;
    return renderAdmUsers(body);
  };
  let list = body.querySelector(".adm-list");
  if (!append || !list) {
    list = adminNode("div", "adm-list adm-people");
    const bar = adminNode("div", "adm-toolbar");
    bar.append(
      admSearch(state, "admSearchUsers", rerender),
      admChips(ADM_USER_FILTERS.map(([value, key]) => [value, t(key)]), state.filter, (value) => {
        state.filter = value;
        rerender();
      }),
      adminNode("p", "adm-count-line", tf("admUsersCount", { n: adminNumber(data.total) })),
    );
    body.replaceChildren(bar, list);
  }
  body.querySelector(".load-more")?.remove();
  if (!data.items.length && !append) admEmpty(list, "dashEmpty", "users");
  data.items.forEach((user) => list.appendChild(admUserRow(user)));
  const more = admMore(state.offset + data.items.length, data.total, () => {
    state.offset += 30;
    renderAdmUsers(body, true);
  });
  if (more) body.appendChild(more);
}

function admSeenLine(user) {
  if (!user.devices) return t("deviceNone");
  return [tf("deviceActive", { time: timeAgo(user.lastSeen) }), tf("devicesCount", { n: user.devices })].join(" · ");
}

function admUserRow(user) {
  const row = adminNode("article", "adm-card adm-user");
  const paint = (current) => {
    row.replaceChildren();
    const top = adminNode("div", "adm-user-top");
    const face = avatarNode({ name: current.name, initial: String(current.name || "•").trim().charAt(0) || "•" });
    const copy = adminNode("div", "adm-user-copy");
    copy.append(adminNode("strong", "", current.name), adminNode("small", "", [current.position, deptLabel(current.department)].filter(Boolean).join(" · ")));
    top.append(face, copy);
    const pills = adminNode("div", "adm-pills");
    if (current.admin) pills.appendChild(adminNode("span", "adm-status s-admin", t("admPillAdmin")));
    pills.appendChild(adminNode("span", current.registered ? "adm-status s-resolved" : "adm-status s-none", t(current.registered ? "admPillRegistered" : "admPillNotRegistered")));
    if (current.twoFactor) pills.appendChild(adminNode("span", "adm-status s-dept", t("admPill2fa")));
    if (current.locked) pills.appendChild(adminNode("span", "adm-status s-review", t("admPillLocked")));
    if (current.banned) pills.appendChild(adminNode("span", "adm-status s-banned", t("admPillBanned")));
    else if (current.warnings) pills.appendChild(adminNode("span", "adm-status s-review", tf("admPillWarnings", { n: adminNumber(current.warnings) })));
    const tools = adminNode("div", "adm-tools");
    const act = (key, op, icon, confirmKey, kind) => {
      const button = admBtn(t(key), kind || "ghost", icon);
      const run = async () => {
        button.disabled = true;
        const data = await social("admin-user", { pid: current.pid, op });
        if (data && data.user) paint(data.user);
        else button.disabled = false;
      };
      button.addEventListener("click", () => {
        if (confirmKey) admConfirm(tf(confirmKey, { name: current.name }), t(key), run);
        else run();
      });
      return button;
    };
    if (!current.fixedAdmin) {
      tools.appendChild(current.admin
        ? act("admRemoveAdmin", "admin-off", "shield", "admConfirmRemoveAdmin")
        : act("admMakeAdmin", "admin-on", "shield", "admConfirmMakeAdmin", "primary"));
    }
    const devices = adminNode("ul", "device-list adm-devices");
    devices.hidden = true;
    const loadDevices = async (revoke) => {
      const data = await social("admin-sessions", revoke ? { pid: current.pid, revoke } : { pid: current.pid });
      if (!data || !Array.isArray(data.sessions)) {
        devices.replaceChildren(adminNode("li", "device-empty", t("devicesFailed")));
        return;
      }
      paintDeviceList(devices, data.sessions, (session, button) => {
        button.disabled = true;
        loadDevices(session.id);
      });
      const count = row.querySelector(".adm-user-seen");
      if (count) count.textContent = admSeenLine({ ...current, devices: data.sessions.length });
    };
    if (current.registered) {
      const view = admBtn(tf("devicesCount", { n: current.devices || 0 }), "ghost", "devices");
      view.setAttribute("aria-expanded", "false");
      view.addEventListener("click", () => {
        devices.hidden = !devices.hidden;
        view.setAttribute("aria-expanded", String(!devices.hidden));
        if (!devices.hidden) {
          devices.replaceChildren(adminNode("li", "device-empty", t("devicesLoading")));
          loadDevices();
        }
      });
      tools.appendChild(view);
      tools.appendChild(act("admForceOut", "revoke", "logout", "admConfirmForceOut"));
      if ((current.twoFactor || current.registered) && current.pid !== selectedPerson.pid) tools.appendChild(act("admReset2fa", "reset-2fa", "shield", "admConfirmReset2fa"));
    }
    if (current.locked) tools.appendChild(act("admUnlock", "unlock", "unlock"));
    if (current.banned) tools.appendChild(act("admUnban", "unban", "unlock", "admConfirmUnban", "primary"));
    row.append(top, pills);
    if (current.registered) row.appendChild(adminNode("p", "adm-user-seen", admSeenLine(current)));
    if (tools.children.length) row.appendChild(tools);
    row.appendChild(devices);
  };
  paint(user);
  return row;
}

async function renderAdmConduct(body, append) {
  const state = admQuery.conduct;
  const data = await social("admin-conduct", { q: state.q, filter: state.filter, offset: state.offset });
  if (admTab !== "conduct") return;
  if (!data || !data.stats) {
    adminNotice(body, "dashFail");
    return;
  }
  paintAdmConduct(body, data, append);
}

function paintAdmConduct(body, data, append) {
  const state = admQuery.conduct;
  const rerender = () => {
    state.offset = 0;
    return renderAdmConduct(body);
  };
  let feed = body.querySelector(".adm-conduct-feed");
  if (!append || !feed) {
    const stats = data.stats;
    const hero = adminNode("section", "adm-conduct-hero");
    hero.appendChild(adminNode("p", "adm-count-line", tf("admConductLead", { limit: stats.limit, n: adminNumber(stats.library) })));
    const kpis = adminNode("div", "adm-log-kpis");
    [
      ["admConductStatWarnings", stats.warnings, "amber"],
      ["admConductStatWeek", stats.week, "violet"],
      ["admConductStatPeople", stats.people, "blue"],
      ["admConductStatBanned", stats.banned, "red"],
    ].forEach(([key, value, tone]) => {
      const box = adminNode("div", `adm-log-kpi tone-${tone}`);
      box.append(adminNode("b", "", adminNumber(value)), adminNode("span", "", t(key)));
      kpis.appendChild(box);
    });
    hero.appendChild(kpis);
    const bar = adminNode("div", "adm-toolbar");
    bar.append(
      admSearch(state, "admConductSearch", rerender),
      admChips(ADM_CONDUCT_FILTERS.map(([value, key]) => [value, t(key), value === "banned" ? stats.banned : stats.warnings]), state.filter, (value) => {
        state.filter = value;
        rerender();
      }),
    );
    const bans = adminNode("section", "adm-conduct-bans");
    bans.appendChild(adminNode("h3", "adm-day", `${t("admConductBans")} · ${adminNumber(data.bans.length)}`));
    if (!data.bans.length) bans.appendChild(adminNode("p", "adm-count-line", t("admConductBansEmpty")));
    data.bans.forEach((ban) => bans.appendChild(admBanRow(ban, body)));
    const parts = [hero, bar];
    if (data.bans.length || state.filter === "banned") parts.push(bans);
    if (state.filter !== "banned") {
      feed = adminNode("section", "adm-conduct-feed");
      feed.appendChild(adminNode("h3", "adm-day", `${t("admConductFeed")} · ${tf("admConductCount", { n: adminNumber(data.total) })}`));
      parts.push(feed);
    }
    body.replaceChildren(...parts);
    if (feed && !data.items.length) {
      const empty = adminNode("div");
      admEmpty(empty, "admConductEmpty", "check");
      feed.appendChild(empty);
    }
  }
  body.querySelector(".load-more")?.remove();
  if (!feed) return;
  data.items.forEach((row) => feed.appendChild(admConductRow(row, data.stats.limit)));
  const more = admMore(state.offset + data.items.length, data.total, () => {
    state.offset += 30;
    renderAdmConduct(body, true);
  });
  if (more) body.appendChild(more);
}

function admConductHead(person, pill) {
  const top = adminNode("div", "adm-user-top");
  const face = avatarNode({ ...person, initial: String(person.name || "•").trim().charAt(0) || "•" });
  const copy = adminNode("div", "adm-user-copy");
  copy.append(adminNode("strong", "", person.name || "—"), adminNode("small", "", [person.position, deptLabel(person.department)].filter(Boolean).join(" · ")));
  top.append(face, copy);
  if (pill) top.appendChild(pill);
  return top;
}

function admBanRow(ban, body) {
  const row = adminNode("article", "adm-card adm-user adm-ban");
  row.appendChild(admConductHead(ban.person, adminNode("span", "adm-status s-banned", t("admPillBanned"))));
  row.appendChild(adminNode("p", "adm-user-seen", tf("admConductBannedAt", { time: timeAgo(ban.at), n: adminNumber(ban.total || ban.count) })));
  const tools = adminNode("div", "adm-tools");
  const lift = admBtn(t("admUnban"), "primary", "unlock");
  lift.addEventListener("click", () => {
    admConfirm(tf("admConfirmUnban", { name: ban.person.name }), t("admUnban"), async () => {
      lift.disabled = true;
      const state = admQuery.conduct;
      const data = await social("admin-unban", { pid: ban.person.pid, q: state.q, filter: state.filter, offset: 0 });
      if (!data || !data.stats) {
        lift.disabled = false;
        return;
      }
      state.offset = 0;
      paintAdmConduct(body, data);
      admRefresh();
    });
  });
  tools.appendChild(lift);
  row.appendChild(tools);
  return row;
}

function admMarkWords(text, words) {
  const box = adminNode("blockquote", "adm-conduct-text");
  const terms = words.filter((word) => word && !/\s/.test(word)).sort((left, right) => right.length - left.length);
  if (!terms.length) {
    box.textContent = text;
    return box;
  }
  const pattern = new RegExp(`(${terms.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  String(text || "").split(pattern).forEach((part, index) => {
    if (!part) return;
    box.appendChild(index % 2 ? adminNode("mark", "", part) : document.createTextNode(part));
  });
  return box;
}

function admConductRow(row, limit) {
  const item = adminNode("article", `adm-card adm-conduct${row.banned ? " is-banned" : ""}`);
  const pill = row.banned
    ? adminNode("span", "adm-status s-banned", t("admPillBanned"))
    : adminNode("span", "adm-status s-review", tf("admConductWarnN", { n: adminNumber(Math.min(row.count, limit)), limit: adminNumber(limit) }));
  item.appendChild(admConductHead(row.person, pill));
  const meta = adminNode("p", "adm-conduct-meta");
  meta.append(adminNode("b", "", t(ADM_CONDUCT_WHERE[row.where] || "admWherePost")), document.createTextNode(` · ${timeAgo(row.at)}`));
  meta.title = fullTime(row.at);
  item.append(meta, admMarkWords(row.text, row.words));
  if (row.words.length) {
    const chips = adminNode("div", "terms-words adm-conduct-words");
    chips.appendChild(adminNode("small", "", t("admConductWords")));
    row.words.forEach((word) => chips.appendChild(adminNode("span", "", word)));
    item.appendChild(chips);
  }
  return item;
}

async function renderAdmAchievements(body) {
  const data = await social("admin-achievements", {});
  if (admTab !== "achievements") return;
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  if (!data.items.length) {
    admEmpty(body, "admNoPendingAch", "achievements");
    return;
  }
  body.replaceChildren(...data.items.map((item) => {
    const card = adminNode("article", "adm-card adm-ach");
    const head = adminNode("div", "adm-card-head");
    head.append(adminNode("span", "adm-status s-dept", deptLabel(item.department) || item.department), adminNode("time", "adm-time", timeAgo(item.createdAt)));
    const tools = adminNode("div", "adm-tools");
    [[true, "achApprove", "primary", "check"], [false, "achReject", "ghost", "close"]].forEach(([approve, key, kind, icon]) => {
      const button = admBtn(t(key), kind, icon);
      button.addEventListener("click", async () => {
        tools.querySelectorAll("button").forEach((node) => { node.disabled = true; });
        const saved = await social("achievement-review", { department: item.department, id: item.id, approve });
        if (saved) {
          renderAdmAchievements(body);
          admRefresh();
        } else tools.querySelectorAll("button").forEach((node) => { node.disabled = false; });
      });
      tools.appendChild(button);
    });
    card.append(
      head,
      adminNode("strong", "adm-card-title", item.title),
      adminNode("p", "adm-card-text", item.text),
      adminNode("p", "adm-who", [item.name, item.position].filter(Boolean).join(" · ")),
      tools,
    );
    return card;
  }));
}

const ADM_JOIN_FIELDS = [
  ["badge", "labelBadge", "password", "numeric", 16],
  ["name", "joinName", "text", "", 80],
  ["department", "joinDept", "text", "", 80],
  ["position", "joinPosition", "text", "", 80],
  ["code", "labelCode", "password", "numeric", 12],
  ["mobile", "labelMobile", "text", "tel", 24],
];

function admAddEmployeeForm(onAdded) {
  const form = adminNode("form", "adm-card adm-join-form");
  form.noValidate = true;
  const toggle = admBtn(t("admAddEmployee"), "ghost", "joins");
  const fields = adminNode("div", "adm-join-fields");
  fields.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    fields.hidden = !fields.hidden;
    toggle.setAttribute("aria-expanded", String(!fields.hidden));
    if (!fields.hidden) fields.querySelector("input").focus();
  });
  const inputs = {};
  fields.appendChild(adminNode("p", "adm-who", t("admAddEmployeeLead")));
  ADM_JOIN_FIELDS.forEach(([key, label, type, mode, max]) => {
    const wrap = adminNode("label", "adm-join-field");
    const input = adminNode("input", "adm-input");
    input.type = type;
    input.maxLength = max;
    input.autocomplete = "off";
    if (mode) input.inputMode = mode;
    if (mode || key === "name") input.dir = "ltr";
    wrap.append(adminNode("span", "", t(label)), input);
    inputs[key] = input;
    fields.appendChild(wrap);
  });
  const error = adminNode("p", "form-error");
  error.setAttribute("role", "alert");
  const done = adminNode("p", "form-ok");
  done.setAttribute("role", "status");
  done.hidden = true;
  const submit = admBtn(t("admAddEmployeeBtn"), "primary", "check");
  submit.type = "submit";
  fields.append(error, done, submit);
  form.append(toggle, fields);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    done.hidden = true;
    submit.disabled = true;
    const payload = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value.trim()]));
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: selectedPerson ? selectedPerson.token : "", action: "admin-add-employee", ...payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        error.textContent = t(data.error === "exists" ? "admEmployeeExists" : JOIN_ERRORS[data.error] || "dashFail");
        return;
      }
      Object.values(inputs).forEach((input) => { input.value = ""; });
      done.textContent = t("admEmployeeAdded");
      done.hidden = false;
      onAdded();
    } catch {
      error.textContent = t("dashFail");
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}

async function renderAdmJoins(body) {
  const data = await social("admin-joins", {});
  if (admTab !== "joins") return;
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  const form = admAddEmployeeForm(() => admRefresh());
  if (!data.requests.length) {
    admEmpty(body, "admNoJoins", "joins");
    body.prepend(form);
    return;
  }
  body.replaceChildren(form, ...data.requests.map((item) => {
    const card = adminNode("article", "adm-card adm-ach");
    const head = adminNode("div", "adm-card-head");
    head.append(adminNode("span", "adm-status s-dept", item.department), adminNode("time", "adm-time", timeAgo(item.createdAt)));
    const tools = adminNode("div", "adm-tools");
    [["approve", "admJoinApprove", "primary", "check"], ["reject", "achReject", "ghost", "close"]].forEach(([decision, key, kind, icon]) => {
      const button = admBtn(t(key), kind, icon);
      button.addEventListener("click", async () => {
        tools.querySelectorAll("button").forEach((node) => { node.disabled = true; });
        const saved = await social("admin-join", { id: item.id, decision });
        if (saved) {
          renderAdmJoins(body);
          admRefresh();
        } else tools.querySelectorAll("button").forEach((node) => { node.disabled = false; });
      });
      tools.appendChild(button);
    });
    const title = adminNode("strong", "adm-card-title", item.name);
    title.dir = "ltr";
    card.append(head, title, adminNode("p", "adm-who", item.position || ""), tools);
    return card;
  }));
}

async function renderAdmSpark(body, preset) {
  const data = preset || await social("admin-spark", {});
  if (admTab !== "spark") return;
  if (!data) {
    adminNotice(body, "dashFail");
    return;
  }
  const current = adminNode("section", "adm-spark-hero");
  const kicker = adminNode("span", "adm-spark-kicker");
  kicker.append(admIcon("spark"), adminNode("span", "", t(data.custom ? "admSparkCustomNow" : "admSparkAutoNow")));
  current.append(kicker, adminNode("p", "adm-spark-q", data.custom ? data.custom.ar : data.auto.ar));
  if (data.custom) current.appendChild(adminNode("p", "adm-spark-was", `${t("admSparkAutoWas")}: ${data.auto.ar}`));
  const form = adminNode("form", "adm-card adm-spark-form");
  form.append(adminNode("strong", "adm-card-title", t("admSparkSet")), adminNode("p", "adm-who", t("admSparkLead")));
  const ar = adminNode("textarea", "adm-input");
  ar.maxLength = 200;
  ar.required = true;
  ar.dir = "rtl";
  ar.placeholder = t("admSparkAr");
  ar.value = data.custom ? data.custom.ar : "";
  const en = adminNode("textarea", "adm-input");
  en.maxLength = 200;
  en.dir = "ltr";
  en.placeholder = t("admSparkEn");
  en.value = data.custom ? data.custom.en : "";
  const tools = adminNode("div", "adm-tools");
  const save = admBtn(t("admSparkSave"), "primary", "check");
  save.type = "submit";
  tools.appendChild(save);
  if (data.custom) {
    const reset = admBtn(t("admSparkReset"), "ghost", "close");
    reset.addEventListener("click", async () => {
      reset.disabled = true;
      const next = await social("admin-spark", { op: "clear" });
      if (next) {
        loadSpark();
        renderAdmSpark(body, next);
      } else reset.disabled = false;
    });
    tools.appendChild(reset);
  }
  form.append(ar, en, tools);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ar.value.trim()) return;
    save.disabled = true;
    const next = await social("admin-spark", { op: "set", ar: ar.value.trim(), en: en.value.trim() });
    if (next) {
      loadSpark();
      renderAdmSpark(body, next);
    } else save.disabled = false;
  });
  body.replaceChildren(current, form);
}

function admDayLabel(date) {
  const day = new Date(date);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (day.toDateString() === today.toDateString()) return t("admToday");
  if (day.toDateString() === yesterday.toDateString()) return t("admYesterday");
  return day.toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
}

async function renderAdmLog(body, append) {
  const state = admQuery.log;
  const data = await social("admin-log", { group: state.group, q: state.q, offset: state.offset, days: state.days });
  if (admTab !== "log") return;
  if (!data || !Array.isArray(data.items)) {
    adminNotice(body, "dashFail");
    return;
  }
  const rerender = () => {
    state.offset = 0;
    return renderAdmLog(body);
  };
  let feed = body.querySelector(".adm-log-feed");
  if (!append || !feed) {
    feed = adminNode("div", "adm-log-feed");
    const head = adminNode("div", "adm-log-top");
    head.append(adminNode("p", "adm-count-line", t("admLogLead")), admPeriod(state, rerender, ADM_LOG_PERIODS));
    const bar = adminNode("div", "adm-toolbar");
    bar.append(
      admSearch(state, "admSearchLog", rerender),
      admChips(ADM_LOG_GROUPS.map(([value, key]) => [value, t(key), data.counts ? data.counts[value] : null]), state.group, (value) => {
        state.group = value;
        rerender();
      }),
      adminNode("p", "adm-count-line", tf("admLogCount", { n: adminNumber(data.total) })),
    );
    body.replaceChildren(head, admLogStats(data.stats), ...(data.stats.logins ? [admLogInsights(data.stats)] : []), bar, feed);
  }
  body.querySelector(".load-more")?.remove();
  if (!data.items.length && !append) admEmpty(feed, "admLogEmpty", "log");
  data.items.forEach((row) => {
    const key = new Date(row.at).toDateString();
    let group = feed.lastElementChild;
    if (!group || group.dataset.day !== key) {
      group = adminNode("section", "adm-log");
      group.dataset.day = key;
      group.appendChild(adminNode("h3", "adm-day", admDayLabel(row.at)));
      feed.appendChild(group);
    }
    group.appendChild(admLogRow(row));
  });
  const more = admMore(state.offset + data.items.length, data.total, () => {
    state.offset += 60;
    renderAdmLog(body, true);
  });
  if (more) body.appendChild(more);
}

function admRing(percent, label) {
  const ring = adminNode("div", "adm-ring");
  const value = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  ring.style.setProperty("--p", String(value));
  ring.append(adminNode("b", "", percent == null ? "—" : `${value}%`), adminNode("small", "", label));
  return ring;
}

function admLogStats(stats) {
  const card = adminNode("section", "adm-log-hero");
  card.appendChild(admRing(stats.successRate, t("admLogSuccessRate")));
  const grid = adminNode("div", "adm-log-kpis");
  [
    ["admLogStatLogins", stats.logins, "green", () => admLogFilter("logins")],
    ["admLogStatFails", stats.fails, "red", () => admLogFilter("failures")],
    ["admLogStatLocks", stats.locks, "amber", () => admLogFilter("failures")],
    ["admLogStatPeople", stats.people, "blue", null],
    ["admLogStatIps", stats.ips, "violet", null],
  ].forEach(([key, value, tone, open]) => {
    const box = adminNode(open ? "button" : "div", `adm-log-kpi tone-${tone}`);
    if (open) {
      box.type = "button";
      box.addEventListener("click", open);
    }
    box.append(adminNode("b", "", adminNumber(value)), adminNode("span", "", t(key)));
    grid.appendChild(box);
  });
  card.appendChild(grid);
  return card;
}

function admLogFilter(group) {
  admQuery.log.group = group;
  admQuery.log.offset = 0;
  renderAdmLog(document.querySelector("#adm-body"));
}

function admLogInsights(stats) {
  const wrap = adminNode("div", "adm-log-insights");
  const hours = dashCard("admLogHours");
  const max = Math.max(1, ...stats.hours);
  const peak = stats.hours.indexOf(Math.max(...stats.hours));
  const chart = adminNode("div", "adm-hours");
  stats.hours.forEach((count, hour) => {
    const col = adminNode("i", hour === peak && count ? "peak" : "");
    col.style.height = `${Math.max(4, (count / max) * 100)}%`;
    col.title = `${String(hour).padStart(2, "0")}:00 · ${adminNumber(count)}`;
    chart.appendChild(col);
  });
  const axis = adminNode("div", "dash-axis adm-hours-axis");
  ["00", "06", "12", "18", "23"].forEach((label) => axis.appendChild(adminNode("span", "", label)));
  hours.append(chart, axis, adminNode("p", "dash-foot", tf("admLogPeak", { time: `${String(peak).padStart(2, "0")}:00` })));

  const devices = dashCard("admLogDevices");
  const total = Math.max(1, stats.kinds.mobile + stats.kinds.tablet + stats.kinds.desktop);
  const split = adminNode("div", "adm-split-bar");
  const legend = adminNode("div", "adm-split-legend");
  [["mobile", "deviceKindMobile"], ["desktop", "deviceKindDesktop"], ["tablet", "deviceKindTablet"]].forEach(([kind, key]) => {
    const count = stats.kinds[kind];
    const share = Math.round((count / total) * 100);
    if (count) {
      const part = adminNode("i", `k-${kind}`);
      part.style.width = `${share}%`;
      split.appendChild(part);
    }
    const item = adminNode("span", `k-${kind}`);
    item.append(adminNode("b", "", `${share}%`), document.createTextNode(` ${t(key)}`));
    legend.appendChild(item);
  });
  devices.append(split, legend, adminNode("p", "dash-foot", tf("admLogAppShare", { n: adminNumber(stats.app), total: adminNumber(stats.logins) })));

  const tops = dashCard("admLogTech");
  const lists = adminNode("div", "adm-tech");
  [["admLogBrowsers", stats.browsers], ["admLogSystems", stats.systems]].forEach(([key, rows]) => {
    const col = adminNode("div", "adm-tech-col");
    col.appendChild(adminNode("h3", "", t(key)));
    const top = Math.max(1, ...rows.map((row) => row.count));
    rows.forEach((row) => {
      const line = adminNode("div", "adm-tech-row");
      const name = row.name === "app" ? t("deviceApp") : row.name === "other" ? t("admLogOther") : row.name;
      const head = adminNode("div", "dash-row-head");
      head.append(adminNode("span", "", name), adminNode("b", "", adminNumber(row.count)));
      const track = adminNode("i", "dash-track");
      const fill = adminNode("u");
      fill.style.width = `${(row.count / top) * 100}%`;
      track.appendChild(fill);
      line.append(head, track);
      col.appendChild(line);
    });
    lists.appendChild(col);
  });
  tops.appendChild(lists);
  wrap.append(hours, devices, tops);
  return wrap;
}

function admLogTime(at) {
  return new Date(at).toLocaleTimeString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

function admLogWho(row) {
  if (row.person) return row.person.name;
  if (row.unknown) return t("admLogUnknown");
  if (row.system) return t("admLogSystem");
  return "—";
}

function admLogChip(icon, text, extra) {
  const chip = adminNode("span", extra ? `adm-log-chip ${extra}` : "adm-log-chip");
  if (icon) chip.appendChild(svgIcon(icon));
  chip.appendChild(adminNode("span", "", text));
  return chip;
}

function admLogRow(row) {
  const tone = ADM_LOG_TONE[row.type] || "gray";
  const person = row.person;
  const device = row.device || null;
  const item = adminNode("article", `adm-log-row tone-${tone}`);
  const head = adminNode("button", "adm-log-head");
  head.type = "button";
  head.setAttribute("aria-expanded", "false");
  const name = admLogWho(row);
  let face;
  if (person) face = avatarNode({ ...person, initial: "•" });
  else {
    face = adminNode("span", "adm-log-face");
    face.appendChild(admIcon(row.system ? "shield" : "users"));
  }
  const badge = adminNode("span", "adm-log-avatar");
  badge.append(face, adminNode("i", "adm-log-dot"));
  const copy = adminNode("span", "adm-log-copy");
  const title = adminNode("span", "adm-log-name");
  title.appendChild(adminNode("strong", "", name));
  if (person && person.official) title.appendChild(officialMark());
  copy.appendChild(title);
  if (person) {
    const role = [person.position, deptLabel(person.department) || person.department].filter(Boolean).join(" · ");
    if (role) copy.appendChild(adminNode("small", "adm-log-role", role));
  }
  const event = adminNode("span", "adm-log-event");
  event.append(adminNode("em", "", ADM_LOG_KEYS[row.type] ? t(ADM_LOG_KEYS[row.type]) : row.type), adminNode("span", `adm-log-result r-${tone}`, t(ADM_LOG_RESULT[tone])));
  copy.appendChild(event);
  const side = adminNode("span", "adm-log-side");
  side.append(adminNode("time", "", admLogTime(row.at)), svgIcon("m7 10 5 5 5-5"));
  head.append(badge, copy, side);

  const chips = adminNode("div", "adm-log-chips");
  if (device && device.kind) {
    const kinds = { mobile: "deviceKindMobile", tablet: "deviceKindTablet", desktop: "deviceKindDesktop" };
    chips.appendChild(admLogChip(DEVICE_ICONS[device.kind] || DEVICE_ICONS.desktop, t(kinds[device.kind] || "deviceKindOther")));
    if (device.os && device.os !== "other") chips.appendChild(admLogChip("", device.os));
    chips.appendChild(admLogChip("", device.app ? t("deviceApp") : device.browser && device.browser !== "other" ? device.browser : t("deviceBrowser"), device.app ? "is-app" : ""));
  }
  if (row.ip) chips.appendChild(admLogChip("", `IP \u2066${row.ip}\u2069`, "is-ip"));

  const more = adminNode("div", "adm-log-more");
  more.hidden = true;
  const facts = adminNode("dl", "adm-log-facts");
  const fact = (key, value) => {
    if (!value) return;
    const cell = adminNode("div");
    cell.append(adminNode("dt", "", t(key)), adminNode("dd", "", value));
    facts.appendChild(cell);
  };
  fact("admLogFName", name);
  if (person) {
    fact("admLogFDept", deptLabel(person.department) || person.department);
    fact("admLogFRole", person.position);
  }
  fact("admLogFEvent", ADM_LOG_KEYS[row.type] ? t(ADM_LOG_KEYS[row.type]) : row.type);
  fact("admLogFResult", t(ADM_LOG_RESULT[tone]));
  fact("admLogFTime", fullTime(row.at));
  if (device && device.kind) {
    fact("admLogFDevice", deviceLabel(device));
    fact("admLogFOs", device.os && device.os !== "other" ? device.os : t("admLogOther"));
    fact("admLogFBrowser", device.browser && device.browser !== "other" ? device.browser : t("admLogOther"));
    fact("admLogFVia", t(device.app ? "admLogViaApp" : "admLogViaWeb"));
  }
  if (row.ip) fact("admLogFIp", `\u2066${row.ip}\u2069`);
  more.appendChild(facts);
  if (person) {
    const pills = adminNode("div", "adm-pills");
    if (person.admin) pills.appendChild(adminNode("span", "adm-status s-admin", t("admPillAdmin")));
    pills.appendChild(adminNode("span", person.registered ? "adm-status s-resolved" : "adm-status s-none", t(person.registered ? "admPillRegistered" : "admPillNotRegistered")));
    if (person.twoFactor) pills.appendChild(adminNode("span", "adm-status s-dept", t("admPill2fa")));
    if (person.email) pills.appendChild(adminNode("span", "adm-status s-dept", t("admPillEmail")));
    if (person.locked) pills.appendChild(adminNode("span", "adm-status s-review", t("admPillLocked")));
    if (person.registered) pills.appendChild(adminNode("span", "adm-status s-none", tf("devicesCount", { n: person.devices || 0 })));
    const go = admBtn(t("admLogOpenUser"), "ghost", "users");
    go.addEventListener("click", () => {
      Object.assign(admQuery.users, { q: person.name, filter: "all", offset: 0 });
      showAdmTab("users");
    });
    const tools = adminNode("div", "adm-tools");
    tools.appendChild(go);
    more.append(pills, tools);
  }
  head.addEventListener("click", () => {
    more.hidden = !more.hidden;
    head.setAttribute("aria-expanded", String(!more.hidden));
    item.classList.toggle("open", !more.hidden);
  });
  item.append(head);
  if (chips.children.length) item.appendChild(chips);
  item.appendChild(more);
  return item;
}
