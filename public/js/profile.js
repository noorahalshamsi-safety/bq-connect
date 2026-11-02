Object.assign(dict.ar, {
  ppPosts: "منشور",
  ppFollowing: "يتابع",
  ppFollowers: "متابِع",
  ppEmpty: "ما نشر شي للحين.",
  ppMissing: "الحساب غير موجود.",
});

Object.assign(dict.en, {
  ppPosts: "Posts",
  ppFollowing: "Following",
  ppFollowers: "Followers",
  ppEmpty: "No posts yet.",
  ppMissing: "This account doesn't exist.",
});

const PROFILE_TILE_COLORS = {
  idea: ["#e10600", "#7a0300"],
  suggestion: ["#0f766e", "#134e4a"],
  complaint: ["#9a3412", "#431407"],
  thanks: ["#b45309", "#78350f"],
  announcement: ["#1d4ed8", "#1e3a8a"],
  event: ["#0e7490", "#164e63"],
  poll: ["#6d28d9", "#3b0764"],
  article: ["#374151", "#111827"],
  post: ["#27272a", "#09090b"],
};

let profileMeta = { highlights: [] };
let profileMetaAt = 0;
let hlArchive = [];
let hlEditing = null;
let hlPicked = [];
let hlCoverId = "";
let editPhoto = "";

function mediaThumb(src) {
  if (isVideoSrc(src)) {
    const video = document.createElement("video");
    video.src = `${src}#t=0.1`;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    return video;
  }
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.src = src;
  return img;
}

function onHold(node, onPress, onLongPress) {
  let timer = 0;
  let held = false;
  node.addEventListener("pointerdown", () => {
    held = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      held = true;
      onLongPress();
    }, 480);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => node.addEventListener(type, () => clearTimeout(timer)));
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (held) return;
    held = true;
    clearTimeout(timer);
    onLongPress();
  });
  node.addEventListener("click", () => {
    if (held) {
      held = false;
      return;
    }
    onPress();
  });
}

async function loadProfileMeta(force) {
  if (!selectedPerson) return;
  if (!force && Date.now() - profileMetaAt < 15000) return;
  profileMetaAt = Date.now();
  const data = await social("profile-meta", {});
  if (!data) return;
  profileMeta = { highlights: data.highlights || [] };
  if (view === "profile") paintProfile();
}

function renderProfile() {
  paintProfile();
  loadProfileMeta(false);
}

function paintProfile() {
  if (!selectedPerson) return;
  const person = selectedPerson;
  document.querySelector("#ig-handle").textContent = person.name;

  const wrap = document.querySelector("#ig-avatar-wrap");
  wrap.replaceChildren();
  const mine = storyPeople().find((row) => row.mine);
  const seen = seenStorySet();
  const ring = document.createElement("button");
  ring.type = "button";
  ring.className = mine ? (mine.items.every((item) => seen.has(item.id)) ? "ig-ring live seen" : "ig-ring live") : "ig-ring";
  ring.setAttribute("aria-label", t(mine ? "bqYourStory" : "bqAddStory"));
  const face = document.createElement("span");
  face.className = "avatar ig-avatar";
  paintAvatar(face, person);
  ring.appendChild(face);
  ring.addEventListener("click", () => {
    if (!mine) {
      openStoryCamera();
      return;
    }
    const next = mine.items.findIndex((item) => !seen.has(item.id));
    openStoryViewer(mine.key, next < 0 ? 0 : next);
  });
  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "ig-plus";
  plus.textContent = "+";
  plus.setAttribute("aria-label", t("bqAddStory"));
  plus.addEventListener("click", () => openStoryCamera());
  wrap.append(ring, plus);

  const counts = document.querySelector("#ig-counts");
  counts.replaceChildren();
  const own = ideas.filter((idea) => idea.mine && idea.type !== "story");
  const ideaCount = own.filter((idea) => !idea.type || idea.type === "idea").length;
  const projectCount = own.filter((idea) => idea.status === "project").length;
  [[ideaCount, "workIdeas"], [own.length - ideaCount, "igPosts"], [projectCount, "workProjects"]].forEach(([value, key]) => {
    const cell = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = Number(value).toLocaleString("en-US");
    const span = document.createElement("span");
    span.textContent = t(key);
    cell.append(strong, span);
    counts.appendChild(cell);
  });

  const bio = document.querySelector("#ig-bio");
  bio.replaceChildren();
  const name = document.createElement("strong");
  name.textContent = person.name;
  bio.appendChild(name);
  if (person.position) {
    const role = document.createElement("span");
    role.className = "ig-role";
    role.textContent = person.position;
    bio.appendChild(role);
  }
  if (deptLabel(person.department)) {
    const dept = document.createElement("span");
    dept.className = "ig-dept";
    dept.textContent = deptLabel(person.department);
    bio.appendChild(dept);
  }
  if (person.bio) {
    const text = document.createElement("p");
    text.textContent = person.bio;
    bio.appendChild(text);
  }
  const points = pointsFor(true);
  const level = document.createElement("button");
  level.type = "button";
  level.className = "ig-level";
  level.appendChild(svgIcon("M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"));
  const levelText = document.createElement("span");
  levelText.textContent = tf("igLevelLine", { badge: t("bqBadge"), n: levelFor(points), pts: points.toLocaleString("en-US") });
  level.appendChild(levelText);
  level.addEventListener("click", () => {
    profileTab = "wins";
    paintProfileTabs();
    paintProfileGrid();
  });
  bio.appendChild(level);

  paintHighlights();
  paintProfileTabs();
  paintProfileGrid();
}

function paintHighlights() {
  const row = document.querySelector("#ig-highlights");
  row.replaceChildren();
  profileMeta.highlights.forEach((highlight) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ig-hl";
    const ring = document.createElement("span");
    ring.className = "ig-hl-ring";
    const cover = document.createElement("span");
    cover.className = "ig-hl-cover";
    if (highlight.cover) cover.appendChild(mediaThumb(highlight.cover));
    ring.appendChild(cover);
    const label = document.createElement("small");
    const title = highlight.title || t("igHighlightDefault");
    label.textContent = title;
    button.append(ring, label);
    onHold(button, () => {
      openStoryDeck({
        key: `hl:${highlight.id}`,
        bits: { name: title, initial: title.charAt(0), cover: highlight.cover },
        items: highlight.items,
      }, 0);
    }, () => openHighlightEditor(highlight));
    row.appendChild(button);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "ig-hl ig-hl-new";
  const ring = document.createElement("span");
  ring.className = "ig-hl-ring";
  const cover = document.createElement("span");
  cover.className = "ig-hl-cover";
  cover.appendChild(svgIcon("M12 5v14M5 12h14"));
  ring.appendChild(cover);
  const label = document.createElement("small");
  label.textContent = t("igNewHighlight");
  add.append(ring, label);
  add.addEventListener("click", () => openHighlightEditor(null));
  row.appendChild(add);
}

function paintProfileTabs() {
  document.querySelectorAll("#ig-tabs [data-profile]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profile === profileTab);
  });
}

function profileItems() {
  if (profileTab === "saved") return ideas.filter((idea) => idea.saved && idea.type !== "story");
  if (profileTab === "reels") return ideas.filter((idea) => idea.mine && isVideoSrc(idea.media));
  const mine = ideas.filter((idea) => idea.mine && idea.type !== "story");
  if (profileTab === "ideas") return mine.filter((idea) => !idea.type || ["idea", "suggestion", "complaint"].includes(idea.type));
  return mine;
}

function profileTile(idea) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "ig-tile";
  const kind = idea.type || "idea";
  if (idea.media) {
    tile.appendChild(mediaThumb(idea.media));
  } else {
    const colors = PROFILE_TILE_COLORS[kind] || PROFILE_TILE_COLORS.post;
    tile.classList.add("text");
    tile.style.background = `linear-gradient(150deg, ${colors[0]}, ${colors[1]})`;
    const text = document.createElement("p");
    text.textContent = idea.title || excerpt(idea.text, 90);
    tile.appendChild(text);
  }
  const marks = {
    idea: "M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.7.5-1.1 1.2-1.2 2.1h-4.6c-.1-.9-.5-1.6-1.2-2.1A6 6 0 0 1 12 3z",
    poll: "M5 19V10M12 19V5M19 19v-7",
  };
  const multi = Array.isArray(idea.gallery) && idea.gallery.length > 1 ? "M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M4 9.5A1.5 1.5 0 0 1 5.5 8h9A1.5 1.5 0 0 1 16 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 18.5z" : "";
  const mark = isVideoSrc(idea.media) ? "M8 5.5v13l10.5-6.5z" : multi || marks[kind];
  if (mark) {
    const badge = document.createElement("span");
    badge.className = isVideoSrc(idea.media) ? "ig-tile-mark solid" : "ig-tile-mark";
    badge.appendChild(svgIcon(mark));
    tile.appendChild(badge);
  }
  tile.setAttribute("aria-label", idea.title || excerpt(idea.text, 60) || t("typePost"));
  tile.addEventListener("click", () => openThread(idea.id));
  return tile;
}

function paintProfileGrid() {
  const grid = document.querySelector("#profile-list");
  grid.replaceChildren();
  grid.classList.toggle("wins", profileTab === "wins");
  if (profileTab === "wins") {
    const points = pointsFor(true);
    const into = points % 300;
    const card = document.createElement("article");
    card.className = "ig-wins";
    const icon = document.createElement("span");
    icon.className = "level-icon";
    icon.appendChild(svgIcon("M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8-4.3-4.1 5.9-.9z"));
    const title = document.createElement("strong");
    title.textContent = t("bqBadge");
    const meta = document.createElement("span");
    meta.textContent = tf("bqLevel", { n: levelFor(points) });
    const track = document.createElement("div");
    track.className = "level-track";
    const bar = document.createElement("i");
    bar.style.width = `${Math.round((into / 300) * 100)}%`;
    track.appendChild(bar);
    const score = document.createElement("small");
    score.textContent = `${into}/300 · ${points.toLocaleString("en-US")} ${t("bqPts")}`;
    card.append(icon, title, meta, track, score);
    grid.appendChild(card);
    return;
  }
  const items = profileItems();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "ig-empty";
    const icons = {
      grid: "M3.5 3.5h17v17h-17zM9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17",
      reels: "M3.5 3.5h17v17h-17zM10.5 9v6l4.5-3z",
      ideas: "M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.7.5-1.1 1.2-1.2 2.1h-4.6c-.1-.9-.5-1.6-1.2-2.1A6 6 0 0 1 12 3z",
      saved: "M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.2L6 20V5.5a1 1 0 0 1 1-1z",
    };
    const icon = document.createElement("span");
    icon.className = "ig-empty-icon";
    icon.appendChild(svgIcon(icons[profileTab] || icons.grid));
    const text = document.createElement("p");
    text.textContent = t({ grid: "igEmptyGrid", reels: "igEmptyReels", ideas: "igEmptyIdeas", saved: "savedEmpty" }[profileTab] || "igEmptyGrid");
    empty.append(icon, text);
    if (profileTab !== "saved") {
      const go = document.createElement("button");
      go.type = "button";
      go.className = "text-btn strong";
      go.textContent = t(profileTab === "reels" ? "bqAddStory" : "bqCreatePost");
      go.addEventListener("click", () => {
        if (profileTab === "reels") openStoryCamera();
        else if (profileTab === "ideas") openCompose({ type: "idea" });
        else openCreateMenu();
      });
      empty.appendChild(go);
    }
    grid.appendChild(empty);
    return;
  }
  items.forEach((idea) => grid.appendChild(profileTile(idea)));
}

function photoData(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = 360;
      canvas.height = 360;
      canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 360, 360);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function paintEditPhoto() {
  const face = document.querySelector("#edit-photo");
  const official = Boolean(selectedPerson && selectedPerson.official);
  paintAvatar(face, { official, photo: editPhoto });
  document.querySelector("#edit-photo-pick").hidden = official;
  document.querySelector("#edit-photo-clear").hidden = official || !editPhoto;
}

function openEditProfile() {
  if (!selectedPerson) return;
  editPhoto = selectedPerson.photo || "";
  paintEditPhoto();
  document.querySelector("#edit-name").value = selectedPerson.name;
  document.querySelector("#edit-role").value = [selectedPerson.position, deptLabel(selectedPerson.department)].filter(Boolean).join(" · ");
  document.querySelector("#edit-bio").value = selectedPerson.bio || "";
  document.querySelector("#edit-profile-error").textContent = "";
  document.querySelector("#edit-profile").showModal();
}

async function shareProfile() {
  if (!selectedPerson) return;
  const text = `${[selectedPerson.name, selectedPerson.position, deptLabel(selectedPerson.department)].filter(Boolean).join(" · ")} | BQ Connect`;
  if (navigator.share) {
    navigator.share({ title: "BQ Connect", text }).catch(() => {});
    return;
  }
  const button = document.querySelector("#ig-share");
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = t("igCopied");
    setTimeout(() => { button.textContent = t("igShareProfile"); }, 1600);
  } catch {}
}

function hlCover() {
  return hlPicked.includes(hlCoverId) ? hlCoverId : hlPicked[0] || "";
}

async function openHighlightEditor(highlight, preselect) {
  if (!selectedPerson) return;
  hlEditing = highlight;
  hlPicked = highlight ? highlight.items.map((item) => item.id) : preselect ? [preselect] : [];
  hlCoverId = highlight ? (highlight.items.find((item) => item.media === highlight.cover) || {}).id || "" : "";
  document.querySelector("#hl-title").value = highlight ? highlight.title : "";
  const heading = document.querySelector("#hl-heading");
  heading.dataset.i18n = highlight ? "igHighlightEdit" : "igHighlightNew";
  heading.textContent = t(heading.dataset.i18n);
  document.querySelector("#hl-delete").hidden = !highlight;
  document.querySelector("#hl-error").textContent = "";
  hlArchive = [];
  paintHighlightEditor(true);
  document.querySelector("#hl-editor").showModal();
  const data = await social("story-archive", {});
  hlArchive = data && Array.isArray(data.stories) ? data.stories : [];
  hlPicked = hlPicked.filter((id) => hlArchive.some((story) => story.id === id));
  paintHighlightEditor(false);
}

function paintHighlightEditor(loading) {
  const grid = document.querySelector("#hl-archive");
  grid.replaceChildren();
  const coverBox = document.querySelector("#hl-cover");
  coverBox.replaceChildren();
  const cover = hlArchive.find((story) => story.id === hlCover());
  if (cover) coverBox.appendChild(mediaThumb(cover.media));
  else coverBox.appendChild(svgIcon("M12 5v14M5 12h14"));
  if (loading) {
    const wait = document.createElement("p");
    wait.className = "hl-empty";
    wait.textContent = t("sending");
    grid.appendChild(wait);
    return;
  }
  if (!hlArchive.length) {
    const empty = document.createElement("div");
    empty.className = "hl-empty";
    const text = document.createElement("p");
    text.textContent = t("igArchiveEmpty");
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn";
    go.textContent = t("bqAddStory");
    go.addEventListener("click", () => {
      document.querySelector("#hl-editor").close();
      openStoryCamera();
    });
    empty.append(text, go);
    grid.appendChild(empty);
    return;
  }
  const coverId = hlCover();
  hlArchive.forEach((story) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "hl-story";
    tile.appendChild(mediaThumb(story.media));
    const order = hlPicked.indexOf(story.id);
    tile.classList.toggle("on", order >= 0);
    const check = document.createElement("b");
    check.className = "hl-check";
    check.textContent = order >= 0 ? String(order + 1) : "";
    const date = document.createElement("small");
    date.className = "hl-date";
    date.textContent = new Date(story.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short" });
    tile.append(check, date);
    if (story.id === coverId) {
      const tag = document.createElement("span");
      tag.className = "hl-cover-tag";
      tag.textContent = t("igCover");
      tile.appendChild(tag);
    }
    onHold(tile, () => {
      if (hlPicked.includes(story.id)) hlPicked = hlPicked.filter((id) => id !== story.id);
      else if (hlPicked.length < 50) hlPicked.push(story.id);
      document.querySelector("#hl-error").textContent = "";
      paintHighlightEditor(false);
    }, () => {
      if (!hlPicked.includes(story.id)) hlPicked.push(story.id);
      hlCoverId = story.id;
      paintHighlightEditor(false);
    });
    grid.appendChild(tile);
  });
}

async function saveHighlight() {
  const error = document.querySelector("#hl-error");
  if (!hlPicked.length) {
    error.textContent = t("igNeedPick");
    return;
  }
  const button = document.querySelector("#hl-save");
  button.disabled = true;
  const data = await social("highlight-save", {
    id: hlEditing ? hlEditing.id : "",
    title: document.querySelector("#hl-title").value.trim(),
    storyIds: hlPicked,
    coverId: hlCover(),
  });
  button.disabled = false;
  if (!data) {
    error.textContent = t("bqUploadFail");
    return;
  }
  profileMeta.highlights = data.highlights || [];
  document.querySelector("#hl-editor").close();
  if (view === "profile") paintProfile();
}

document.querySelector("#ig-edit").addEventListener("click", openEditProfile);
document.querySelector("#ig-share").addEventListener("click", shareProfile);
document.querySelector("#edit-profile-cancel").addEventListener("click", () => document.querySelector("#edit-profile").close());
document.querySelector("#edit-photo-pick").addEventListener("click", () => document.querySelector("#edit-photo-file").click());
document.querySelector("#edit-photo-clear").addEventListener("click", () => {
  editPhoto = "";
  paintEditPhoto();
});
document.querySelector("#edit-photo-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    editPhoto = await photoData(file);
    paintEditPhoto();
  } catch {
    document.querySelector("#edit-profile-error").textContent = t("bqMediaBad");
  }
});
document.querySelector("#edit-profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = await social("profile", { bio: document.querySelector("#edit-bio").value.trim(), photo: editPhoto });
  if (!data || !data.person) {
    document.querySelector("#edit-profile-error").textContent = t("bqUploadFail");
    return;
  }
  selectedPerson = { ...selectedPerson, ...data.person, token: selectedPerson.token };
  document.querySelector("#edit-profile").close();
  renderProfile();
  renderAccount();
});
async function saveSettingsPhoto(photo) {
  const error = document.querySelector("#set-photo-error");
  const pick = document.querySelector("#set-photo-pick");
  error.textContent = "";
  pick.classList.add("is-busy");
  const data = await social("profile", { bio: selectedPerson.bio || "", photo });
  pick.classList.remove("is-busy");
  if (!data || !data.person) {
    error.textContent = t("bqUploadFail");
    return;
  }
  selectedPerson = { ...selectedPerson, ...data.person, token: selectedPerson.token };
  renderAccount();
  if (view === "profile") renderProfile();
  showSettings("account");
}

let personPage = null;

function personPosts(pid) {
  return ideas
    .filter((idea) => idea.type !== "story" && !idea.groupId && ((idea.author && idea.author.pid) || idea.pid) === pid)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

async function openPerson(pid) {
  if (!pid || !selectedPerson) return;
  if (pid === selectedPerson.pid) {
    showView("profile");
    return;
  }
  if (view === "person" && !openId && personPage && personPage.pid === pid) return;
  const from = { view, thread: openId, page: view === "person" ? personPage : null };
  personPage = { pid, person: null, missing: false, from };
  showView("person");
  paintPerson();
  window.scrollTo({ top: 0 });
  const data = await social("person", { pid });
  if (!personPage || personPage.pid !== pid) return;
  if (data && data.person) personPage.person = data.person;
  else personPage.missing = true;
  if (view === "person") paintPerson();
}

function closePerson() {
  const from = personPage ? personPage.from : null;
  if (!from) {
    showView("home");
    return;
  }
  if (from.page) {
    personPage = from.page;
    showView("person");
    paintPerson();
  } else {
    personPage = null;
    showView(from.view === "person" ? "home" : from.view);
  }
  if (from.thread) openThread(from.thread);
}

function personFollow(person) {
  const follow = document.createElement("button");
  follow.type = "button";
  follow.className = person.followed ? "twd-follow on" : "twd-follow";
  follow.textContent = t(person.followed ? "following" : "follow");
  follow.addEventListener("click", async () => {
    follow.disabled = true;
    const data = await social("follow", { pid: person.pid });
    follow.disabled = false;
    if (!data || !personPage || personPage.person !== person) return;
    const followed = Boolean(data.followed);
    if (followed !== person.followed) person.followers = Math.max(0, (person.followers || 0) + (followed ? 1 : -1));
    person.followed = followed;
    paintPerson();
    loadIdeas();
  });
  return follow;
}

function paintPerson() {
  const head = document.querySelector("#person-head");
  const list = document.querySelector("#person-feed");
  head.replaceChildren();
  list.replaceChildren();
  if (!personPage) return;
  const person = personPage.person;
  const posts = personPosts(personPage.pid);
  const known = posts[0] && posts[0].author ? { ...posts[0].author, pid: personPage.pid } : null;
  const shown = person || known;
  document.querySelector("#person-title").textContent = shown ? shown.name : "";
  if (!shown) {
    if (personPage.missing) {
      const missing = document.createElement("p");
      missing.className = "empty";
      missing.textContent = t("ppMissing");
      list.appendChild(missing);
    }
    return;
  }
  const cover = document.createElement("span");
  cover.className = "org-cover pp-cover";
  paintCover(cover, shown.department || shown.name);
  const top = document.createElement("div");
  top.className = "pp-top";
  const face = feedFace({ pid: shown.pid, author: shown }, { ...shown, initial: "•" });
  face.classList.add("pp-face");
  top.appendChild(face);
  if (person && !person.mine) top.appendChild(personFollow(person));
  const name = document.createElement("h2");
  name.className = "pp-name";
  name.textContent = shown.name;
  if (shown.official) name.appendChild(officialMark());
  head.append(cover, top, name);
  const roleText = [shown.position, deptLabel(shown.department)].filter(Boolean).join(" · ");
  if (roleText) {
    const role = document.createElement("p");
    role.className = "pp-role";
    role.textContent = roleText;
    head.appendChild(role);
  }
  if (person && person.bio) {
    const bio = document.createElement("p");
    bio.className = "pp-bio";
    bio.textContent = person.bio;
    head.appendChild(bio);
  }
  const counts = document.createElement("p");
  counts.className = "pp-stats";
  const rows = [[posts.length, "ppPosts"]];
  if (person && !person.official) {
    if (person.following > 0) rows.push([person.following, "ppFollowing"]);
    if (person.followers > 0) rows.push([person.followers, "ppFollowers"]);
  }
  rows.forEach(([value, key]) => {
    const cell = document.createElement("span");
    const strong = document.createElement("b");
    strong.textContent = Number(value || 0).toLocaleString("en-US");
    cell.append(strong, ` ${t(key)}`);
    counts.appendChild(cell);
  });
  head.appendChild(counts);
  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("ppEmpty");
    list.appendChild(empty);
    return;
  }
  posts.forEach((idea) => list.appendChild(feedPost(idea)));
}

document.querySelector("#person-back").addEventListener("click", closePerson);
document.querySelector("#set-photo-pick").addEventListener("click", () => document.querySelector("#set-photo-file").click());
document.querySelector("#set-photo-remove").addEventListener("click", () => saveSettingsPhoto(""));
document.querySelector("#set-photo-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file || !selectedPerson) return;
  try {
    await saveSettingsPhoto(await photoData(file));
  } catch {
    document.querySelector("#set-photo-error").textContent = t("bqMediaBad");
  }
});
document.querySelector("#hl-cancel").addEventListener("click", () => document.querySelector("#hl-editor").close());
document.querySelector("#hl-save").addEventListener("click", saveHighlight);
document.querySelector("#hl-delete").addEventListener("click", async () => {
  if (!hlEditing || !window.confirm(t("igDeleteAsk"))) return;
  const data = await social("highlight-delete", { id: hlEditing.id });
  if (!data) return;
  profileMeta.highlights = data.highlights || [];
  document.querySelector("#hl-editor").close();
  if (view === "profile") paintProfile();
});
let hlResume = null;
document.querySelector("#story-hl").addEventListener("click", (event) => {
  event.stopPropagation();
  const row = viewerRows()[storyGroup];
  const item = row?.items[storyIndex];
  if (!item) return;
  hlResume = storyDeck ? null : { key: row.key, index: storyIndex };
  closeStoryViewer();
  openHighlightEditor(null, item.id);
});
document.querySelector("#hl-editor").addEventListener("close", () => {
  const resume = hlResume;
  hlResume = null;
  if (resume) openStoryViewer(resume.key, resume.index);
});
