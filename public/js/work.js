const DRAFT_TYPES = new Set(["post", "idea", "announcement", "event", "suggestion", "complaint", "article"]);
const DRAFT_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const SIMILAR_STOP = new Set(["في", "من", "على", "الي", "عن", "مع", "هذا", "هذه", "اللي", "الذي", "التي", "كل", "بدل", "يكون", "عشان", "لان", "لما", "فكره", "نسوي", "ممكن", "the", "and", "for", "with", "that", "this", "from", "idea"]);

let draftType = null;
let draftTimer = null;
let similarTimer = null;

function localInputValue(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad2 = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function draftKey(type) {
  return `bq-draft:${selectedPerson ? selectedPerson.pid : ""}:${type}`;
}

function readDraft(type) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(type)) || "null");
    if (!draft || typeof draft !== "object" || Date.now() - Number(draft.savedAt || 0) > DRAFT_MAX_AGE) return null;
    return draft;
  } catch {
    return null;
  }
}

function clearDraft(type) {
  clearTimeout(draftTimer);
  draftTimer = null;
  localStorage.removeItem(draftKey(type));
}

function collectDraft() {
  return {
    title: titleInput.value,
    text: ideaInput.value,
    problem: problemInput.value,
    impact: impactInput.value,
    pros: readPointRows("pros"),
    cons: readPointRows("cons"),
    place: placeValue(),
    pinned: document.querySelector("#post-place").value,
    project: document.querySelector("#post-project").value,
    eventAt: document.querySelector("#event-at").value,
    eventPlace: document.querySelector("#event-place").value,
    step: ideaStep,
    savedAt: Date.now(),
  };
}

function draftEmpty(draft) {
  const fields = [draft.title, draft.text, draft.problem, draft.impact, draft.project, draft.eventPlace, draft.eventAt];
  return !fields.some((value) => String(value || "").trim()) && !draft.pros.length && !draft.cons.length;
}

function saveDraftNow() {
  clearTimeout(draftTimer);
  draftTimer = null;
  if (!draftType || draftType !== postType || editingId || !selectedPerson) return;
  const draft = collectDraft();
  if (draftEmpty(draft)) localStorage.removeItem(draftKey(draftType));
  else localStorage.setItem(draftKey(draftType), JSON.stringify(draft));
}

function saveDraftSoon() {
  if (!draftType) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftNow, 400);
}

function stopDraft() {
  clearTimeout(draftTimer);
  draftTimer = null;
  draftType = null;
  document.querySelector("#draft-note").hidden = true;
  paintSimilar();
}

function restoreDraft(type, seeded) {
  const note = document.querySelector("#draft-note");
  const eventAt = document.querySelector("#event-at");
  eventAt.min = localInputValue(new Date().toISOString());
  draftType = DRAFT_TYPES.has(type) ? type : null;
  note.hidden = true;
  const draft = draftType && !seeded ? readDraft(type) : null;
  if (draft) {
    titleInput.value = draft.title || "";
    ideaInput.value = draft.text || "";
    problemInput.value = draft.problem || "";
    impactInput.value = draft.impact || "";
    setPointRows("pros", draft.pros || []);
    setPointRows("cons", draft.cons || []);
    setPlaceValue(draft.place || "");
    document.querySelector("#post-place").value = draft.pinned || "";
    const project = document.querySelector("#post-project");
    project.value = draft.project || "";
    project.hidden = !project.value;
    eventAt.value = draft.eventAt || "";
    document.querySelector("#event-place").value = draft.eventPlace || "";
    if (type === "idea") ideaStep = Math.min(4, Math.max(1, Number(draft.step) || 1));
    const max = Number(ideaInput.maxLength) || 1000;
    counter.textContent = `${ideaInput.value.length}/${max}`;
    paintComposeRows();
    paintIdeaStudio();
    note.hidden = false;
  }
  requestAnimationFrame(paintSimilar);
}

form.addEventListener("input", () => {
  saveDraftSoon();
  if (postType === "idea") {
    clearTimeout(similarTimer);
    similarTimer = setTimeout(paintSimilar, 300);
  }
});
form.addEventListener("click", saveDraftSoon);
composeDialog.addEventListener("close", saveDraftNow);
document.querySelector("#draft-discard").addEventListener("click", () => {
  const type = postType;
  clearDraft(type);
  draftType = null;
  composeDialog.close();
  openCompose({ type });
});

function normalizeWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

function wordSet(value) {
  const words = new Set();
  normalizeWords(value).split(" ").forEach((raw) => {
    let word = raw;
    if (word.length > 4) word = word.replace(/^(وال|بال|فال|كال|لل|ال)/, "");
    if (word.length >= 3 && !SIMILAR_STOP.has(word)) words.add(word);
  });
  return words;
}

function similarIdeas() {
  const mine = wordSet(`${titleInput.value} ${ideaInput.value}`);
  if (mine.size < 2) return [];
  return ideas
    .filter((idea) => (!idea.type || idea.type === "idea") && !idea.mine && !idea.hidden)
    .map((idea) => {
      const theirs = wordSet(`${idea.title || ""} ${idea.text || ""} ${idea.problem || ""}`);
      let shared = 0;
      mine.forEach((word) => {
        if (theirs.has(word)) shared += 1;
      });
      return { idea, shared, score: theirs.size ? (2 * shared) / (mine.size + theirs.size) : 0 };
    })
    .filter((row) => row.shared >= 2 && row.score >= 0.18)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((row) => row.idea);
}

function paintSimilar() {
  const box = document.querySelector("#similar-box");
  if (!box) return;
  const active = composeDialog.open && postType === "idea" && ideaStep === 1 && !editingId;
  const list = active ? similarIdeas() : [];
  box.hidden = !list.length;
  box.replaceChildren();
  if (!list.length) return;
  const head = document.createElement("div");
  head.className = "similar-head";
  const title = document.createElement("strong");
  title.textContent = t("similarTitle");
  const lead = document.createElement("small");
  lead.textContent = t("similarLead");
  head.append(title, lead);
  box.appendChild(head);
  list.forEach((idea) => {
    const row = document.createElement("div");
    row.className = "similar-row";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = idea.title || excerpt(idea.text, 60);
    const meta = document.createElement("small");
    meta.textContent = [idea.author && idea.author.department ? deptLabel(idea.author.department) : "", statusLabel(idea.status), `♥ ${idea.rating?.likes || 0}`].filter(Boolean).join(" · ");
    copy.append(name, meta);
    const support = document.createElement("button");
    support.type = "button";
    const supported = idea.rating?.mine === "like";
    support.className = supported ? "on" : "";
    support.textContent = t(supported ? "similarSupported" : "similarSupport");
    support.addEventListener("click", async () => {
      await rateIdea(idea.id, "like");
      paintSimilar();
    });
    const open = document.createElement("button");
    open.type = "button";
    open.className = "ghost";
    open.textContent = t("similarOpen");
    open.addEventListener("click", () => {
      composeDialog.close();
      openThread(idea.id);
    });
    row.append(copy, support, open);
    box.appendChild(row);
  });
}

async function ideaAction(id, action) {
  if (!selectedPerson || !selectedPerson.token) {
    showGate();
    return;
  }
  const response = await fetch(`/api/ideas/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token }),
  });
  if (response.status === 401) {
    clearSession();
    return;
  }
  if (!response.ok) return;
  const data = await response.json();
  ideas = data.ideas;
  stats = data.stats;
  renderInbox();
  paintGlobalAnnounce();
  if (view === "announcements") renderAnnouncements();
  if (openId) renderThread();
}

function announceFooter(idea) {
  const foot = document.createElement("div");
  foot.className = "announce-foot";
  foot.addEventListener("click", (event) => event.stopPropagation());
  if (idea.ack) {
    const ack = document.createElement("button");
    ack.type = "button";
    ack.className = `ack-btn${idea.ack.mine ? " on" : ""}`;
    ack.disabled = idea.ack.mine;
    ack.textContent = t(idea.ack.mine ? "ackDone" : "ackButton");
    ack.addEventListener("click", () => ideaAction(idea.id, "ack"));
    foot.appendChild(ack);
    const count = document.createElement("small");
    count.className = "ack-count";
    if (idea.ack.total) count.textContent = tf("ackCount", { n: idea.ack.count, total: idea.ack.total, p: Math.round((idea.ack.count / idea.ack.total) * 1000) / 10 });
    else if (idea.ack.count) count.textContent = tf("ackCountShort", { n: idea.ack.count });
    if (count.textContent) foot.appendChild(count);
  }
  if (idea.canPin) {
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin-btn";
    pin.textContent = t(idea.pinned ? "unpinAction" : "pinAction");
    pin.addEventListener("click", () => ideaAction(idea.id, "pin"));
    foot.appendChild(pin);
  }
  return foot;
}

function eventBox(idea) {
  const box = document.createElement("div");
  box.className = "event-box";
  box.addEventListener("click", (event) => event.stopPropagation());
  const at = new Date(idea.event.at);
  const valid = !Number.isNaN(at.getTime());
  const locale = lang === "ar" ? "ar-SA" : "en-GB";
  const date = document.createElement("div");
  date.className = "event-date";
  const day = document.createElement("b");
  day.textContent = valid ? at.toLocaleDateString(locale, { day: "numeric" }) : "";
  const month = document.createElement("span");
  month.textContent = valid ? at.toLocaleDateString(locale, { month: "short" }) : "";
  date.append(day, month);
  const info = document.createElement("div");
  info.className = "event-info";
  const when = announceDate(idea.event.at);
  const line = document.createElement("strong");
  line.textContent = [when.day, when.time].filter(Boolean).join(" · ");
  info.appendChild(line);
  const point = geoPoint(idea.place);
  if (point) {
    const link = document.createElement("a");
    link.href = mapUrl(point);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = t("geoOnMap");
    info.appendChild(link);
  } else if (idea.place) {
    const place = document.createElement("span");
    place.textContent = displayPlace(idea.place);
    info.appendChild(place);
  }
  const going = document.createElement("small");
  going.textContent = tf("eventCount", { n: idea.event.going });
  info.appendChild(going);
  box.append(date, info);
  const upcoming = valid && at.getTime() > Date.now();
  const rsvp = document.createElement("button");
  rsvp.type = "button";
  rsvp.className = `rsvp-btn${idea.event.mine ? " on" : ""}`;
  rsvp.disabled = !upcoming;
  rsvp.textContent = !upcoming ? t("eventPast") : t(idea.event.mine ? "eventGoingOn" : "eventGoing");
  rsvp.addEventListener("click", () => ideaAction(idea.id, "rsvp"));
  box.appendChild(rsvp);
  return box;
}

function eventsSection() {
  const now = Date.now();
  const upcoming = ideas
    .filter((idea) => idea.type === "event" && idea.event && Date.parse(idea.event.at) > now)
    .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) || Date.parse(left.event.at) - Date.parse(right.event.at));
  if (!upcoming.length) return null;
  const section = document.createElement("section");
  section.className = "events-section";
  const heading = document.createElement("h2");
  heading.textContent = t("upcomingEvents");
  section.appendChild(heading);
  upcoming.forEach((idea) => {
    const card = document.createElement("article");
    card.className = "event-card tap";
    const title = document.createElement("h3");
    title.textContent = idea.title || "";
    if (idea.pinned) {
      const pin = document.createElement("span");
      pin.className = "announce-pin";
      pin.textContent = t("pinnedTag");
      title.appendChild(pin);
    }
    card.append(title, eventBox(idea));
    if (idea.canPin) {
      const foot = announceFooter(idea);
      if (foot.childElementCount) card.appendChild(foot);
    }
    card.addEventListener("click", () => openThread(idea.id));
    section.appendChild(card);
  });
  return section;
}
