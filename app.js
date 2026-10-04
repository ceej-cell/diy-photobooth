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
const templateSelect = document.getElementById("templateSelect");
const photoCountEl = document.getElementById("photoCount");
const delayEl = document.getElementById("delay");
const cameraCard = document.querySelector(".camera-card");

// The template is the source of truth for the camera framing.
// Add new templates here later without rewriting the camera system.
const TEMPLATES = {
  classic: {
    name: "Classic 4:3",
    slot: { width: 780, height: 585 },
    capture: { width: 1200, height: 900 }
  },
  square: {
    name: "Square 1:1",
    slot: { width: 780, height: 780 },
    capture: { width: 1200, height: 1200 }
  },
  portrait: {
    name: "Portrait 3:4",
    slot: { width: 720, height: 960 },
    capture: { width: 900, height: 1200 }
  }
};

let stream = null;
let facingMode = "user";
let lastResultUrl = null;
let activeTemplate = TEMPLATES[templateSelect.value];

function setStatus(message) {
  statusEl.textContent = message;
}

function updateCameraFrame() {
  const { width, height } = activeTemplate.slot;
  cameraCard.style.aspectRatio = `${width} / ${height}`;
}

function getTemplate() {
  return TEMPLATES[templateSelect.value] || TEMPLATES.classic;
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
    startBtn.textContent = "Take Photos";
    setStatus(`${activeTemplate.name} • Camera ready`);
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

function getCenteredCrop(sourceWidth, sourceHeight, targetRatio) {
  const sourceRatio = sourceWidth / sourceHeight;

  if (sourceRatio > targetRatio) {
    // Source is wider: crop the left/right edges.
    const cropWidth = sourceHeight * targetRatio;
    return {
      sx: (sourceWidth - cropWidth) / 2,
      sy: 0,
      sw: cropWidth,
      sh: sourceHeight
    };
  }

  // Source is taller: crop the top/bottom edges.
  const cropHeight = sourceWidth / targetRatio;
  return {
    sx: 0,
    sy: (sourceHeight - cropHeight) / 2,
    sw: sourceWidth,
    sh: cropHeight
  };
}

function captureFrame() {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const targetWidth = activeTemplate.capture.width;
  const targetHeight = activeTemplate.capture.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Camera frame isn't ready.");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const crop = getCenteredCrop(
    sourceWidth,
    sourceHeight,
    targetWidth / targetHeight
  );

  // Capture exactly the same aspect ratio the live camera displays.
  // No stretching: only a centered crop when the camera's native ratio differs.
  ctx.save();
  if (facingMode === "user") {
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    video,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    targetWidth,
    targetHeight
  );
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
  const { slot } = activeTemplate;

  const outputWidth = 900;
  const top = 90;
  const gap = 30;
  const bottom = 120;
  const photoWidth = slot.width;
  const photoHeight = slot.height;
  const outputHeight =
    top +
    loaded.length * photoHeight +
    (loaded.length - 1) * gap +
    bottom;

  const out = document.createElement("canvas");
  out.width = outputWidth;
  out.height = outputHeight;
  const c = out.getContext("2d");

  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, outputWidth, outputHeight);

  c.fillStyle = "#111111";
  c.font = "800 34px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText("DIY PHOTOBOOTH", outputWidth / 2, 52);

  let y = top;
  for (const img of loaded) {
    const x = (outputWidth - photoWidth) / 2;

    // Captured images already have the template's exact aspect ratio,
    // so this placement cannot warp the image.
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
  templateSelect.disabled = true;
  photoCountEl.disabled = true;
  delayEl.disabled = true;

  const count = Number(photoCountEl.value);
  const delay = Number(delayEl.value);
  const shots = [];

  try {
    for (let i = 0; i < count; i++) {
      setStatus(`Photo ${i + 1} of ${count} • ${activeTemplate.name}`);
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
    templateSelect.disabled = false;
    photoCountEl.disabled = false;
    delayEl.disabled = false;
    startBtn.textContent = "Take Photos";
  }
}

templateSelect.addEventListener("change", async () => {
  activeTemplate = getTemplate();
  updateCameraFrame();

  if (stream) {
    setStatus(`${activeTemplate.name} • Restarting camera…`);
    await startCamera();
  } else {
    setStatus(`${activeTemplate.name} • Camera not started`);
  }
});

switchCameraBtn.addEventListener("click", async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  await startCamera();
});

startBtn.addEventListener("click", async () => {
  if (!stream) {
    await startCamera();
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

updateCameraFrame();
window.addEventListener("beforeunload", stopCamera);
