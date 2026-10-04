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
const shotGuide = document.getElementById("shotGuide");

/*
  PHOTOBOOTH TEMPLATE SYSTEM
  --------------------------
  A template owns the final strip layout AND every photo slot.
  Each slot defines its own aspect ratio. The camera follows the
  current slot, so every captured frame matches the space it will occupy.

  Adding a template should only require adding another object here.
*/
const TEMPLATES = {
  classic: {
    name: "Classic Strip",
    description: "Three or four 4:3 photos stacked vertically.",
    layouts: {
      3: {
        canvas: { width: 900, height: 2115 },
        slots: [
          { x: 60, y: 90, width: 780, height: 585 },
          { x: 60, y: 720, width: 780, height: 585 },
          { x: 60, y: 1350, width: 780, height: 585 }
        ]
      },
      4: {
        canvas: { width: 900, height: 2745 },
        slots: [
          { x: 60, y: 90, width: 780, height: 585 },
          { x: 60, y: 720, width: 780, height: 585 },
          { x: 60, y: 1350, width: 780, height: 585 },
          { x: 60, y: 1980, width: 780, height: 585 }
        ]
      }
    }
  },

  square: {
    name: "Square Strip",
    description: "Three or four square photos.",
    layouts: {
      3: {
        canvas: { width: 900, height: 2670 },
        slots: [
          { x: 60, y: 90, width: 780, height: 780 },
          { x: 60, y: 960, width: 780, height: 780 },
          { x: 60, y: 1830, width: 780, height: 780 }
        ]
      },
      4: {
        canvas: { width: 900, height: 3540 },
        slots: [
          { x: 60, y: 90, width: 780, height: 780 },
          { x: 60, y: 960, width: 780, height: 780 },
          { x: 60, y: 1830, width: 780, height: 780 },
          { x: 60, y: 2700, width: 780, height: 780 }
        ]
      }
    }
  },

  portrait: {
    name: "Portrait Strip",
    description: "Three or four vertical 3:4 photos.",
    layouts: {
      3: {
        canvas: { width: 900, height: 3090 },
        slots: [
          { x: 90, y: 90, width: 720, height: 960 },
          { x: 90, y: 1110, width: 720, height: 960 },
          { x: 90, y: 2130, width: 720, height: 960 }
        ]
      },
      4: {
        canvas: { width: 900, height: 4110 },
        slots: [
          { x: 90, y: 90, width: 720, height: 960 },
          { x: 90, y: 1110, width: 720, height: 960 },
          { x: 90, y: 2130, width: 720, height: 960 },
          { x: 90, y: 3150, width: 720, height: 960 }
        ]
      }
    }
  },

  mixed: {
    name: "Mixed Collage",
    description: "A landscape hero photo with two square photos below.",
    layouts: {
      3: {
        canvas: { width: 900, height: 1530 },
        slots: [
          { x: 60, y: 90, width: 780, height: 585 },
          { x: 60, y: 705, width: 375, height: 375 },
          { x: 465, y: 705, width: 375, height: 375 }
        ]
      }
    }
  }
};

let stream = null;
let facingMode = "user";
let lastResultUrl = null;
let activeTemplate = TEMPLATES[templateSelect.value] || TEMPLATES.classic;
let activeLayout = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function getTemplate() {
  return TEMPLATES[templateSelect.value] || TEMPLATES.classic;
}

function getLayout() {
  const template = getTemplate();
  const requestedCount = Number(photoCountEl.value);
  const availableCounts = Object.keys(template.layouts).map(Number).sort((a, b) => a - b);
  const count = template.layouts[requestedCount] ? requestedCount : availableCounts[0];
  return template.layouts[count];
}

function getAvailableCounts() {
  return Object.keys(activeTemplate.layouts).map(Number).sort((a, b) => a - b);
}

function syncPhotoCountOptions() {
  const available = getAvailableCounts();
  const previous = Number(photoCountEl.value);
  photoCountEl.innerHTML = "";

  available.forEach(count => {
    const option = document.createElement("option");
    option.value = count;
    option.textContent = `${count} photos`;
    photoCountEl.appendChild(option);
  });

  photoCountEl.value = available.includes(previous) ? String(previous) : String(available[0]);
}

function getSlot(slotIndex = 0) {
  const layout = getLayout();
  return layout.slots[Math.min(slotIndex, layout.slots.length - 1)];
}

function updateCameraFrame(slotIndex = 0) {
  const slot = getSlot(slotIndex);
  activeLayout = getLayout();
  cameraCard.style.aspectRatio = `${slot.width} / ${slot.height}`;

  if (shotGuide) {
    const ratio = slot.width / slot.height;
    const ratioText = ratio === 1 ? "1:1" : ratio > 1 ? "4:3" : "3:4";
    shotGuide.textContent = `Photo ${slotIndex + 1} of ${activeLayout.slots.length} • ${ratioText}`;
  }
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
    updateCameraFrame(0);
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
    const cropWidth = sourceHeight * targetRatio;
    return {
      sx: (sourceWidth - cropWidth) / 2,
      sy: 0,
      sw: cropWidth,
      sh: sourceHeight
    };
  }

  const cropHeight = sourceWidth / targetRatio;
  return {
    sx: 0,
    sy: (sourceHeight - cropHeight) / 2,
    sw: sourceWidth,
    sh: cropHeight
  };
}

function captureFrame(slot) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const targetWidth = slot.width;
  const targetHeight = slot.height;

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

function drawImageCover(ctx, img, slot) {
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  const crop = getCenteredCrop(sourceWidth, sourceHeight, slot.width / slot.height);

  ctx.drawImage(
    img,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    slot.x,
    slot.y,
    slot.width,
    slot.height
  );
}

function drawTemplateBackground(c, layout) {
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, layout.canvas.width, layout.canvas.height);

  c.fillStyle = "#111111";
  c.font = "800 34px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText("DIY PHOTOBOOTH", layout.canvas.width / 2, 52);
}

async function buildStrip(images) {
  const loaded = await Promise.all(images.map(loadImage));
  const layout = getLayout();

  if (loaded.length !== layout.slots.length) {
    throw new Error("Photo count does not match the selected template.");
  }

  const out = document.createElement("canvas");
  out.width = layout.canvas.width;
  out.height = layout.canvas.height;
  const c = out.getContext("2d");

  drawTemplateBackground(c, layout);

  loaded.forEach((img, index) => {
    drawImageCover(c, img, layout.slots[index]);
  });

  c.fillStyle = "#777777";
  c.font = "500 22px system-ui, sans-serif";
  c.textAlign = "center";
  c.fillText(
    new Date().toLocaleDateString(),
    layout.canvas.width / 2,
    layout.canvas.height - 42
  );

  return out.toDataURL("image/png");
}

async function takePhotos() {
  if (!stream) {
    await startCamera();
    if (!stream) return;
  }

  const layout = getLayout();
  const count = layout.slots.length;
  const delay = Number(delayEl.value);
  const shots = [];

  startBtn.disabled = true;
  switchCameraBtn.disabled = true;
  templateSelect.disabled = true;
  photoCountEl.disabled = true;
  delayEl.disabled = true;

  try {
    for (let i = 0; i < count; i++) {
      const slot = layout.slots[i];
      updateCameraFrame(i);
      setStatus(`Photo ${i + 1} of ${count} • Frame the shot`);
      await wait(350);
      await countdown(delay);
      shots.push(captureFrame(slot));
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
    updateCameraFrame(0);
  }
}

templateSelect.addEventListener("change", async () => {
  activeTemplate = getTemplate();
  syncPhotoCountOptions();
  updateCameraFrame(0);

  if (stream) {
    setStatus(`${activeTemplate.name} • Restarting camera…`);
    await startCamera();
  } else {
    setStatus(`${activeTemplate.name} • Camera not started`);
  }
});

photoCountEl.addEventListener("change", async () => {
  updateCameraFrame(0);
  if (stream) {
    setStatus(`${activeTemplate.name} • Updating frame…`);
    await startCamera();
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

activeTemplate = getTemplate();
syncPhotoCountOptions();
updateCameraFrame(0);
