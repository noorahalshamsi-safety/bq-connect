// Scoped Fresh Install behavior; shared/legacy public assets remain unchanged.
const fs = require("node:fs"), path = require("node:path");
const { need } = require("./config.cjs");
function transform(source) {
  const start = source.indexOf("async function saveIdea(payload) {");
  const end = source.indexOf("\nasync function ", start + 1);
  need(start > 0 && end > start, "fresh_post_client_contract_changed");
  source = source.slice(0, start) + fs.readFileSync(path.join(__dirname, "post-client.txt"), "utf8") +
    source.slice(end);
  const fallback = '    else formError.textContent = t("errFailed");';
  need(source.includes(fallback), "fresh_post_error_contract_changed");
  source = source.replace(fallback,
    '    else formError.textContent = freshPostError(error) || t("errFailed");');
  const mediaFailure = '      const data = xhr.response;';
  need(source.includes(mediaFailure), "fresh_media_error_contract_changed");
  source = source.replace(mediaFailure, mediaFailure + `
      if (data?.error === "media_provider_unconfigured") {
        reject(new Error("post_media")); return;
      }`);
  const uploadError = 'failed = error.message === "big" ?';
  need(source.includes(uploadError), "fresh_media_feedback_contract_changed");
  return source.replace(uploadError, 'failed = freshPostError(error) || (error.message === "big" ?')
    .replace(': t("bqUploadFail");', ': t("bqUploadFail"));');
}
module.exports = { transform };
