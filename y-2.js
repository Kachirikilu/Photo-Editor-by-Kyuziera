let originalFiles = [];
let currentImageIndex = 0;
let processedImages = {};
let isProcessing = false;
let smoothEffect = false;

const elements = {
  fileInput: document.getElementById("fileInput"),
  uploadLabel: document.getElementById("uploadLabel"),
  smoothButton: document.getElementById("smoothButton"),
  displayCanvas: document.getElementById("displayCanvas"),
  placeholderText: document.getElementById("placeholderText"),
  singleFileContainer: document.getElementById("singleFileContainer"),
  multiFileContainer: document.getElementById("multiFileContainer"),
  tempCanvas: document.getElementById("tempCanvas"),
  finalCanvas: document.getElementById("finalCanvas"),
  baseSideLength: document.getElementById("baseSideLength"),
  colorDepth: document.getElementById("colorDepth"),
  ditheringStrength: document.getElementById("ditheringStrength"),
  noiseStrength: document.getElementById("noiseStrength"),
  lumaForNoise: document.getElementById("lumaForNoise"),
  brightness: document.getElementById("brightness"),
  contrast: document.getElementById("contrast"),
  highlight: document.getElementById("highlight"),
  shadow: document.getElementById("shadow"),
  saturation: document.getElementById("saturation"),
  whiteBalance: document.getElementById("whiteBalance"),
  tint: document.getElementById("tint"),
  applyButton: document.getElementById("applyButton"),
  downloadButton: document.getElementById("downloadButton"),
  toggleAdvancedButton: document.getElementById("toggleAdvancedButton"),
  advancedControls: document.getElementById("advancedControls"),
  downloadMode: document.getElementById("downloadMode"),
  outputInfo: document.getElementById("outputInfo"),
};

const tempCtx = elements.tempCanvas.getContext("2d", {
  willReadFrequently: true,
});
const finalCtx = elements.finalCanvas.getContext("2d", {
  willReadFrequently: true,
});

// --- UTILITIES & HELPERS ---

/**
 * Convert RGB to the nearest color in a given palette size (quantization).
 * @param {number} r - Red value
 * @param {number} g - Green value
 * @param {number} b - Blue value
 * @param {number} depth - Max depth (e.g., 32 means 32 unique color levels)
 * @returns {{r: number, g: number, b: number}} - Quantized RGB
 */
function getNearestColor(r, g, b, depth) {
  const step = 256 / depth;
  const map = (val) => Math.round(val / step) * step;
  return { r: map(r), g: map(g), b: map(b) };
}

/**
 * Clamp a value between 0 and 255.
 * @param {number} x - Value to clamp
 * @returns {number} - Clamped value
 */
const clamp = (x) => Math.max(0, Math.min(255, x));

/**
 * Set the display message and button states.
 * @param {string} msg - The message to display.
 * @param {boolean} processing - If the app is currently processing.
 */
function setStatus(msg, processing = false) {
  isProcessing = processing;
  elements.outputInfo.innerHTML = processing
    ? `<span id="loadingIndicator">Memproses... ${msg}</span>`
    : msg;
  elements.applyButton.disabled = processing || originalFiles.length === 0;
  elements.downloadButton.disabled =
    processing ||
    originalFiles.length === 0 ||
    !Object.keys(processedImages).length;
  elements.toggleAdvancedButton.disabled =
    processing || originalFiles.length === 0;
  elements.uploadLabel.disabled = processing;
  elements.fileInput.disabled = processing;
}

// --- CORE IMAGE PROCESSING FUNCTIONS ---

/**
 * Apply color adjustments (Brightness, Contrast, Saturation, etc.) to image data.
 * @param {ImageData} imageData - The original image data.
 * @param {object} adjustments - Adjustment values from sliders.
 * @returns {ImageData} - New image data after adjustments.
 */
function applyColorAdjustments(imageData, adjustments) {
  const data = imageData.data;
  const len = data.length;
  const adjustedData = new Uint8ClampedArray(len);

  const br = adjustments.brightness / 100; // -1 to 1
  const co = (adjustments.contrast + 100) / 100; // 0.5 to 1.5
  const sa = (adjustments.saturation + 100) / 100; // 0 to 2
  const hl = adjustments.highlight / 50; // -1 to 1
  const sh = adjustments.shadow / 50; // -1 to 1
  const wb = adjustments.whiteBalance / (100 * 3); // -1/3 to 1/3 (blue ↔ yellow)
  const ti = adjustments.tint / (100 * 3); // -1/3 to 1/3 (green ↔ magenta)

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // === 1. Brightness & Contrast ===
    r = (r - 128) * co + 128 + br * 255;
    g = (g - 128) * co + 128 + br * 255;
    b = (b - 128) * co + 128 + br * 255;

    // === 2. Highlight / Shadow ===
    const Y = 0.299 * r + 0.587 * g + 0.114 * b;

    if (hl !== 0) {
      const amount = hl * 255;
      const ratio = Math.pow(Y / 255, 0.5);
      const adjust = amount * ratio;
      r += adjust;
      g += adjust;
      b += adjust;
    }

    if (sh !== 0) {
      const amount = sh * 255;
      const ratio = 1 - Math.pow(Y / 255, 0.5);
      const adjust = amount * ratio;
      r += adjust;
      g += adjust;
      b += adjust;
    }

    // === 3. White Balance / Tint ===
    if (wb > 0) {
      r = Math.min(255, r + wb * 255);
      g = Math.max(0, g + wb * 150);
      b = Math.max(0, b - wb * 150);
    } else if (wb < 0) {
      r = Math.max(0, r + wb * 150);
      g = Math.max(0, g + wb * 150);
      b = Math.min(255, b - wb * 255);
    }

    if (ti > 0) {
      r = Math.min(255, r + ti * 150);
      b = Math.min(255, b + ti * 150);
      g = Math.max(0, g - ti * 200);
    } else if (ti < 0) {
      g = Math.min(255, g - ti * 255);
      r = Math.max(0, r + ti * 100);
      b = Math.max(0, b + ti * 100);
    }

    // === 4. Saturation (YUV-style) ===
    const avg = (r + g + b) / 3;
    r = clamp(avg + (r - avg) * sa);
    g = clamp(avg + (g - avg) * sa);
    b = clamp(avg + (b - avg) * sa);

    adjustedData[i] = clamp(r);
    adjustedData[i + 1] = clamp(g);
    adjustedData[i + 2] = clamp(b);
    adjustedData[i + 3] = data[i + 3]; // alpha
  }

  return new ImageData(adjustedData, imageData.width, imageData.height);
}

function smoothImage() {
  if (!elements.smoothButton) return;
  smoothEffect = !smoothEffect;
  elements.smoothButton.classList.toggle("off", !smoothEffect);
  processImage();
}

/**
 * Process an image using Pixelation, Color Quantization, and Floyd-Steinberg Dithering.
 * @param {Canvas} canvas - The canvas containing the image.
 * @param {object} settings - The settings object from all sliders.
 * @returns {Canvas} - The canvas containing the processed image.
 */
function quantizeAndDither(canvas, settings) {
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;
  const sideLength = settings.baseSideLength;
  const depth = settings.colorDepth;
  const ditherStrength = settings.ditheringStrength;
  const noiseStrength = settings.noiseStrength;
  const lumaForNoise = settings.lumaForNoise;

  const longestSide = Math.max(originalWidth, originalHeight);
  const scaleFactor = sideLength / longestSide;

  // Gunakan pembulatan float agar rasio tetap proporsional dan halus
  const smallWidth = Math.max(1, Math.floor(originalWidth * scaleFactor));
  const smallHeight = Math.max(1, Math.floor(originalHeight * scaleFactor));

  elements.tempCanvas.width = smallWidth;
  elements.tempCanvas.height = smallHeight;
  elements.finalCanvas.width = originalWidth;
  elements.finalCanvas.height = originalHeight;

  const tempCtx = elements.tempCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  const finalCtx = elements.finalCanvas.getContext("2d");

  // 1️⃣ Downscale halus untuk "preview" effect
  if (smoothEffect == true) {
    tempCtx.imageSmoothingQuality = "high";
  } else {
    tempCtx.imageSmoothingQuality = "low";
  }

  tempCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight);

  // 2️⃣ Ambil hasilnya untuk proses lanjutan
  let imageData = tempCtx.getImageData(0, 0, smallWidth, smallHeight);

  // 3️⃣ Lakukan color adjustment sebelum quantization
  imageData = applyColorAdjustments(imageData, settings);

  const data = imageData.data;
  const w = smallWidth;
  const h = smallHeight;

  // 4️⃣ Quantization + Floyd-Steinberg dithering
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Tambah noise halus (opsional)
      // const noise = Math.floor(
      //   Math.random() * noiseStrength * 2 - noiseStrength
      // );
      // r = clamp(r + noise);
      // g = clamp(g + noise);
      // b = clamp(b + noise);

      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma <= lumaForNoise && noiseStrength > 0) {
        const noiseFactor = (1 - luma / 80) * noiseStrength;
        const noiseR = (Math.random() - 0.5) * 2 * noiseFactor;
        const noiseG = (Math.random() - 0.5) * 2 * noiseFactor;
        const noiseB = (Math.random() - 0.5) * 2 * noiseFactor;

        r = clamp(r + noiseR);
        g = clamp(g + noiseG);
        b = clamp(b + noiseB);
      }

      const newColor = getNearestColor(r, g, b, depth);

      const errR = (r - newColor.r) * ditherStrength;
      const errG = (g - newColor.g) * ditherStrength;
      const errB = (b - newColor.b) * ditherStrength;

      data[i] = newColor.r;
      data[i + 1] = newColor.g;
      data[i + 2] = newColor.b;

      // Distribusi error Floyd–Steinberg
      if (x + 1 < w) {
        data[i + 4] = clamp(data[i + 4] + errR * (7 / 16));
        data[i + 5] = clamp(data[i + 5] + errG * (7 / 16));
        data[i + 6] = clamp(data[i + 6] + errB * (7 / 16));
      }
      if (x > 0 && y + 1 < h) {
        const j = i + (w - 1) * 4;
        data[j] = clamp(data[j] + errR * (3 / 16));
        data[j + 1] = clamp(data[j + 1] + errG * (3 / 16));
        data[j + 2] = clamp(data[j + 2] + errB * (3 / 16));
      }
      if (y + 1 < h) {
        const j = i + w * 4;
        data[j] = clamp(data[j] + errR * (5 / 16));
        data[j + 1] = clamp(data[j + 1] + errG * (5 / 16));
        data[j + 2] = clamp(data[j + 2] + errB * (5 / 16));
      }
      if (x + 1 < w && y + 1 < h) {
        const j = i + (w + 1) * 4;
        data[j] = clamp(data[j] + errR * (1 / 16));
        data[j + 1] = clamp(data[j + 1] + errG * (1 / 16));
        data[j + 2] = clamp(data[j + 2] + errB * (1 / 16));
      }
    }
  }

  // 5️⃣ Tulis hasil kecil ke tempCanvas lagi
  tempCtx.putImageData(imageData, 0, 0);

  // 6️⃣ Upscale ke ukuran asli tanpa smoothing (agar pixel tetap tajam)
  finalCtx.imageSmoothingEnabled = false;
  finalCtx.drawImage(elements.tempCanvas, 0, 0, originalWidth, originalHeight);

  return elements.finalCanvas;
}

/**
 * Get all current settings from the sliders.
 */
function getSettings() {
  return {
    baseSideLength: parseInt(elements.baseSideLength.value),
    downloadMode:
      elements.downloadMode.value === "base"
        ? "base"
        : elements.downloadMode.value === "max"
        ? "max"
        : parseInt(elements.downloadMode.value),
    colorDepth: parseInt(elements.colorDepth.value),
    ditheringStrength: parseFloat(elements.ditheringStrength.value),
    noiseStrength: parseInt(elements.noiseStrength.value),
    lumaForNoise: parseInt(elements.lumaForNoise.value),
    brightness: parseInt(elements.brightness.value),
    contrast: parseInt(elements.contrast.value),
    highlight: parseInt(elements.highlight.value),
    shadow: parseInt(elements.shadow.value),
    saturation: parseInt(elements.saturation.value),
    whiteBalance: parseInt(elements.whiteBalance.value),
    tint: parseInt(elements.tint.value),
  };
}

// --- MAIN EXECUTION ---

/**
 * Process all loaded images with the current settings.
 */
async function processImage() {
  if (originalFiles.length === 0 || isProcessing) return;

  elements.downloadButton.disabled = true;
  elements.downloadButton.textContent = "Processing...";

  setStatus(`Memulai proses untuk ${originalFiles.length} gambar...`, true);

  if (originalFiles.length === 1) {
    const fileData = processedImages[originalFiles[0].name];
    await processSingleImage(fileData.originalCanvas, originalFiles[0].name);

    // Update single file preview
    elements.displayCanvas.width = fileData.originalCanvas.width;
    elements.displayCanvas.height = fileData.originalCanvas.height;
    elements.displayCanvas
      .getContext("2d")
      .drawImage(processedImages[originalFiles[0].name].processedCanvas, 0, 0);

    setStatus(`Selesai memproses 1 gambar.`, false);
  } else {
    // Multi-file mode
    elements.multiFileContainer.innerHTML = "";

    for (let i = 0; i < originalFiles.length; i++) {
      const file = originalFiles[i];
      const fileData = processedImages[file.name];

      elements.downloadButton.textContent = `${file.name} (${i + 1}/${
        originalFiles.length
      })`;

      setStatus(
        `Memproses: ${file.name} (${i + 1}/${originalFiles.length})`,
        true
      );

      await processSingleImage(fileData.originalCanvas, file.name);

      const card = createPreviewCard(file.name, fileData.originalImage);
      elements.multiFileContainer.appendChild(card);
    }

    setStatus(`Selesai memproses ${originalFiles.length} gambar.`, false);
  }
  elements.downloadButton.disabled = false;
  elements.downloadButton.textContent = "Simpan";
}

/**
 * Core function to run quantization/dithering on one image data set.
 * @param {Canvas} originalCanvas - The canvas holding the original image data.
 * @param {string} fileName - The name of the file being processed.
 */
function processSingleImage(originalCanvas, fileName) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const settings = getSettings();
      const finalCanvas = quantizeAndDither(originalCanvas, settings);

      const processedCanvasClone = document.createElement("canvas");
      processedCanvasClone.width = finalCanvas.width;
      processedCanvasClone.height = finalCanvas.height;
      processedCanvasClone.getContext("2d").drawImage(finalCanvas, 0, 0);

      processedImages[fileName].processedCanvas = processedCanvasClone;
      resolve();
    }, 50);
  });
}

function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // === Tambahkan logika ini untuk memastikan rendering sempurna ===
      requestAnimationFrame(() => {
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      });
    };

    img.onerror = () => {
      console.error(`Gagal memuat file: ${file.name}`);
      reject(new Error(`Gagal memuat gambar: ${file.name}`));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Handles file input change event.
 */
elements.fileInput.addEventListener("change", async (e) => {
  if (isProcessing) return;

  originalFiles = Array.from(e.target.files);
  processedImages = {};
  elements.multiFileContainer.innerHTML = "";
  setStatus(`Memuat ${originalFiles.length} gambar...`, true);

  try {
    for (const file of originalFiles) {
      setStatus(`Memuat: ${file.name}...`, true);
      const originalCanvas = await loadImageToCanvas(file);

      processedImages[file.name] = {
        originalCanvas: originalCanvas,
        processedCanvas: null,
        originalImage: originalCanvas,
      };
      await new Promise((r) => setTimeout(r, 100));
    }
    if (originalFiles.length > 0) {
      setStatus(
        `Semua file dimuat. Memberi jeda 100 milidetik untuk rendering...`,
        true
      );
      await new Promise((r) => setTimeout(r, 100));
    }

    if (originalFiles.length === 1) {
      // Single file mode
      elements.singleFileContainer.classList.remove("hidden");
      elements.multiFileContainer.classList.add("hidden");

      const fileData = processedImages[originalFiles[0].name];
      elements.displayCanvas.classList.remove("hidden");
      elements.placeholderText.classList.add("hidden");

      elements.displayCanvas.width = fileData.originalCanvas.width;
      elements.displayCanvas.height = fileData.originalCanvas.height;
      elements.displayCanvas
        .getContext("2d")
        .drawImage(fileData.originalCanvas, 0, 0);

      setStatus(`Selesai memuat 1 gambar. Klik 'Efek' untuk memproses.`, false);
    } else if (originalFiles.length > 1) {
      // Multi file mode
      elements.singleFileContainer.classList.add("hidden");
      elements.multiFileContainer.classList.remove("hidden");

      elements.multiFileContainer.innerHTML = "";
      originalFiles.forEach((file) => {
        const fileData = processedImages[file.name];
        const card = createPreviewCard(file.name, fileData.originalCanvas);
        elements.multiFileContainer.appendChild(card);
      });
    }

    setStatus(
      `Selesai memuat ${originalFiles.length} gambar. Klik 'Efek' untuk memproses.`,
      false
    );
    if (originalFiles.length > 0) {
      requestAnimationFrame(() => {
        processImage();
      });
    }
  } catch (error) {
    console.error(error);
    setStatus(`ERROR: ${error.message}.`, false);
    originalFiles = [];
    elements.displayCanvas.classList.add("hidden");
    elements.placeholderText.classList.remove("hidden");
  }
});

/**
 * Membuat elemen kartu pratinjau untuk file.
 * @param {string} fileName - Nama file.
 * @param {HTMLCanvasElement} canvas - Kanvas sumber (biasanya kanvas asli).
 * @returns {HTMLDivElement} Elemen kartu pratinjau yang dibuat.
 */
function createPreviewCard(fileName, canvas) {
  // 1. Buat kontainer kartu
  const card = document.createElement("div");
  card.className = "file-preview-card";
  card.id = `card-${fileName.replace(/[^a-zA-Z0-9]/g, "-")}`;

  // 2. Buat elemen kanvas pratinjau
  const previewCanvas = document.createElement("canvas");
  previewCanvas.className = "preview-canvas";
  previewCanvas.width = canvas.width;
  previewCanvas.height = canvas.height;

  // 3. Tentukan dan gambar sumber kanvas
  const sourceCanvas =
    processedImages[fileName]?.processedCanvas ||
    processedImages[fileName]?.originalCanvas;

  if (sourceCanvas) {
    previewCanvas
      .getContext("2d")
      .drawImage(sourceCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
  } else {
    console.warn(`Kanvas sumber tidak ditemukan untuk file: ${fileName}`);
  }

  // 4. Buat elemen judul
  const title = document.createElement("p");
  title.className = "file-title";
  title.textContent = fileName;
  title.title = fileName;

  // 5. Gabungkan elemen ke kartu
  card.appendChild(previewCanvas);
  card.appendChild(title);

  return card;
}
/**
 * Update the span next to the slider on input change.
 * @param {string} id - Base ID of the slider
 */
function updateSliderValue(id) {
  const slider = document.getElementById(id);
  const valueSpan = document.getElementById(id + "Value");
  if (valueSpan) {
    valueSpan.textContent = parseFloat(slider.value).toFixed(
      id.includes("dithering") ? 2 : 0
    );
  }
}

// Attach listeners to all sliders to update their labels
document.querySelectorAll('input[type="range"]').forEach((slider) => {
  updateSliderValue(slider.id); // Initial update
  slider.addEventListener("input", () => updateSliderValue(slider.id));
});

// Toggle Advanced Controls
elements.toggleAdvancedButton.addEventListener("click", () => {
  const isHidden =
    elements.advancedControls.classList.contains("hidden-controls");
  if (isHidden) {
    elements.advancedControls.classList.remove("hidden-controls");
    elements.advancedControls.classList.add("visible-controls");
    elements.toggleAdvancedButton.textContent = "Hidden";
    elements.toggleAdvancedButton.classList.add("on");
  } else {
    elements.advancedControls.classList.remove("visible-controls");
    elements.advancedControls.classList.add("hidden-controls");
    elements.toggleAdvancedButton.textContent = "More";
    elements.toggleAdvancedButton.classList.remove("on");
  }
});

/**
 * Resizes a canvas to the target max resolution while maintaining aspect ratio.
 * @param {Canvas} sourceCanvas - The canvas to resize.
 * @param {number} maxDimension - The maximum allowed dimension (width or height).
 * @returns {Canvas} - The resized canvas.
 */
function resizeCanvas(sourceCanvas, maxDimension) {
  if (maxDimension === "max") {
    return sourceCanvas; // No resize requested
  }

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (width <= maxDimension && height <= maxDimension) {
    return sourceCanvas; // Already small enough
  }

  let newWidth, newHeight;
  if (width > height) {
    newWidth = maxDimension;
    newHeight = Math.round(height * (maxDimension / width));
  } else {
    newHeight = maxDimension;
    newWidth = Math.round(width * (maxDimension / height));
  }

  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = newWidth;
  resizedCanvas.height = newHeight;
  const ctx = resizedCanvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

  return resizedCanvas;
}

/**
 * Menyesuaikan resolusi akhir gambar sesuai mode download (Integer Scaling).
 *
 * @param {Canvas} sourceCanvas - Kanvas hasil akhir pixelation (misalnya 240x180).
 * @param {number} baseSideLength - Ukuran sisi dasar pixelation (nilai slider 240).
 * @param {number|string} targetResolution - Resolusi target maksimum (misalnya 4096).
 * @returns {Canvas} - Kanvas yang sudah disesuaikan resolusinya.
 */
function applyDownloadMode(sourceCanvas, baseSideLength, targetResolution) {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  // 1. Tentukan Sisi Terpanjang Kanvas Sumber (setelah pixelation)
  const longestSrcSide = Math.max(srcW, srcH);

  let maxDownloadSide;
  if (targetResolution === "max") {
    maxDownloadSide = parseInt(longestSrcSide);
  } else if (targetResolution === "base") {
    maxDownloadSide = parseInt(baseSideLength);
  } else {
    maxDownloadSide = parseInt(targetResolution);
  }

  // 2. Hitung Skala Maksimum (Float) yang Diperbolehkan
  const scaleFactor = Math.max(1, Math.floor(maxDownloadSide / baseSideLength));
  const newBaseSideLenght = baseSideLength * scaleFactor;
  const maxScaleFinal = newBaseSideLenght / longestSrcSide;

  // 4. Hitung Dimensi Final
  const newW = srcW * maxScaleFinal;
  const newH = srcH * maxScaleFinal;

  // 5. Gambar Ulang ke Canvas Baru dengan Skala Integer
  const output = document.createElement("canvas");
  output.width = newW;
  output.height = newH;
  const ctx = output.getContext("2d");

  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(sourceCanvas, 0, 0, srcW, srcH, 0, 0, newW, newH);
  return output;
}

/**
 * Downloads the processed image(s).
 */
async function downloadAll() {
  if (isProcessing) return;
  await processImage();
  elements.downloadButton.disabled = true;
  elements.downloadButton.textContent = "Processing...";

  const filesToDownload = Object.keys(processedImages);
  if (filesToDownload.length === 0) {
    setStatus("Tidak ada gambar yang bisa disimpan.", false);
    return;
  }

  const maxDimensionStr = elements.downloadMode.value;
  const maxDimension = isNaN(parseInt(maxDimensionStr))
    ? maxDimensionStr
    : parseInt(maxDimensionStr);
  const isBaseDownload = maxDimensionStr === "base";

  setStatus(`Menyiapkan ${filesToDownload.length} file untuk diunduh...`, true);

  try {
    for (let i = 0; i < filesToDownload.length; i++) {
      const fileName = filesToDownload[i];
      const fileData = processedImages[fileName];

      if (!fileData.processedCanvas) {
        setStatus(`❌ ERROR: ${fileName} belum diproses.`, false);
        continue;
      }

      let canvasToDownload;
      const settings = getSettings();
      const sourceCanvas = fileData.processedCanvas;
      canvasToDownload = applyDownloadMode(
        sourceCanvas,
        settings.baseSideLength,
        settings.downloadMode
      );

      const sideLength = settings.baseSideLength;
      const srcW = sourceCanvas.width;
      const srcH = sourceCanvas.height;

      let baseWidth, baseHeight;

      if (srcW >= srcH) {
        baseWidth = sideLength;
        baseHeight = Math.round((srcH / srcW) * sideLength);
      } else {
        baseHeight = sideLength;
        baseWidth = Math.round((srcW / srcH) * sideLength);
      }
      const originalFileNameBase = fileName.replace(/\.[^/.]+$/, "");

      const now = new Date();
      const pad = (num) => String(num).padStart(2, "0");
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());
      const seconds = pad(now.getSeconds());
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

      let smoothValue = "";
      if (smoothEffect == true) {
        smoothValue = "smooth_";
      }

      const exifControls = `Pixel_Art_${baseWidth}x${baseHeight}_${originalFileNameBase}_${timestamp}_${smoothValue}cd${elements.colorDepth.value}_ds${elements.ditheringStrength.value}_ns${elements.noiseStrength.value}_ln${elements.lumaForNoise.value}_br${elements.brightness.value}_co${elements.contrast.value}_hl${elements.highlight.value}_sh${elements.shadow.value}_sa${elements.saturation.value}_wb${elements.whiteBalance.value}_ti${elements.tint.value}_Kyuziera.png`;
      const finalFileName = exifControls;
      const link = document.createElement("a");
      link.href = canvasToDownload.toDataURL("image/png");
      link.download = finalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await new Promise((r) => setTimeout(r, 200));
    }

    setStatus(`✅ Selesai mengunduh ${filesToDownload.length} file.`, false);

    elements.downloadButton.textContent = "Berhasil Disimpan!";

    setTimeout(() => {
      elements.downloadButton.disabled = false;
      elements.downloadButton.textContent = "Simpan";
    }, 800);
  } catch (error) {
    console.error("Gagal mengunduh file:", error);
    setStatus("Terjadi kesalahan saat mengunduh.", false);
    elements.downloadButton.disabled = false;
    elements.downloadButton.textContent = "Simpan";
  }
}

elements.downloadButton.addEventListener("click", downloadAll);
// --- INITIALIZATION ---
window.onload = () => {
  setStatus("Silakan unggah foto Anda.", false);
};

// ====== Daftar elemen yang berperan sebagai input slider ======
const sliderKeys = [
  "baseSideLength",
  "colorDepth",
  "ditheringStrength",
  "noiseStrength",
  "lumaForNoise",
  "brightness",
  "contrast",
  "highlight",
  "shadow",
  "saturation",
  "whiteBalance",
  "tint",
];

// === Debounce helper ===
function debounce(fn, delay = 100) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// === Versi dengan auto-refresh 500ms setelah slider berhenti bergerak ===
const debouncedProcessImage = debounce(() => processImage(), 500);

sliderKeys.forEach((key) => {
  const el = elements[key];
  if (!el) return;

  el.addEventListener("input", debouncedProcessImage);
  el.addEventListener("change", processImage);
});

function restrictSliderTap(slider, toleranceDesktop = 15, toleranceTouch = 30) {
  if (!slider) return;

  slider.addEventListener("mousedown", (e) => {
    const rect = e.target.getBoundingClientRect();
    const handlePosition =
      ((slider.value - slider.min) / (slider.max - slider.min)) * rect.width;
    if (Math.abs(e.offsetX - handlePosition) > toleranceDesktop) {
      e.preventDefault();
    }
  });

  slider.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const handlePosition =
      ((slider.value - slider.min) / (slider.max - slider.min)) * rect.width;
    if (Math.abs(x - handlePosition) > toleranceTouch) {
      e.preventDefault();
    }
  });
}

[
  elements.baseSideLength,
  elements.colorDepth,
  elements.ditheringStrength,
  elements.noiseStrength,
  elements.lumaForNoise,
  elements.brightness,
  elements.contrast,
  elements.highlight,
  elements.shadow,
  elements.saturation,
  elements.whiteBalance,
  elements.tint,
].forEach((slider) => restrictSliderTap(slider));