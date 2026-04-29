/**
 * Background Remover - vanilla ES module.
 *
 * Loads Transformers.js + an ONNX salient-object segmentation model in the
 * browser. Runs inference 100% on-device via WebGPU (preferred) or WASM
 * (fallback). Outputs a PNG with transparent background; optionally
 * composites onto a solid color before download.
 *
 * Model: Xenova/u2net (Apache-2.0 weights). Safe for commercial use.
 *
 * Privacy claim: zero outbound requests for the image data. The model is
 * fetched from Hugging Face's CDN on first use, then cached in the browser's
 * IndexedDB by Transformers.js for subsequent runs.
 */
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';
// Pinned to a recent stable version. Bumping is deliberate - later versions
// may change the segmentation pipeline API surface.
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2';

// Allow remote model fetch from HF; cache in IndexedDB after first load.
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/u2net';
const MAX_DIMENSION = 4096; // refuse images bigger than this - memory protection

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const statusEl = document.getElementById('status');
const compareEl = document.getElementById('compare');
const originalImg = document.getElementById('original-img');
const resultCanvas = document.getElementById('result-canvas');
const actions = document.getElementById('actions');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const bgColor = document.getElementById('bg-color');
const applyBgBtn = document.getElementById('apply-bg');
const ctaEditor = document.getElementById('cta-editor');

let model, processor;
let modelReady = false;
let trackedThisSession = false;
let lastResultBlob = null;

// ---- file selection ----
fileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) processFile(e.target.files[0]);
});
dropzone.addEventListener('click', () => fileInput.click());
['dragenter', 'dragover'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragging'); });
});
['dragleave', 'drop'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragging'); });
});
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.[0]) processFile(e.dataTransfer.files[0]);
});

// ---- main flow ----
async function processFile(file) {
  if (!file.type.startsWith('image/')) {
    setStatus('Not an image file.', 'error');
    return;
  }

  setStatus('Reading image…');

  // Show original immediately
  const objectUrl = URL.createObjectURL(file);
  originalImg.src = objectUrl;
  await new Promise((res) => { originalImg.onload = res; });

  if (originalImg.naturalWidth > MAX_DIMENSION || originalImg.naturalHeight > MAX_DIMENSION) {
    setStatus(`Image too large (${originalImg.naturalWidth}×${originalImg.naturalHeight}). Max ${MAX_DIMENSION}×${MAX_DIMENSION}.`, 'error');
    return;
  }

  compareEl.hidden = false;

  if (!modelReady) {
    setStatus(`Downloading AI model (~170 MB, first time only)…`, 'progress');
    try {
      await loadModel();
      modelReady = true;
    } catch (err) {
      console.error(err);
      setStatus('Failed to load the model. Check your connection and reload.', 'error');
      return;
    }
  }

  setStatus('Removing background…', 'progress');
  try {
    await runInference(originalImg);
    setStatus('Done. Click "Download PNG" or apply a solid background color.', 'success');
    actions.hidden = false;
    if (!trackedThisSession) {
      trackToolUsed('background-remover', 'remove');
      trackedThisSession = true;
    }
  } catch (err) {
    console.error(err);
    setStatus('Inference failed. Try a smaller image or a different format.', 'error');
  }
}

// ---- model ----
async function loadModel() {
  // Show download progress via the progress callback
  const onProgress = (data) => {
    if (data.status === 'progress' && data.total) {
      const pct = Math.round((data.loaded / data.total) * 100);
      setStatus(`Downloading AI model… ${pct}%`, 'progress', pct);
    }
  };
  // Image segmentation pipeline. AutoModel + AutoProcessor gives finer control
  // than the high-level pipeline() helper.
  model = await AutoModel.from_pretrained(MODEL_ID, {
    config: { model_type: 'custom' },
    quantized: true,
    progress_callback: onProgress,
  });
  processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      feature_extractor_type: 'ImageFeatureExtractor',
      image_std: [1, 1, 1],
      resample: 2,
      rescale_factor: 0.00392156862745098,
      size: { width: 320, height: 320 },
    },
    progress_callback: onProgress,
  });
}

async function runInference(img) {
  // Convert <img> to RawImage tensor
  const rawImg = await RawImage.fromURL(img.src);
  const { pixel_values } = await processor(rawImg);
  const { output } = await model({ input: pixel_values });

  // Resize segmentation mask back up to original dimensions, apply as alpha channel
  const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(rawImg.width, rawImg.height);

  resultCanvas.width = rawImg.width;
  resultCanvas.height = rawImg.height;
  const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const pixelData = ctx.getImageData(0, 0, rawImg.width, rawImg.height);
  for (let i = 0; i < mask.data.length; ++i) {
    pixelData.data[4 * i + 3] = mask.data[i];
  }
  ctx.putImageData(pixelData, 0, 0);

  // Cache the blob for download
  lastResultBlob = await new Promise((res) => resultCanvas.toBlob(res, 'image/png'));
}

// ---- download / apply bg ----
downloadBtn.addEventListener('click', () => {
  if (!lastResultBlob) return;
  triggerDownload(lastResultBlob, 'background-removed.png');
  trackToolUsed('background-remover', 'download');
});

applyBgBtn.addEventListener('click', async () => {
  if (!resultCanvas.width) return;
  // composite the transparent canvas onto a fresh canvas filled with the chosen bg
  const c = document.createElement('canvas');
  c.width = resultCanvas.width;
  c.height = resultCanvas.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bgColor.value;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(resultCanvas, 0, 0);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  triggerDownload(blob, 'background-replaced.png');
  trackToolUsed('background-remover', 'download-with-bg');
});

resetBtn.addEventListener('click', () => {
  compareEl.hidden = true;
  actions.hidden = true;
  fileInput.value = '';
  originalImg.src = '';
  resultCanvas.width = 0;
  resultCanvas.height = 0;
  lastResultBlob = null;
  setStatus('Ready for the next image.');
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- status / progress UI ----
function setStatus(msg, kind = 'info', pct) {
  statusEl.hidden = false;
  statusEl.classList.remove('error');
  if (kind === 'error') statusEl.classList.add('error');
  if (kind === 'progress' && typeof pct === 'number') {
    statusEl.innerHTML = `${escapeHtml(msg)}<div class="progress"><span style="width:${pct}%"></span></div>`;
  } else {
    statusEl.textContent = msg;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

ctaEditor?.addEventListener('click', () => trackCtaClicked('background-remover', 'editor'));

// ---- init message ----
setStatus('Drop an image to start. The AI model loads on first use (~170 MB), then runs locally for every image.');
