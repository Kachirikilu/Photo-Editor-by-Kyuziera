const imageUpload = document.getElementById("imageUpload");
const frameRatioSelect = document.getElementById("frameRatioSelect");
const frameOrientation = document.getElementById("frameOrientation");
const paddingSlider = document.getElementById("paddingSlider");
const paddingValueDiv = document.getElementById("paddingValueDiv");
const colorManual = document.getElementById("colorManual");
const downloadButton = document.getElementById("downloadButton");
const frameContainer = document.getElementById("frameContainer");
const imageWrapper = document.getElementById("imageWrapper");
const imagePreview = document.getElementById("imagePreview");
const placeholderText = document.getElementById("placeholderText");
const maxSizeSelect = document.getElementById("maxSizeSelect");
const colorTemplates = document.querySelectorAll(".color-swatch");
const previewArea = document.querySelector(".preview-area");

let MAX_SIZE = 4096;
let originalFileNameBase = "Foto";
let originalImages = [];
let previewImage = null;

function customInput(preset) {
  const ratioSelect = document.getElementById("frameRatioSelect");
  const orientationSelect = document.getElementById("frameOrientation");

  if (preset === 1) {
    ratioSelect.value = "original";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 3;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "6%";
  } else if (preset === 2) {
    ratioSelect.value = "16:9";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 3;
    colorManual.value = "#935a4d";
    paddingValueDiv.textContent = "6%";
  } else if (preset === 3) {
    ratioSelect.value = "3:2";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 3;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "6%";
  } else if (preset === 4) {
    ratioSelect.value = "3:2";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 4;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "8%";
  } else if (preset === 5) {
    ratioSelect.value = "1:1";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 4;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "8%";
  } else if (preset === 6) {
    ratioSelect.value = "5:4";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 4;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "8%";
  } else if (preset === 7) {
    ratioSelect.value = "7:5";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 3;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "6%";
  } else if (preset === 8) {
    ratioSelect.value = "16:10";
    orientationSelect.value = "vertikal";
    paddingSlider.value = 4;
    colorManual.value = "#ffffff";
    paddingValueDiv.textContent = "8%";
  }

  applyFrame();
}

function loadImages(event) {
  const files = Array.from(event.target.files).filter((f) =>
    f.type.startsWith("image/")
  );
  if (!files.length) return;

  originalFileNameBase = files[0].name.replace(/\.[^/.]+$/, "");
  originalImages = files;

  const reader = new FileReader();
  reader.onload = function (e) {
    imagePreview.src = e.target.result;
    imagePreview.onload = () => {
      previewImage = new Image();
      previewImage.src = e.target.result;
      placeholderText.classList.add("hidden");
      frameContainer.classList.remove("hidden");
      downloadButton.disabled = false;
      applyFrame();
    };
  };
  reader.readAsDataURL(files[0]);
}

/**
 * Memuat gambar ke pratinjau utama (imagePreview) dan mengembalikan objek Image.
 * Ini penting untuk memaksa browser memuat data sumber sebelum diproses.
 * @param {File} file - File gambar yang akan dimuat.
 * @returns {Promise<HTMLImageElement>} - Objek Image yang telah dimuat.
 */
function loadPreviewImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      imagePreview.src = e.target.result;

      img.onload = function () {
        setTimeout(() => resolve(img), 50);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function calculateFrameSize(
  imgWidth,
  imgHeight,
  ratioValue,
  paddingPercent,
  maxPreviewWidth = null,
  maxPreviewHeight = null
) {
  let targetWidth = imgWidth;
  let targetHeight = imgHeight;

  if (ratioValue !== "original") {
    const [rw, rh] = ratioValue.split(":").map(Number);
    const frameRatio = rw / rh;
    const imageRatio = imgWidth / imgHeight;

    if (frameRatio > imageRatio) {
      targetWidth = imgHeight * frameRatio;
      targetHeight = imgHeight;
    } else {
      targetWidth = imgWidth;
      targetHeight = imgWidth / frameRatio;
    }
  }

  if (maxPreviewWidth && maxPreviewHeight) {
    const scaleW = maxPreviewWidth / targetWidth;
    const scaleH = maxPreviewHeight / targetHeight;
    const scale = Math.min(scaleW, scaleH, 1);
    targetWidth *= scale;
    targetHeight *= scale;
  }

  const padding = (Math.min(targetWidth, targetHeight) * paddingPercent) / 2;
  return { width: targetWidth, height: targetHeight, padding };
}

function flipRatio(ratio) {
  if (ratio === "original" || ratio === "1:1") return ratio;
  const parts = ratio.split(":");
  if (parts.length === 2) return parts[1] + ":" + parts[0];
  return ratio;
}

function applyFrame() {
  if (!previewImage) return;

  let ratioValue = frameRatioSelect.value;
  const orienValue = frameOrientation.value;
  if (orienValue === "vertikal") ratioValue = flipRatio(ratioValue);

  const paddingPercent = parseFloat(paddingSlider.value) / 100;
  const frameColor = colorManual.value;

  const MAX_PREVIEW_HEIGHT = 420;
  const MAX_PREVIEW_WIDTH = previewArea.offsetWidth;

  const { width, height, padding } = calculateFrameSize(
    previewImage.width,
    previewImage.height,
    ratioValue,
    paddingPercent,
    MAX_PREVIEW_WIDTH,
    MAX_PREVIEW_HEIGHT
  );

  frameContainer.style.setProperty("--frame-color", frameColor);
  frameContainer.style.setProperty("--frame-padding", `${padding}px`);
  frameContainer.style.width = width + "px";
  frameContainer.style.height = height + "px";
}

async function downloadFrames() {
  if (!originalImages.length) return;

  downloadButton.disabled = true;
  downloadButton.textContent = "Processing...";

  let ratioValue = frameRatioSelect.value;
  const orienValue = frameOrientation.value;
  if (orienValue === "vertikal") ratioValue = flipRatio(ratioValue);

  const paddingPercent = parseFloat(paddingSlider.value) / 100;
  const frameColor = colorManual.value;

  for (let i = 0; i < originalImages.length; i++) {
    const file = originalImages[i];

    // 1. ROTASI PREVIEW (KUNCI PERBAIKAN)
    downloadButton.textContent = `Memproses: ${file.name} (${i + 1}/${
      originalImages.length
    })`;

    try {
      const img = await loadPreviewImage(file);
      let { width, height, padding } = calculateFrameSize(
        img.width,
        img.height,
        ratioValue,
        paddingPercent
      );
      downloadButton.disabled = true;

      let canvasWidth, canvasHeight;
      let oriImageWidth = img.width;
      let oriImageHeight = img.height;
      let scale = 1;

      if (MAX_SIZE !== null) {
        scale = MAX_SIZE / Math.max(width, height);
        padding *= scale;
      }

      canvasWidth = width * scale;
      canvasHeight = height * scale;

      if (img.width / img.height < 1) {
        oriImageHeight = img.height * scale;
        oriImageWidth = (oriImageHeight * img.width) / img.height;
      } else {
        oriImageWidth = img.width * scale;
        oriImageHeight = (oriImageWidth * img.height) / img.width;
      }

      const finalImageWidth = canvasWidth - padding * 2;
      const finalImageHeight = canvasHeight - padding * 2;

      const ratioFit = Math.min(
        finalImageWidth / img.width,
        finalImageHeight / img.height
      );
      const drawWidth = img.width * ratioFit;
      const drawHeight = img.height * ratioFit;

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = frameColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const offsetX = (canvasWidth - drawWidth) / 2;
      const offsetY = (canvasHeight - drawHeight) / 2;

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      const link = document.createElement("a");
      const now = new Date();
      const pad = (num) => String(num).padStart(2, "0");
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());
      const seconds = pad(now.getSeconds());
      const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

      const finalFileName = `Frame_${file.name.replace(
        /\.[^/.]+$/,
        ""
      )}_${timestamp}_Kyuziera.png`;

      link.download = finalFileName;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(`Gagal memproses file: ${file.name}`, error);
    }
  }

  downloadButton.disabled = false;
  downloadButton.textContent = "Berhasil Disimpan!";
  setTimeout(() => {
    downloadButton.textContent = "Simpan";
  }, 800);
}
imageUpload.addEventListener("change", loadImages);
frameRatioSelect.addEventListener("change", applyFrame);
frameOrientation.addEventListener("change", applyFrame);
paddingSlider.addEventListener("input", () => {
  paddingValueDiv.textContent = 2 * paddingSlider.value + "%";
  applyFrame();
});
colorManual.addEventListener("input", applyFrame);
colorTemplates.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    colorManual.value = swatch.getAttribute("data-color");
    applyFrame();
  });
});
downloadButton.addEventListener("click", downloadFrames);

maxSizeSelect.addEventListener("change", () => {
  MAX_SIZE =
    maxSizeSelect.value === "max" ? null : parseInt(maxSizeSelect.value, 10);
});

paddingValueDiv.textContent = 2 * paddingSlider.value + "%";