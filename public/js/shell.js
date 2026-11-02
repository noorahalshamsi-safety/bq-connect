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
}
