/**
 * Email-Safe Font Checker — vanilla ES module.
 *
 * Looks up the requested font in a curated table (web-safe / system /
 * webfont) and renders a per-client support matrix using a snapshot of
 * caniemail.com's @font-face data.
 *
 * For unknown fonts (user types something we don't have classified) the
 * tool assumes "webfont" — i.e. requires @font-face to render — which is
 * the safe default for any custom font name.
 */
import { CLIENTS, lookupFont } from './font-data.js';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const fontInput = document.getElementById('font-input');
const emptyState = document.getElementById('empty-state');
const results = document.getElementById('results');
const verdict = document.getElementById('verdict');
const stackEl = document.getElementById('stack');
const matrixBody = document.getElementById('matrix-body');
const copyStackBtn = document.getElementById('copy-stack-btn');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');
const quickFontBtns = document.querySelectorAll('.quick-fonts button');

let trackedThisSession = false;

// ===== rendering =====

function check(fontName) {
  const data = lookupFont(fontName);
  if (!data) {
    emptyState.hidden = false;
    results.hidden = true;
    return;
  }
  emptyState.hidden = true;
  results.hidden = false;
  renderVerdict(data);
  renderMatrix(data);
  if (!trackedThisSession) {
    trackToolUsed('font-checker', 'check');
    trackedThisSession = true;
  }
}

function renderVerdict(data) {
  const labels = {
    'web-safe':  { badge: 'Web-safe',   text: 'pre-installed on every operating system. Renders everywhere without @font-face.' },
    'system':    { badge: 'System',     text: 'OS-specific UI font. Renders on its native platform; falls back elsewhere.' },
    'webfont':   { badge: 'Webfont',    text: 'requires @font-face. Renders in clients that support webfonts; falls back in clients that don\'t.' },
    'unknown':   { badge: 'Unknown',    text: 'not in the curated list - treating as webfont (requires @font-face) as a safe default.' },
  };
  const v = labels[data.type];
  const safeName = escapeHtml(data.name);
  verdict.innerHTML = `
    <span class="badge ${data.type}">${v.badge}</span>
    <strong>${safeName}</strong> — ${v.text}
  `;
  stackEl.textContent = `font-family: ${data.stack};`;
}

function renderMatrix(data) {
  matrixBody.innerHTML = '';
  for (const client of CLIENTS) {
    const status = clientStatus(data, client);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(client.name)}</td>
      <td class="status-cell ${status.cls}"><span class="dot"></span>${status.label}</td>
      <td class="note">${escapeHtml(status.note)}</td>
    `;
    matrixBody.appendChild(row);
  }
}

/**
 * Decide what each client does with this font.
 *  - web-safe: always renders
 *  - system: renders only on matching OS
 *  - webfont / unknown: renders if client supports @font-face, falls back otherwise
 */
function clientStatus(data, client) {
  if (data.type === 'web-safe') {
    return { cls: 'renders', label: 'Renders', note: 'Pre-installed on the client\'s OS.' };
  }
  if (data.type === 'system') {
    const os = data.os;
    // Apple system fonts on Apple clients
    if (os === 'apple' && client.family === 'Apple') {
      return { cls: 'renders', label: 'Renders', note: 'Apple system font on Apple Mail.' };
    }
    if (os === 'apple' && client.id === 'outlook-mac') {
      return { cls: 'renders', label: 'Renders', note: 'Apple system font on macOS Outlook.' };
    }
    // Windows system fonts on Outlook desktop / Outlook 365 Win
    if (os === 'windows' && (client.id.startsWith('outlook-2') || client.id === 'outlook-365-win')) {
      return { cls: 'renders', label: 'Renders', note: 'Windows system font on Outlook desktop.' };
    }
    // For system-ui generic, supported widely except Outlook desktop pre-2019
    if (!os) {
      if (client.id.startsWith('outlook-201') || client.id === 'outlook-365-win') {
        return { cls: 'fallback', label: 'Falls back', note: 'system-ui keyword not honored — falls back to next in stack.' };
      }
      return { cls: 'renders', label: 'Renders', note: 'system-ui keyword resolves to the OS default UI font.' };
    }
    return { cls: 'fallback', label: 'Falls back', note: `${os} system font not available here — falls back to next in stack.` };
  }
  // webfont / unknown
  if (client.fontFace === 'yes') {
    return { cls: 'renders', label: 'Renders', note: client.note };
  }
  if (client.fontFace === 'partial') {
    return { cls: 'fallback', label: 'Often falls back', note: client.note };
  }
  return { cls: 'fallback', label: 'Falls back', note: client.note };
}

// ===== UI wiring =====

let debounceTimer;
fontInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => check(fontInput.value), 200);
});

quickFontBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    fontInput.value = btn.dataset.font;
    check(btn.dataset.font);
  });
});

copyStackBtn.addEventListener('click', async () => {
  if (!stackEl.textContent) return;
  try {
    await navigator.clipboard.writeText(stackEl.textContent);
    showToast('Stack copied');
    trackToolUsed('font-checker', 'copy-stack');
  } catch {
    showToast('Copy failed');
  }
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('font-checker', 'editor'));

// ===== helpers =====

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
