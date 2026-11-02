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
let camUrl = "";
let camSending = false;
let camBusy = false;
let camTool = "";
let camFilter = 0;
let camHands = false;
let camTimer = false;
let camFlash = false;
let camMode = "story";
let camGradient = 0;
let camLayoutCells = 0;
let camLayoutShots = [];
let camToastTimer = 0;
let camSwipe = null;

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

function stopCamStream() {
  if (camStream) camStream.getTracks().forEach((track) => track.stop());
  camStream = null;
  camLive.srcObject = null;
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
  const video = { facingMode: camFacing, width: { ideal: 1080 }, height: { ideal: 1920 } };
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
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    document.querySelector("#cam-flip").hidden = devices.filter((device) => device.kind === "videoinput").length < 2;
  }).catch(() => {});
}

function camOutputSize(width) {
  const rect = camStage.getBoundingClientRect();
  const ratio = rect.width ? rect.height / rect.width : 16 / 9;
  return { w: width, h: Math.min(Math.round(width * 2.4), Math.round(width * ratio)) };
}

function camDrawLive(context, x, y, w, h, mirror) {
  const vw = camLive.videoWidth;
  const vh = camLive.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  context.save();
  context.filter = CAM_FILTERS[camFilter].css;
  if (mirror) {
    context.translate(x + w, y);
    context.scale(-1, 1);
    context.drawImage(camLive, sx, sy, sw, sh, 0, 0, w, h);
  } else context.drawImage(camLive, sx, sy, sw, sh, x, y, w, h);
  context.restore();
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
    const on = tool === camTool || (tool === "filter" && camFilter > 0) || (tool === "handsfree" && camHands) || (tool === "timer" && camTimer);
    button.classList.toggle("on", on);
  });
  camLive.style.filter = CAM_FILTERS[camFilter].css;
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
    camFilter = (camFilter + 1) % CAM_FILTERS.length;
    camToast(t(CAM_FILTERS[camFilter].key));
  } else if (tool === "handsfree") {
    camHands = !camHands;
    camToast(camHands ? t("bqHandsOn") : t("bqToolOff"));
  } else if (tool === "timer") {
    camTimer = !camTimer;
    camToast(camTimer ? t("bqTimerOn") : t("bqToolOff"));
  } else if (tool === "more") {
    const open = !storyCam.classList.contains("tools-open");
    storyCam.classList.toggle("tools-open", open);
    document.querySelector("[data-tool=more]").setAttribute("aria-expanded", String(open));
    return;
  }
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
  camHands = false;
  camTimer = false;
  camLayoutShots = [];
  camTextInput.value = "";
  storyCam.classList.remove("tools-open");
  document.querySelector("#cam-sheet").hidden = true;
  document.querySelector("#cam-sheet").dir = document.documentElement.dir;
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

function camShowReview(blob) {
  camClearReview();
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
  paintAvatar(document.querySelector("#cam-avatar"), selectedPerson);
  camError.textContent = "";
  paintCamMode();
}

async function camTakePhoto() {
  if (!camLive.videoWidth) return;
  await camFlashOn();
  const { w, h } = camOutputSize(1080);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  camDrawLive(canvas.getContext("2d"), 0, 0, w, h, camSaveMirror());
  camFlashOff();
  camFlashBlink();
  const blob = await canvasBlob(canvas);
  if (blob) camShowReview(blob);
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
  camDrawLive(cell.getContext("2d"), 0, 0, cell.width, cell.height, camSaveMirror());
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
  const blob = await canvasBlob(canvas);
  if (blob) camShowReview(blob);
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
  let size = text.length > 90 ? 64 : text.length > 40 ? 80 : 96;
  context.font = `800 ${size}px Cairo, Outfit, sans-serif`;
  let lines = camWrapLines(context, text, w * 0.82);
  while (lines.length * size * 1.35 > h * 0.7 && size > 40) {
    size -= 6;
    context.font = `800 ${size}px Cairo, Outfit, sans-serif`;
    lines = camWrapLines(context, text, w * 0.82);
  }
  context.direction = /[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fff";
  context.shadowColor = "rgba(0, 0, 0, 0.25)";
  context.shadowBlur = 18;
  const lineHeight = size * 1.35;
  const top = h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => context.fillText(line, w / 2, top + index * lineHeight));
  camTextInput.blur();
  const blob = await canvasBlob(canvas);
  if (blob) camShowReview(blob);
}

function camRecorderType() {
  if (!window.MediaRecorder) return "";
  return ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    .find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function camStartPipe() {
  const { w, h } = camOutputSize(720);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  let frame = 0;
  const draw = () => {
    camDrawLive(context, 0, 0, w, h, camSaveMirror());
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
  try {
    camPipe = camStartPipe();
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
    if (blob.size) camShowReview(blob);
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
  const { w, h } = camOutputSize(720);
  const frames = [];
  storyCam.classList.add("recording");
  camStarted = Date.now();
  for (let index = 0; index < 16; index += 1) {
    const frame = document.createElement("canvas");
    frame.width = w;
    frame.height = h;
    camDrawLive(frame.getContext("2d"), 0, 0, w, h, camSaveMirror());
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
  if (!storyCam.hidden && chunks.length) camShowReview(new Blob(chunks, { type: type.split(";")[0] }));
}

async function camCountdown() {
  const count = document.querySelector("#cam-count");
  camBusy = true;
  count.hidden = false;
  for (let left = 3; left > 0 && !storyCam.hidden; left -= 1) {
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
    const media = await sendMediaFile(blob, camError);
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
    camError.textContent = error.message === "big" ? t("bqVideoBig") : error.message === "offensive" ? t("conductBlocked") : t("bqUploadFail");
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
  clearTimeout(camHoldTimer);
  if (camTool || camHands || camTimer || camRecorder) return;
  camHoldTimer = setTimeout(() => {
    camHolding = camStartRecording();
  }, 280);
});
camShutter.addEventListener("pointerup", () => {
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
  if (problem) {
    camToast(t(problem));
    return;
  }
  camShowReview(file);
});
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
camStage.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, textarea, input, label, .cam-sheet")) return;
  camSwipe = { x: event.clientX, y: event.clientY };
  const sheet = document.querySelector("#cam-sheet");
  if (!sheet.hidden) sheet.hidden = true;
});
camStage.addEventListener("pointerup", (event) => {
  if (!camSwipe) return;
  const dx = event.clientX - camSwipe.x;
  const dy = event.clientY - camSwipe.y;
  camSwipe = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (camTool === "text" || !document.querySelector("#cam-review").hidden) return;
  camFilter = (camFilter + (dx < 0 ? 1 : CAM_FILTERS.length - 1)) % CAM_FILTERS.length;
  camToast(t(CAM_FILTERS[camFilter].key));
  paintCamTools();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !storyCam.hidden) closeStoryCamera();
});
