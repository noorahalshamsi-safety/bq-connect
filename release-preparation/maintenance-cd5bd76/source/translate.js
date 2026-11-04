const crypto = require("crypto");
const path = require("path");

const MODELS = { "ar>en": "Xenova/opus-mt-ar-en", "en>ar": "Xenova/opus-mt-en-ar" };
const MAX_TEXT = 3000;
const PIECE = 380;
const CACHE_MAX = 600;

// The engine is one serial CPU queue: bound how many requests may wait on it
// and how long a caller waits, so overload fails fast instead of piling up.
const limits = { pending: 6, waitMs: 45000 };

const pipelines = new Map();
const cache = new Map();
let library = null;
let queue = Promise.resolve();
let pending = 0;

function enabled() {
  return process.env.BQ_TRANSLATE !== "0";
}

function loadLibrary() {
  if (!library) {
    library = import("@huggingface/transformers").then((lib) => {
      lib.env.cacheDir = process.env.BQ_MODELS_DIR || path.join(__dirname, "models");
      lib.env.allowLocalModels = false;
      return lib;
    });
    library.catch(() => { library = null; });
  }
  return library;
}

function translatorFor(pair) {
  if (!pipelines.has(pair)) {
    const ready = loadLibrary().then((lib) => lib.pipeline("translation", MODELS[pair], { dtype: "q8" }));
    ready.catch(() => pipelines.delete(pair));
    pipelines.set(pair, ready);
  }
  return pipelines.get(pair);
}

function splitLong(sentence) {
  if (sentence.length <= PIECE) return [sentence];
  const out = [];
  let current = "";
  sentence.split(/\s+/).forEach((word) => {
    if (current && current.length + word.length + 1 > PIECE) {
      out.push(current);
      current = "";
    }
    current = current ? `${current} ${word}` : word.slice(0, PIECE);
  });
  if (current) out.push(current);
  return out;
}

function pieces(text) {
  return text.split(/\n/).map((line) => line
    .split(/(?<=[.!?؟…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap(splitLong));
}

// The OPUS models garble URLs and drop emoji, so these spans are kept verbatim.
const VERBATIM = /(https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u;

function segments(piece) {
  return piece.split(new RegExp(VERBATIM.source, "gu"))
    .filter((part) => part !== "")
    .map((part) => ({ text: part, translate: !VERBATIM.test(part) && /\p{L}/u.test(part) }));
}

const degenerate = (text) => /(\S+)(?:\s+\1){2,}/u.test(text) || /([.،,!؟?])\1{2,}/u.test(text);

async function translateSegment(translator, text) {
  // Padded batches and unbounded generation make the quantized models repeat tokens.
  const limit = Math.min(400, Math.ceil(text.length * 1.5) + 16);
  const attempt = async (options) => {
    const [row] = await translator([text], { max_new_tokens: limit, ...options });
    return String(row && row.translation_text || "").trim();
  };
  const first = await attempt({});
  if (!degenerate(first) || degenerate(text)) return first;
  const second = await attempt({ repetition_penalty: 1.3, no_repeat_ngram_size: 2 });
  return degenerate(second) ? text : second;
}

async function translatePiece(translator, piece) {
  const out = [];
  for (const part of segments(piece)) {
    if (!part.translate) {
      out.push(part.text);
      continue;
    }
    const lead = /^\s/.test(part.text) ? " " : "";
    const trail = /\s$/.test(part.text) ? " " : "";
    out.push(lead + await translateSegment(translator, part.text.trim()) + trail);
  }
  return out.join("").replace(/\s{2,}/g, " ").trim();
}

async function run(pair, text) {
  const translator = await translatorFor(pair);
  const lines = pieces(text);
  if (!lines.flat().length) return "";
  const results = [];
  for (const line of lines) {
    const translated = [];
    for (const piece of line) translated.push(await translatePiece(translator, piece));
    results.push(translated.join(" "));
  }
  return results.join("\n").trim();
}

function translate(text, from, to) {
  const pair = `${from}>${to}`;
  const source = String(text || "").trim();
  if (!MODELS[pair] || !source || source.length > MAX_TEXT) return Promise.resolve("");
  const key = `${pair}:${crypto.createHash("sha256").update(source).digest("base64url")}`;
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit);
  }
  if (pending >= limits.pending) return Promise.resolve("");
  pending += 1;
  const job = queue.then(() => run(pair, source));
  queue = job.catch(() => {});
  // A job that outlives its caller still finishes and fills the cache.
  const done = job.then((result) => {
    if (result) {
      cache.set(key, result);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    return result;
  }).finally(() => { pending -= 1; });
  done.catch(() => {});
  let timer;
  const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(""), limits.waitMs); });
  return Promise.race([done, deadline]).finally(() => clearTimeout(timer));
}

function warm() {
  if (!enabled()) return;
  Object.keys(MODELS).reduce((chain, pair) => chain.then(() => translatorFor(pair)).catch(() => {}), Promise.resolve())
    .catch(() => {});
}

module.exports = { enabled, translate, warm, segments, MAX_TEXT, limits };
