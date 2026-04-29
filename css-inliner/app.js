// CSS Inliner for HTML Email - Tool 12
// Vanilla JS using browser-native CSSOM via hidden iframe.
// No third-party library.

import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const $ = (id) => document.getElementById(id);
const input = $('html-input');
const output = $('html-output');
const inputStats = $('input-stats');
const outputStats = $('output-stats');
const inlineBtn = $('inline-btn');
const sampleBtn = $('sample-btn');
const copyBtn = $('copy-btn');
const downloadBtn = $('download-btn');
const clearBtn = $('clear-btn');
const autoToggle = $('auto-toggle');
const statRulesInlined = $('stat-rules-inlined');
const statRulesPreserved = $('stat-rules-preserved');
const statElementsTouched = $('stat-elements-touched');
const statSize = $('stat-size');
const statSizeCard = $('stat-size-card');
const ctaEditor = $('cta-editor');
const toast = $('toast');

const GMAIL_CLIP_BYTES = 102 * 1024;

// ---- Specificity ----
function selectorSpecificity(sel) {
  let a = 0, b = 0, c = 0;
  let s = sel.replace(/"[^"]*"|'[^']*'/g, '');
  // Strip pseudo-elements first (higher precedence in regex order)
  s = s.replace(/::[\w-]+/g, () => { c++; return ''; });
  // Pseudo-classes (single colon, but need to skip what we already handled)
  s = s.replace(/:[\w-]+(?:\([^)]*\))?/g, () => { b++; return ''; });
  // IDs
  s = s.replace(/#[\w-]+/g, () => { a++; return ''; });
  // Attribute selectors
  s = s.replace(/\[[^\]]+\]/g, () => { b++; return ''; });
  // Classes
  s = s.replace(/\.[\w-]+/g, () => { b++; return ''; });
  // Element types (whatever's left of letters that look like types, ignoring combinators)
  s = s.replace(/[a-zA-Z][\w-]*/g, () => { c++; return ''; });
  return [a, b, c];
}

function winsOver(a, b) {
  if (a.important !== b.important) return a.important;
  for (let i = 0; i < 3; i++) {
    if (a.spec[i] !== b.spec[i]) return a.spec[i] > b.spec[i];
  }
  return a.order >= b.order;
}

function hasPseudo(sel) {
  // detect :something or ::something but allow attribute selectors like [type="x"]
  // strip attribute selectors first
  const stripped = sel.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"|'[^']*'/g, '');
  return /::?[a-zA-Z]/.test(stripped);
}

// ---- Core inliner ----
async function inlineCss(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.width = '800px';
  iframe.style.height = '600px';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('sandbox', 'allow-same-origin');
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(html);
    idoc.close();

    // Give the parser a tick to populate styleSheets
    await new Promise((r) => setTimeout(r, 0));

    const sheets = Array.from(idoc.styleSheets);
    const elementStyles = new WeakMap();
    let rulesInlined = 0;
    let rulesPreserved = 0;
    let elementsTouched = new Set();
    let order = 0;

    for (const sheet of sheets) {
      let rules;
      try {
        rules = Array.from(sheet.cssRules || []);
      } catch (e) {
        continue; // cross-origin or unreadable sheet
      }

      const preservedForSheet = [];

      for (const rule of rules) {
        order++;

        const ruleClass = rule.constructor.name;

        if (ruleClass === 'CSSStyleRule') {
          const selectorParts = rule.selectorText.split(',').map((s) => s.trim()).filter(Boolean);
          const inlineableSelectors = [];
          const preservedSelectors = [];

          for (const sel of selectorParts) {
            if (hasPseudo(sel)) {
              preservedSelectors.push(sel);
            } else {
              inlineableSelectors.push(sel);
            }
          }

          // Apply inlineable parts to elements
          for (const sel of inlineableSelectors) {
            let matched;
            try {
              matched = idoc.querySelectorAll(sel);
            } catch (e) {
              continue;
            }
            if (!matched.length) continue;

            const spec = selectorSpecificity(sel);

            for (const el of matched) {
              elementsTouched.add(el);
              let map = elementStyles.get(el);
              if (!map) {
                map = new Map();
                elementStyles.set(el, map);
              }

              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                const value = rule.style.getPropertyValue(prop);
                const important = rule.style.getPropertyPriority(prop) === 'important';
                const entry = { value, important, spec, order };

                const existing = map.get(prop);
                if (!existing || winsOver(entry, existing)) {
                  map.set(prop, entry);
                }
              }
            }
            rulesInlined++;
          }

          // If any selector parts were preserved, rebuild a rule for them
          if (preservedSelectors.length) {
            const reduced = `${preservedSelectors.join(', ')} { ${cssTextOfDeclarations(rule.style)} }`;
            preservedForSheet.push(reduced);
            rulesPreserved++;
          }
        } else if (
          ruleClass === 'CSSMediaRule'
          || ruleClass === 'CSSSupportsRule'
          || ruleClass === 'CSSKeyframesRule'
          || ruleClass === 'CSSFontFaceRule'
          || ruleClass === 'CSSImportRule'
        ) {
          preservedForSheet.push(rule.cssText);
          rulesPreserved++;
        } else {
          // Unknown rule type - preserve verbatim
          preservedForSheet.push(rule.cssText);
          rulesPreserved++;
        }
      }

      // Replace this sheet's source with only preserved rules
      const styleEl = sheet.ownerNode;
      if (styleEl && styleEl.tagName === 'STYLE') {
        if (preservedForSheet.length) {
          styleEl.textContent = preservedForSheet.join('\n\n');
        } else {
          styleEl.parentNode.removeChild(styleEl);
        }
      }
    }

    // Apply accumulated styles
    for (const el of elementsTouched) {
      const map = elementStyles.get(el);
      if (!map) continue;

      for (const [prop, entry] of map) {
        const existingValue = el.style.getPropertyValue(prop);
        const existingPriority = el.style.getPropertyPriority(prop);

        if (!existingValue) {
          el.style.setProperty(prop, entry.value, entry.important ? 'important' : '');
        } else if (entry.important && existingPriority !== 'important') {
          el.style.setProperty(prop, entry.value, 'important');
        }
      }
    }

    // Serialize. Always re-emit doctype.
    const result = '<!DOCTYPE html>\n' + idoc.documentElement.outerHTML;

    return {
      html: result,
      rulesInlined,
      rulesPreserved,
      elementsTouched: elementsTouched.size,
    };
  } finally {
    document.body.removeChild(iframe);
  }
}

function cssTextOfDeclarations(style) {
  const parts = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    const val = style.getPropertyValue(prop);
    const imp = style.getPropertyPriority(prop) === 'important' ? ' !important' : '';
    parts.push(`${prop}: ${val}${imp};`);
  }
  return parts.join(' ');
}

// ---- UI plumbing ----
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function fmtKB(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

function updateInputStats() {
  const len = input.value.length;
  inputStats.textContent = `${len.toLocaleString()} chars`;
}

function updateOutputStats(html, stats) {
  const len = html ? new Blob([html]).size : 0;
  outputStats.textContent = `${html ? html.length.toLocaleString() : 0} chars`;
  if (stats) {
    statRulesInlined.textContent = stats.rulesInlined;
    statRulesPreserved.textContent = stats.rulesPreserved;
    statElementsTouched.textContent = stats.elementsTouched;
  }
  statSize.textContent = fmtKB(len);
  statSizeCard.classList.toggle('warning', len > GMAIL_CLIP_BYTES);
  statSizeCard.classList.toggle('success', len > 0 && len <= GMAIL_CLIP_BYTES);
}

let inFlight = null;
async function runInline(reason = 'manual') {
  const src = input.value.trim();
  if (!src) {
    output.value = '';
    updateOutputStats('', { rulesInlined: 0, rulesPreserved: 0, elementsTouched: 0 });
    return;
  }

  // Avoid re-entrancy: cancel by token
  const token = Symbol('inline');
  inFlight = token;

  try {
    const result = await inlineCss(src);
    if (inFlight !== token) return; // newer run started
    output.value = result.html;
    updateOutputStats(result.html, result);
    trackToolUsed('css-inliner', reason, {
      rules_inlined: result.rulesInlined,
      rules_preserved: result.rulesPreserved,
    });
  } catch (e) {
    console.error(e);
    if (inFlight !== token) return;
    output.value = `/* Inliner error: ${e.message} */\n\n${src}`;
    updateOutputStats(output.value, { rulesInlined: 0, rulesPreserved: 0, elementsTouched: 0 });
  }
}

let debounceTimer = null;
function scheduleAutoInline() {
  if (!autoToggle.checked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runInline('auto'), 250);
}

input.addEventListener('input', () => {
  updateInputStats();
  scheduleAutoInline();
});

inlineBtn.addEventListener('click', () => runInline('manual'));

sampleBtn.addEventListener('click', () => {
  input.value = SAMPLE_HTML;
  updateInputStats();
  runInline('sample');
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  output.value = '';
  updateInputStats();
  updateOutputStats('', { rulesInlined: 0, rulesPreserved: 0, elementsTouched: 0 });
});

copyBtn.addEventListener('click', async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    showToast('Output copied to clipboard');
    trackToolUsed('css-inliner', 'copy');
  } catch (e) {
    output.select();
    document.execCommand('copy');
    showToast('Output copied');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!output.value) return;
  const blob = new Blob([output.value], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inlined-email.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded inlined-email.html');
  trackToolUsed('css-inliner', 'download');
});

ctaEditor.addEventListener('click', () => trackCtaClicked('css-inliner', 'editor'));

updateInputStats();

// ---- Sample email (mixed: classes, ids, @media, :hover, !important, inline overrides) ----
const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sample newsletter</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: #f4f4f7; color: #1a1a1a; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
  .header { padding: 24px; background: #2b312c; color: #ffffff; }
  .header h1 { margin: 0; font-size: 28px; }
  .body { padding: 32px 24px; line-height: 1.6; }
  .body p { margin: 0 0 16px; }
  .cta { display: inline-block; background: #28ef91; color: #2b312c !important; padding: 12px 24px; border-radius: 999px; font-weight: 700; text-decoration: none; }
  .cta:hover { background: #1fd47e; }
  .footer { padding: 24px; text-align: center; color: #888; font-size: 12px; }
  .footer a { color: #888; }
  #unsubscribe { font-style: italic; }
  @media (max-width: 480px) {
    .header h1 { font-size: 22px; }
    .body { padding: 20px 16px; }
  }
</style>
</head>
<body>
<table class="container" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr><td class="header">
    <h1>This week at MiN8T</h1>
  </td></tr>
  <tr><td class="body">
    <p>Hi there,</p>
    <p>We shipped 5 new free tools and a fresh inline CSS engine. Click below to read the rundown.</p>
    <p style="text-align:center;margin: 24px 0;">
      <a href="https://min8t.com/articles" class="cta">Read the post</a>
    </p>
    <p>Cheers,<br>The MiN8T team</p>
  </td></tr>
  <tr><td class="footer">
    <p>You're receiving this because you signed up at min8t.com.</p>
    <p id="unsubscribe"><a href="#">Unsubscribe</a> &middot; <a href="#">View in browser</a></p>
  </td></tr>
</table>
</body>
</html>`;
