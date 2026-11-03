Object.assign(dict.ar, {
  meEdit: "تعديل",
  meDone: "تم",
  meFilter: "فلاتر",
  meAdjust: "ضبط",
  meText: "نص",
  meDraw: "رسم",
  meTrim: "قص",
  meSound: "الصوت",
  meRotate: "تدوير",
  meTextPh: "اكتب كلامك هنا",
  meTextHint: "اسحب النص لتحريكه، وبإصبعين كبّره أو دوّره، واسحبه لسلة المهملات لحذفه",
  meTapText: "اضغط على الشاشة لإضافة نص، واسحب يمين أو يسار لتغيير الفلتر",
  meStyle: "شكل النص",
  meColor: "اللون",
  meTextAdd: "نص جديد",
  meTextDelete: "حذف النص",
  meBox: "خلفية",
  meSize: "الحجم",
  meBright: "الإضاءة",
  meContrast: "التباين",
  meSaturate: "التشبع",
  meReset: "إعادة الضبط",
  meBrush: "سماكة",
  meUndo: "تراجع",
  meClear: "مسح الرسم",
  meDrawHint: "ارسم بإصبعك على الصورة",
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
  meAdjust: "Adjust",
  meText: "Text",
  meDraw: "Draw",
  meTrim: "Trim",
  meSound: "Sound",
  meRotate: "Rotate",
  meTextPh: "Type your text",
  meTextHint: "Drag text to move it, pinch to resize or rotate, drop it on the bin to delete",
  meTapText: "Tap the screen to add text, swipe left or right to change the filter",
  meStyle: "Text style",
  meColor: "Color",
  meTextAdd: "New text",
  meTextDelete: "Delete text",
  meBox: "Background",
  meSize: "Size",
  meBright: "Brightness",
  meContrast: "Contrast",
  meSaturate: "Saturation",
  meReset: "Reset",
  meBrush: "Brush",
  meUndo: "Undo",
  meClear: "Clear drawing",
  meDrawHint: "Draw with your finger on the picture",
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

const ME_TEXT_MAX = 6;
const ME_STROKE_MAX = 80;
const meDialog = document.querySelector("#media-edit");
const meStage = document.querySelector("#me-stage");
const meFrame = document.querySelector("#me-frame");
const meBase = document.querySelector("#me-base");
const meVideo = document.querySelector("#me-video");
const meLayer = document.querySelector("#me-layer");
const mePanel = document.querySelector("#me-panel");
let meState = null;

const ME_STYLES = ["bar", "plain", "box"];
const ME_STYLE_SIZE = { bar: 0.05, plain: 0.085, box: 0.07 };

function meBlankText(color) {
  return { value: "", color: color || "#ffffff", style: "bar", size: ME_STYLE_SIZE.bar, x: 0.5, y: 0.45, angle: 0 };
}

function meTextStyle(item) {
  return ME_STYLES.includes(item.style) ? item.style : item.box ? "box" : "plain";
}

function meLight(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!hex) return true;
  const value = parseInt(hex[1], 16);
  return 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) > 150;
}

function meHueColor(fraction) {
  if (fraction < 0.06) return "#ffffff";
  if (fraction > 0.94) return "#111111";
  const hue = ((fraction - 0.06) / 0.88) * 360;
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    const value = 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function meTexts(edits) {
  return edits && Array.isArray(edits.texts) ? edits.texts.filter((item) => item && String(item.value || "").trim()) : [];
}

function meStrokes(edits) {
  return edits && Array.isArray(edits.strokes) ? edits.strokes.filter((item) => item && item.points && item.points.length) : [];
}

function meAdjusted(edits) {
  const adjust = (edits && edits.adjust) || {};
  return Boolean(adjust.b || adjust.c || adjust.s);
}

function meHasLayer(edits) {
  return meTexts(edits).length > 0 || meStrokes(edits).length > 0;
}

function mediaEdited(edits) {
  if (!edits) return false;
  return Boolean(edits.filter || edits.rotate || edits.mute || edits.trim || meAdjusted(edits) || meHasLayer(edits));
}

function meFilterCss(edits) {
  const parts = [];
  const preset = CAM_FILTERS[(edits && edits.filter) || 0];
  if (preset && preset.css !== "none") parts.push(preset.css);
  const adjust = (edits && edits.adjust) || {};
  if (adjust.b) parts.push(`brightness(${(1 + adjust.b / 100).toFixed(2)})`);
  if (adjust.c) parts.push(`contrast(${(1 + adjust.c / 100).toFixed(2)})`);
  if (adjust.s) parts.push(`saturate(${(1 + adjust.s / 100).toFixed(2)})`);
  return parts.join(" ") || "none";
}

function paintText(context, width, height, item) {
  const text = String(item.value || "").trim();
  if (!text) return null;
  const style = meTextStyle(item);
  const size = Math.max(10, Math.round(width * item.size));
  context.save();
  context.font = `${style === "bar" ? 700 : 800} ${size}px Cairo, Outfit, system-ui, sans-serif`;
  context.direction = /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const lines = camWrapLines(context, text, width * (style === "bar" ? 0.9 : 0.84)).slice(0, 8);
  const lineHeight = size * 1.3;
  const centerY = item.y * height;
  const block = lines.length * lineHeight;
  const first = -block / 2 + lineHeight / 2;
  if (style === "bar") {
    const box = { left: 0, top: centerY - block / 2 - size * 0.35, width, height: block + size * 0.7 };
    context.fillStyle = "rgba(0, 0, 0, 0.55)";
    context.fillRect(box.left, box.top, box.width, box.height);
    context.fillStyle = item.color;
    lines.forEach((line, index) => context.fillText(line, width / 2, centerY + first + index * lineHeight));
    context.restore();
    return box;
  }
  const x = item.x * width;
  const textWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  const boxWidth = textWidth + size * 0.9;
  const boxHeight = block + size * 0.45;
  const light = meLight(item.color);
  context.translate(x, centerY);
  if (item.angle) context.rotate(item.angle);
  if (style === "box") {
    context.fillStyle = item.color;
    context.beginPath();
    if (context.roundRect) context.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, size * 0.35);
    else context.rect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
    context.fill();
    context.fillStyle = light ? "#111111" : "#ffffff";
  } else {
    context.shadowColor = light ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.35)";
    context.shadowBlur = size * 0.25;
    context.shadowOffsetY = size * 0.04;
    context.fillStyle = item.color;
  }
  lines.forEach((line, index) => context.fillText(line, 0, first + index * lineHeight));
  context.restore();
  if (!item.angle) return { left: x - boxWidth / 2, top: centerY - boxHeight / 2, width: boxWidth, height: boxHeight };
  const reach = Math.max(boxWidth, boxHeight);
  return { left: x - reach / 2, top: centerY - reach / 2, width: reach, height: reach };
}

function paintStroke(context, width, height, stroke) {
  const points = stroke.points;
  context.save();
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = Math.max(1, stroke.size * width);
  context.lineCap = "round";
  context.lineJoin = "round";
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0][0] * width, points[0][1] * height, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(points[0][0] * width, points[0][1] * height);
    for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0] * width, points[index][1] * height);
    context.stroke();
  }
  context.restore();
}

function paintOverlay(context, width, height, edits) {
  meStrokes(edits).forEach((stroke) => paintStroke(context, width, height, stroke));
  const all = edits && Array.isArray(edits.texts) ? edits.texts : [];
  return all.map((item) => (item ? paintText(context, width, height, item) : null));
}

function overlayLayer(width, height, edits) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paintOverlay(canvas.getContext("2d"), width, height, edits);
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
  canvasFilterFallback(context, filter, 0, 0, width, height);
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
  paintOverlay(context, canvas.width, canvas.height, edits);
  if (picture.close) picture.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("image"))), "image/jpeg", 0.86);
  });
}

function videoEditOptions(kit, edits, width, height) {
  const video = {};
  const filter = meFilterCss(edits);
  if (filter !== "none" || meHasLayer(edits)) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const overlay = meHasLayer(edits) ? overlayLayer(width, height, edits) : null;
    video.process = (sample) => {
      context.filter = filter;
      sample.draw(context, 0, 0, width, height);
      context.filter = "none";
      canvasFilterFallback(context, filter, 0, 0, width, height);
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
  meState.boxes = paintOverlay(context, meLayer.width, meLayer.height, meState.edits);
  const picked = meState.boxes[meState.textIndex];
  if (meState.tool === "text" && picked) {
    context.save();
    context.setLineDash([8, 6]);
    context.lineWidth = 2;
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.strokeRect(picked.left - 4, picked.top - 4, picked.width + 8, picked.height + 8);
    context.restore();
  }
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

function meHueBar(current, onPick) {
  const bar = document.createElement("div");
  bar.className = "me-hue";
  bar.setAttribute("role", "slider");
  bar.setAttribute("aria-label", t("meColor"));
  const knob = document.createElement("i");
  knob.style.background = current;
  knob.style.top = `${(meState.hueAt[current] ?? (current === "#111111" ? 0.97 : 0.03)) * 100}%`;
  bar.append(knob);
  let active = null;
  const pick = (event) => {
    const box = bar.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    const color = meHueColor(fraction);
    meState.hueAt[color] = fraction;
    knob.style.top = `${fraction * 100}%`;
    knob.style.background = color;
    onPick(color);
  };
  bar.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    active = event.pointerId;
    bar.classList.add("on");
    try {
      bar.setPointerCapture(event.pointerId);
    } catch {}
    pick(event);
  });
  bar.addEventListener("pointermove", (event) => {
    if (active === event.pointerId) pick(event);
  });
  ["pointerup", "pointercancel"].forEach((name) => {
    bar.addEventListener(name, () => {
      active = null;
      bar.classList.remove("on");
    });
  });
  return bar;
}

function meRound(label, className, icon, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `me-icon ${className}`;
  button.setAttribute("aria-label", label);
  button.appendChild(svgIcon(icon));
  button.addEventListener("click", onClick);
  return button;
}

function mePanelFilter() {
  mePanel.append(filterChips(meState.edits.filter || 0, (index) => {
    meState.edits.filter = index;
    mePaint();
    meFlash(t(CAM_FILTERS[index].key));
  }));
}

function mePanelAdjust() {
  const adjust = meState.edits.adjust;
  const rows = [["b", "meBright"], ["c", "meContrast"], ["s", "meSaturate"]].map(([key, label]) =>
    meRange(t(label), -50, 50, 1, adjust[key] || 0, (value, out) => {
      adjust[key] = value;
      out.textContent = value > 0 ? `+${value}` : String(value);
      mePaint();
    }));
  const reset = meButton(t("meReset"), "me-chip me-reset", () => {
    adjust.b = 0;
    adjust.c = 0;
    adjust.s = 0;
    meShowTool("adjust");
    mePaint();
  });
  mePanel.append(...rows, reset);
}

function meCurrentText() {
  const texts = meState.edits.texts;
  if (!texts[meState.textIndex]) {
    texts.push(meBlankText());
    meState.textIndex = texts.length - 1;
  }
  return texts[meState.textIndex];
}

function meAddText(y) {
  const filled = meState.edits.texts.filter((row) => row.value.trim());
  meState.edits.texts = filled;
  if (filled.length >= ME_TEXT_MAX) {
    meState.textIndex = filled.length - 1;
    meShowTool("text");
    return;
  }
  const item = meBlankText();
  item.y = Math.min(0.9, Math.max(0.1, y));
  filled.push(item);
  meState.textIndex = filled.length - 1;
  meShowTool("text");
}

function mePanelText() {
  const item = meCurrentText();
  const row = document.createElement("div");
  row.className = "me-text-row";
  const style = document.createElement("button");
  style.type = "button";
  style.className = "me-icon me-style";
  style.setAttribute("aria-label", t("meStyle"));
  style.textContent = "Aa";
  style.dataset.style = meTextStyle(item);
  style.addEventListener("click", () => {
    const next = ME_STYLES[(ME_STYLES.indexOf(meTextStyle(item)) + 1) % ME_STYLES.length];
    item.style = next;
    delete item.box;
    item.size = ME_STYLE_SIZE[next];
    if (next === "bar") {
      item.x = 0.5;
      item.angle = 0;
    }
    style.dataset.style = next;
    mePaint();
  });
  const input = document.createElement("textarea");
  input.className = "me-text";
  input.rows = 1;
  input.maxLength = 140;
  input.dir = "auto";
  input.placeholder = t("meTextPh");
  input.value = item.value;
  const grow = () => {
    input.style.height = "44px";
    input.style.height = `${Math.max(44, input.scrollHeight)}px`;
  };
  input.addEventListener("input", () => {
    item.value = input.value;
    grow();
    mePaint();
  });
  requestAnimationFrame(grow);
  const remove = meRound(t("meTextDelete"), "me-text-del", "M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13", () => {
    meState.edits.texts.splice(meState.textIndex, 1);
    meState.textIndex = Math.max(0, meState.edits.texts.length - 1);
    meShowTool("none");
  });
  row.append(style, input, remove);
  const hue = meHueBar(item.color, (color) => {
    item.color = color;
    mePaint();
  });
  mePanel.append(row, hue, meNote("meTextHint"));
  setTimeout(() => input.focus(), 60);
}

function mePanelDraw() {
  const pen = meState.pen;
  const hue = meHueBar(pen.color, (color) => {
    pen.color = color;
  });
  const size = meRange(t("meBrush"), 0.006, 0.04, 0.002, pen.size, (value, out) => {
    pen.size = value;
    out.textContent = String(Math.round(value * 1000));
  });
  const actions = document.createElement("div");
  actions.className = "me-actions";
  actions.append(
    meButton(t("meUndo"), "me-chip", () => {
      meState.edits.strokes.pop();
      mePaint();
    }),
    meButton(t("meClear"), "me-chip", () => {
      meState.edits.strokes = [];
      mePaint();
    }),
  );
  mePanel.append(hue, size, actions, meNote("meDrawHint"));
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

function meFlash(text) {
  flashLabel(document.querySelector("#me-flash"), text);
}

function meHint(show) {
  document.querySelector("#me-hint").classList.toggle("show", show);
}

function meCycleFilter(step) {
  const count = CAM_FILTERS.length;
  meState.edits.filter = ((((meState.edits.filter || 0) + step) % count) + count) % count;
  mePaint();
  meFlash(t(CAM_FILTERS[meState.edits.filter].key));
  if (meState.tool === "filter") meShowTool("filter");
}

function meShowTool(tool) {
  if (!meState) return;
  if (meState.tool === "text" && tool !== "text") meState.edits.texts = meState.edits.texts.filter((row) => row.value.trim());
  meState.tool = tool;
  mePanel.replaceChildren();
  mePanel.classList.toggle("top", tool === "text");
  meDialog.classList.toggle("me-focus", tool === "text" || tool === "draw");
  document.querySelectorAll("#me-tools [data-me-tool]").forEach((button) => {
    button.classList.toggle("on", button.dataset.meTool === tool);
  });
  meLayer.classList.toggle("drawing", tool === "draw");
  if (tool !== "none") meHint(false);
  if (tool === "filter") mePanelFilter();
  else if (tool === "adjust") mePanelAdjust();
  else if (tool === "text") mePanelText();
  else if (tool === "draw") mePanelDraw();
  else if (tool === "trim") mePanelTrim();
  else if (tool === "sound") mePanelSound();
  mePaint();
}

function meFinish(result) {
  if (!meState) return;
  const state = meState;
  meState = null;
  meDrag = null;
  mePointers.clear();
  meDialog.classList.remove("me-focus", "me-dragging");
  mePanel.classList.remove("top");
  meHint(false);
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
  const source = state.edits;
  const edits = {};
  if (source.filter) edits.filter = source.filter;
  if (meAdjusted(source)) edits.adjust = { b: source.adjust.b || 0, c: source.adjust.c || 0, s: source.adjust.s || 0 };
  if (source.rotate) edits.rotate = source.rotate;
  if (source.mute) edits.mute = true;
  if (source.trim) edits.trim = { ...source.trim };
  const texts = meTexts(source).map((item) => ({ ...item }));
  if (texts.length) edits.texts = texts;
  const strokes = meStrokes(source).map((stroke) => ({ ...stroke, points: stroke.points.map((point) => [...point]) }));
  if (strokes.length) edits.strokes = strokes;
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

async function openMediaEditor(file, initial, options = {}) {
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
      tool: "none",
      textIndex: 0,
      boxes: [],
      hueAt: {},
      pen: { color: "#ffffff", size: 0.012 },
      edits: {
        filter: start.filter || 0,
        adjust: { b: 0, c: 0, s: 0, ...(start.adjust || {}) },
        rotate: start.rotate || 0,
        mute: Boolean(start.mute),
        trim: start.trim ? { ...start.trim } : null,
        texts: meTexts(start).map((item) => ({ ...item })),
        strokes: meStrokes(start).map((stroke) => ({ ...stroke, points: stroke.points.map((point) => [...point]) })),
      },
    };
    const state = meState;
    const done = document.querySelector("#me-done span");
    done.dataset.i18n = options.doneKey || "meDone";
    done.textContent = t(done.dataset.i18n);
    meDialog.dir = document.documentElement.dir;
    meDialog.classList.toggle("is-video", video);
    meBase.hidden = video;
    meVideo.hidden = !video;
    document.querySelectorAll("#me-tools [data-me-video]").forEach((button) => (button.hidden = !video));
    document.querySelectorAll("#me-tools [data-me-photo]").forEach((button) => (button.hidden = video));
    mePanel.replaceChildren();
    meDialog.showModal();
    meHint(true);
    if (state.edits.filter) meFlash(t(CAM_FILTERS[state.edits.filter].key));
    setTimeout(() => {
      if (meState === state) meHint(false);
    }, 4500);
    if (video) {
      state.url = URL.createObjectURL(file);
      meVideo.muted = state.edits.mute;
      meVideo.src = state.url;
      videoDuration(file).then((seconds) => {
        if (meState !== state) return;
        state.duration = seconds;
        const long = seconds > VIDEO_SECONDS + 0.5;
        if (long && !state.edits.trim) state.edits.trim = { start: 0, end: VIDEO_SECONDS };
        meLayout();
        meVideo.currentTime = state.edits.trim ? state.edits.trim.start : 0;
        meVideo.play().catch(() => {
          meVideo.muted = true;
          meVideo.play().catch(() => {});
        });
        meShowTool(long ? "trim" : "none");
        if (long) mePanel.prepend(meNote("meLongTrim"));
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
          meShowTool("none");
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
meVideo.addEventListener("loadedmetadata", meLayout);

let meDrag = null;
const mePointers = new Map();
const meTrash = document.querySelector("#me-trash");

function mePoint(event) {
  const box = meLayer.getBoundingClientRect();
  return {
    cx: event.clientX,
    cy: event.clientY,
    x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
    y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    px: ((event.clientX - box.left) / box.width) * meLayer.width,
    py: ((event.clientY - box.top) / box.height) * meLayer.height,
  };
}

function meHitText(point) {
  const boxes = meState.boxes || [];
  for (let index = boxes.length - 1; index >= 0; index -= 1) {
    const box = boxes[index];
    if (box && point.px >= box.left - 12 && point.px <= box.left + box.width + 12 && point.py >= box.top - 12 && point.py <= box.top + box.height + 12) return index;
  }
  return -1;
}

function meOverTrash(point) {
  const box = meTrash.getBoundingClientRect();
  return point.cx >= box.left - 18 && point.cx <= box.right + 18 && point.cy >= box.top - 18 && point.cy <= box.bottom + 18;
}

function mePinchShape() {
  const [a, b] = [...mePointers.values()];
  return { dist: Math.hypot(a.cx - b.cx, a.cy - b.cy) || 1, angle: Math.atan2(b.cy - a.cy, b.cx - a.cx) };
}

function meEndDrag() {
  meDrag = null;
  meDialog.classList.remove("me-dragging");
  meTrash.classList.remove("show", "hot");
}

meStage.addEventListener("pointerdown", (event) => {
  if (!meState) return;
  const point = mePoint(event);
  mePointers.set(event.pointerId, point);
  meHint(false);
  event.preventDefault();
  try {
    meStage.setPointerCapture(event.pointerId);
  } catch {}
  if (mePointers.size === 2 && meDrag && meDrag.item) {
    const shape = mePinchShape();
    meDrag.pinch = { ...shape, size: meDrag.item.size, turn: meDrag.item.angle || 0 };
    meDrag.moved = true;
    return;
  }
  if (mePointers.size > 1) return;
  if (meState.tool === "draw") {
    if (meState.edits.strokes.length >= ME_STROKE_MAX) return;
    const stroke = { color: meState.pen.color, size: meState.pen.size, points: [[point.x, point.y]] };
    meState.edits.strokes.push(stroke);
    meDrag = { id: event.pointerId, stroke };
  } else {
    const index = meHitText(point);
    if (index >= 0) {
      const item = meState.edits.texts[index];
      meState.textIndex = index;
      meDrag = { id: event.pointerId, item, dx: item.x - point.x, dy: item.y - point.y, start: point, moved: false };
    } else {
      meDrag = { id: event.pointerId, swipe: true, start: point };
    }
  }
  mePaint();
});
meStage.addEventListener("pointermove", (event) => {
  if (!meState || !mePointers.has(event.pointerId)) return;
  const point = mePoint(event);
  mePointers.set(event.pointerId, point);
  if (!meDrag) return;
  if (meDrag.pinch && mePointers.size >= 2) {
    const shape = mePinchShape();
    const item = meDrag.item;
    item.size = Math.min(0.3, Math.max(0.03, (meDrag.pinch.size * shape.dist) / meDrag.pinch.dist));
    if (meTextStyle(item) !== "bar") item.angle = meDrag.pinch.turn + shape.angle - meDrag.pinch.angle;
    mePaint();
    return;
  }
  if (meDrag.id !== event.pointerId) return;
  if (meDrag.stroke) {
    const points = meDrag.stroke.points;
    const last = points[points.length - 1];
    if (Math.hypot(point.x - last[0], point.y - last[1]) < 0.004 || points.length >= 600) return;
    points.push([Math.round(point.x * 10000) / 10000, Math.round(point.y * 10000) / 10000]);
    mePaint();
  } else if (meDrag.item) {
    if (!meDrag.moved && Math.hypot(point.cx - meDrag.start.cx, point.cy - meDrag.start.cy) < 6) return;
    meDrag.moved = true;
    const item = meDrag.item;
    if (meTextStyle(item) !== "bar") item.x = Math.min(0.95, Math.max(0.05, point.x + meDrag.dx));
    item.y = Math.min(0.95, Math.max(0.05, point.y + meDrag.dy));
    meDialog.classList.add("me-dragging");
    meTrash.classList.add("show");
    meTrash.classList.toggle("hot", meOverTrash(point));
    mePaint();
  }
});
["pointerup", "pointercancel"].forEach((name) => {
  meStage.addEventListener(name, (event) => {
    const point = mePointers.get(event.pointerId);
    mePointers.delete(event.pointerId);
    const drag = meDrag;
    if (!meState || !drag) return;
    if (drag.pinch) {
      if (!mePointers.size) meEndDrag();
      else if (drag.id === event.pointerId) drag.pinch = null;
      mePaint();
      return;
    }
    if (drag.id !== event.pointerId) return;
    const trashed = meTrash.classList.contains("hot");
    meEndDrag();
    if (name === "pointercancel" || !point) {
      mePaint();
      return;
    }
    if (drag.item) {
      if (trashed) {
        const at = meState.edits.texts.indexOf(drag.item);
        if (at >= 0) meState.edits.texts.splice(at, 1);
        meState.textIndex = Math.max(0, meState.edits.texts.length - 1);
        if (meState.tool === "text") meShowTool("none");
      } else if (!drag.moved) {
        meShowTool("text");
      }
      mePaint();
      return;
    }
    if (drag.swipe) {
      const dx = point.cx - drag.start.cx;
      const dy = point.cy - drag.start.cy;
      const step = filterSwipeStep(dx, dy);
      if (step) {
        meCycleFilter(step);
      } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        if (meState.tool === "text") meShowTool("none");
        else if (meState.tool !== "trim" && meState.tool !== "sound") meAddText(point.y);
      }
    }
  });
});

document.querySelectorAll("#me-tools [data-me-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!meState) return;
    const tool = button.dataset.meTool;
    if (tool === "text") meAddText(0.45);
    else meShowTool(meState.tool === tool ? "none" : tool);
  });
});
document.querySelector("#me-tool-done").addEventListener("click", () => meShowTool("none"));
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
