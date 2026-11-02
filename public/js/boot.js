(function () {
  var params = new URLSearchParams(location.search);
  var stored = localStorage.getItem("rd-lang");
  var lang = params.get("lang") === "en" || params.get("lang") === "ar" ? params.get("lang") : stored;
  if (lang !== "en" && lang !== "ar") lang = "ar";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  var theme = localStorage.getItem("bq-theme");
  var dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
