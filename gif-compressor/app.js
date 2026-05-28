/**
 * GIF Compressor - vanilla ES module.
 *
 * Wraps the gifsicle-wasm-browser package (renzhezhilu/gifsicle-wasm-browser,
 * MIT) - full gifsicle binary compiled to WebAssembly. Library API takes a
 * gif blob plus a CLI-style command string and returns the compressed
 * output blob.
 *
 * Three email-aware presets, plus four manual controls (max width / lossy /
 * colors / loops). Settings re-apply live to all loaded files. Single +
 * bulk ZIP download. Total payload counter flags red over 1 MB.
 *
 * Files NEVER leave the browser. WASM binary loaded from jsdelivr on first
 * use (~600 KB), cached after.
 */
import gifsicle from 'https://cdn.jsdelivr.net/npm/gifsicle-wasm-browser@1.5.19/+esm';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PAYLOAD_WARN   = 700  * 1024;
const PAYLOAD_BAD    = 1024 * 1024;

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const widthInput = document.getElementById('width-input');
const widthValue = document.getElementById('width-value');
const lossyInput = document.getElementById('lossy-input');
const lossyValue = document.getElementById('lossy-value');
const colorsInput = document.getElementById('colors-input');
const colorsValue = document.getElementById('colors-value');
const loopsInput = document.getElementById('loops-input');
const presetBtns = document.querySelectorAll('.preset-btn');
const summary = document.getElementById('summary');
const totalSizeEl = document.getElementById('total-size');
const clearBtn = document.getElementById('clear-btn');
const zipBtn = document.getElementById('zip-btn');
const resultsEl = document.getElementById('results');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');

const PRESETS = {
  outlook: { width: 600, lossy: 80,  colors: 128, loops: 1 },
  mobile:  { width: 480, lossy: 100, colors: 64,  loops: 0 },
  max:     { width: 400, lossy: 200, colors: 32,  loops: 0 },
};

/** @type {Array<{id, file, originalUrl, compressed?, compressedUrl?, busy}>} */
const items = [];
let recompressTimer;
let trackedThisSession = false;

// ---- file selection ----
fileInput.addEventListener('change', (e) => addFiles(e.target.files));
['dragenter', 'dragover'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragging'); });
});
['dragleave', 'drop'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragging'); });
});
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
  let added = 0;
  for (const file of Array.from(fileList)) {
    if (file.type !== 'image/gif') {
      showToast(`${file.name} isn't a GIF`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast(`${file.name} > 25 MB - skipping`);
      continue;
    }
    items.push({
      id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      originalUrl: URL.createObjectURL(file),
      compressed: null,
      compressedUrl: null,
      busy: true,
    });
    added++;
  }
  if (added > 0) {
    if (!trackedThisSession) {
      trackToolUsed('gif-compressor', 'compress');
      trackedThisSession = true;
    }
    render();
    compressAll();
  }
}

// ---- compression ----
function buildCommand(filename) {
  const w = parseInt(widthInput.value, 10);
  const l = parseInt(lossyInput.value, 10);
  const c = parseInt(colorsInput.value, 10);
  const loops = parseInt(loopsInput.value, 10);
  // gifsicle args: optimize, lossy, colors, resize, loopcount, in/out paths
  // The library uses /in/ and /out/ virtual filesystems
  return [
    `-O3`,
    `--lossy=${l}`,
    `--colors=${c}`,
    `--resize-fit-width ${w}`,
    `--loopcount=${loops}`,
    `-o /out/${filename}`,
    `/in/${filename}`,
  ].join(' ');
}

async function compressAll() {
  for (const item of items) item.busy = true;
  render();
  for (const item of items) {
    try {
      const cmd = buildCommand(item.file.name);
      const buf = await item.file.arrayBuffer();
      const result = await gifsicle.run({
        input: [{ file: new Uint8Array(buf), name: item.file.name }],
        command: [cmd],
      });
      const outFile = result[0];
      const outBlob = new Blob([outFile], { type: 'image/gif' });
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      item.compressed = outBlob;
      item.compressedUrl = URL.createObjectURL(outBlob);
    } catch (err) {
      console.error('gif compress failed:', item.file.name, err);
      item.compressed = null;
      item.compressedUrl = null;
    }
    item.busy = false;
    render();
  }
}

// ---- live recompress on slider change (debounced) ----
function scheduleRecompress() {
  clearTimeout(recompressTimer);
  recompressTimer = setTimeout(() => {
    if (items.length > 0) compressAll();
  }, 500);
}
widthInput.addEventListener('input', () => {
  widthValue.textContent = widthInput.value;
  scheduleRecompress();
});
lossyInput.addEventListener('input', () => {
  lossyValue.textContent = lossyInput.value;
  scheduleRecompress();
});
colorsInput.addEventListener('input', () => {
  colorsValue.textContent = colorsInput.value;
  scheduleRecompress();
});
loopsInput.addEventListener('input', scheduleRecompress);

presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    presetBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const p = PRESETS[btn.dataset.preset];
    widthInput.value = p.width;  widthValue.textContent = p.width;
    lossyInput.value = p.lossy;  lossyValue.textContent = p.lossy;
    colorsInput.value = p.colors; colorsValue.textContent = p.colors;
    loopsInput.value = p.loops;
    if (items.length > 0) compressAll();
    trackToolUsed('gif-compressor', 'preset', { preset: btn.dataset.preset });
  });
});

// ---- rendering ----
function render() {
  if (items.length === 0) {
    summary.hidden = true;
    resultsEl.innerHTML = '';
    return;
  }
  summary.hidden = false;
  resultsEl.innerHTML = '';
  let total = 0;
  for (const item of items) {
    const compressedBytes = item.compressed?.size ?? 0;
    const reductionPct = item.compressed
      ? Math.round((1 - compressedBytes / item.file.size) * 100)
      : null;
    const reductionClass = reductionPct !== null && reductionPct < 0 ? 'reduction bad' : 'reduction';
    if (!item.busy) total += compressedBytes;

    const card = document.createElement('div');
    card.className = 'result-card' + (item.busy ? ' processing' : '');
    card.innerHTML = `
      <div class="head">
        <strong>${escapeHtml(item.file.name)}</strong>
        <span class="stats">
          ${formatBytes(item.file.size)} → ${item.busy ? '…' : formatBytes(compressedBytes)}
          ${reductionPct !== null ? `<span class="${reductionClass}">${reductionPct >= 0 ? '−' : '+'}${Math.abs(reductionPct)}%</span>` : ''}
        </span>
      </div>
      <div class="compare">
        <figure>
          <figcaption>Original</figcaption>
          <img src="${item.originalUrl}" alt="original">
        </figure>
        <figure>
          <figcaption>Compressed</figcaption>
          ${item.compressedUrl ? `<img src="${item.compressedUrl}" alt="compressed">` : '<div style="padding:60px 0; color:var(--text-muted)">…</div>'}
        </figure>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" data-action="download" data-id="${item.id}" ${item.busy || !item.compressed ? 'disabled' : ''}>Download</button>
        <button class="btn btn-secondary" data-action="remove" data-id="${item.id}">✕ Remove</button>
      </div>
    `;
    resultsEl.appendChild(card);
  }
  totalSizeEl.textContent = formatBytes(total);
  totalSizeEl.classList.toggle('warn', total > PAYLOAD_WARN && total <= PAYLOAD_BAD);
  totalSizeEl.classList.toggle('bad',  total > PAYLOAD_BAD);
}

resultsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === 'remove') removeItem(id);
  if (btn.dataset.action === 'download') downloadItem(id);
});

function removeItem(id) {
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    URL.revokeObjectURL(items[idx].originalUrl);
    if (items[idx].compressedUrl) URL.revokeObjectURL(items[idx].compressedUrl);
    items.splice(idx, 1);
    render();
  }
}

function downloadItem(id) {
  const item = items.find((i) => i.id === id);
  if (!item || !item.compressed) return;
  const link = document.createElement('a');
  link.href = item.compressedUrl;
  link.download = item.file.name;
  link.click();
  trackToolUsed('gif-compressor', 'download');
}

clearBtn.addEventListener('click', () => {
  for (const i of items) {
    URL.revokeObjectURL(i.originalUrl);
    if (i.compressedUrl) URL.revokeObjectURL(i.compressedUrl);
  }
  items.length = 0;
  render();
});

zipBtn.addEventListener('click', async () => {
  const ready = items.filter((i) => i.compressed);
  if (ready.length === 0) { showToast('Nothing to download'); return; }
  const zip = new JSZip();
  for (const i of ready) zip.file(i.file.name, i.compressed);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `compressed-gifs-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  trackToolUsed('gif-compressor', 'download-zip', { count: ready.length });
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('gif-compressor', 'editor'));

// ---- helpers ----
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
