const video = document.getElementById("video");
const canvas = document.getElementById("captureCanvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const switchCameraBtn = document.getElementById("switchCamera");
const statusEl = document.getElementById("status");
const countdownEl = document.getElementById("countdown");
const flashEl = document.getElementById("flash");
const placeholder = document.getElementById("cameraPlaceholder");
const resultSection = document.getElementById("resultSection");
const resultImage = document.getElementById("resultImage");
const downloadBtn = document.getElementById("downloadBtn");
const retakeBtn = document.getElementById("retakeBtn");
const photoCountEl = document.getElementById("photoCount");
const delayEl = document.getElementById("delay");

let stream = null;
let facingMode = "user";
let lastResultUrl = null;

function setStatus(message) {
  statusEl.textContent = message;
}

async function startCamera() {
  stopCamera();

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Camera isn't supported by this browser.");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    });

    video.srcObject = stream;
    placeholder.classList.add("hidden");
    switchCameraBtn.disabled = false;
    startBtn.textContent = "Start Photobooth";
    setStatus("Camera ready");
  } catch (error) {
    console.error(error);
    setStatus(
      error.name === "NotAllowedError"
        ? "Camera permission was blocked."
        : "Couldn't access the camera."
    );
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function countdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    countdownEl.textContent = i;
    await wait(1000);
  }
  countdownEl.textContent = "";
}

function captureFrame() {
  const w = video.videoWidth;
  const h = video.videoHeight;

  if (!w || !h) throw new Error("Camera frame isn't ready.");

  canvas.width = w;
  canvas.height = h;

  // Mirror selfie camera so the captured image matches the preview.
  ctx.save();
  if (facingMode === "user") {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  flashEl.classList.remove("fire");
  void flashEl.offsetWidth;
  flashEl.classList.add("fire");

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildStrip(images) {
  const loaded = await Promise.all(images.map(loadImage));

  const outputWidth = 900;
  const photoWidth = 780;
  const photoHeight = Math.round(photoWidth * 0.75);
  const top = 90;
  const gap = 30;
  const bottom = 120;
  const outputHeight = top + loaded.length * photoHeight + (loaded.length - 1) * gap + bottom;

  const out = document.createElement("canvas");
  out.width = outputWidth;
  out.height = outputHeight;
  const c = out.getContext("2d");

  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, outputWidth, outputHeight);

  // Header
  c.fillStyle = "#111111";
  c.font = "800 34px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText("DIY PHOTOBOOTH", outputWidth / 2, 52);

  let y = top;
  for (const img of loaded) {
    const x = (outputWidth - photoWidth) / 2;
    c.drawImage(img, x, y, photoWidth, photoHeight);
    y += photoHeight + gap;
  }

  c.fillStyle = "#777777";
  c.font = "500 22px system-ui, sans-serif";
  c.fillText(new Date().toLocaleDateString(), outputWidth / 2, outputHeight - 42);

  return out.toDataURL("image/png");
}

async function takePhotos() {
  if (!stream) {
    await startCamera();
    if (!stream) return;
  }

  startBtn.disabled = true;
  switchCameraBtn.disabled = true;
  photoCountEl.disabled = true;
  delayEl.disabled = true;

  const count = Number(photoCountEl.value);
  const delay = Number(delayEl.value);
  const shots = [];

  try {
    for (let i = 0; i < count; i++) {
      setStatus(`Photo ${i + 1} of ${count}`);
      await countdown(delay);
      shots.push(captureFrame());
      await wait(450);
    }

    setStatus("Building your strip…");
    const dataUrl = await buildStrip(shots);

    if (lastResultUrl) URL.revokeObjectURL(lastResultUrl);
    lastResultUrl = dataUrl;

    resultImage.src = dataUrl;
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus("Done!");
  } catch (error) {
    console.error(error);
    setStatus("Something went wrong. Please try again.");
  } finally {
    startBtn.disabled = false;
    switchCameraBtn.disabled = false;
    photoCountEl.disabled = false;
    delayEl.disabled = false;
    startBtn.textContent = "Take Photos";
  }
}

switchCameraBtn.addEventListener("click", async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
});

startBtn.addEventListener("click", async () => {
  if (!stream) {
    await startCamera();
    if (stream) startBtn.textContent = "Take Photos";
    return;
  }
  await takePhotos();
});

retakeBtn.addEventListener("click", () => {
  resultSection.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

downloadBtn.addEventListener("click", () => {
  if (!lastResultUrl) return;

  const a = document.createElement("a");
  a.href = lastResultUrl;
  a.download = `photobooth-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

window.addEventListener("beforeunload", stopCamera);
