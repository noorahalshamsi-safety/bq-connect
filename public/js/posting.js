let replyScope = "all";

const REPLY_LABELS = { all: "replyAll", department: "replyDeptLabel", none: "replyNoneLabel" };
const X_EMOJI = ["😀", "😂", "😍", "🥰", "😎", "🤔", "👏", "🙏", "💪", "👍", "👌", "🔥", "🎉", "✨", "❤️", "💡", "✅", "📌", "📢", "🚀", "🏗️", "🦺", "⚙️", "📊", "📅", "☕", "🌟", "🤝", "🇸🇦", "💯"];
const RING_LENGTH = 2 * Math.PI * 10;

function setReplyScope(value) {
  replyScope = REPLY_LABELS[value] ? value : "all";
  const label = document.querySelector("#x-reply-label");
  if (label) {
    label.dataset.i18n = REPLY_LABELS[replyScope];
    label.textContent = t(label.dataset.i18n);
  }
  document.querySelectorAll("#x-reply-menu [data-reply]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.reply === replyScope));
  });
  document.querySelector("#x-reply")?.setAttribute("data-scope", replyScope);
  closeReplyMenu();
}

function closeReplyMenu() {
  const menu = document.querySelector("#x-reply-menu");
  if (menu) menu.hidden = true;
  document.querySelector("#x-reply")?.setAttribute("aria-expanded", "false");
}

document.querySelector("#x-reply").addEventListener("click", (event) => {
  event.stopPropagation();
  const menu = document.querySelector("#x-reply-menu");
  menu.hidden = !menu.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
});

document.querySelectorAll("#x-reply-menu [data-reply]").forEach((button) => {
  button.addEventListener("click", () => setReplyScope(button.dataset.reply));
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#x-reply-menu, #x-reply")) closeReplyMenu();
  if (!event.target.closest("#x-emoji, [data-x='emoji']")) closeEmoji();
});

function closeEmoji() {
  const panel = document.querySelector("#x-emoji");
  if (panel) panel.hidden = true;
  document.querySelector("[data-x='emoji']")?.setAttribute("aria-expanded", "false");
}

function insertAtCaret(input, value) {
  const max = Number(input.maxLength) > 0 ? Number(input.maxLength) : Infinity;
  if (input.value.length + value.length > max) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(value, start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

function paintEmojiPanel() {
  const panel = document.querySelector("#x-emoji");
  if (panel.childElementCount) return;
  X_EMOJI.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    button.textContent = emoji;
    button.addEventListener("click", () => insertAtCaret(ideaInput, emoji));
    panel.appendChild(button);
  });
}

const X_ACTIONS = {
  media: () => document.querySelector("#post-add").click(),
  place: () => document.querySelector('[data-row="place"]').click(),
  tag: () => document.querySelector('[data-row="tag"]').click(),
  project: () => document.querySelector('[data-row="project"]').click(),
  poll: () => switchComposeType(postType === "poll" ? "post" : "poll"),
  emoji: (button) => {
    const panel = document.querySelector("#x-emoji");
    paintEmojiPanel();
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  },
};

document.querySelectorAll("#x-toolbar [data-x]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const action = X_ACTIONS[button.dataset.x];
    if (action) action(button);
  });
});

function paintRing() {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(counter.textContent || "");
  if (!match) return;
  const used = Number(match[1]);
  const max = Number(match[2]) || 1;
  const left = max - used;
  const ring = document.querySelector("#x-ring");
  const fill = document.querySelector("#x-ring-fill");
  fill.style.strokeDasharray = String(RING_LENGTH);
  fill.style.strokeDashoffset = String(RING_LENGTH * (1 - Math.min(used / max, 1)));
  ring.dataset.state = left <= 0 ? "over" : left <= 20 ? "warn" : "";
  ring.classList.toggle("empty", used === 0);
  document.querySelector("#x-ring-left").textContent = left <= 20 ? String(left) : "";
}

new MutationObserver(paintRing).observe(counter, { childList: true, characterData: true, subtree: true });
paintRing();

function paintXAvatar() {
  const avatar = document.querySelector("#x-avatar");
  if (!avatar || !selectedPerson) return;
  paintAvatar(avatar, selectedPerson);
}

new MutationObserver(() => {
  if (!composeDialog.open) return;
  paintXAvatar();
  closeEmoji();
  closeReplyMenu();
}).observe(composeDialog, { attributes: true, attributeFilter: ["open"] });

function textLanguage(text) {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (arabic + latin < 3) return "";
  return arabic >= latin ? "ar" : "en";
}

const translators = new Map();
const TRANSLATE_WAIT = 8000;

function withinTime(promise) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), TRANSLATE_WAIT))]);
}

function translatorFor(from, to) {
  const key = `${from}>${to}`;
  if (!translators.has(key)) {
    const pair = { sourceLanguage: from, targetLanguage: to };
    const ready = self.Translator.availability(pair)
      .then((availability) => (availability === "unavailable" ? null : self.Translator.create(pair)))
      .catch(() => null);
    translators.set(key, ready);
  }
  return translators.get(key);
}

async function browserTranslate(text, from, to) {
  if (!("Translator" in self)) return null;
  const translator = await withinTime(translatorFor(from, to));
  if (!translator) return null;
  return withinTime(translator.translate(text));
}

async function serverTranslate(text, from, to) {
  if (!selectedPerson) return null;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 45000);
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token, text: text.slice(0, 3000), from, to }),
      signal: stop.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.text === "string" && data.text.trim() ? data.text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function webTranslateLink(text, from, to) {
  const link = document.createElement("a");
  link.href = `https://translate.google.com/?sl=${from}&tl=${to}&op=translate&text=${encodeURIComponent(text.slice(0, 4000))}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = t("translateWeb");
  return link;
}

function translateControl(text) {
  const source = String(text || "").trim();
  const from = textLanguage(source);
  if (!from) return null;
  const to = from === lang ? (from === "ar" ? "en" : "ar") : lang;
  const label = to === lang ? t("translatePost") : t(to === "en" ? "translateToEn" : "translateToAr");
  const box = document.createElement("div");
  box.className = "x-translate";
  box.addEventListener("click", (event) => event.stopPropagation());
  const button = document.createElement("button");
  button.type = "button";
  button.className = "x-translate-btn";
  button.textContent = label;
  let output = null;
  button.addEventListener("click", async () => {
    if (output) {
      output.hidden = !output.hidden;
      button.textContent = output.hidden ? label : t("translateHide");
      return;
    }
    button.disabled = true;
    button.textContent = t("translating");
    let result = null;
    try {
      result = (await serverTranslate(source, from, to)) || (await browserTranslate(source, from, to));
    } catch {
      result = null;
    }
    button.disabled = false;
    output = document.createElement("div");
    output.className = "x-translated";
    const note = document.createElement("small");
    if (result) {
      note.textContent = tf("translatedFrom", { from: t(from === "ar" ? "langNameAr" : "langNameEn") });
      const body = document.createElement("p");
      body.dir = "auto";
      body.textContent = result;
      output.append(note, body);
    } else {
      note.textContent = t("translateNoLocal");
      output.append(note, webTranslateLink(source, from, to));
    }
    box.appendChild(output);
    button.textContent = t("translateHide");
  });
  box.appendChild(button);
  return box;
}

function officialMark() {
  const mark = document.createElement("span");
  mark.className = "official-mark";
  mark.title = t("officialAccount");
  mark.setAttribute("aria-label", t("officialAccount"));
  mark.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.2l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.2z"/><path class="tick" d="m8.6 12.2 2.3 2.3 4.6-4.8"/></svg>';
  return mark;
}

const ANNOUNCE_HIDDEN = "bq-announce-hidden";

function pendingAnnouncements() {
  if (!selectedPerson || !Array.isArray(ideas)) return [];
  return ideas
    .filter((idea) => idea.type === "announcement" && !idea.hidden && idea.ack && !idea.ack.mine)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

function paintGlobalAnnounce() {
  const box = document.querySelector("#global-announce");
  const count = document.querySelector("#announce-count");
  const pending = pendingAnnouncements();
  if (count) {
    count.hidden = !pending.length;
    count.textContent = pending.length > 9 ? "9+" : String(pending.length);
  }
  if (!box) return;
  const latest = pending.find((idea) => idea.id !== sessionStorage.getItem(ANNOUNCE_HIDDEN));
  box.hidden = !latest;
  box.replaceChildren();
  if (!latest) return;
  const icon = document.createElement("span");
  icon.className = "global-announce-icon";
  icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10v4H7l10 5V5L7 10z"/><path d="M20.5 10.5v3"/></svg>';
  const copy = document.createElement("div");
  copy.className = "global-announce-copy";
  const tag = document.createElement("small");
  tag.textContent = t("globalAnnounceTag");
  const text = document.createElement("strong");
  text.dir = "auto";
  text.textContent = excerpt(latest.title || latest.text || "", 90);
  copy.append(tag, text);
  const read = document.createElement("button");
  read.type = "button";
  read.className = "global-announce-read";
  read.textContent = t("globalAnnounceRead");
  read.addEventListener("click", () => openThread(latest.id));
  const ack = document.createElement("button");
  ack.type = "button";
  ack.className = "global-announce-ack";
  ack.textContent = t("ackButton");
  ack.addEventListener("click", () => ideaAction(latest.id, "ack"));
  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "global-announce-hide";
  hide.setAttribute("aria-label", t("globalAnnounceHide"));
  hide.textContent = "×";
  hide.addEventListener("click", () => {
    sessionStorage.setItem(ANNOUNCE_HIDDEN, latest.id);
    paintGlobalAnnounce();
  });
  box.append(icon, copy, read, ack, hide);
}

document.querySelector("#reels-add")?.addEventListener("click", () => openStoryCamera());
document.querySelector("#reels-back")?.addEventListener("click", closeReelFocus);
