/**
 * Brand Color Extractor — vanilla ES module.
 *
 * Stack:
 *   - colorthief v2.4.0 (MIT, ~12.5k★) for dominant-color extraction (Modified Median Cut)
 *   - chroma-js v3.1.2  (BSD-3, ~10.8k★) for tint/shade generation + WCAG contrast
 *
 * Both pulled from jsdelivr ESM. Total bundle ~30 KB gzipped, no build step.
 *
 * Pipeline: file → <img> → ColorThief.getPalette(5) → for each color, generate
 * 9 steps (50-900) by interpolating toward white and toward a brand-dark, then
 * compute WCAG contrast against white + black for accessibility hints.
 *
 * Output formats: CSS custom properties / Tailwind theme.colors / JSON / SCSS.
 * Image stays in the browser — DevTools Network shows zero outbound requests
 * for image data.
 */
import ColorThief from 'https://cdn.jsdelivr.net/npm/colorthief@2.4.0/+esm';
import chroma from 'https://cdn.jsdelivr.net/npm/chroma-js@3.1.2/+esm';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const previewBlock = document.getElementById('preview');
const previewImg = document.getElementById('preview-img');
const previewName = document.getElementById('preview-name');
const previewSize = document.getElementById('preview-size');
const paletteEl = document.getElementById('palette');
const outputSection = document.getElementById('output-section');
const outputTabs = document.querySelectorAll('.output-tabs button');
const outputPre = document.getElementById('output-pre');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const brandGuidelinesLink = document.getElementById('brand-guidelines-link');
const ctaEditor = document.getElementById('cta-editor');
const toast = document.getElementById('toast');

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

let baseColors = [];   // hex strings, length 5
let activeTab = 'css';
let trackedThisSession = false;

const colorThief = new ColorThief();

// ===== file selection =====
fileInput.addEventListener('change', (e) => {
  if (e.target.files?.[0]) processFile(e.target.files[0]);
});
['dragenter', 'dragover'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('dragging'); });
});
['dragleave', 'drop'].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('dragging'); });
});
dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer?.files?.[0]) processFile(e.dataTransfer.files[0]);
});

async function processFile(file) {
  if (!file.type.startsWith('image/')) { showToast('Not an image'); return; }
  if (file.size > 10 * 1024 * 1024)    { showToast('Image > 10 MB'); return; }

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewName.textContent = file.name;
  previewSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
  previewBlock.hidden = false;

  await new Promise((res) => {
    if (previewImg.complete) res();
    else previewImg.onload = res;
  });

  try {
    const palette = colorThief.getPalette(previewImg, 5);
    baseColors = palette.map(([r, g, b]) => chroma(r, g, b).hex());
    renderPalette();
    renderOutput();
    outputSection.hidden = false;
    if (!trackedThisSession) {
      trackToolUsed('palette-extractor', 'extract');
      trackedThisSession = true;
    }
  } catch (err) {
    console.error(err);
    showToast('Extraction failed - try a different image');
  }
}

// ===== palette rendering =====

function renderPalette() {
  paletteEl.innerHTML = '';
  baseColors.forEach((hex, idx) => {
    const row = document.createElement('div');
    row.className = 'color-row';
    row.innerHTML = `
      <div class="base">
        <div class="swatch" style="background:${hex}" data-base="${idx}"></div>
        <input type="text" data-base-input="${idx}" value="${hex}" maxlength="7" spellcheck="false" autocomplete="off">
      </div>
      <div class="scale" data-row="${idx}"></div>
    `;
    paletteEl.appendChild(row);
    renderScaleRow(idx);
  });

  // wire base color editing
  paletteEl.querySelectorAll('input[data-base-input]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.baseInput, 10);
      const v = e.target.value.trim();
      if (/^#?[0-9a-f]{6}$/i.test(v)) {
        const norm = v.startsWith('#') ? v : `#${v}`;
        baseColors[i] = norm;
        const sw = paletteEl.querySelector(`[data-base="${i}"]`);
        sw.style.background = norm;
        renderScaleRow(i);
        renderOutput();
      }
    });
  });
}

function renderScaleRow(rowIdx) {
  const base = baseColors[rowIdx];
  const scale = generateScale(base);
  const container = paletteEl.querySelector(`[data-row="${rowIdx}"]`);
  container.innerHTML = '';
  scale.forEach((hex, i) => {
    const step = document.createElement('div');
    step.className = 'step';
    const a11y = wcagBadges(hex);
    step.innerHTML = `
      <div class="swatch" style="background:${hex}" data-hex="${hex}"></div>
      <div class="label">${STEPS[i]}</div>
      <div class="a11y">${a11y}</div>
    `;
    container.appendChild(step);
    step.querySelector('.swatch').addEventListener('click', () => {
      navigator.clipboard?.writeText(hex);
      showToast(`${hex} copied`);
      trackToolUsed('palette-extractor', 'copy-swatch');
    });
  });
}

/**
 * Generate a 9-step scale from a base color.
 * Steps 50-400 fade toward white; 600-900 fade toward a near-black.
 * Step 500 IS the base. Lightness curve approximates Tailwind/Material defaults.
 */
function generateScale(baseHex) {
  const base = chroma(baseHex);
  const lightTarget = '#ffffff';
  const darkTarget  = '#0a1628';  // near-black with a hint of brand depth, not pure #000

  // Light steps (50, 100, 200, 300, 400) - mix toward white
  // Mix amounts: 50→0.92, 100→0.82, 200→0.66, 300→0.46, 400→0.22
  const lightMixes = [0.92, 0.82, 0.66, 0.46, 0.22];
  const lightSteps = lightMixes.map((m) => chroma.mix(base, lightTarget, m, 'oklab').hex());

  // Dark steps (600, 700, 800, 900) - mix toward dark
  // Mix amounts: 600→0.18, 700→0.36, 800→0.54, 900→0.72
  const darkMixes = [0.18, 0.36, 0.54, 0.72];
  const darkSteps = darkMixes.map((m) => chroma.mix(base, darkTarget, m, 'oklab').hex());

  return [...lightSteps, base.hex(), ...darkSteps];
}

function wcagBadges(hex) {
  const c = chroma(hex);
  const onWhite = chroma.contrast(c, '#ffffff');
  const onBlack = chroma.contrast(c, '#000000');
  // Choose better of the two for "what background to put text on"
  const best = onWhite > onBlack
    ? { ratio: onWhite, label: 'on W' }
    : { ratio: onBlack, label: 'on K' };
  let aa = '<span class="fail">AA</span>';
  let aaa = '<span class="fail">AAA</span>';
  if (best.ratio >= 4.5) aa = '<span class="pass">AA</span>';
  if (best.ratio >= 7)   aaa = '<span class="pass">AAA</span>';
  return `${aa}·${aaa}`;
}

// ===== output formats =====

function buildPaletteData() {
  return baseColors.map((base, i) => ({
    name: `brand-${i + 1}`,
    base,
    scale: Object.fromEntries(generateScale(base).map((hex, idx) => [STEPS[idx], hex])),
  }));
}

function formatCSS(data) {
  const lines = [':root {'];
  for (const c of data) {
    for (const [step, hex] of Object.entries(c.scale)) {
      lines.push(`  --${c.name}-${step}: ${hex};`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

function formatTailwind(data) {
  const colors = {};
  for (const c of data) colors[c.name] = c.scale;
  const inner = JSON.stringify(colors, null, 2)
    .replace(/"([0-9]+|\w[\w-]*)"\s*:/g, '$1:')   // unquote keys
    .replace(/"#([0-9a-f]{6})"/gi, "'#$1'");      // single-quote hex strings
  return `module.exports = {\n  theme: {\n    extend: {\n      colors: ${inner.split('\n').join('\n      ')},\n    },\n  },\n};`;
}

function formatJSON(data) {
  return JSON.stringify({ generatedAt: new Date().toISOString(), source: 'min8t.com/tools/palette-extractor', palette: data }, null, 2);
}

function formatSCSS(data) {
  const lines = [];
  for (const c of data) {
    for (const [step, hex] of Object.entries(c.scale)) {
      lines.push(`$${c.name}-${step}: ${hex};`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function renderOutput() {
  const data = buildPaletteData();
  const formatters = { css: formatCSS, tailwind: formatTailwind, json: formatJSON, scss: formatSCSS };
  outputPre.textContent = formatters[activeTab](data);
  brandGuidelinesLink.hidden = activeTab !== 'json';
}

outputTabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    outputTabs.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    renderOutput();
    trackToolUsed('palette-extractor', 'switch-format', { format: activeTab });
  });
});

copyBtn.addEventListener('click', async () => {
  if (!outputPre.textContent) return;
  try {
    await navigator.clipboard.writeText(outputPre.textContent);
    showToast(`${activeTab.toUpperCase()} copied`);
    trackToolUsed('palette-extractor', 'copy-format', { format: activeTab });
  } catch {
    showToast('Copy failed');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!outputPre.textContent) return;
  const ext = { css: 'css', tailwind: 'js', json: 'json', scss: 'scss' }[activeTab];
  const blob = new Blob([outputPre.textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `brand-palette.${ext}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  trackToolUsed('palette-extractor', 'download', { format: activeTab });
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('palette-extractor', 'brand-guidelines'));
brandGuidelinesLink?.addEventListener('click', () => trackCtaClicked('palette-extractor', 'brand-guidelines-deep'));

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}
