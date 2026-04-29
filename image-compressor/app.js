/**
 * Email Image Compressor — vanilla ES module.
 *
 * Drag-drop upload, in-browser compression via browser-image-compression,
 * per-image preview with reduction stats, bulk ZIP download, and a running
 * "total payload" gauge that flags over-1MB so users know their email will
 * struggle to render.
 *
 * Files NEVER leave the browser. The library uses a Web Worker so the UI
 * stays responsive while compressing.
 */
import imageCompression from 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.mjs';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB upload cap
const PAYLOAD_WARN   = 700  * 1024;       // amber at >700KB
const PAYLOAD_BAD    = 1024 * 1024;       // red   at >1MB

const dropzone   = document.getElementById('dropzone');
const fileInput  = document.getElementById('file-input');
const widthInput = document.getElementById('width-input');
const widthValue = document.getElementById('width-value');
const qualityInput = document.getElementById('quality-input');
const qualityValue = document.getElementById('quality-value');
const formatInput = document.getElementById('format-input');
const summary = document.getElementById('summary');
const totalSize = document.getElementById('total-size');
const clearBtn = document.getElementById('clear-btn');
const zipBtn = document.getElementById('zip-btn');
const resultsEl = document.getElementById('results');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');

/** @type {Array<{id: string, file: File, originalUrl: string, compressed?: Blob, compressedUrl?: string, busy: boolean}>} */
const items = [];
let trackedThisSession = false;
let recompressTimer;

// ---- file selection ----
fileInput.addEventListener('change', (e) => addFiles(e.target.files));
dropzone.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragging');
  });
});
['dragleave', 'drop'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragging');
  });
});
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
});

function addFiles(fileList) {
  let added = 0;
  for (const file of Array.from(fileList)) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > MAX_FILE_BYTES) {
      showToast(`${file.name} is over 25MB — skipping`);
      continue;
    }
    items.push({
      id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
      trackToolUsed('image-compressor', 'compress');
      trackedThisSession = true;
    }
    render();
    compressAll();
  }
}

// ---- compression ----
function buildOptions() {
  return {
    maxSizeMB: 0.2,
    maxWidthOrHeight: parseInt(widthInput.value, 10),
    initialQuality: parseFloat(qualityInput.value),
    fileType: formatInput.value,
    useWebWorker: true,
    alwaysKeepResolution: false,
  };
}

async function compressAll() {
  const opts = buildOptions();
  for (const item of items) {
    item.busy = true;
  }
  render();
  // sequential to keep memory bounded — Web Worker handles each
  for (const item of items) {
    try {
      const compressed = await imageCompression(item.file, opts);
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      item.compressed = compressed;
      item.compressedUrl = URL.createObjectURL(compressed);
    } catch (err) {
      console.error('compress failed:', item.file.name, err);
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
  }, 350);
}
widthInput.addEventListener('input', () => {
  widthValue.textContent = widthInput.value;
  scheduleRecompress();
});
qualityInput.addEventListener('input', () => {
  qualityValue.textContent = parseFloat(qualityInput.value).toFixed(2);
  scheduleRecompress();
});
formatInput.addEventListener('change', () => scheduleRecompress());

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
    const card = document.createElement('div');
    card.className = 'result-card' + (item.busy ? ' compressing' : '');
    const thumb = item.compressedUrl || item.originalUrl;
    const compressedBytes = item.compressed?.size ?? 0;
    const reductionPct = item.compressed
      ? Math.round((1 - compressedBytes / item.file.size) * 100)
      : null;
    const reductionClass = reductionPct !== null && reductionPct < 0 ? 'reduction bad' : 'reduction';
    if (!item.busy) total += compressedBytes;
    card.innerHTML = `
      <img class="thumb" src="${thumb}" alt="${escapeHtml(item.file.name)}">
      <div class="meta">
        <strong>${escapeHtml(item.file.name)}</strong>
        <div class="stats">
          ${formatBytes(item.file.size)} → ${item.busy ? '…' : formatBytes(compressedBytes)}
          ${reductionPct !== null ? `<span class="${reductionClass}">${reductionPct >= 0 ? '−' : '+'}${Math.abs(reductionPct)}%</span>` : ''}
        </div>
        ${item.busy ? '<div class="progress"><span style="width:60%"></span></div>' : ''}
      </div>
      <div class="actions">
        <button class="btn btn-secondary" data-action="download" data-id="${item.id}" ${item.busy || !item.compressed ? 'disabled' : ''}>Download</button>
        <button class="btn btn-secondary" data-action="remove"   data-id="${item.id}">✕</button>
      </div>
    `;
    resultsEl.appendChild(card);
  }
  // total + color
  totalSize.textContent = formatBytes(total);
  totalSize.classList.toggle('warn', total > PAYLOAD_WARN && total <= PAYLOAD_BAD);
  totalSize.classList.toggle('bad',  total > PAYLOAD_BAD);
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
  link.download = renameForFormat(item.file.name, formatInput.value);
  link.click();
  trackToolUsed('image-compressor', 'download');
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
  if (ready.length === 0) {
    showToast('Nothing to download yet');
    return;
  }
  const zip = new JSZip();
  for (const i of ready) {
    zip.file(renameForFormat(i.file.name, formatInput.value), i.compressed);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `email-images-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  trackToolUsed('image-compressor', 'download-zip', { count: ready.length });
});

// ---- helpers ----
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function renameForFormat(originalName, mime) {
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[mime] || '';
  const base = originalName.replace(/\.[^.]+$/, '');
  return `${base}${ext}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

ctaEditor?.addEventListener('click', () => {
  trackCtaClicked('image-compressor', 'editor');
});
