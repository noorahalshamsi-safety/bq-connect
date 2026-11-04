const THEME_KEY = "bq-theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
let installPrompt = null;

function themeChoice() {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "dark" || saved === "system" ? saved : "light";
}

function applyTheme() {
  const choice = themeChoice();
  const dark = choice === "dark" || (choice === "system" && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#000000" : "#ffffff";
  document.querySelectorAll("[data-set-theme]").forEach((button) => {
    button.classList.toggle("active", button.dataset.setTheme === choice);
  });
}

darkQuery.addEventListener("change", applyTheme);
document.querySelectorAll("[data-set-theme]").forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.setItem(THEME_KEY, button.dataset.setTheme);
    applyTheme();
  });
});
applyTheme();

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

const INSTALL_STEPS = {
  android: ["installAnd1", "installAnd2", "installAnd3"],
  ios: ["installIos1", "installIos2", "installIos3"],
};
let installOs = "";

function deviceOs() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "android";
}

function paintInstallSteps() {
  const os = installOs || deviceOs();
  document.querySelectorAll("[data-install-os]").forEach((tab) => {
    const on = tab.dataset.installOs === os;
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-selected", String(on));
  });
  const list = document.querySelector("#install-steps");
  list.replaceChildren(...INSTALL_STEPS[os].map((key) => {
    const item = document.createElement("li");
    item.textContent = t(key);
    return item;
  }));
}

function paintInstall() {
  const button = document.querySelector("#install-btn");
  const note = document.querySelector("#install-note");
  const installed = isStandalone();
  button.hidden = installed || !installPrompt;
  note.hidden = !installed;
  note.textContent = installed ? t("installDone") : "";
  document.querySelector(".install-perks").hidden = installed;
  document.querySelector("#install-guide").hidden = installed || Boolean(installPrompt);
  document.querySelector("#install-https").hidden = installed || window.isSecureContext;
  if (!installed) paintInstallSteps();
}

document.querySelectorAll("[data-install-os]").forEach((tab) => {
  tab.addEventListener("click", () => {
    installOs = tab.dataset.installOs;
    paintInstallSteps();
  });
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  paintInstall();
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  paintInstall();
});

document.querySelector("#install-btn").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try {
    await installPrompt.userChoice;
  } catch {}
  installPrompt = null;
  paintInstall();
});

document.querySelector('[data-settings="install"]').addEventListener("click", paintInstall);

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type !== "open" || typeof data.url !== "string") return;
    const match = data.url.match(/^\/#idea=(.+)$/);
    if (match && selectedPerson) openThread(decodeURIComponent(match[1]));
    else if (selectedPerson) showView("alerts");
  });
}

const PUSH_KEY = "bq-push-key";

function pushSupported() {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function pushKeyBytes(value) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base + "=".repeat((4 - (base.length % 4)) % 4));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function pushCall(op, extra) {
  if (!selectedPerson || !selectedPerson.token) return null;
  const response = await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: selectedPerson.token, op, ...extra }),
  });
  return response.ok ? response.json() : null;
}

async function pushSave(sub, key) {
  const saved = await pushCall("subscribe", { subscription: sub.toJSON(), lang });
  if (saved) localStorage.setItem(PUSH_KEY, key);
  return Boolean(saved);
}

async function paintPush() {
  const box = document.querySelector("#push-cta");
  const button = document.querySelector("#push-btn");
  const note = document.querySelector("#push-note");
  if (!selectedPerson) {
    box.hidden = true;
    return;
  }
  if (!pushSupported()) {
    box.hidden = !(deviceOs() === "ios" && !isStandalone());
    button.hidden = true;
    note.textContent = t("pushIosInstall");
    return;
  }
  if (Notification.permission === "denied") {
    box.hidden = false;
    button.hidden = true;
    note.textContent = t("pushDenied");
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") {
      const data = await pushCall("key", { endpoint: sub.endpoint });
      if (data && localStorage.getItem(PUSH_KEY) !== data.key) await sub.unsubscribe();
      else {
        if (data && !data.active) await pushSave(sub, data.key);
        box.hidden = true;
        return;
      }
    }
  } catch {}
  box.hidden = false;
  button.hidden = false;
  note.textContent = t("pushLead");
}

async function enablePush() {
  const button = document.querySelector("#push-btn");
  const note = document.querySelector("#push-note");
  button.disabled = true;
  try {
    if ((await Notification.requestPermission()) !== "granted") return;
    const data = await pushCall("key", {});
    if (!data || !data.key) throw new Error("no key");
    const registration = await navigator.serviceWorker.ready;
    const sub = (await registration.pushManager.getSubscription()) || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKeyBytes(data.key) }));
    if (!(await pushSave(sub, data.key))) throw new Error("not saved");
  } catch {
    note.textContent = t("pushFail");
    button.disabled = false;
    return;
  }
  button.disabled = false;
  paintPush();
}

function pushForget(person) {
  if (!pushSupported() || !person) return;
  navigator.serviceWorker.getRegistration().then((registration) => registration && registration.pushManager.getSubscription()).then((sub) => {
    if (!sub) return;
    if (person.token) {
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: person.token, op: "unsubscribe", endpoint: sub.endpoint }),
        keepalive: true,
      }).catch(() => {});
    }
    localStorage.removeItem(PUSH_KEY);
    return sub.unsubscribe();
  }).catch(() => {});
}

document.querySelector("#push-btn").addEventListener("click", enablePush);
new MutationObserver(() => {
  if (!document.querySelector("#alerts").hidden) paintPush();
}).observe(document.querySelector("#alerts"), { attributes: true, attributeFilter: ["hidden"] });
