#!/usr/bin/env node
/**
 * OG image generator for the MiN8T free tools.
 * Reads tools.json -> emits 16 SVGs -> rsvg-convert to PNGs at 1200x630.
 *
 * Design (per tool):
 *   - Dark canvas (#0d0d0d) with diagonal brand-green accent strip
 *   - "FREE" pill top-right, brand-green
 *   - "MiN8T / TOOLS" wordmark top-left
 *   - Tool title centered-left, big white sans-serif
 *   - Subtitle below, muted white
 *   - Bottom-left: min8t.com/tools/<slug>/ in mono gray
 *   - Bottom-right: green arrow → and "min8t.com" wordmark
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// XML-safe text
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Word-wrap title at ~22 chars per line for the 88pt size; subtitle at ~52 chars
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildSvg({ slug, title, subtitle }) {
  // Wrap heading: max 2 lines, ~22 chars each
  const titleLines = wrap(title, 22).slice(0, 2);
  const titleY0 = titleLines.length === 1 ? 360 : 320;
  const titleLineH = 96;

  // Wrap subtitle: max 2 lines, ~58 chars each
  const subLines = wrap(subtitle, 58).slice(0, 2);
  const subY0 = titleY0 + titleLines.length * titleLineH + 28;
  const subLineH = 38;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0d0d"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <linearGradient id="accent-grad" x1="0" y1="0" x2="1" y2="0.5">
      <stop offset="0%" stop-color="#28ef91" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#28ef91" stop-opacity="0.0"/>
    </linearGradient>
    <style>
      .heading { font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; font-weight: 700; }
      .body    { font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; font-weight: 400; }
      .mono    { font-family: 'SF Mono', 'Menlo', 'Monaco', monospace; font-weight: 500; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg-grad)"/>

  <!-- Diagonal brand accent strip (subtle, top-right) -->
  <polygon points="900,0 1200,0 1200,300" fill="url(#accent-grad)"/>

  <!-- Brand-green vertical accent on left edge -->
  <rect x="0" y="0" width="8" height="630" fill="#28ef91"/>

  <!-- MiN8T logo wordmark, top-left -->
  <g transform="translate(56, 64)">
    <!-- circled-M placeholder (matches min8t-logo-circled-white aesthetic) -->
    <circle cx="22" cy="22" r="22" fill="#28ef91"/>
    <text x="22" y="30" text-anchor="middle" class="heading" font-size="22" fill="#0d0d0d">M</text>
    <text x="60" y="22" class="heading" font-size="22" fill="#ffffff">MiN8T</text>
    <text x="60" y="42" class="body" font-size="11" fill="rgba(255,255,255,0.5)" letter-spacing="2">FREE TOOLS</text>
  </g>

  <!-- "FREE" pill, top-right -->
  <g transform="translate(1010, 56)">
    <rect width="138" height="40" rx="20" fill="rgba(40,239,145,0.18)" stroke="#28ef91" stroke-width="1.5"/>
    <text x="69" y="26" text-anchor="middle" class="heading" font-size="13" fill="#28ef91" letter-spacing="2">NO SIGNUP</text>
  </g>

  <!-- Title -->
  ${titleLines.map((line, i) => `
  <text x="56" y="${titleY0 + i * titleLineH}" class="heading" font-size="84" fill="#ffffff">${esc(line)}</text>`).join('')}

  <!-- Subtitle -->
  ${subLines.map((line, i) => `
  <text x="56" y="${subY0 + i * subLineH}" class="body" font-size="28" fill="rgba(255,255,255,0.72)">${esc(line)}</text>`).join('')}

  <!-- Bottom-left: tool URL -->
  <text x="56" y="580" class="mono" font-size="20" fill="rgba(255,255,255,0.45)">min8t.com/tools/${esc(slug)}/</text>

  <!-- Bottom-right: arrow + cta -->
  <g transform="translate(940, 558)">
    <text x="0" y="20" class="heading" font-size="22" fill="#28ef91">Try it free</text>
    <g transform="translate(140, 8)" stroke="#28ef91" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M2 12 L26 12"/>
      <path d="M16 2 L26 12 L16 22"/>
    </g>
  </g>
</svg>`;
}

let okCount = 0;
let errCount = 0;
for (const tool of TOOLS) {
  try {
    const svg = buildSvg(tool);
    const svgPath = path.join(OUT, `${tool.slug}.svg`);
    const pngPath = path.join(OUT, `${tool.slug}.png`);
    fs.writeFileSync(svgPath, svg);
    execSync(`rsvg-convert -w 1200 -h 630 -f png -o "${pngPath}" "${svgPath}"`, { stdio: 'pipe' });
    const size = (fs.statSync(pngPath).size / 1024).toFixed(1);
    console.log(`OK ${tool.slug}.png (${size} KB)`);
    okCount++;
  } catch (e) {
    console.error(`ERR ${tool.slug}: ${e.message}`);
    errCount++;
  }
}
console.log(`\n${okCount} ok, ${errCount} errors`);
