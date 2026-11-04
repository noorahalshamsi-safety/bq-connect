Object.assign(dict.ar, {
  pmSave: "حفظ",
  pmSaved: "محفوظ",
  pmSavedToast: "انحفظ في المحفوظات",
  pmUnsavedToast: "انشال من المحفوظات",
  pmCopyText: "نسخ النص",
  pmTextCopied: "تم نسخ النص",
  pmFail: "ما زبطت، جرّب مرة ثانية",
  pmEditPost: "تعديل المنشور",
  pmEditSub: "عدّل النص أو الصور أو المكان",
  pmReplies: "مين يقدر يرد",
  pmRepliesTitle: "مين يقدر يرد؟",
  pmRepliesLead: "اختر مين يقدر يعلّق على منشورك. تقدر تغيّرها بأي وقت.",
  pmRepliesDone: "تم تحديث إعداد الردود",
  pmDeletePost: "حذف المنشور",
  pmDeleteSub: "ينحذف نهائياً مع التعليقات",
  pmAnnounceStory: "أضف الإعلان للقصة",
  pmAnnounceStorySub: "يظهر للجميع في القصص لمدة 24 ساعة",
  pmAnnounceStoryDone: "تمت إضافة الإعلان للقصة",
  pmFollow: "متابعة {name}",
  pmUnfollow: "إلغاء متابعة {name}",
  pmFollowSub: "تطلع لك منشوراته في صفحة المتابَعين",
  pmUnfollowSub: "ما تطلع لك منشوراته في صفحة المتابَعين",
  pmFollowed: "صرت تتابع {name}",
  pmUnfollowed: "ألغيت متابعة {name}",
  pmReportPost: "إبلاغ عن المنشور",
  pmReportSub: "البلاغ سري، وصاحب المنشور ما يعرف مين بلّغ",
  pmHideSub: "يختفي من الصفحة الرئيسية لكل الموظفين",
  pmOpenSub: "افتح المنشور مع التعليقات",
  kindChipsLabel: "نوع المنشور",
  createPostSub: "اكتب واختر من داخله: استطلاع، اقتراح، شكوى، شكر أو مقال",
  createAnnounceGroupSub: "إعلان رسمي أو فعالية لكل الموظفين",
  xPoll: "استطلاع",
});

Object.assign(dict.en, {
  pmSave: "Save",
  pmSaved: "Saved",
  pmSavedToast: "Saved to your collection",
  pmUnsavedToast: "Removed from saved",
  pmCopyText: "Copy text",
  pmTextCopied: "Text copied",
  pmFail: "That didn't work, try again",
  pmEditPost: "Edit post",
  pmEditSub: "Change the text, photos or place",
  pmReplies: "Who can reply",
  pmRepliesTitle: "Who can reply?",
  pmRepliesLead: "Choose who can comment on your post. You can change it any time.",
  pmRepliesDone: "Reply setting updated",
  pmDeletePost: "Delete post",
  pmDeleteSub: "Removed for good, with its comments",
  pmAnnounceStory: "Add to story",
  pmAnnounceStorySub: "Everyone sees it in stories for 24 hours",
  pmAnnounceStoryDone: "Announcement added to your story",
  pmFollow: "Follow {name}",
  pmUnfollow: "Unfollow {name}",
  pmFollowSub: "See their posts in your Following feed",
  pmUnfollowSub: "Stop seeing their posts in Following",
  pmFollowed: "You're following {name}",
  pmUnfollowed: "You unfollowed {name}",
  pmReportPost: "Report post",
  pmReportSub: "Reports are confidential; the author won't know who reported",
  pmHideSub: "Hidden from the home feed for everyone",
  pmOpenSub: "Open the post with its comments",
  kindChipsLabel: "Post type",
  createPostSub: "Write, then pick inside: poll, suggestion, complaint, thanks or article",
  createAnnounceGroupSub: "An official announcement or event for everyone",
  xPoll: "Poll",
});

const TAG_PATTERN = /#([\p{L}\p{M}\p{N}_]{2,40})/gu;
const SHEET_ICONS = {
  hidden: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.2-3.1 3.5M6.6 7.6C4.6 8.9 3.2 10.8 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
};

function normalizeTag(value) {
  return String(value || "").replace(/^#+/, "").replace(/\u0640/g, "").trim().toLowerCase();
}

function tagMatches(text) {
  const value = String(text || "");
  return [...value.matchAll(TAG_PATTERN)].filter((match) => match.index === 0 || /[\s([«"'،,.]/.test(value[match.index - 1]));
}

function ideaTags(idea) {
  return [...new Set(tagMatches(`${idea.title || ""} ${idea.text || ""}`).map((match) => normalizeTag(match[1])))];
}

function fillRichText(node, text) {
  const value = String(text || "");
  node.replaceChildren();
  let last = 0;
  tagMatches(value).forEach((match) => {
    node.appendChild(document.createTextNode(value.slice(last, match.index)));
    const link = document.createElement("button");
    link.type = "button";
    link.className = "tag-link";
    link.textContent = match[0];
    link.addEventListener("click", (event) => {
      event.stopPropagation();
      openTag(match[1]);
    });
    node.appendChild(link);
    last = match.index + match[0].length;
  });
  node.appendChild(document.createTextNode(value.slice(last)));
}

function openTag(tag) {
  openSearch(`#${normalizeTag(tag)}`);
}

function hiddenNote() {
  const note = document.createElement("p");
  note.className = "hidden-note";
  note.append(svgIcon(SHEET_ICONS.hidden), document.createTextNode(t("hiddenOwner")));
  return note;
}

function closeSheet() {
  document.querySelectorAll(".sheet-backdrop, .action-sheet").forEach((node) => node.remove());
  document.removeEventListener("keydown", sheetKeys);
}

function sheetKeys(event) {
  if (event.key === "Escape") closeSheet();
}

function openSheet(heading, lead, options) {
  closeSheet();
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.addEventListener("click", closeSheet);
  const sheet = document.createElement("div");
  sheet.className = "action-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  const grip = document.createElement("i");
  grip.className = "sheet-grip";
  sheet.appendChild(grip);
  if (heading) {
    const title = document.createElement("h3");
    title.textContent = heading;
    sheet.appendChild(title);
  }
  if (lead) {
    const note = document.createElement("p");
    note.textContent = lead;
    sheet.appendChild(note);
  }
  const list = document.createElement("div");
  list.className = "sheet-list";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.label;
    if (option.danger) button.classList.add("danger");
    button.addEventListener("click", () => {
      closeSheet();
      option.run();
    });
    list.appendChild(button);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "sheet-cancel";
  cancel.textContent = t("pmCancel");
  cancel.addEventListener("click", closeSheet);
  sheet.append(list, cancel);
  document.body.append(backdrop, sheet);
  document.addEventListener("keydown", sheetKeys);
  requestAnimationFrame(() => sheet.classList.add("open"));
  const first = list.querySelector("button");
  if (first) first.focus({ preventScroll: true });
}

const CREATE_GROUPS = [
  {
    type: "post",
    label: "typePost",
    sub: "createPostSub",
    tone: "blue",
    icon: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9h8M8 13h8M8 17h5",
    kinds: [
      ["post", "createPlainPost", "createPlainSub", "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8 9h8M8 13h8M8 17h5"],
      ["suggestion", "typeSuggestion", "createSuggestSub", "M4 5h16v11H9l-5 4zM9 10h6"],
      ["complaint", "typeComplaint", "createComplaintSub", "M12 4 2.8 19.5h18.4zM12 10v4M12 17h.01"],
      ["thanks", "typeThanks", "createThanksSub", "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"],
      ["story", "typeStory", "createStorySub", "M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z"],
      ["article", "typeArticle", "createArticleSub", "M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5zM12 6v13.5"],
      ["poll", "bqPoll", "createPollSub", "M5 19V10M12 19V5M19 19v-7"],
    ],
  },
  {
    type: "idea",
    label: "typeIdea",
    sub: "createIdeaSub",
    tone: "amber",
    icon: "M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.7.5-1.1 1.2-1.2 2.1h-4.6c-.1-.9-.5-1.6-1.2-2.1A6 6 0 0 1 12 3z",
  },
  {
    type: "announcement",
    label: "typeAnnouncement",
    sub: "createAnnounceGroupSub",
    tone: "red",
    icon: "M3.5 10v4H7l10 5V5L7 10zM7 14l1.6 5.5h2.6L10 15.3M20.5 10.5v3",
    kinds: [
      ["announcement", "createPlainAnnounce", "createAnnounceSub", "M3.5 10v4H7l10 5V5L7 10zM7 14l1.6 5.5h2.6L10 15.3M20.5 10.5v3"],
      ["event", "typeEvent", "createEventSub", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4M8 14h3"],
    ],
  },
];

function composeKindFor(type) {
  for (const group of CREATE_GROUPS) {
    if (group.type === type && !group.kinds) return { tone: group.tone, icon: group.icon, name: group.label, hint: group.sub };
    const kind = (group.kinds || []).find(([value]) => value === type);
    if (kind) return { tone: group.tone, icon: kind[3], name: type === "post" ? "typePost" : kind[1], hint: kind[2] };
  }
  return null;
}

const COMPOSE_CHIPS = {
  post: ["post", "suggestion", "complaint", "thanks", "article"],
  announcement: ["announcement", "event"],
};

function chipSetFor(type) {
  if (editingId) return null;
  if (COMPOSE_CHIPS.announcement.includes(type)) return COMPOSE_CHIPS.announcement;
  if (selectedPerson && selectedPerson.announcer) return null;
  return type === "poll" || COMPOSE_CHIPS.post.includes(type) ? COMPOSE_CHIPS.post : null;
}

function switchComposeType(type) {
  if (type === postType) return;
  postType = type;
  ideaStep = 1;
  paintPostType();
  (type === "poll" || type === "article" || type === "suggestion" || type === "complaint" ? titleInput : ideaInput).focus();
}

function paintKindChips(box, chips) {
  const row = document.createElement("div");
  row.className = "kind-chips";
  row.setAttribute("role", "radiogroup");
  row.setAttribute("aria-label", t("kindChipsLabel"));
  const active = postType === "poll" ? "post" : postType;
  chips.forEach((type) => {
    const kind = composeKindFor(type);
    if (!kind) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `kind-chip ${kind.tone}`;
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", String(type === active));
    const name = t(type === "announcement" ? "typeAnnouncement" : kind.name);
    chip.setAttribute("aria-label", name);
    chip.title = name;
    const label = document.createElement("span");
    label.textContent = name;
    chip.append(svgIcon(kind.icon), label);
    chip.addEventListener("click", () => switchComposeType(type));
    row.appendChild(chip);
  });
  box.appendChild(row);
  requestAnimationFrame(() => row.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }));
}

function paintComposeKind() {
  const box = document.querySelector("#compose-kind");
  if (!box) return;
  box.replaceChildren();
  const pollTool = document.querySelector("[data-x='poll']");
  const chips = chipSetFor(postType);
  if (pollTool) {
    pollTool.hidden = chips !== COMPOSE_CHIPS.post;
    pollTool.setAttribute("aria-pressed", String(postType === "poll"));
  }
  box.classList.toggle("as-chips", Boolean(chips));
  if (chips) {
    box.hidden = false;
    paintKindChips(box, chips);
    return;
  }
  const kind = composeKindFor(postType);
  box.hidden = !kind;
  if (!kind) return;
  const badge = document.createElement("b");
  badge.className = `create-icon ${kind.tone}`;
  badge.appendChild(svgIcon(kind.icon));
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = t(kind.name);
  const hint = document.createElement("small");
  hint.textContent = t(kind.hint);
  copy.append(name, hint);
  box.append(badge, copy);
  if (!editingId) {
    const change = document.createElement("button");
    change.type = "button";
    change.textContent = t("composeChange");
    change.addEventListener("click", () => {
      composeDialog.close();
      openCreateMenu();
    });
    box.appendChild(change);
  }
}

function openCreateMenu() {
  if (!selectedPerson) {
    showGate();
    return;
  }
  if (selectedPerson.adminAccount) {
    showView("dashboard");
    return;
  }
  closeSheet();
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.addEventListener("click", closeSheet);
  const sheet = document.createElement("div");
  sheet.className = "action-sheet create-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  const grip = document.createElement("i");
  grip.className = "sheet-grip";
  const title = document.createElement("h3");
  title.textContent = t("createTitle");
  sheet.append(grip, title);
  const list = document.createElement("div");
  list.className = "create-list";
  const start = (type) => {
    closeSheet();
    openCompose({ type });
  };
  const official = Boolean(selectedPerson.announcer);
  const allowed = official ? ["announcement", "post"] : ["post", "idea"];
  const groups = CREATE_GROUPS
    .filter((group) => allowed.includes(group.type))
    .map((group) => ({ ...group, sub: official && group.type === "post" ? "createPlainSub" : group.sub, kinds: null }));
  groups.forEach((group) => {
    const item = document.createElement("div");
    item.className = "create-group";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "create-head";
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = t(group.label);
    const sub = document.createElement("small");
    sub.textContent = t(group.sub);
    copy.append(name, sub);
    const chev = document.createElement("i");
    chev.className = "chev";
    const badge = document.createElement("b");
    badge.className = `create-icon ${group.tone}`;
    badge.appendChild(svgIcon(group.icon));
    head.append(badge, copy, chev);
    item.appendChild(head);
    if (group.kinds) {
      head.setAttribute("aria-expanded", "false");
      const kinds = document.createElement("div");
      kinds.className = "create-kinds";
      kinds.hidden = true;
      group.kinds.forEach(([type, key, hint, path]) => {
        const kind = document.createElement("button");
        kind.type = "button";
        const label = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = t(key);
        const small = document.createElement("small");
        small.textContent = t(hint);
        label.append(strong, small);
        kind.append(svgIcon(path), label);
        kind.addEventListener("click", () => start(type));
        kinds.appendChild(kind);
      });
      head.addEventListener("click", () => {
        const open = kinds.hidden;
        list.querySelectorAll(".create-kinds").forEach((node) => { node.hidden = true; });
        list.querySelectorAll(".create-head[aria-expanded]").forEach((node) => node.setAttribute("aria-expanded", "false"));
        kinds.hidden = !open;
        head.setAttribute("aria-expanded", String(open));
      });
      item.appendChild(kinds);
    } else {
      head.addEventListener("click", () => start(group.type));
    }
    list.appendChild(item);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "sheet-cancel";
  cancel.textContent = t("pmCancel");
  cancel.addEventListener("click", closeSheet);
  sheet.append(list, cancel);
  document.body.append(backdrop, sheet);
  document.addEventListener("keydown", sheetKeys);
  requestAnimationFrame(() => sheet.classList.add("open"));
  list.querySelector("button").focus({ preventScroll: true });
}

document.querySelector("#dock-create").addEventListener("click", openCreateMenu);
document.querySelector("#ig-create").addEventListener("click", openCreateMenu);

const MENU_ICONS = {
  link: "M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.6 6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6",
  copy: "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  open: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4",
  follow: "M15 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19 8v6M16 11h6",
  unfollow: "M15 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 11h6",
  report: "M5 21V4M5 4h11l-2 4 2 4H5",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  all: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z",
  department: "M16 19c0-2.5-1.8-4.5-4-4.5S8 16.5 8 19M12 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 18c0-1.8.9-3.3 2.2-4M19 18c0-1.8-.9-3.3-2.2-4",
  none: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

const REPLY_ROWS = [["all", "replyAllShort"], ["department", "replyDept"], ["none", "replyNone"]];

function menuRow(option) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "pm-row";
  if (option.danger) row.classList.add("danger");
  const icon = document.createElement("b");
  icon.className = "pm-ico";
  icon.appendChild(svgIcon(option.icon));
  const copy = document.createElement("span");
  const label = document.createElement("strong");
  label.textContent = option.label;
  copy.appendChild(label);
  if (option.sub) {
    const sub = document.createElement("small");
    sub.textContent = option.sub;
    copy.appendChild(sub);
  }
  row.append(icon, copy);
  if (option.checked != null) {
    row.setAttribute("aria-pressed", String(option.checked));
    const mark = document.createElement("i");
    mark.className = "pm-check";
    if (option.checked) mark.appendChild(svgIcon(MENU_ICONS.check));
    row.appendChild(mark);
  }
  return row;
}

function openMenuSheet({ head, title, lead, tiles = [], groups = [] }) {
  closeSheet();
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  backdrop.addEventListener("click", closeSheet);
  const sheet = document.createElement("div");
  sheet.className = "action-sheet post-menu";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  const grip = document.createElement("i");
  grip.className = "sheet-grip";
  sheet.appendChild(grip);
  if (head) sheet.appendChild(head);
  if (title) {
    const heading = document.createElement("h3");
    heading.textContent = title;
    sheet.appendChild(heading);
  }
  if (lead) {
    const note = document.createElement("p");
    note.textContent = lead;
    sheet.appendChild(note);
  }
  const run = (option) => {
    closeSheet();
    option.run();
  };
  if (tiles.length) {
    const row = document.createElement("div");
    row.className = "pm-tiles";
    tiles.forEach((option) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "pm-tile";
      tile.classList.toggle("on", Boolean(option.on));
      const icon = document.createElement("b");
      icon.appendChild(svgIcon(option.icon));
      const label = document.createElement("span");
      label.textContent = option.label;
      tile.append(icon, label);
      tile.addEventListener("click", () => run(option));
      row.appendChild(tile);
    });
    sheet.appendChild(row);
  }
  groups.filter((group) => group.length).forEach((group) => {
    const box = document.createElement("div");
    box.className = "pm-group";
    group.forEach((option) => {
      const row = menuRow(option);
      row.addEventListener("click", () => run(option));
      box.appendChild(row);
    });
    sheet.appendChild(box);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "sheet-cancel";
  cancel.textContent = t("pmCancel");
  cancel.addEventListener("click", closeSheet);
  sheet.appendChild(cancel);
  document.body.append(backdrop, sheet);
  document.addEventListener("keydown", sheetKeys);
  requestAnimationFrame(() => sheet.classList.add("open"));
  const first = sheet.querySelector(".pm-tile, .pm-row");
  if (first) first.focus({ preventScroll: true });
}

function postMenuHead(idea) {
  const bits = authorBits(idea);
  const head = document.createElement("div");
  head.className = "pm-head";
  const face = avatarNode(idea.mine && selectedPerson ? selectedPerson : bits);
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = bits.name;
  if (idea.author && idea.author.official) name.appendChild(officialMark());
  const meta = document.createElement("small");
  meta.textContent = [typeLabel(idea.type), timeAgo(idea.createdAt)].filter(Boolean).join(" · ");
  copy.append(name, meta);
  const snippet = String(idea.title || idea.text || "").trim();
  if (snippet) {
    const line = document.createElement("em");
    line.textContent = snippet;
    copy.appendChild(line);
  }
  head.append(face, copy);
  return head;
}

async function copyToClipboard(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    feedToast(t(done));
  } catch {
    feedToast(t("pmFail"));
  }
}

async function toggleFollowFrom(idea) {
  const data = await social("follow", { pid: idea.pid });
  if (!data) return;
  feedToast(tf(data.followed ? "pmFollowed" : "pmUnfollowed", { name: authorBits(idea).name }));
  await loadIdeas();
}

async function toggleSaveFrom(idea) {
  const wasSaved = Boolean(idea.saved);
  await toggleSave(idea.id);
  const fresh = ideas.find((item) => item.id === idea.id);
  if (fresh && Boolean(fresh.saved) !== wasSaved) feedToast(t(wasSaved ? "pmUnsavedToast" : "pmSavedToast"));
}

async function setPostReplies(idea, scope) {
  if (scope === (idea.replies || "all")) return;
  try {
    await updateIdea(idea.id, { token: selectedPerson.token, replies: scope });
    renderInbox();
    if (openId) renderThread();
    if (view === "profile") renderProfile();
    feedToast(t("pmRepliesDone"));
  } catch (error) {
    if (error.message === "employee") clearSession();
    else feedToast(t("pmFail"));
  }
}

function openReplySheet(idea) {
  const current = idea.replies || "all";
  openMenuSheet({
    title: t("pmRepliesTitle"),
    lead: t("pmRepliesLead"),
    groups: [REPLY_ROWS.map(([scope, key]) => ({
      icon: MENU_ICONS[scope],
      label: t(key),
      checked: scope === current,
      run: () => setPostReplies(idea, scope),
    }))],
  });
}

function openPostMenu(idea) {
  const link = `${location.origin}${location.pathname}#idea=${encodeURIComponent(idea.id)}`;
  const text = [idea.title, idea.text].filter(Boolean).join("\n");
  const tiles = [
    { icon: ICONS.save, label: t(idea.saved ? "pmSaved" : "pmSave"), on: idea.saved, run: () => toggleSaveFrom(idea) },
    { icon: FEED_ICONS.share, label: t("pmShare"), run: () => feedShare(idea) },
    { icon: MENU_ICONS.link, label: t("pmCopyLink"), run: () => copyToClipboard(link, "fpCopied") },
  ];
  if (text) tiles.push({ icon: MENU_ICONS.copy, label: t("pmCopyText"), run: () => copyToClipboard(text, "pmTextCopied") });

  const main = [];
  const danger = [];
  if (idea.mine) {
    if (!editingId) main.push({ icon: MENU_ICONS.edit, label: t("pmEditPost"), sub: t("pmEditSub"), run: () => editIdea(idea) });
    if (idea.type !== "story") {
      const scope = idea.replies || "all";
      main.push({ icon: MENU_ICONS[scope], label: t("pmReplies"), sub: t(REPLY_LABELS[scope]), run: () => openReplySheet(idea) });
    }
    if (idea.type === "announcement" && selectedPerson && selectedPerson.announcer) {
      main.push({ icon: NOTICE_ICONS.announce, label: t("pmAnnounceStory"), sub: t("pmAnnounceStorySub"), run: () => announceToStory(idea) });
    }
    danger.push({ icon: MENU_ICONS.trash, label: t("pmDeletePost"), sub: t("pmDeleteSub"), danger: true, run: () => removeIdea(idea.id) });
  } else {
    if (idea.pid) {
      main.push({
        icon: idea.followed ? MENU_ICONS.unfollow : MENU_ICONS.follow,
        label: tf(idea.followed ? "pmUnfollow" : "pmFollow", { name: authorBits(idea).name }),
        sub: t(idea.followed ? "pmUnfollowSub" : "pmFollowSub"),
        run: () => toggleFollowFrom(idea),
      });
    }
    danger.push({ icon: MENU_ICONS.report, label: t("pmReportPost"), sub: t("pmReportSub"), danger: true, run: () => openReportSheet(idea) });
    if (selectedPerson && selectedPerson.moderator) {
      danger.push({ icon: SHEET_ICONS.hidden, label: t("pmHide"), sub: t("pmHideSub"), danger: true, run: () => hideFromFeed(idea) });
    }
  }
  if (openId !== idea.id) main.push({ icon: MENU_ICONS.open, label: t("pmOpen"), sub: t("pmOpenSub"), run: () => openThread(idea.id) });
  openMenuSheet({ head: postMenuHead(idea), tiles, groups: [main, danger] });
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function announceStoryImage(idea) {
  const w = 1080;
  const h = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#1d4ed8");
  gradient.addColorStop(1, "#0b1f5c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);
  let top = 260;
  const photo = idea.media && !isVideoSrc(idea.media) ? await loadCanvasImage(idea.media) : null;
  if (photo && photo.naturalWidth) {
    const box = { x: 90, y: 230, w: w - 180, h: 760 };
    const scale = Math.max(box.w / photo.naturalWidth, box.h / photo.naturalHeight);
    const sw = box.w / scale;
    const sh = box.h / scale;
    context.save();
    context.beginPath();
    context.roundRect(box.x, box.y, box.w, box.h, 48);
    context.clip();
    context.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, box.x, box.y, box.w, box.h);
    context.restore();
    top = box.y + box.h + 90;
  }
  const rtl = /[\u0600-\u06FF]/.test(`${idea.title || ""}${idea.text || ""}`);
  context.direction = rtl ? "rtl" : "ltr";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.beginPath();
  context.roundRect(w / 2 - 150, top, 300, 84, 42);
  context.fill();
  context.fillStyle = "#fff";
  context.font = "800 46px Cairo, Outfit, sans-serif";
  context.fillText(t("announceKicker"), w / 2, top + 14);
  top += 140;
  const title = String(idea.title || "").trim();
  if (title) {
    context.font = "800 76px Cairo, Outfit, sans-serif";
    camWrapLines(context, title, w * 0.82).slice(0, 4).forEach((line) => {
      context.fillText(line, w / 2, top);
      top += 104;
    });
    top += 30;
  }
  const body = String(idea.text || "").trim();
  if (body && body !== title) {
    context.font = "600 48px Cairo, Outfit, sans-serif";
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    const room = Math.max(1, Math.floor((h - 260 - top) / 70));
    const lines = camWrapLines(context, body, w * 0.82);
    lines.slice(0, room).forEach((line, index) => {
      context.fillText(index === room - 1 && lines.length > room ? `${line}…` : line, w / 2, top);
      top += 70;
    });
  }
  const logo = await loadCanvasImage("/img/bq-connect.svg");
  if (logo && logo.naturalWidth) {
    const lw = 300;
    const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
    context.drawImage(logo, (w - lw) / 2, h - 140 - lh, lw, lh);
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("render"))), "image/jpeg", 0.9));
}

async function announceToStory(idea) {
  if (!selectedPerson) return;
  feedToast(t("bqUploading"));
  try {
    const media = await uploadMedia(await announceStoryImage(idea));
    await saveIdea({ token: selectedPerson.token, type: "story", title: "", text: "", media, mentions: [], options: [] });
    renderStories();
    feedToast(t("pmAnnounceStoryDone"));
  } catch {
    feedToast(t("bqUploadFail"));
  }
}

function openReportSheet(idea) {
  const reasons = [["spam", "reasonSpam"], ["offensive", "reasonOffensive"], ["false", "reasonFalse"], ["private", "reasonPrivate"], ["other", "reasonOther"]];
  openMenuSheet({
    title: t("reportTitle"),
    lead: t("reportLead"),
    groups: [reasons.map(([reason, key]) => ({ icon: MENU_ICONS.report, label: t(key), run: () => sendReport(idea, reason) }))],
  });
}

async function sendReport(idea, reason) {
  if (!selectedPerson) return;
  try {
    const response = await fetch(`/api/ideas/${encodeURIComponent(idea.id)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token, reason }),
    });
    if (response.status === 401) {
      clearSession();
      return;
    }
    if (!response.ok) throw new Error("report");
    const data = await response.json();
    ideas = data.ideas;
    if (openId === idea.id) closeThread();
    renderInbox();
    feedToast(t("reportThanks"));
  } catch {
    feedToast(t("reportFail"));
  }
}

async function hideFromFeed(idea) {
  const data = await social("mod-action", { id: idea.id, decision: "hide" });
  if (!data) return;
  if (openId === idea.id) closeThread();
  await loadIdeas();
}
