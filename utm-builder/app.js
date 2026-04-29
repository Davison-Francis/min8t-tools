/**
 * UTM Builder - vanilla ES module.
 *
 * Live-updates the output URL + QR as the user types. Persists last-used
 * source/medium/campaign combos to localStorage so the user can re-apply a
 * recent setup with one click. Everything runs client-side; nothing leaves
 * the browser.
 */
import QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const STORAGE_KEY = 'min8t.utm-builder.recents';
const MAX_RECENTS = 5;

const form = document.getElementById('utm-form');
const output = document.getElementById('output-url');
const copyBtn = document.getElementById('copy-btn');
const qrCanvas = document.getElementById('qr-canvas');
const recentsBlock = document.getElementById('recents');
const recentsList = document.getElementById('recents-list');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');

let lastValidUrl = '';     // tracks the last successfully-generated URL for QR + copy
let trackedThisSession = false;  // dedupe analytics: one tool_used event per real generation

// ---- core: build URL from form values ----
function buildUrl() {
  const v = Object.fromEntries(new FormData(form));
  const dest = (v.url || '').trim();
  if (!dest) { setOutput('', false); return null; }

  let u;
  try { u = new URL(dest); }
  catch { setOutput('Invalid URL - include https://', false); return null; }

  // Required fields
  const required = ['source', 'medium', 'campaign'];
  for (const k of required) {
    if (!(v[k] || '').trim()) { setOutput('', false); return null; }
  }

  // Apply params (skip empties so users don't ship dangling ?utm_term=)
  ['source', 'medium', 'campaign', 'term', 'content'].forEach((k) => {
    const val = (v[k] || '').trim();
    if (val) u.searchParams.set(`utm_${k}`, val);
    else u.searchParams.delete(`utm_${k}`);
  });

  return u.toString();
}

function setOutput(text, isUrl) {
  output.value = text;
  if (isUrl) {
    lastValidUrl = text;
    QRCode.toCanvas(qrCanvas, text, { width: 160, margin: 1 }).catch(() => {
      // QR failures are non-fatal - clear the canvas
      const ctx = qrCanvas.getContext('2d');
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
    });
  } else {
    lastValidUrl = '';
    const ctx = qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
  }
}

function regenerate() {
  const url = buildUrl();
  if (url) {
    setOutput(url, true);
    if (!trackedThisSession) {
      trackToolUsed('utm-builder', 'generate');
      trackedThisSession = true;
    }
  }
}

form.addEventListener('input', regenerate);

// ---- copy-to-clipboard ----
copyBtn.addEventListener('click', async () => {
  if (!lastValidUrl) {
    showToast('Fill in the required fields first');
    return;
  }
  try {
    await navigator.clipboard.writeText(lastValidUrl);
    showToast('Copied!');
    persistRecent();
    trackToolUsed('utm-builder', 'copy');
  } catch {
    // Fallback for older browsers
    output.select();
    document.execCommand('copy');
    showToast('Copied!');
    persistRecent();
  }
});

// ---- QR download (click on the canvas) ----
qrCanvas.addEventListener('click', () => {
  if (!lastValidUrl) return;
  const link = document.createElement('a');
  link.href = qrCanvas.toDataURL('image/png');
  link.download = 'utm-link-qr.png';
  link.click();
  trackToolUsed('utm-builder', 'qr-download');
});

// ---- toast ----
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ---- recents (last-used source/medium/campaign combos) ----
function loadRecents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistRecent() {
  const v = Object.fromEntries(new FormData(form));
  const entry = {
    source: (v.source || '').trim(),
    medium: (v.medium || '').trim(),
    campaign: (v.campaign || '').trim(),
  };
  if (!entry.source || !entry.medium || !entry.campaign) return;

  const existing = loadRecents().filter(
    (r) => !(r.source === entry.source && r.medium === entry.medium && r.campaign === entry.campaign),
  );
  const updated = [entry, ...existing].slice(0, MAX_RECENTS);

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); }
  catch { /* quota - ignore */ }
  renderRecents();
}

function renderRecents() {
  const recents = loadRecents();
  if (recents.length === 0) {
    recentsBlock.hidden = true;
    return;
  }
  recentsBlock.hidden = false;
  recentsList.innerHTML = '';
  recents.forEach((r) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${r.source} · ${r.medium} · ${r.campaign}`;
    btn.addEventListener('click', () => {
      form.source.value = r.source;
      form.medium.value = r.medium;
      form.campaign.value = r.campaign;
      regenerate();
      form.url.focus();
      trackToolUsed('utm-builder', 'apply-recent');
    });
    li.appendChild(btn);
    recentsList.appendChild(li);
  });
}

// ---- conversion CTA ----
ctaEditor?.addEventListener('click', () => {
  trackCtaClicked('utm-builder', 'editor');
});

// ---- init ----
renderRecents();
regenerate();
