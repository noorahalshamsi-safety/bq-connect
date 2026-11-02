Object.assign(dict.ar, {
  meEdit: "تعديل",
  meDone: "تم",
  meFilter: "فلاتر",
  meText: "نص",
  meTrim: "قص",
  meSound: "الصوت",
  meRotate: "تدوير",
  meTextPh: "اكتب كلامك هنا",
  meTextHint: "اسحب النص على الصورة لتغيير مكانه",
  meBox: "خلفية",
  meSize: "الحجم",
  meStart: "البداية",
  meEnd: "النهاية",
  meTrimNote: "اختر الجزء اللي تبيه، بحد أقصى 60 ثانية",
  meMute: "كتم صوت الفيديو",
  meMuteNote: "ينشر الفيديو بدون صوت",
  meFailed: "تعذّر تطبيق التعديلات على هذا الفيديو. جرّب متصفحاً آخر.",
  meSaved: "تم حفظ التعديلات",
  meNoVideo: "تعديل الفيديو غير مدعوم في هذا المتصفح",
  meLongTrim: "الفيديو أطول من 60 ثانية، اختر الجزء اللي تبيه",
});

Object.assign(dict.en, {
  meEdit: "Edit",
  meDone: "Done",
  meFilter: "Filters",
  meText: "Text",
  meTrim: "Trim",
  meSound: "Sound",
  meRotate: "Rotate",
  meTextPh: "Type your text",
  meTextHint: "Drag the text on the picture to move it",
  meBox: "Background",
  meSize: "Size",
  meStart: "Start",
  meEnd: "End",
  meTrimNote: "Pick the part you want, up to 60 seconds",
  meMute: "Mute video sound",
  meMuteNote: "The video is posted without sound",
  meFailed: "Couldn't apply the edits to this video. Try another browser.",
  meSaved: "Edits saved",
  meNoVideo: "Video editing isn't supported in this browser",
  meLongTrim: "This video is longer than 60 seconds, pick the part you want",
});

const ME_COLORS = ["#ffffff", "#111111", "#e10600", "#ffd400", "#2563eb", "#16a34a"];
const meDialog = document.querySelector("#media-edit");
const meStage = document.querySelector("#me-stage");
const meFrame = document.querySelector("#me-frame");
const meBase = document.querySelector("#me-base");
const meVideo = document.querySelector("#me-video");
const meLayer = document.querySelector("#me-layer");
const mePanel = document.querySelector("#me-panel");
let meState = null;

function meBlankCaption() {
  return { value: "", color: "#ffffff", box: false, size: 0.075, x: 0.5, y: 0.5 };
}

function mediaEdited(edits) {
  if (!edits) return false;
  return Boolean(edits.filter || edits.rotate || edits.mute || edits.trim || (edits.caption && edits.caption.value.trim()));
}

function meFilterCss(edits) {
  const filter = CAM_FILTERS[(edits && edits.filter) || 0];
  return filter ? filter.css : "none";
}

function paintCaption(context, width, height, caption) {
  const text = caption && caption.value.trim();
  if (!text) return;
  const size = Math.max(10, Math.round(width * caption.size));
  context.save();
  context.font = `800 ${size}px Cairo, Outfit, system-ui, sans-serif`;
  context.direction = /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = camWrapLines(context, text, width * 0.84).slice(0, 8);
  const lineHeight = size * 1.3;
  const x = caption.x * width;
  const top = caption.y * height - ((lines.length - 1) * lineHeight) / 2;
  const light = ["#ffffff", "#ffd400"].includes(caption.color);
  if (caption.box) {
    const boxWidth = Math.max(...lines.map((line) => context.measureText(line).width)) + size * 0.9;
    const boxHeight = lines.length * lineHeight + size * 0.45;
    const left = x - boxWidth / 2;
    const boxTop = top - lineHeight / 2 - size * 0.22;
    const radius = size * 0.35;
    context.fillStyle = caption.color;
    context.beginPath();
    if (context.roundRect) context.roundRect(left, boxTop, boxWidth, boxHeight, radius);
    else context.rect(left, boxTop, boxWidth, boxHeight);
    context.fill();
    context.fillStyle = light ? "#111111" : "#ffffff";
  } else {
    context.shadowColor = light ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.35)";
    context.shadowBlur = size * 0.25;
    context.shadowOffsetY = size * 0.04;
    context.fillStyle = caption.color;
  }
  lines.forEach((line, index) => context.fillText(line, x, top + index * lineHeight));
  context.restore();
}

function captionLayer(width, height, caption) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paintCaption(canvas.getContext("2d"), width, height, caption);
  return canvas;
}

function loadPicture(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => meImageElement(file));
  }
  return meImageElement(file);
}

function meImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function drawTurned(context, picture, width, height, turn, filter) {
  const sourceWidth = picture.naturalWidth || picture.width;
  const sourceHeight = picture.naturalHeight || picture.height;
  const swap = turn === 90 || turn === 270;
  const drawWidth = swap ? height : width;
  const drawHeight = swap ? width : height;
  context.save();
  context.filter = filter || "none";
  context.translate(width / 2, height / 2);
  context.rotate((turn * Math.PI) / 180);
  context.drawImage(picture, 0, 0, sourceWidth, sourceHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

async function renderPhoto(file, edits) {
  const picture = await loadPicture(file);
  const turn = ((edits.rotate || 0) % 360 + 360) % 360;
  const sourceWidth = picture.naturalWidth || picture.width;
  const sourceHeight = picture.naturalHeight || picture.height;
  const swap = turn === 90 || turn === 270;
  const fullWidth = swap ? sourceHeight : sourceWidth;
  const fullHeight = swap ? sourceWidth : sourceHeight;
  const scale = Math.min(1, 1440 / Math.max(fullWidth, fullHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(fullWidth * scale));
  canvas.height = Math.max(1, Math.round(fullHeight * scale));
  const context = canvas.getContext("2d");
  drawTurned(context, picture, canvas.width, canvas.height, turn, meFilterCss(edits));
  paintCaption(context, canvas.width, canvas.height, edits.caption);
  if (picture.close) picture.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("image"))), "image/jpeg", 0.86);
  });
}

function videoEditOptions(kit, edits, width, height) {
  const video = {};
  if (edits.filter || (edits.caption && edits.caption.value.trim())) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const overlay = edits.caption && edits.caption.value.trim() ? captionLayer(width, height, edits.caption) : null;
    const filter = meFilterCss(edits);
    video.process = (sample) => {
      context.filter = filter;
      sample.draw(context, 0, 0, width, height);
      context.filter = "none";
      if (overlay) context.drawImage(overlay, 0, 0);
      return new kit.VideoSample(canvas, { timestamp: sample.timestamp, duration: sample.duration });
    };
    video.processedWidth = width;
    video.processedHeight = height;
  }
  return video;
}

function meFmt(seconds) {
  const total = Math.max(0, Math.round(seconds * 10) / 10);
  const minutes = Math.floor(total / 60);
  const rest = total - minutes * 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest.toFixed(1)}`;
}

function meSourceSize() {
  if (!meState) return { width: 1, height: 1 };
  if (meState.video) return { width: meVideo.videoWidth || 9, height: meVideo.videoHeight || 16 };
  const picture = meState.picture;
  const width = picture ? picture.naturalWidth || picture.width : 1;
  const height = picture ? picture.naturalHeight || picture.height : 1;
  const turn = meState.edits.rotate || 0;
  return turn === 90 || turn === 270 ? { width: height, height: width } : { width, height };
}

function meLayout() {
  if (!meState) return;
  const box = meStage.getBoundingClientRect();
  const size = meSourceSize();
  const ratio = size.width / size.height || 1;
  let width = box.width;
  let height = width / ratio;
  if (height > box.height) {
    height = box.height;
    width = height * ratio;
  }
  meFrame.style.width = `${Math.round(width)}px`;
  meFrame.style.height = `${Math.round(height)}px`;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  meLayer.width = Math.max(1, Math.round(width * scale));
  meLayer.height = Math.max(1, Math.round(height * scale));
  if (!meState.video && meState.picture) {
    const longest = Math.min(1600, Math.round(Math.max(width, height) * scale));
    const fit = longest / Math.max(size.width, size.height);
    meBase.width = Math.max(1, Math.round(size.width * fit));
    meBase.height = Math.max(1, Math.round(size.height * fit));
    drawTurned(meBase.getContext("2d"), meState.picture, meBase.width, meBase.height, meState.edits.rotate || 0, "none");
  }
  mePaint();
}

function mePaint() {
  if (!meState) return;
  const filter = meFilterCss(meState.edits);
  meBase.style.filter = filter === "none" ? "" : filter;
  meVideo.style.filter = filter === "none" ? "" : filter;
  const context = meLayer.getContext("2d");
  context.clearRect(0, 0, meLayer.width, meLayer.height);
  paintCaption(context, meLayer.width, meLayer.height, meState.edits.caption);
}

function meButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function meRange(label, min, max, step, value, onInput) {
  const wrap = document.createElement("label");
  wrap.className = "me-range";
  const name = document.createElement("span");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const out = document.createElement("b");
  input.addEventListener("input", () => onInput(Number(input.value), out, input));
  wrap.append(name, input, out);
  onInput(Number(input.value), out, input, true);
  return wrap;
}

function meNote(key) {
  const note = document.createElement("p");
  note.className = "me-note";
  note.textContent = t(key);
  return note;
}

function mePanelFilter() {
  const row = document.createElement("div");
  row.className = "me-chips";
  CAM_FILTERS.forEach((filter, index) => {
    const chip = meButton(t(filter.key), "me-chip", () => {
      meState.edits.filter = index;
      mePaint();
      row.querySelectorAll(".me-chip").forEach((item, at) => item.classList.toggle("on", at === index));
    });
    chip.classList.toggle("on", (meState.edits.filter || 0) === index);
    const swatch = document.createElement("i");
    swatch.style.filter = filter.css === "none" ? "" : filter.css;
    chip.prepend(swatch);
    row.append(chip);
  });
  mePanel.append(row);
}

function mePanelText() {
  const caption = meState.edits.caption;
  const input = document.createElement("textarea");
  input.className = "me-text";
  input.rows = 2;
  input.maxLength = 140;
  input.dir = "auto";
  input.placeholder = t("meTextPh");
  input.value = caption.value;
  input.addEventListener("input", () => {
    caption.value = input.value;
    mePaint();
  });
  const colors = document.createElement("div");
  colors.className = "me-colors";
  ME_COLORS.forEach((color) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "me-color";
    dot.style.background = color;
    dot.setAttribute("aria-label", color);
    dot.classList.toggle("on", caption.color === color);
    dot.addEventListener("click", () => {
      caption.color = color;
      colors.querySelectorAll(".me-color").forEach((item) => item.classList.toggle("on", item === dot));
      mePaint();
    });
    colors.append(dot);
  });
  const box = meButton(t("meBox"), "me-chip me-box", () => {
    caption.box = !caption.box;
    box.classList.toggle("on", caption.box);
    mePaint();
  });
  box.classList.toggle("on", caption.box);
  colors.append(box);
  const size = meRange(t("meSize"), 0.04, 0.14, 0.005, caption.size, (value, out) => {
    caption.size = value;
    out.textContent = `${Math.round(value * 1000) / 10}`;
    mePaint();
  });
  mePanel.append(input, colors, size, meNote("meTextHint"));
  if (!caption.value) setTimeout(() => input.focus(), 60);
}

function meTrimLimits() {
  const trim = meState.edits.trim || { start: 0, end: Math.min(meState.duration, VIDEO_SECONDS) };
  return { start: trim.start, end: trim.end };
}

function meSetTrim(start, end) {
  const duration = meState.duration;
  if (start <= 0.05 && end >= duration - 0.05) meState.edits.trim = null;
  else meState.edits.trim = { start, end };
}

function mePanelTrim() {
  const duration = meState.duration;
  const limits = meTrimLimits();
  const summary = document.createElement("p");
  summary.className = "me-trim-sum";
  summary.dir = "ltr";
  const paintSummary = () => {
    const now = meTrimLimits();
    summary.textContent = `${meFmt(now.start)} - ${meFmt(now.end)}  (${meFmt(now.end - now.start)})`;
  };
  let startInput = null;
  let endInput = null;
  const start = meRange(t("meStart"), 0, Math.max(0, duration - 0.5), 0.1, limits.start, (value, out, input, initial) => {
    startInput = input;
    out.textContent = meFmt(value);
    if (initial) return;
    let end = endInput ? Number(endInput.value) : meTrimLimits().end;
    if (end - value < 0.5) end = Math.min(duration, value + 0.5);
    if (end - value > VIDEO_SECONDS) end = value + VIDEO_SECONDS;
    if (endInput) {
      endInput.value = String(end);
      endInput.nextElementSibling.textContent = meFmt(end);
    }
    meSetTrim(value, end);
    meVideo.currentTime = value;
    paintSummary();
  });
  const end = meRange(t("meEnd"), 0.5, duration, 0.1, limits.end, (value, out, input, initial) => {
    endInput = input;
    out.textContent = meFmt(value);
    if (initial) return;
    let begin = startInput ? Number(startInput.value) : meTrimLimits().start;
    if (value - begin < 0.5) begin = Math.max(0, value - 0.5);
    if (value - begin > VIDEO_SECONDS) begin = value - VIDEO_SECONDS;
    if (startInput) {
      startInput.value = String(begin);
      startInput.nextElementSibling.textContent = meFmt(begin);
    }
    meSetTrim(begin, value);
    meVideo.currentTime = Math.max(begin, value - 1.5);
    paintSummary();
  });
  paintSummary();
  mePanel.append(summary, start, end, meNote("meTrimNote"));
}

function mePanelSound() {
  const label = document.createElement("label");
  label.className = "me-switch";
  const name = document.createElement("span");
  name.textContent = t("meMute");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(meState.edits.mute);
  input.addEventListener("change", () => {
    meState.edits.mute = input.checked;
    meVideo.muted = input.checked;
    if (!input.checked) meVideo.play().catch(() => {});
  });
  label.append(name, input);
  mePanel.append(label, meNote("meMuteNote"));
}

function meShowTool(tool) {
  if (!meState) return;
  meState.tool = tool;
  mePanel.replaceChildren();
  document.querySelectorAll("#me-tools [data-me-tool]").forEach((button) => {
    button.classList.toggle("on", button.dataset.meTool === tool);
  });
  if (tool === "filter") mePanelFilter();
  else if (tool === "text") mePanelText();
  else if (tool === "trim") mePanelTrim();
  else if (tool === "sound") mePanelSound();
}

function meFinish(result) {
  if (!meState) return;
  const state = meState;
  meState = null;
  meVideo.pause();
  meVideo.removeAttribute("src");
  meVideo.load();
  if (state.url) URL.revokeObjectURL(state.url);
  if (state.picture && state.picture.close) state.picture.close();
  mePanel.replaceChildren();
  if (meDialog.open) meDialog.close();
  if (!result) {
    state.resolve(null);
    return;
  }
  const edits = { ...state.edits, caption: { ...state.edits.caption } };
  if (!edits.caption.value.trim()) delete edits.caption;
  if (!edits.filter) delete edits.filter;
  if (!edits.rotate) delete edits.rotate;
  if (!edits.mute) delete edits.mute;
  if (!edits.trim) delete edits.trim;
  if (state.video && state.duration > VIDEO_SECONDS + 0.5 && !edits.trim) edits.trim = { start: 0, end: VIDEO_SECONDS };
  state.resolve(edits);
}

function videoDuration(file) {
  return new Promise((resolve) => {
    const done = async () => {
      let seconds = meVideo.duration;
      if (!Number.isFinite(seconds) || seconds <= 0) seconds = await trackSeconds(file);
      resolve(seconds > 0 ? seconds : 0);
    };
    if (meVideo.readyState >= 1) done();
    else meVideo.addEventListener("loadedmetadata", done, { once: true });
    meVideo.addEventListener("error", () => resolve(0), { once: true });
  });
}

async function openMediaEditor(file, initial) {
  const video = /^video\//.test(file.type);
  if (video && !(await videoCompressor())) {
    if (typeof camToast === "function" && !storyCam.hidden) camToast(t("meNoVideo"));
    return initial || {};
  }
  if (meState) meFinish(null);
  return new Promise((resolve) => {
    const start = initial || {};
    meState = {
      file,
      video,
      resolve,
      url: "",
      picture: null,
      duration: 0,
      tool: "filter",
      edits: {
        filter: start.filter || 0,
        rotate: start.rotate || 0,
        mute: Boolean(start.mute),
        trim: start.trim ? { ...start.trim } : null,
        caption: { ...meBlankCaption(), ...(start.caption || {}) },
      },
    };
    const state = meState;
    meDialog.dir = document.documentElement.dir;
    meDialog.classList.toggle("is-video", video);
    meBase.hidden = video;
    meVideo.hidden = !video;
    document.querySelectorAll("#me-tools [data-me-video]").forEach((button) => (button.hidden = !video));
    document.querySelectorAll("#me-tools [data-me-photo]").forEach((button) => (button.hidden = video));
    mePanel.replaceChildren();
    meDialog.showModal();
    if (video) {
      state.url = URL.createObjectURL(file);
      meVideo.muted = state.edits.mute;
      meVideo.src = state.url;
      videoDuration(file).then((seconds) => {
        if (meState !== state) return;
        state.duration = seconds;
        if (seconds > VIDEO_SECONDS + 0.5 && !state.edits.trim) state.edits.trim = { start: 0, end: VIDEO_SECONDS };
        meLayout();
        meVideo.currentTime = state.edits.trim ? state.edits.trim.start : 0;
        meVideo.play().catch(() => {
          meVideo.muted = true;
          meVideo.play().catch(() => {});
        });
        meShowTool(seconds > VIDEO_SECONDS + 0.5 ? "trim" : "filter");
        if (seconds > VIDEO_SECONDS + 0.5 && typeof camToast === "function" && !storyCam.hidden) camToast(t("meLongTrim"));
        if (seconds > VIDEO_SECONDS + 0.5) mePanel.prepend(meNote("meLongTrim"));
      });
    } else {
      loadPicture(file)
        .then((picture) => {
          if (meState !== state) {
            if (picture.close) picture.close();
            return;
          }
          state.picture = picture;
          meLayout();
          meShowTool("filter");
        })
        .catch(() => meFinish(null));
    }
  });
}

meVideo.addEventListener("timeupdate", () => {
  if (!meState || !meState.video) return;
  const trim = meState.edits.trim;
  if (trim && (meVideo.currentTime >= trim.end || meVideo.currentTime < trim.start - 0.3)) meVideo.currentTime = trim.start;
});
meVideo.addEventListener("ended", () => {
  if (!meState) return;
  meVideo.currentTime = meState.edits.trim ? meState.edits.trim.start : 0;
  meVideo.play().catch(() => {});
});
meVideo.addEventListener("loadedmetadata", meLayout);

let meDrag = null;
meLayer.addEventListener("pointerdown", (event) => {
  if (!meState || !meState.edits.caption.value.trim()) return;
  event.preventDefault();
  meDrag = event.pointerId;
  try {
    meLayer.setPointerCapture(event.pointerId);
  } catch {}
  meMoveCaption(event);
});
meLayer.addEventListener("pointermove", (event) => {
  if (meDrag === event.pointerId) meMoveCaption(event);
});
["pointerup", "pointercancel"].forEach((name) => {
  meLayer.addEventListener(name, () => {
    meDrag = null;
  });
});

function meMoveCaption(event) {
  const box = meLayer.getBoundingClientRect();
  const caption = meState.edits.caption;
  caption.x = Math.min(0.95, Math.max(0.05, (event.clientX - box.left) / box.width));
  caption.y = Math.min(0.95, Math.max(0.05, (event.clientY - box.top) / box.height));
  mePaint();
}

document.querySelectorAll("#me-tools [data-me-tool]").forEach((button) => {
  button.addEventListener("click", () => meShowTool(button.dataset.meTool));
});
document.querySelector("#me-rotate").addEventListener("click", () => {
  if (!meState || meState.video) return;
  meState.edits.rotate = ((meState.edits.rotate || 0) + 90) % 360;
  meLayout();
});
document.querySelector("#me-cancel").addEventListener("click", () => meFinish(null));
document.querySelector("#me-done").addEventListener("click", () => meFinish(true));
meDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  meFinish(null);
});
if (typeof ResizeObserver === "function") {
  new ResizeObserver(() => {
    if (meState) meLayout();
  }).observe(meStage);
} else {
  window.addEventListener("resize", () => {
    if (meState) meLayout();
  });
}
