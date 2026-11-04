const storyCam = document.querySelector("#story-cam");
const camStage = document.querySelector("#cam-stage");
const camLive = document.querySelector("#cam-live");
const camShot = document.querySelector("#cam-shot");
const camClip = document.querySelector("#cam-clip");
const camShutter = document.querySelector("#cam-shutter");
const camError = document.querySelector("#cam-error");
const camTextInput = document.querySelector("#cam-text-input");
const CAM_RING = 2 * Math.PI * 46;
const CAM_FILTERS = [
  { key: "bqFilterNone", css: "none" },
  { key: "bqFilterWarm", css: "sepia(0.28) saturate(1.35) contrast(1.05)" },
  { key: "bqFilterCool", css: "saturate(1.1) hue-rotate(-14deg) brightness(1.04)" },
  { key: "bqFilterMono", css: "grayscale(1) contrast(1.12)" },
  { key: "bqFilterVivid", css: "saturate(1.7) contrast(1.12)" },
  { key: "bqFilterFade", css: "contrast(0.86) brightness(1.1) saturate(0.75)" },
];
const CAM_GRADIENTS = [
  ["#e10600", "#6e0200"],
  ["#2b2f36", "#0e1014"],
  ["#2563eb", "#7c3aed"],
  ["#f59e0b", "#e11d48"],
  ["#059669", "#0e7490"],
  ["#ec4899", "#8b5cf6"],
];
const CAM_LAYOUTS = {
  4: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  2: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
};

let camSettings = { mirror: true, lines: false, save: false };
try {
  camSettings = { ...camSettings, ...JSON.parse(localStorage.getItem("rd-cam-settings") || "{}") };
} catch {}

let camStream = null;
let camFacing = "environment";
let camFront = false;
let camBlockedKey = "";
let camRecorder = null;
let camPipe = null;
let camDiscard = false;
let camChunks = [];
let camHoldTimer = 0;
let camHolding = false;
let camTick = 0;
let camStarted = 0;
let camBlob = null;
let camEdits = null;
let camUrl = "";
let camSending = false;
let camBusy = false;
let camTool = "";
let camFilter = 0;
let camFilterOpen = false;
let camVideoEdits = false;
let camHands = false;
let camTimer = 0;
let camFlash = false;
let camMode = "story";
let camGradient = 0;
let camLayoutCells = 0;
let camLayoutShots = [];
let camToastTimer = 0;
let camSwipe = null;
let camEditUrl = "";
let camZoom = 1;
let camZoomRange = { min: 1, max: 5, hw: false };
let camZoomFrame = 0;
let camZoomAnim = 0;
let camExposure = 0;
let camExposureRange = null;
let camFocusModes = [];
let camFocusPoint = false;
let camFocusTimer = 0;
let camTapTimer = 0;
let camLastTap = 0;
let camPinch = null;
let camShutterStart = null;
const camPointers = new Map();
const CAM_ZOOM_STOPS = [0.5, 1, 2, 3, 5];

function camWait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function camToast(text) {
  const toast = document.querySelector("#cam-toast");
  clearTimeout(camToastTimer);
  toast.textContent = text;
  toast.hidden = !text;
  if (text) camToastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

const flashTimers = new WeakMap();

function flashLabel(node, text) {
  node.textContent = text;
  node.classList.add("show");
  clearTimeout(flashTimers.get(node));
  flashTimers.set(node, setTimeout(() => node.classList.remove("show"), 900));
}

function filterSwipeStep(dx, dy) {
  if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy) * 1.3) return 0;
  return (dx < 0) !== (document.documentElement.dir === "rtl") ? 1 : -1;
}

function filterChips(selected, onPick) {
  const row = document.createElement("div");
  row.className = "me-chips";
  CAM_FILTERS.forEach((filter, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "me-chip";
    chip.classList.toggle("on", index === selected);
    const swatch = document.createElement("i");
    swatch.style.filter = filter.css === "none" ? "" : filter.css;
    chip.append(swatch, t(filter.key));
    chip.addEventListener("click", () => {
      row.querySelectorAll(".me-chip").forEach((item, at) => item.classList.toggle("on", at === index));
      onPick(index);
    });
    row.append(chip);
  });
  return row;
}

function camSaveMirror() {
  return camFront && camSettings.mirror;
}

function camTrack() {
  return camStream ? camStream.getVideoTracks()[0] : null;
}

function camHasTorch() {
  const track = camTrack();
  try {
    return Boolean(track && track.getCapabilities && track.getCapabilities().torch);
  } catch {
    return false;
  }
}

function camSetTorch(on) {
  const track = camTrack();
  if (!camHasTorch()) return Promise.resolve();
  return track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {});
}

function camCaps() {
  const track = camTrack();
  try {
    return track && track.getCapabilities ? track.getCapabilities() || {} : {};
  } catch {
    return {};
  }
}

function camDigitalZoom() {
  return camZoomRange.hw ? 1 : camZoom;
}

function camLiveFilter(bake = true) {
  const parts = [];
  const css = CAM_FILTERS[camFilter].css;
  if (bake && css !== "none") parts.push(css);
  if (!camExposureRange && camExposure) parts.push(`brightness(${(1 + camExposure * 0.6).toFixed(2)})`);
  return parts.join(" ") || "none";
}

function camPaintLive() {
  const zoom = camDigitalZoom();
  camLive.style.transform = `${camFront ? "scaleX(-1) " : ""}scale(${zoom.toFixed(3)})`;
  camLive.style.filter = camLiveFilter();
}

function camSetupZoom() {
  const caps = camCaps();
  const track = camTrack();
  if (caps.zoom && caps.zoom.max > caps.zoom.min) {
    camZoomRange = { min: caps.zoom.min, max: Math.min(caps.zoom.max, 10), hw: true };
    const settings = track.getSettings ? track.getSettings() : {};
    camZoom = settings.zoom || Math.max(1, caps.zoom.min);
  } else {
    camZoomRange = { min: 1, max: 5, hw: false };
    camZoom = 1;
  }
  const exposure = caps.exposureCompensation;
  camExposureRange = exposure && exposure.max > exposure.min ? exposure : null;
  camExposure = 0;
  camFocusModes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
  camFocusPoint = "pointsOfInterest" in caps;
  document.querySelector("#cam-exposure").value = "0";
  document.querySelector("#cam-focus").hidden = true;
  camPaintLive();
  paintCamZoom();
}

function camApplyZoom(value) {
  camZoom = Math.min(camZoomRange.max, Math.max(camZoomRange.min, value));
  if (camZoomRange.hw) {
    cancelAnimationFrame(camZoomFrame);
    camZoomFrame = requestAnimationFrame(() => {
      const track = camTrack();
      if (track) track.applyConstraints({ advanced: [{ zoom: camZoom }] }).catch(() => {});
    });
  }
  camPaintLive();
  paintCamZoom();
}

function camZoomTo(target) {
  cancelAnimationFrame(camZoomAnim);
  const from = camZoom;
  const started = performance.now();
  const step = (now) => {
    const part = Math.min(1, (now - started) / 220);
    camApplyZoom(from + (target - from) * (1 - (1 - part) * (1 - part)));
    if (part < 1) camZoomAnim = requestAnimationFrame(step);
  };
  camZoomAnim = requestAnimationFrame(step);
}

function camZoomLabel(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}x`;
}

function paintCamZoom() {
  const box = document.querySelector("#cam-zoom");
  const stops = CAM_ZOOM_STOPS.filter((stop) => stop >= camZoomRange.min - 0.01 && stop <= camZoomRange.max + 0.01);
  if (camZoomRange.min < 1 && !stops.includes(camZoomRange.min) && camZoomRange.min > 0.5) stops.unshift(Math.round(camZoomRange.min * 10) / 10);
  const active = stops.reduce((best, stop) => (stop <= camZoom + 0.05 ? stop : best), stops[0]);
  if (box.childElementCount !== stops.length) {
    box.replaceChildren(...stops.map((stop) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.zoom = String(stop);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        camZoomTo(stop);
      });
      return button;
    }));
  }
  box.querySelectorAll("button").forEach((button) => {
    const stop = Number(button.dataset.zoom);
    const on = stop === active;
    button.classList.toggle("on", on);
    button.textContent = on ? camZoomLabel(camZoom) : camZoomLabel(stop).replace("x", "");
  });
  box.hidden = stops.length < 2 || !camStream;
}

function camStagePoint(clientX, clientY) {
  const rect = camStage.getBoundingClientRect();
  const vw = camLive.videoWidth || rect.width;
  const vh = camLive.videoHeight || rect.height;
  const scale = (camFitsFrame() ? Math.min(rect.width / vw, rect.height / vh) : Math.max(rect.width / vw, rect.height / vh)) * camDigitalZoom();
  let x = (clientX - rect.left - rect.width / 2) / (vw * scale) + 0.5;
  const y = (clientY - rect.top - rect.height / 2) / (vh * scale) + 0.5;
  if (camFront) x = 1 - x;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function camFocusAt(clientX, clientY) {
  const focus = document.querySelector("#cam-focus");
  const rect = camStage.getBoundingClientRect();
  focus.style.left = `${clientX - rect.left}px`;
  focus.style.top = `${clientY - rect.top}px`;
  focus.classList.toggle("flip-side", clientX - rect.left > rect.width - 90);
  focus.hidden = false;
  focus.classList.remove("pulse");
  void focus.offsetWidth;
  focus.classList.add("pulse");
  const track = camTrack();
  if (track && (camFocusPoint || camFocusModes.length)) {
    const advanced = {};
    if (camFocusPoint) advanced.pointsOfInterest = [camStagePoint(clientX, clientY)];
    if (camFocusModes.includes("single-shot")) advanced.focusMode = "single-shot";
    else if (camFocusModes.includes("continuous")) advanced.focusMode = "continuous";
    track.applyConstraints({ advanced: [advanced] }).catch(() => {});
  }
  camKeepFocus();
}

function camKeepFocus() {
  clearTimeout(camFocusTimer);
  camFocusTimer = setTimeout(() => {
    document.querySelector("#cam-focus").hidden = true;
  }, 3200);
}

function camSetExposure(value) {
  camExposure = Math.min(1, Math.max(-1, value));
  const track = camTrack();
  if (camExposureRange && track) {
    const range = camExposureRange;
    let target = camExposure >= 0 ? camExposure * range.max : -camExposure * range.min;
    if (range.step) target = Math.round(target / range.step) * range.step;
    track.applyConstraints({ advanced: [{ exposureCompensation: target }] }).catch(() => {});
  }
  camPaintLive();
  camKeepFocus();
}

function camLiveReady() {
  return !storyCam.hidden && document.querySelector("#cam-review").hidden && camTool !== "text" && camStream && !camBusy;
}

function stopCamStream() {
  if (camStream) camStream.getTracks().forEach((track) => track.stop());
  camStream = null;
  camLive.srcObject = null;
  document.querySelector("#cam-zoom").hidden = true;
  document.querySelector("#cam-focus").hidden = true;
}

function paintCamBlocked() {
  const blocked = Boolean(camBlockedKey) && camTool !== "text";
  document.querySelector("#cam-blocked").hidden = !blocked;
  document.querySelector("#cam-blocked-text").textContent = camBlockedKey ? t(camBlockedKey) : "";
  camShutter.disabled = blocked;
  document.querySelector("#cam-flip").disabled = Boolean(camBlockedKey);
}

async function startCamStream() {
  stopCamStream();
  camBlockedKey = "";
  paintCamBlocked();
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    camBlockedKey = "bqCamUnsupported";
    paintCamBlocked();
    return;
  }
  const video = { facingMode: camFacing, width: { ideal: 1920 }, height: { ideal: 1440 }, zoom: true };
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video });
    } catch (error) {
      camBlockedKey = error && error.name === "NotAllowedError" ? "bqCamDenied" : "bqCamMissing";
      paintCamBlocked();
      return;
    }
  }
  if (storyCam.hidden) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }
  camStream = stream;
  const facing = camTrack()?.getSettings().facingMode;
  const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  camFront = facing ? facing === "user" : phone ? camFacing === "user" : true;
  camLive.classList.toggle("mirror", camFront);
  camLive.srcObject = stream;
  camLive.play().catch(() => {});
  camSetupZoom();
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    document.querySelector("#cam-flip").hidden = devices.filter((device) => device.kind === "videoinput").length < 2;
  }).catch(() => {});
}

function camOutputSize(width) {
  const rect = camStage.getBoundingClientRect();
  const ratio = rect.width ? rect.height / rect.width : 16 / 9;
  return { w: width, h: Math.min(Math.round(width * 2.4), Math.round(width * ratio)) };
}

function camFitsFrame() {
  return camTool !== "layout";
}

function camLiveSize(width) {
  const vw = camLive.videoWidth;
  const vh = camLive.videoHeight;
  if (!camFitsFrame() || !vw || !vh) return camOutputSize(width);
  return { w: width, h: Math.min(Math.round(width * 2.4), Math.round((width * vh) / vw)) };
}

function camDrawLive(context, x, y, w, h, mirror, bake) {
  const vw = camLive.videoWidth;
  const vh = camLive.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh) * camDigitalZoom();
  const sw = w / scale;
  const sh = h / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  const filter = camLiveFilter(bake);
  context.save();
  context.filter = filter;
  if (mirror) {
    context.translate(x + w, y);
    context.scale(-1, 1);
    context.drawImage(camLive, sx, sy, sw, sh, 0, 0, w, h);
  } else context.drawImage(camLive, sx, sy, sw, sh, x, y, w, h);
  context.restore();
  canvasFilterFallback(context, filter, x, y, w, h);
}

function camFilterSeed(baked) {
  return camFilter && !baked ? { filter: camFilter } : null;
}

// Safari ignores CanvasRenderingContext2D.filter, so filters are baked in pixel by pixel there.
const CANVAS_FILTER_OK = (() => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    context.filter = "invert(1)";
    context.fillStyle = "#000";
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[0] > 128;
  } catch {
    return false;
  }
})();
const canvasFilterMatrices = new Map();

function saturateMatrix(s) {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0,
  ];
}

function canvasFilterMatrix(css) {
  if (canvasFilterMatrices.has(css)) return canvasFilterMatrices.get(css);
  let matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  const then = (next) => {
    const out = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        let sum = col === 3 ? next[row * 4 + 3] : 0;
        for (let k = 0; k < 3; k += 1) sum += next[row * 4 + k] * matrix[k * 4 + col];
        out.push(sum);
      }
    }
    matrix = out;
  };
  for (const [, name, raw, unit] of css.matchAll(/([a-z-]+)\(\s*(-?[\d.]+)(deg|%)?\s*\)/g)) {
    const v = unit === "%" ? Number(raw) / 100 : Number(raw);
    if (name === "brightness") then([v, 0, 0, 0, 0, v, 0, 0, 0, 0, v, 0]);
    else if (name === "contrast") {
      const o = 127.5 * (1 - v);
      then([v, 0, 0, o, 0, v, 0, o, 0, 0, v, o]);
    } else if (name === "saturate") then(saturateMatrix(v));
    else if (name === "grayscale") then(saturateMatrix(1 - Math.min(1, v)));
    else if (name === "sepia") {
      const s = 1 - Math.min(1, v);
      then([
        0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s, 0,
        0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s, 0,
        0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s, 0,
      ]);
    } else if (name === "hue-rotate") {
      const turn = (v * Math.PI) / 180;
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      then([
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
      ]);
    }
  }
  canvasFilterMatrices.set(css, matrix);
  return matrix;
}

function canvasFilterFallback(context, css, x, y, w, h) {
  if (CANVAS_FILTER_OK || !css || css === "none") return;
  const m = canvasFilterMatrix(css);
  let image;
  try {
    image = context.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  } catch {
    return;
  }
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = m[0] * r + m[1] * g + m[2] * b + m[3];
    d[i + 1] = m[4] * r + m[5] * g + m[6] * b + m[7];
    d[i + 2] = m[8] * r + m[9] * g + m[10] * b + m[11];
  }
  context.putImageData(image, Math.round(x), Math.round(y));
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
}

function camFlashBlink() {
  storyCam.classList.add("blink");
  setTimeout(() => storyCam.classList.remove("blink"), 160);
}

async function camFlashOn() {
  if (!camFlash) return;
  if (camHasTorch()) {
    await camSetTorch(true);
    await camWait(300);
    return;
  }
  storyCam.classList.add("screen-flash");
  await camWait(350);
}

function camFlashOff() {
  if (camHasTorch()) camSetTorch(false);
  storyCam.classList.remove("screen-flash");
}

function paintCamTools() {
  document.querySelectorAll("#cam-tools [data-tool]").forEach((button) => {
    const tool = button.dataset.tool;
    const on = tool === camTool || (tool === "filter" && camFilterOpen) || (tool === "handsfree" && camHands) || (tool === "timer" && camTimer);
    button.classList.toggle("on", on);
  });
  const filters = document.querySelector("#cam-filters");
  filters.hidden = !camFilterOpen;
  filters.querySelectorAll(".me-chip").forEach((chip, at) => chip.classList.toggle("on", at === camFilter));
  camPaintLive();
  const text = camTool === "text";
  document.querySelector("#cam-text").hidden = !text;
  document.querySelector("#cam-text").style.setProperty("--g1", CAM_GRADIENTS[camGradient][0]);
  document.querySelector("#cam-text").style.setProperty("--g2", CAM_GRADIENTS[camGradient][1]);
  storyCam.classList.toggle("text-mode", text);
  document.querySelector("#cam-lines").hidden = !camSettings.lines || text;
  paintCamLayout();
  paintCamBlocked();
}

function paintCamLayout() {
  const box = document.querySelector("#cam-layout");
  box.replaceChildren();
  box.hidden = camTool !== "layout";
  storyCam.classList.toggle("cam-fill", !camFitsFrame());
  camLive.style.left = "";
  camLive.style.top = "";
  camLive.style.width = "";
  camLive.style.height = "";
  if (camTool !== "layout") return;
  const cells = CAM_LAYOUTS[camLayoutCells];
  cells.forEach(([x, y, w, h], index) => {
    const cell = document.createElement("div");
    cell.className = "cam-cell";
    cell.style.left = `${x * 100}%`;
    cell.style.top = `${y * 100}%`;
    cell.style.width = `${w * 100}%`;
    cell.style.height = `${h * 100}%`;
    if (camLayoutShots[index]) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = camLayoutShots[index].toDataURL("image/jpeg", 0.7);
      cell.appendChild(img);
    } else if (index === camLayoutShots.length) {
      cell.classList.add("now");
      camLive.style.left = cell.style.left;
      camLive.style.top = cell.style.top;
      camLive.style.width = cell.style.width;
      camLive.style.height = cell.style.height;
    } else cell.classList.add("empty");
    box.appendChild(cell);
  });
}

function setCamTool(tool) {
  if (camRecorder || camBusy) return;
  if (tool === "layout") {
    if (camTool !== "layout") {
      camTool = "layout";
      camLayoutCells = 4;
    } else if (camLayoutCells === 4) camLayoutCells = 2;
    else camTool = "";
    camLayoutShots = [];
    camToast(camTool === "layout" ? tf("bqLayoutHint", { n: camLayoutCells, i: 1 }) : t("bqToolOff"));
  } else if (tool === "text" || tool === "loop") {
    camTool = camTool === tool ? "" : tool;
    camLayoutShots = [];
    if (camTool === "text") {
      camToast(t("bqTextHint"));
      setTimeout(() => camTextInput.focus(), 50);
    } else camToast(camTool === "loop" ? t("bqLoopHint") : t("bqToolOff"));
  } else if (tool === "filter") {
    camFilterOpen = !camFilterOpen;
    if (camFilterOpen) document.querySelector("#cam-filters").replaceChildren(filterChips(camFilter, camSetFilter));
  } else if (tool === "handsfree") {
    camHands = !camHands;
    camToast(camHands ? t("bqHandsOn") : t("bqToolOff"));
  } else if (tool === "timer") {
    camTimer = camTimer === 0 ? 3 : camTimer === 3 ? 10 : 0;
    camToast(camTimer ? tf("bqTimerOn", { n: camTimer }) : t("bqToolOff"));
  } else if (tool === "more") {
    const open = !storyCam.classList.contains("tools-open");
    storyCam.classList.toggle("tools-open", open);
    document.querySelector("[data-tool=more]").setAttribute("aria-expanded", String(open));
    return;
  }
  paintCamTools();
}

function camSetFilter(index) {
  const count = CAM_FILTERS.length;
  camFilter = ((index % count) + count) % count;
  flashLabel(document.querySelector("#cam-filter-name"), t(CAM_FILTERS[camFilter].key));
  paintCamTools();
}

function paintCamMode() {
  document.querySelectorAll("[data-cam-mode]").forEach((button) => button.classList.toggle("on", button.dataset.camMode === camMode));
  const story = camMode === "story";
  document.querySelector("#cam-caption").hidden = !story;
  document.querySelector("#cam-avatar").hidden = !story;
  const label = document.querySelector("#cam-share-label");
  label.dataset.i18n = story ? "bqYourStory" : "bqCamNext";
  label.textContent = t(label.dataset.i18n);
}

function camCaptureMode() {
  storyCam.classList.remove("reviewing");
  document.querySelector("#cam-review").hidden = true;
  document.querySelector("#cam-capture").hidden = false;
  camLive.hidden = false;
  camShot.hidden = true;
  camClip.hidden = true;
  camError.textContent = "";
}

function camClearReview() {
  camClip.pause();
  camClip.removeAttribute("src");
  camShot.removeAttribute("src");
  if (camUrl) URL.revokeObjectURL(camUrl);
  camUrl = "";
  camBlob = null;
  camEdits = null;
  if (camEditUrl) URL.revokeObjectURL(camEditUrl);
  camEditUrl = "";
  camClip.style.filter = "";
  document.querySelector("#cam-over").hidden = true;
  document.querySelector("#cam-edit").classList.remove("on");
}

async function camPaintEdits() {
  const blob = camBlob;
  const edits = camEdits;
  const video = Boolean(blob && /^video\//.test(blob.type));
  const filter = video ? meFilterCss(edits) : "none";
  camClip.style.filter = filter === "none" ? "" : filter;
  if (camClip.src) camClip.muted = Boolean(edits && edits.mute);
  document.querySelector("#cam-edit").classList.toggle("on", mediaEdited(edits));
  if (video) {
    if (edits && edits.trim && camClip.src) camClip.currentTime = edits.trim.start;
    camPaintOverlay();
    return;
  }
  let shown = camUrl;
  if (blob && mediaEdited(edits)) {
    try {
      const out = await renderPhoto(blob, edits);
      if (camBlob !== blob || camEdits !== edits) return;
      if (camEditUrl) URL.revokeObjectURL(camEditUrl);
      camEditUrl = URL.createObjectURL(out);
      shown = camEditUrl;
    } catch {}
  }
  if (shown && camBlob === blob) camShot.src = shown;
}

function camPaintOverlay() {
  const canvas = document.querySelector("#cam-over");
  const edits = camEdits;
  const show = Boolean(edits && !camClip.hidden && camClip.videoWidth && meHasLayer(edits));
  canvas.hidden = !show;
  if (!show) return;
  const box = camStage.getBoundingClientRect();
  const scale = Math.min(box.width / camClip.videoWidth, box.height / camClip.videoHeight);
  const width = camClip.videoWidth * scale;
  const height = camClip.videoHeight * scale;
  canvas.style.left = `${(box.width - width) / 2}px`;
  canvas.style.top = `${(box.height - height) / 2}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  paintOverlay(context, canvas.width, canvas.height, edits);
}

async function camEditReview(auto) {
  if (!camBlob || camSending) return;
  const first = auto === true;
  const blob = camBlob;
  camClip.pause();
  const edits = await openMediaEditor(blob, camEdits, { doneKey: first ? "bqCamNext" : "meDone" });
  if (camBlob !== blob) return;
  if (edits) {
    camEdits = edits;
    camPaintEdits();
    if (!first && mediaEdited(edits)) camToast(t("meSaved"));
  } else if (first) {
    camClearReview();
    camCaptureMode();
    if (!camStream) startCamStream();
    return;
  }
  if (!camClip.hidden && camClip.src) camClip.play().catch(() => {});
}

function openStoryCamera(mode) {
  if (!selectedPerson) {
    showGate();
    return;
  }
  pauseReels();
  camClearReview();
  camCaptureMode();
  camMode = ["post", "story", "idea"].includes(mode) ? mode : "story";
  camTool = "";
  camFilter = 0;
  camFilterOpen = false;
  camHands = false;
  camTimer = 0;
  camLayoutShots = [];
  camTextInput.value = "";
  storyCam.classList.remove("tools-open");
  storyCam.classList.toggle("cam-rtl", document.documentElement.dir === "rtl");
  videoCompressor().then((kit) => { camVideoEdits = Boolean(kit); });
  document.querySelector("#cam-sheet").hidden = true;
  document.querySelector("#cam-sheet").dir = document.documentElement.dir;
  document.querySelector("#cam-filters").dir = document.documentElement.dir;
  document.querySelector("#cam-toast").dir = document.documentElement.dir;
  document.querySelector("#cam-caption").value = "";
  document.querySelector("#set-mirror").checked = camSettings.mirror;
  document.querySelector("#set-lines").checked = camSettings.lines;
  document.querySelector("#set-save").checked = camSettings.save;
  paintCamMode();
  paintCamTools();
  storyCam.hidden = false;
  startCamStream();
}

function closeStoryCamera() {
  camStopRecording(true);
  camFlashOff();
  stopCamStream();
  camClearReview();
  camBusy = false;
  document.querySelector("#cam-count").hidden = true;
  storyCam.hidden = true;
}

function camShowReview(blob, skipEditor, seed) {
  camClearReview();
  if (seed) camEdits = seed;
  camBlob = blob;
  camUrl = URL.createObjectURL(blob);
  const video = /^video\//.test(blob.type);
  camLive.hidden = true;
  camShot.hidden = video;
  camClip.hidden = !video;
  if (video) {
    camClip.src = camUrl;
    camClip.muted = false;
    camClip.play().catch(() => {
      camClip.muted = true;
      camClip.play().catch(() => {});
    });
  } else {
    camShot.src = camUrl;
    const thumb = document.querySelector("#cam-thumb");
    thumb.src = camUrl;
    thumb.hidden = false;
  }
  storyCam.classList.add("reviewing");
  document.querySelector("#cam-capture").hidden = true;
  document.querySelector("#cam-review").hidden = false;
  document.querySelector("#cam-focus").hidden = true;
  paintAvatar(document.querySelector("#cam-avatar"), selectedPerson);
  camError.textContent = "";
  paintCamMode();
  if (!skipEditor) camEditReview(true);
}

async function camTakePhoto() {
  if (!camLive.videoWidth) return;
  await camFlashOn();
  const { w, h } = camLiveSize(1080);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  camDrawLive(canvas.getContext("2d"), 0, 0, w, h, camSaveMirror(), false);
  const seed = camFilterSeed(false);
  camFlashOff();
  camFlashBlink();
  const blob = await canvasBlob(canvas);
  if (blob) camShowReview(blob, false, seed);
}

async function camLayoutShot() {
  if (!camLive.videoWidth) return;
  const cells = CAM_LAYOUTS[camLayoutCells];
  const { w, h } = camOutputSize(1080);
  const [, , cw, ch] = cells[camLayoutShots.length];
  await camFlashOn();
  const cell = document.createElement("canvas");
  cell.width = Math.round(w * cw);
  cell.height = Math.round(h * ch);
  camDrawLive(cell.getContext("2d"), 0, 0, cell.width, cell.height, camSaveMirror(), false);
  camFlashOff();
  camFlashBlink();
  camLayoutShots.push(cell);
  if (camLayoutShots.length < cells.length) {
    paintCamLayout();
    camToast(tf("bqLayoutHint", { n: camLayoutCells, i: camLayoutShots.length + 1 }));
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, w, h);
  cells.forEach(([x, y, cwRatio, chRatio], index) => {
    const gap = 3;
    context.drawImage(camLayoutShots[index], Math.round(x * w) + gap, Math.round(y * h) + gap, Math.round(cwRatio * w) - gap * 2, Math.round(chRatio * h) - gap * 2);
  });
  camLayoutShots = [];
  paintCamLayout();
  const seed = camFilterSeed(false);
  const blob = await canvasBlob(canvas);
  if (blob) camShowReview(blob, false, seed);
}

function camWrapLines(context, text, maxWidth) {
  const lines = [];
  text.split(/\n/).forEach((paragraph) => {
    let line = "";
    paragraph.split(/\s+/).filter(Boolean).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    });
    lines.push(line);
  });
  return lines;
}

async function camRenderText() {
  const text = camTextInput.value.trim();
  if (!text) {
    camToast(t("bqTextEmpty"));
    camTextInput.focus();
    return;
  }
  const { w, h } = camOutputSize(1080);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, CAM_GRADIENTS[camGradient][0]);
  gradient.addColorStop(1, CAM_GRADIENTS[camGradient][1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, w, h);
  camTextInput.blur();
  const size = text.length > 90 ? 0.06 : text.length > 40 ? 0.072 : ME_STYLE_SIZE.plain;
  const item = { ...meBlankText(), value: text.slice(0, 140), style: "plain", size, y: 0.5 };
  const blob = await canvasBlob(canvas);
  if (blob) camShowReview(blob, false, { texts: [item] });
}

function camRecorderType() {
  if (!window.MediaRecorder) return "";
  return ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    .find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function camStartPipe(bake) {
  const { w, h } = camLiveSize(720);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  let frame = 0;
  const draw = () => {
    camDrawLive(context, 0, 0, w, h, camSaveMirror(), bake);
    frame = requestAnimationFrame(draw);
  };
  draw();
  const stream = canvas.captureStream(30);
  camStream.getAudioTracks().forEach((track) => stream.addTrack(track));
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(frame);
      stream.getVideoTracks().forEach((track) => track.stop());
    },
  };
}

function paintCamClock(limit) {
  const seconds = Math.min(limit, (Date.now() - camStarted) / 1000);
  document.querySelector("#cam-rec-time").textContent = seconds >= 60 ? "1:00" : `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
  document.querySelector("#cam-ring-fill").style.strokeDashoffset = String(CAM_RING * (1 - seconds / limit));
}

function camStartRecording() {
  const type = camRecorderType();
  if (!camStream || !type || !camLive.videoWidth) return false;
  const bake = !camVideoEdits;
  try {
    camPipe = camStartPipe(bake);
    camRecorder = new MediaRecorder(camPipe.stream, { mimeType: type, videoBitsPerSecond: 2500000 });
  } catch {
    if (camPipe) camPipe.stop();
    camPipe = null;
    camRecorder = null;
    return false;
  }
  if (camFlash) camSetTorch(true);
  camChunks = [];
  camDiscard = false;
  camRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size) camChunks.push(event.data);
  };
  camRecorder.onstop = () => {
    const recorder = camRecorder;
    camRecorder = null;
    if (camPipe) camPipe.stop();
    camPipe = null;
    if (camDiscard || !recorder) {
      camChunks = [];
      return;
    }
    const blob = new Blob(camChunks, { type: (recorder.mimeType || type).split(";")[0] });
    camChunks = [];
    if (blob.size) camShowReview(blob, false, camFilterSeed(bake));
  };
  camRecorder.start(250);
  camStarted = Date.now();
  storyCam.classList.add("recording");
  document.querySelector("#cam-rec").hidden = false;
  const tick = () => {
    paintCamClock(VIDEO_SECONDS);
    if ((Date.now() - camStarted) / 1000 >= VIDEO_SECONDS) {
      camStopRecording(false);
      return;
    }
    camTick = setTimeout(tick, 100);
  };
  tick();
  return true;
}

function camStopRecording(discard) {
  clearTimeout(camTick);
  clearTimeout(camHoldTimer);
  storyCam.classList.remove("recording");
  document.querySelector("#cam-rec").hidden = true;
  document.querySelector("#cam-ring-fill").style.strokeDashoffset = String(CAM_RING);
  camSetTorch(false);
  if (camRecorder && camRecorder.state !== "inactive") {
    camDiscard = Boolean(discard);
    camRecorder.stop();
  }
}

async function camRecordLoop() {
  const type = camRecorderType();
  if (!camLive.videoWidth) return;
  if (!type) {
    camTakePhoto();
    return;
  }
  camBusy = true;
  const bake = !camVideoEdits;
  const seed = camFilterSeed(bake);
  const { w, h } = camLiveSize(720);
  const frames = [];
  storyCam.classList.add("recording");
  camStarted = Date.now();
  for (let index = 0; index < 16; index += 1) {
    const frame = document.createElement("canvas");
    frame.width = w;
    frame.height = h;
    camDrawLive(frame.getContext("2d"), 0, 0, w, h, camSaveMirror(), bake);
    frames.push(frame);
    paintCamClock(1.2);
    await camWait(70);
  }
  storyCam.classList.remove("recording");
  document.querySelector("#cam-ring-fill").style.strokeDashoffset = String(CAM_RING);
  camToast(t("bqLoopBusy"));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const context = out.getContext("2d");
  context.drawImage(frames[0], 0, 0);
  const stream = out.captureStream(30);
  const chunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 3000000 });
  } catch {
    camBusy = false;
    return;
  }
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  const sequence = [...frames, ...frames.slice(1, -1).reverse()];
  for (let round = 0; round < 4 && !storyCam.hidden; round += 1) {
    for (const frame of sequence) {
      context.drawImage(frame, 0, 0);
      await camWait(33);
    }
  }
  recorder.stop();
  await done;
  stream.getTracks().forEach((track) => track.stop());
  camBusy = false;
  camToast("");
  if (!storyCam.hidden && chunks.length) camShowReview(new Blob(chunks, { type: type.split(";")[0] }), false, seed);
}

async function camCountdown() {
  const count = document.querySelector("#cam-count");
  camBusy = true;
  count.hidden = false;
  for (let left = camTimer || 3; left > 0 && !storyCam.hidden; left -= 1) {
    count.textContent = String(left);
    await camWait(1000);
  }
  count.hidden = true;
  camBusy = false;
  return !storyCam.hidden;
}

async function camTap() {
  if (camBusy || !document.querySelector("#cam-review").hidden) return;
  if (camTool === "text") {
    camRenderText();
    return;
  }
  if (camRecorder) {
    camStopRecording(false);
    return;
  }
  if (camTimer && !(await camCountdown())) return;
  if (camTool === "loop") camRecordLoop();
  else if (camTool === "layout") camLayoutShot();
  else if (camHands) {
    if (!camStartRecording()) camTakePhoto();
  } else camTakePhoto();
}

function camDownload(blob) {
  const link = document.createElement("a");
  const ext = blob.type === "video/mp4" ? "mp4" : blob.type === "video/webm" ? "webm" : blob.type === "video/quicktime" ? "mov" : "jpg";
  link.href = URL.createObjectURL(blob);
  link.download = `bq-${camMode}-${Date.now()}.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

async function camShare() {
  if (!camBlob || camSending || !selectedPerson) return;
  const share = document.querySelector("#cam-share");
  const blob = camBlob;
  camSending = true;
  share.disabled = true;
  camError.textContent = t("bqUploading");
  try {
    const media = await sendMediaFile(blob, camError, camEdits);
    if (camMode === "story") {
      await saveIdea({
        token: selectedPerson.token,
        type: "story",
        title: "",
        text: document.querySelector("#cam-caption").value.trim(),
        media,
        mentions: [],
        options: [],
      });
    }
    if (camSettings.save) camDownload(blob);
    const mode = camMode;
    closeStoryCamera();
    if (mode === "story") {
      renderStories();
      if (view === "storyboard") renderGrowth();
    } else {
      openCompose({ type: mode });
      postMedia = media;
      paintPostMedia();
      paintIdeaStudio();
    }
  } catch (error) {
    camError.textContent = error.message === "big" ? t("bqVideoBig") : error.message === "offensive" ? t("conductBlocked") : error.message === "edit" ? t("meFailed") : t("bqUploadFail");
  } finally {
    camSending = false;
    share.disabled = false;
  }
}

document.querySelector("#cam-ring-fill").style.strokeDasharray = String(CAM_RING);
document.querySelector("#cam-ring-fill").style.strokeDashoffset = String(CAM_RING);

camShutter.addEventListener("pointerdown", (event) => {
  if (camShutter.disabled || camBusy || event.button > 0) return;
  event.preventDefault();
  if (camShutter.setPointerCapture) camShutter.setPointerCapture(event.pointerId);
  camHolding = false;
  camShutterStart = { y: event.clientY, zoom: camZoom };
  clearTimeout(camHoldTimer);
  if (camTool || camHands || camTimer || camRecorder) return;
  camHoldTimer = setTimeout(() => {
    camHolding = camStartRecording();
  }, 280);
});
camShutter.addEventListener("pointermove", (event) => {
  if (!camShutterStart || !camHolding || !camRecorder) return;
  const rise = camShutterStart.y - event.clientY;
  if (Math.abs(rise) < 12) return;
  cancelAnimationFrame(camZoomAnim);
  camApplyZoom(camShutterStart.zoom * Math.pow(2, (rise - Math.sign(rise) * 12) / 150));
});
camShutter.addEventListener("pointerup", () => {
  camShutterStart = null;
  clearTimeout(camHoldTimer);
  if (camHolding) {
    camHolding = false;
    if (camRecorder) camStopRecording(false);
    return;
  }
  camTap();
});
camShutter.addEventListener("pointercancel", () => {
  clearTimeout(camHoldTimer);
  if (camHolding && camRecorder) camStopRecording(false);
  camHolding = false;
});
camShutter.addEventListener("contextmenu", (event) => event.preventDefault());
camShutter.addEventListener("click", (event) => {
  if (event.detail === 0) camTap();
});

document.querySelectorAll("#cam-tools [data-tool]").forEach((button) => {
  button.addEventListener("click", () => setCamTool(button.dataset.tool));
});
document.querySelectorAll("[data-cam-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    if (camRecorder || camBusy) return;
    camMode = button.dataset.camMode;
    paintCamMode();
  });
});
document.querySelector("#cam-swatch").addEventListener("click", () => {
  camGradient = (camGradient + 1) % CAM_GRADIENTS.length;
  paintCamTools();
  camTextInput.focus();
});
document.querySelector("#cam-flash").addEventListener("click", () => {
  camFlash = !camFlash;
  const button = document.querySelector("#cam-flash");
  button.classList.toggle("on", camFlash);
  button.setAttribute("aria-pressed", String(camFlash));
  if (camFlash && camStream && !camHasTorch()) camToast(t("bqFlashScreen"));
  if (camRecorder) camSetTorch(camFlash);
});
document.querySelector("#cam-gear").addEventListener("click", () => {
  const sheet = document.querySelector("#cam-sheet");
  sheet.hidden = !sheet.hidden;
});
[["#set-mirror", "mirror"], ["#set-lines", "lines"], ["#set-save", "save"]].forEach(([selector, key]) => {
  document.querySelector(selector).addEventListener("change", (event) => {
    camSettings[key] = event.target.checked;
    localStorage.setItem("rd-cam-settings", JSON.stringify(camSettings));
    paintCamTools();
  });
});
document.querySelector("#cam-close").addEventListener("click", () => {
  if (!document.querySelector("#cam-review").hidden) {
    camClearReview();
    camCaptureMode();
    if (!camStream) startCamStream();
    return;
  }
  closeStoryCamera();
});
document.querySelector("#cam-flip").addEventListener("click", () => {
  if (camRecorder || camBusy) return;
  camFacing = camFacing === "user" ? "environment" : "user";
  camLayoutShots = [];
  paintCamLayout();
  startCamStream();
});
document.querySelector("#cam-gallery").addEventListener("click", () => {
  if (camRecorder || camBusy) return;
  const input = document.querySelector("#cam-file");
  input.removeAttribute("capture");
  input.click();
});
document.querySelector("#cam-device").addEventListener("click", () => {
  const input = document.querySelector("#cam-file");
  input.setAttribute("capture", camFacing);
  input.click();
});
document.querySelector("#cam-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  event.target.removeAttribute("capture");
  if (!file) return;
  const problem = await mediaFileError(file);
  let edits = null;
  if (problem === "bqVideoLong" && (await videoCompressor())) {
    edits = await openMediaEditor(file);
    if (!edits) return;
  } else if (problem) {
    camToast(t(problem));
    return;
  }
  camShowReview(file, Boolean(edits));
  if (edits) {
    camEdits = edits;
    camPaintEdits();
  }
});
camClip.addEventListener("loadedmetadata", camPaintOverlay);
camClip.addEventListener("timeupdate", () => {
  const trim = camEdits && camEdits.trim;
  if (trim && (camClip.currentTime >= trim.end || camClip.currentTime < trim.start - 0.3)) camClip.currentTime = trim.start;
});
window.addEventListener("resize", () => {
  if (!storyCam.hidden && camEdits) camPaintOverlay();
});
document.querySelector("#cam-edit").addEventListener("click", camEditReview);
document.querySelector("#cam-retake").addEventListener("click", () => {
  camClearReview();
  camCaptureMode();
  if (!camStream) startCamStream();
});
document.querySelector("#cam-share").addEventListener("click", camShare);
document.querySelector("#cam-caption").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    camShare();
  }
});
function camPinchDistance() {
  const [first, second] = [...camPointers.values()];
  return Math.hypot(first.x - second.x, first.y - second.y) || 1;
}

camStage.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, textarea, input, label, .cam-sheet")) return;
  camPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (camPointers.size === 2 && camLiveReady()) {
    camSwipe = null;
    clearTimeout(camTapTimer);
    camPinch = { distance: camPinchDistance(), zoom: camZoom };
    return;
  }
  camSwipe = { x: event.clientX, y: event.clientY, at: Date.now() };
  const sheet = document.querySelector("#cam-sheet");
  if (!sheet.hidden) sheet.hidden = true;
});
camStage.addEventListener("pointermove", (event) => {
  if (!camPointers.has(event.pointerId)) return;
  camPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (camPinch && camPointers.size === 2) {
    cancelAnimationFrame(camZoomAnim);
    camApplyZoom(camPinch.zoom * (camPinchDistance() / camPinch.distance));
  }
});
["pointerup", "pointercancel"].forEach((name) => {
  camStage.addEventListener(name, (event) => {
    camPointers.delete(event.pointerId);
    if (camPinch) {
      if (!camPointers.size) camPinch = null;
      camSwipe = null;
      return;
    }
    if (!camSwipe || name === "pointercancel") {
      camSwipe = null;
      return;
    }
    const dx = event.clientX - camSwipe.x;
    const dy = event.clientY - camSwipe.y;
    const quick = Date.now() - camSwipe.at < 350;
    camSwipe = null;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && quick) {
      if (!camLiveReady() || event.target.closest(".cam-focus, .cam-zoom")) return;
      const now = Date.now();
      clearTimeout(camTapTimer);
      if (now - camLastTap < 300) {
        camLastTap = 0;
        if (!camRecorder) document.querySelector("#cam-flip").click();
        return;
      }
      camLastTap = now;
      const x = event.clientX;
      const y = event.clientY;
      camTapTimer = setTimeout(() => camFocusAt(x, y), 260);
      return;
    }
    const step = filterSwipeStep(dx, dy);
    if (!step || camTool === "text" || camRecorder || camBusy || !document.querySelector("#cam-review").hidden) return;
    camSetFilter(camFilter + step);
  });
});
camStage.addEventListener("wheel", (event) => {
  if (!camLiveReady()) return;
  event.preventDefault();
  cancelAnimationFrame(camZoomAnim);
  camApplyZoom(camZoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
}, { passive: false });
document.querySelector("#cam-exposure").addEventListener("input", (event) => camSetExposure(Number(event.target.value)));
document.querySelector("#cam-exposure").addEventListener("pointerdown", (event) => event.stopPropagation());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !storyCam.hidden && !document.querySelector("#media-edit").open) closeStoryCamera();
});
