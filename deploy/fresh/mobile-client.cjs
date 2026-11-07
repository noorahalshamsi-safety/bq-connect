const fs = require("node:fs"), path = require("node:path");
const { need } = require("./config.cjs");
function replaceFunction(source, name, next, file) {
  const start = source.indexOf(name), end = source.indexOf(next, start);
  need(start > 0 && end > start, "fresh_mobile_client_contract_changed");
  return source.slice(0, start) + fs.readFileSync(path.join(__dirname, file), "utf8") + "\n" + source.slice(end);
}
function transform(source) {
  source = replaceFunction(source, "async function restoreSession() {", "\nfunction asciiDigits(", "session-client.txt");
  source = replaceFunction(source, "function uploadMedia(blob, onProgress) {", "\nfunction percentStatus(", "media-client.txt");
  const progress = 'target.textContent = tf(key, { n: Math.round(part * 100) });';
  need(source.includes(progress), "fresh_mobile_progress_contract_changed");
  source = source.replace(progress, `target.textContent = key === "bqUploadingPct" && part >= 1
    ? "Upload sent; verifying storage. Not published yet. / أُرسل الملف؛ جارٍ التحقق من الحفظ ولم يُنشر بعد."
    : tf(key, { n: Math.round(part * 100) });`);
  // Never upload an unreadable video whose duration validation silently failed.
  const duration = '  if (seconds > VIDEO_SECONDS + 0.5) return "bqVideoLong";';
  need(source.includes(duration), "fresh_video_duration_contract_changed");
  source = source.replace(duration, `  if (!Number.isFinite(seconds) || seconds <= 0) return "bqMediaBad";\n${duration}`);
  const converted = 'return edited || buffer.byteLength < file.size || file.size > VIDEO_MAX ?';
  need(source.includes(converted), "fresh_video_conversion_contract_changed");
  source = source.replace(converted, 'return edited || file.type === "video/quicktime" || buffer.byteLength < file.size || file.size > VIDEO_MAX ?');
  const boot = `  restoreSession().then((ok) => {
    if (ok) {
      showApp();
      loadIdeas();
    } else {
      showGate();
    }
  });`;
  need(source.includes(boot), "fresh_session_boot_contract_changed");
  source = source.replace(boot, "  freshRestoreOnOpen();");
  const logoutStart = source.indexOf('document.querySelector("#logout").addEventListener("click",');
  const logoutEnd = source.indexOf('\ndocument.querySelector("#drawer-backdrop")', logoutStart);
  need(logoutStart > 0 && logoutEnd > logoutStart, "fresh_logout_contract_changed");
  source = source.slice(0, logoutStart) + `
document.querySelector("#logout").addEventListener("click", async () => {
  closeDrawer();
  if (!selectedPerson?.token) { clearSession(); return; }
  try {
    const response = await freshSessionRequest("/api/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: selectedPerson.token, op: "logout" }),
      cache: "no-store"
    });
    if (!response.ok && response.status !== 401) throw Error("logout_unconfirmed");
    clearSession();
  } catch {
    window.alert("Sign-out could not be confirmed. Reconnect and retry to revoke this session. / لم يتأكد تسجيل الخروج؛ اتصل بالشبكة وأعد المحاولة لإلغاء الجلسة.");
  }
});
` + source.slice(logoutEnd);
  // Keep the prepared Blob and its key after an interrupted transfer. The
  // reference is memory-only and naturally disappears when the page is closed.
  const send = '  return uploadMedia(ready, percentStatus(target, "bqUploadingPct"));';
  need(source.includes(send), "fresh_upload_retry_contract_changed");
  source = source.replace(send, `
  const retry = () => uploadMedia(ready, percentStatus(target, "bqUploadingPct"));
  try { return await retry(); } catch (error) { error.freshRetry = retry; throw error; }`);
  const failed = '  let failed = "";\n  for (const file of files) {';
  need(source.includes(failed), "fresh_upload_batch_contract_changed");
  source = source.replace(failed, '  let failed = "";\n  const failedMedia = [];\n  for (const file of files) {');
  const catchError = '      if (error.message === "employee") break;';
  need(source.includes(catchError), "fresh_upload_retry_error_contract_changed");
  source = source.replace(catchError, catchError + '\n      if (error.freshRetry) failedMedia.push(error.freshRetry);');
  const tail = '  formError.textContent = failed || (capped ? t("bqGalleryMax") : "");';
  need(source.includes(tail), "fresh_upload_feedback_contract_changed");
  source = source.replace(tail, tail + `
  if (failed && failedMedia.length) {
    const retry = document.createElement("button");
    retry.type = "button"; retry.textContent = "Retry same media / إعادة رفع الملف نفسه";
    retry.addEventListener("click", async () => {
      if (mediaBusy) return;
      mediaBusy = true; retry.disabled = true;
      try {
        while (failedMedia.length) {
          const url = await failedMedia[0]();
          if (single || !postMedia || videoRetryIsVideo(url)) { postMedia = url; postExtra = []; }
          else if (!postExtra.includes(url) && postMedia !== url) postExtra.push(url);
          failedMedia.shift();
        }
        paintPostMedia(); formError.textContent = "";
      } catch (error) {
        formError.textContent = freshPostError(error) || "Retry failed; keep this page open. / تعذر الرفع؛ أبقِ الصفحة مفتوحة.";
        formError.appendChild(retry);
      } finally { mediaBusy = false; retry.disabled = false; }
    });
    formError.appendChild(retry);
  }`);
  source += `
window.addEventListener("beforeunload", event => {
  if (mediaBusy) { event.preventDefault(); event.returnValue = ""; }
});
`;
  return source;
}
module.exports = { transform };
