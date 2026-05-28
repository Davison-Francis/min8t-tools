/**
 * GIF Compressor - single-file consolidated workspace.
 *
 * Wraps the gifsicle-wasm-browser package - full gifsicle compiled to
 * WebAssembly. One GIF at a time, live re-compresses on slider/preset
 * change, animated preview replaces the dropzone.
 *
 * Files NEVER leave the browser.
 */
import gifsicle from 'https://cdn.jsdelivr.net/npm/gifsicle-wasm-browser@1.5.19/+esm';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('file-input');
const workspace    = document.getElementById('workspace');
const filenameEl   = document.getElementById('filename');
const sizeInfoEl   = document.getElementById('size-info');
const reductionEl  = document.getElementById('reduction');
const downloadBtn  = document.getElementById('download-btn');
const clearBtn     = document.getElementById('clear-btn');
const previewImg   = document.getElementById('preview-img');
const overlay      = document.getElementById('overlay');
const overlayText  = document.getElementById('overlay-text');

const widthInput   = document.getElementById('width-input');
const widthValue   = document.getElementById('width-value');
const lossyInput   = document.getElementById('lossy-input');
const lossyValue   = document.getElementById('lossy-value');
const colorsInput  = document.getElementById('colors-input');
const colorsValue  = document.getElementById('colors-value');
const loopsInput   = document.getElementById('loops-input');
const presetBtns   = document.querySelectorAll('.preset-btn');
const toast        = document.getElementById('toast');
const ctaEditor    = document.getElementById('cta-editor');

const PRESETS = {
  outlook: { width: 600, lossy: 80,  colors: 128, loops: 1 },
  mobile:  { width: 480, lossy: 100, colors: 64,  loops: 0 },
  max:     { width: 400, lossy: 200, colors: 32,  loops: 0 },
};

let currentFile = null;
let currentBlob = null;
let currentUrl = null;
let recompressTimer;
let trackedThisSession = false;

// ---- file selection ----
fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) loadFile(file);
});
['dragenter', 'dragover'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragging'); });
});
['dragleave', 'drop'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragging'); });
});
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  if (file.type !== 'image/gif') { showToast(`${file.name} isn't a GIF`); return; }
  if (file.size > MAX_FILE_BYTES) { showToast(`${file.name} > 25 MB`); return; }
  currentFile = file;
  filenameEl.textContent = file.name;
  dropzone.classList.add('hidden');
  workspace.classList.add('active');
  if (!trackedThisSession) {
    trackToolUsed('gif-compressor', 'compress');
    trackedThisSession = true;
  }
  compress();
}

// ---- compression ----
function buildCommand() {
  const w = parseInt(widthInput.value, 10);
  const l = parseInt(lossyInput.value, 10);
  const c = parseInt(colorsInput.value, 10);
  const loops = parseInt(loopsInput.value, 10);
  return `-O3 --lossy=${l} --colors=${c} --resize-fit-width ${w} --loopcount=${loops} -o /out/out.gif /in.gif`;
}

async function compress() {
  if (!currentFile) return;
  setOverlay(true, 'Compressing...');
  downloadBtn.disabled = true;
  try {
    const result = await gifsicle.run({
      input: [{ file: currentFile, name: 'in.gif' }],
      command: [buildCommand()],
    });
    // result[0] is a File-like or Blob from the WASM virtual FS.
    // Force-wrap with image/gif MIME so <img> recognizes animation.
    const raw = result[0];
    const buf = raw instanceof Blob ? await raw.arrayBuffer() : raw;
    currentBlob = new Blob([buf], { type: 'image/gif' });

    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(currentBlob);
    previewImg.src = currentUrl;
    previewImg.hidden = false;

    const orig = currentFile.size;
    const comp = currentBlob.size;
    const pct = Math.round((1 - comp / orig) * 100);
    sizeInfoEl.textContent = `${formatBytes(orig)} → ${formatBytes(comp)}`;
    reductionEl.hidden = false;
    reductionEl.textContent = `${pct >= 0 ? '−' : '+'}${Math.abs(pct)}%`;
    reductionEl.classList.toggle('bad', pct < 0);
    downloadBtn.disabled = false;
  } catch (err) {
    console.error('gif compress failed:', err);
    showToast('Compression failed. Try a smaller GIF or different settings.');
    sizeInfoEl.textContent = `${formatBytes(currentFile.size)} → ERROR`;
  } finally {
    setOverlay(false);
  }
}

function setOverlay(show, text) {
  if (text) overlayText.textContent = text;
  overlay.classList.toggle('show', show);
}

// ---- live recompress ----
function scheduleRecompress() {
  clearTimeout(recompressTimer);
  recompressTimer = setTimeout(() => { if (currentFile) compress(); }, 400);
}
widthInput.addEventListener('input',  () => { widthValue.textContent  = widthInput.value;  scheduleRecompress(); });
lossyInput.addEventListener('input',  () => { lossyValue.textContent  = lossyInput.value;  scheduleRecompress(); });
colorsInput.addEventListener('input', () => { colorsValue.textContent = colorsInput.value; scheduleRecompress(); });
loopsInput.addEventListener('input',  scheduleRecompress);

presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    presetBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const p = PRESETS[btn.dataset.preset];
    widthInput.value  = p.width;  widthValue.textContent  = p.width;
    lossyInput.value  = p.lossy;  lossyValue.textContent  = p.lossy;
    colorsInput.value = p.colors; colorsValue.textContent = p.colors;
    loopsInput.value  = p.loops;
    if (currentFile) compress();
    trackToolUsed('gif-compressor', 'preset', { preset: btn.dataset.preset });
  });
});

// ---- actions ----
downloadBtn.addEventListener('click', () => {
  if (!currentBlob || !currentFile) return;
  const link = document.createElement('a');
  link.href = currentUrl;
  link.download = currentFile.name.replace(/\.gif$/i, '') + '-compressed.gif';
  link.click();
  trackToolUsed('gif-compressor', 'download');
});

clearBtn.addEventListener('click', () => {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentFile = null;
  currentBlob = null;
  currentUrl = null;
  previewImg.src = '';
  previewImg.hidden = true;
  sizeInfoEl.textContent = '—';
  reductionEl.hidden = true;
  downloadBtn.disabled = true;
  workspace.classList.remove('active');
  dropzone.classList.remove('hidden');
  fileInput.value = '';
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('gif-compressor', 'editor'));

// ---- helpers ----
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
