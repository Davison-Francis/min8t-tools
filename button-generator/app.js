// Bulletproof Email Button Generator - Tool 15
// Generates the full bulletproof button pattern (HTML + VML for Outlook).

import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const $ = (id) => document.getElementById(id);
const previewIframe = $('preview-iframe');
const outputHtml = $('output-html');
const copyBtn = $('copy-btn');
const ctaEditor = $('cta-editor');
const presetRow = $('preset-row');
const toast = $('toast');

const fields = {
  text: $('text'),
  url: $('url'),
  bgColor: $('bg-color'),
  textColor: $('text-color'),
  borderColor: $('border-color'),
  borderWidth: $('border-width'),
  radius: $('radius'),
  fontSize: $('font-size'),
  padX: $('pad-x'),
  padY: $('pad-y'),
  fontFamily: $('font-family'),
  fontWeight: $('font-weight'),
  align: $('align'),
  target: $('target'),
};

// ---- HTML escape for attribute values ----
function attrEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---- Bulletproof button HTML generator ----
function buildButtonHtml(opts) {
  const {
    text, url, bgColor, textColor, borderColor, borderWidth, radius,
    fontSize, padX, padY, fontFamily, fontWeight, target,
  } = opts;

  const escapedText = attrEscape(text);
  const escapedUrl = attrEscape(url);
  const escapedFontFamily = attrEscape(fontFamily);

  // VML arcsize is a percentage of the *smaller* dimension. Approximate from radius.
  // Real Outlook clamps; safe upper bound is around the button height.
  // Estimated button height = padY*2 + fontSize + line-height-extra (~4px).
  const estHeight = (Number(padY) * 2) + Number(fontSize) + 4;
  const arcsizePct = Math.min(50, Math.round((Number(radius) / Math.max(estHeight, 1)) * 50));
  const arcsize = `${arcsizePct}%`;

  const widthEstimate = Math.max(120, escapedText.length * (Number(fontSize) * 0.6) + Number(padX) * 2);

  // The bulletproof pattern with VML for Outlook
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapedUrl}" style="height:${estHeight}px;v-text-anchor:middle;width:${Math.round(widthEstimate)}px;" arcsize="${arcsize}" stroke="${borderWidth > 0 ? 't' : 'f'}"${borderWidth > 0 ? ` strokecolor="${borderColor}" strokeweight="${borderWidth}px"` : ''} fillcolor="${bgColor}">
  <w:anchorlock/>
  <center style="color:${textColor};font-family:${escapedFontFamily};font-size:${fontSize}px;font-weight:${fontWeight};">${escapedText}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a class="btn-cta" href="${escapedUrl}" target="${target}" style="background-color:${bgColor};border:${borderWidth}px solid ${borderColor};border-radius:${radius}px;color:${textColor};display:inline-block;font-family:${escapedFontFamily};font-size:${fontSize}px;font-weight:${fontWeight};line-height:${Number(fontSize) + 4}px;padding:${padY}px ${padX}px;text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;">${escapedText}</a>
<!--<![endif]-->`;
}

function buildPreviewSrcdoc(buttonHtml, align) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; font-family: Arial, sans-serif; background: #ffffff; }
  .wrap { text-align: ${align}; }
</style>
</head><body>
<div class="wrap">${buttonHtml}</div>
</body></html>`;
}

function readOpts() {
  return {
    text: fields.text.value || 'Read the post',
    url: fields.url.value || '#',
    bgColor: fields.bgColor.value,
    textColor: fields.textColor.value,
    borderColor: fields.borderColor.value,
    borderWidth: Number(fields.borderWidth.value) || 0,
    radius: Number(fields.radius.value) || 0,
    fontSize: Number(fields.fontSize.value) || 16,
    padX: Number(fields.padX.value) || 0,
    padY: Number(fields.padY.value) || 0,
    fontFamily: fields.fontFamily.value,
    fontWeight: fields.fontWeight.value,
    align: fields.align.value,
    target: fields.target.value,
  };
}

function rerender() {
  const opts = readOpts();
  const html = buildButtonHtml(opts);
  outputHtml.textContent = html;
  previewIframe.srcdoc = buildPreviewSrcdoc(html, opts.align);
}

// Re-render on every input change
for (const el of Object.values(fields)) {
  el.addEventListener('input', rerender);
  el.addEventListener('change', rerender);
}

// Initial render
rerender();
trackToolUsed('button-generator', 'load');

// ---- Presets ----
const PRESETS = {
  stripe: {
    text: 'Continue', url: 'https://example.com', bgColor: '#635bff', textColor: '#ffffff',
    borderColor: '#635bff', borderWidth: 0, radius: 6, fontSize: 16,
    padX: 24, padY: 12, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: '600',
    align: 'center', target: '_blank',
  },
  mailchimp: {
    text: 'Read more', url: 'https://example.com', bgColor: '#ffe01b', textColor: '#241c15',
    borderColor: '#ffe01b', borderWidth: 0, radius: 4, fontSize: 16,
    padX: 28, padY: 14, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: '700',
    align: 'center', target: '_blank',
  },
  minimal: {
    text: 'Learn more', url: 'https://example.com', bgColor: '#1a1a1a', textColor: '#ffffff',
    borderColor: '#1a1a1a', borderWidth: 0, radius: 0, fontSize: 14,
    padX: 24, padY: 12, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: '500',
    align: 'center', target: '_blank',
  },
  pill: {
    text: 'Get started', url: 'https://example.com', bgColor: '#28ef91', textColor: '#2b312c',
    borderColor: '#28ef91', borderWidth: 0, radius: 999, fontSize: 16,
    padX: 32, padY: 14, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: '700',
    align: 'center', target: '_blank',
  },
  square: {
    text: 'Buy now', url: 'https://example.com', bgColor: '#dc2626', textColor: '#ffffff',
    borderColor: '#dc2626', borderWidth: 0, radius: 0, fontSize: 16,
    padX: 32, padY: 16, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: '700',
    align: 'center', target: '_blank',
  },
  outlined: {
    text: 'View details', url: 'https://example.com', bgColor: '#ffffff', textColor: '#1a1a1a',
    borderColor: '#1a1a1a', borderWidth: 2, radius: 999, fontSize: 14,
    padX: 28, padY: 12, fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: '600',
    align: 'center', target: '_blank',
  },
};

presetRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.preset');
  if (!btn) return;
  const preset = PRESETS[btn.dataset.preset];
  if (!preset) return;
  fields.text.value = preset.text;
  fields.url.value = preset.url;
  fields.bgColor.value = preset.bgColor;
  fields.textColor.value = preset.textColor;
  fields.borderColor.value = preset.borderColor;
  fields.borderWidth.value = preset.borderWidth;
  fields.radius.value = preset.radius;
  fields.fontSize.value = preset.fontSize;
  fields.padX.value = preset.padX;
  fields.padY.value = preset.padY;
  fields.fontFamily.value = preset.fontFamily;
  fields.fontWeight.value = preset.fontWeight;
  fields.align.value = preset.align;
  fields.target.value = preset.target;
  rerender();
  trackToolUsed('button-generator', 'preset', { preset: btn.dataset.preset });
});

// ---- Copy ----
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

copyBtn.addEventListener('click', async () => {
  const html = outputHtml.textContent;
  try {
    await navigator.clipboard.writeText(html);
    showToast('HTML copied to clipboard');
    trackToolUsed('button-generator', 'copy');
  } catch (e) {
    const range = document.createRange();
    range.selectNodeContents(outputHtml);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
    showToast('HTML copied');
  }
});

ctaEditor.addEventListener('click', () => trackCtaClicked('button-generator', 'editor'));
