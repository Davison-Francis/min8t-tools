/**
 * Email Signature Generator - vanilla ES module.
 *
 * Three Outlook-safe templates rendered as table-based HTML strings. Live
 * preview in a sandboxed iframe (so MiN8T's CSS doesn't bleed in). Two copy
 * modes: rich content (paste into Gmail/Apple Mail/Outlook signature
 * editors) and HTML source (paste into HTM files or other raw editors).
 *
 * Output is intentionally NOT MiN8T-branded - the user owns their signature.
 */
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const form = document.getElementById('esg-form');
const tplBtns = document.querySelectorAll('.template-btn');
const previewIframe = document.getElementById('preview-iframe');
const sourcePre = document.getElementById('source-pre');
const copyRichBtn = document.getElementById('copy-rich');
const copySourceBtn = document.getElementById('copy-source');
const colorInput = document.getElementById('f-color');
const colorTextInput = document.getElementById('f-color-text');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');

let currentTemplate = 'classic';
let trackedThisSession = false;

// ---- template renderers ----
// Each returns an HTML string for the signature. Pure table-based, inline
// styles, pixel widths only. Tested mentally against the caniemail matrix.

function renderClassic(d) {
  const photoCell = d.photo ? `
    <td valign="top" width="80" style="padding-right:16px;">
      <img src="${escapeAttr(d.photo)}" alt="${escapeAttr(d.name)}" width="80" height="80" style="display:block;border-radius:50%;width:80px;height:80px;object-fit:cover;">
    </td>` : '';
  const dividerCell = `
    <td valign="top" width="1" style="border-left:2px solid ${escapeAttr(d.color)};padding:0;">&nbsp;</td>`;
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#333;">
  <tr>
    ${photoCell}
    ${dividerCell}
    <td valign="top" style="padding-left:16px;">
      <div style="font-size:16px;font-weight:bold;color:#111;">${escapeText(d.name)}</div>
      ${(d.title || d.company) ? `<div style="font-size:13px;color:#555;margin-top:2px;">${escapeText(d.title)}${d.title && d.company ? ' · ' : ''}<span style="color:${escapeAttr(d.color)};font-weight:600;">${escapeText(d.company)}</span></div>` : ''}
      ${contactBlock(d)}
      ${socialBlock(d)}
    </td>
  </tr>
</table>`.trim();
}

function renderMinimal(d) {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#333;">
  <tr>
    <td>
      <div style="font-size:15px;font-weight:bold;color:#111;">${escapeText(d.name)}${d.title ? `<span style="font-weight:normal;color:#555;"> · ${escapeText(d.title)}</span>` : ''}</div>
      ${d.company ? `<div style="color:${escapeAttr(d.color)};font-weight:600;font-size:13px;margin-top:2px;">${escapeText(d.company)}</div>` : ''}
      ${contactInline(d)}
      ${socialBlock(d)}
    </td>
  </tr>
</table>`.trim();
}

function renderAccent(d) {
  return `
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#333;">
  <tr>
    <td bgcolor="${escapeAttr(d.color)}" width="4" style="background-color:${escapeAttr(d.color)};width:4px;border-radius:2px;">&nbsp;</td>
    <td valign="top" style="padding-left:14px;">
      ${d.photo ? `<img src="${escapeAttr(d.photo)}" alt="${escapeAttr(d.name)}" width="56" height="56" style="display:block;border-radius:50%;width:56px;height:56px;object-fit:cover;margin-bottom:8px;">` : ''}
      <div style="font-size:16px;font-weight:bold;color:#111;">${escapeText(d.name)}</div>
      ${(d.title || d.company) ? `<div style="font-size:13px;color:#555;margin-top:2px;">${escapeText(d.title)}${d.title && d.company ? ' at ' : ''}<span style="color:${escapeAttr(d.color)};font-weight:600;">${escapeText(d.company)}</span></div>` : ''}
      ${contactBlock(d)}
      ${socialBlock(d)}
    </td>
  </tr>
</table>`.trim();
}

function contactBlock(d) {
  const parts = [];
  if (d.email)   parts.push(`<a href="mailto:${escapeAttr(d.email)}" style="color:${escapeAttr(d.color)};text-decoration:none;">${escapeText(d.email)}</a>`);
  if (d.phone)   parts.push(`<span style="color:#555;">${escapeText(d.phone)}</span>`);
  if (d.website) parts.push(`<a href="${escapeAttr(d.website)}" style="color:${escapeAttr(d.color)};text-decoration:none;">${escapeText(stripProto(d.website))}</a>`);
  if (parts.length === 0) return '';
  return `<div style="margin-top:8px;font-size:13px;line-height:1.6;">${parts.join('<br>')}</div>`;
}

function contactInline(d) {
  const parts = [];
  if (d.email)   parts.push(`<a href="mailto:${escapeAttr(d.email)}" style="color:${escapeAttr(d.color)};text-decoration:none;">${escapeText(d.email)}</a>`);
  if (d.phone)   parts.push(`<span style="color:#555;">${escapeText(d.phone)}</span>`);
  if (d.website) parts.push(`<a href="${escapeAttr(d.website)}" style="color:${escapeAttr(d.color)};text-decoration:none;">${escapeText(stripProto(d.website))}</a>`);
  if (parts.length === 0) return '';
  return `<div style="margin-top:6px;font-size:12px;color:#555;">${parts.join(' &nbsp;·&nbsp; ')}</div>`;
}

function socialBlock(d) {
  const links = [];
  if (d.linkedin)  links.push(socialLink(d.linkedin,  'in', d.color));
  if (d.twitter)   links.push(socialLink(d.twitter,   'X',  d.color));
  if (d.instagram) links.push(socialLink(d.instagram, 'IG', d.color));
  if (d.github)    links.push(socialLink(d.github,    'GH', d.color));
  if (links.length === 0) return '';
  return `<div style="margin-top:10px;">${links.join('&nbsp;')}</div>`;
}

function socialLink(url, label, color) {
  // Plain text link. Avoiding image icons keeps the signature under 5KB and
  // dodges Outlook's image-rendering quirks. Email clients all support
  // anchor styling consistently.
  return `<a href="${escapeAttr(url)}" style="display:inline-block;font-size:11px;font-weight:bold;color:#fff;background:${escapeAttr(color)};padding:4px 8px;border-radius:3px;text-decoration:none;margin-right:4px;">${label}</a>`;
}

const renderers = { classic: renderClassic, minimal: renderMinimal, accent: renderAccent };

// ---- helpers ----
function readForm() {
  const fd = new FormData(form);
  const d = Object.fromEntries(fd);
  d.color = colorInput.value || '#0066ff';
  return d;
}
function escapeText(s) {
  return (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function stripProto(url) {
  return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// ---- regenerate + render ----
function regenerate() {
  const d = readForm();
  const html = renderers[currentTemplate](d);
  // Write into iframe srcdoc - fully isolated from page CSS
  previewIframe.srcdoc = `<!doctype html><html><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;">${html}</body></html>`;
  sourcePre.textContent = html;
  if (!trackedThisSession) {
    trackToolUsed('email-signature-generator', 'generate');
    trackedThisSession = true;
  }
}

form.addEventListener('input', regenerate);

// ---- template switcher ----
tplBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tplBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTemplate = btn.dataset.template;
    regenerate();
    trackToolUsed('email-signature-generator', 'switch-template', { template: currentTemplate });
  });
});

// ---- color picker / text sync ----
colorInput.addEventListener('input', () => {
  colorTextInput.value = colorInput.value;
  regenerate();
});
colorTextInput.addEventListener('input', () => {
  if (/^#[0-9a-f]{6}$/i.test(colorTextInput.value)) {
    colorInput.value = colorTextInput.value;
    regenerate();
  }
});

// ---- copy ----
copyRichBtn.addEventListener('click', async () => {
  const html = sourcePre.textContent;
  try {
    // Prefer ClipboardItem with text/html so paste targets get rich content.
    if (window.ClipboardItem && navigator.clipboard?.write) {
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([sourceToPlainText(html)], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })]);
      showToast('Copied - paste into Gmail / Apple Mail / Outlook signature settings');
    } else {
      // Fallback: range-select hidden div, execCommand copy
      legacyCopyRich(html);
      showToast('Copied (legacy mode)');
    }
    trackToolUsed('email-signature-generator', 'copy-rich');
  } catch (err) {
    console.error(err);
    showToast('Copy failed - try the HTML source instead');
  }
});

copySourceBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(sourcePre.textContent);
    showToast('HTML source copied');
    trackToolUsed('email-signature-generator', 'copy-source');
  } catch {
    showToast('Copy failed - select the HTML below and copy manually');
  }
});

// fallback rich-copy via temporary contenteditable div
function legacyCopyRich(html) {
  const tmp = document.createElement('div');
  tmp.contentEditable = 'true';
  tmp.style.position = 'fixed';
  tmp.style.left = '-9999px';
  tmp.innerHTML = html;
  document.body.appendChild(tmp);
  const range = document.createRange();
  range.selectNodeContents(tmp);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
  tmp.remove();
}

function sourceToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText.trim();
}

// ---- toast ----
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

ctaEditor?.addEventListener('click', () => trackCtaClicked('email-signature-generator', 'editor'));

// ---- init ----
regenerate();
