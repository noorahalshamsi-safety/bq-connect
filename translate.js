const crypto = require("crypto");
const path = require("path");

const MODELS = { "ar>en": "Xenova/opus-mt-ar-en", "en>ar": "Xenova/opus-mt-en-ar" };
const MAX_TEXT = 3000;
const PIECE = 380;
const CACHE_MAX = 600;

const pipelines = new Map();
const cache = new Map();
let library = null;
let queue = Promise.resolve();

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

async function run(pair, text) {
  const translator = await translatorFor(pair);
  const lines = pieces(text);
  const flat = lines.flat();
  if (!flat.length) return "";
  const results = [];
  for (let index = 0; index < flat.length; index += 8) {
    const batch = flat.slice(index, index + 8);
    const output = await translator(batch, { max_new_tokens: 400 });
    (Array.isArray(output) ? output : [output]).forEach((row) => results.push(String(row.translation_text || "").trim()));
  }
  let cursor = 0;
  return lines.map((line) => line.map(() => results[cursor++] || "").join(" ")).join("\n").trim();
}

function translate(text, from, to) {
  const pair = `${from}>${to}`;
  const source = String(text || "").trim().slice(0, MAX_TEXT);
  if (!MODELS[pair] || !source) return Promise.resolve("");
  const key = `${pair}:${crypto.createHash("sha256").update(source).digest("base64url")}`;
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit);
  }
  const job = queue.then(() => run(pair, source));
  queue = job.catch(() => {});
  return job.then((result) => {
    if (result) {
      cache.set(key, result);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    return result;
  });
}

function warm() {
  if (!enabled()) return;
  Object.keys(MODELS).reduce((chain, pair) => chain.then(() => translatorFor(pair)).catch(() => {}), Promise.resolve())
    .catch(() => {});
}

module.exports = { enabled, translate, warm, MAX_TEXT };
