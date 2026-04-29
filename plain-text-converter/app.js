/**
 * HTML → Plain-text Converter — vanilla ES module.
 *
 * Custom DOM walker: gives us full control over how each element type
 * lowers to text. Avoids dragging in a markdown library (turndown) just
 * to override every emitter, and avoids html-to-text's Node-only deps.
 *
 * Output respects:
 *  - Configurable line width (default 76 per RFC 5322 practical convention)
 *  - Three link styles: inline (default), numbered references, strip
 *  - Three heading styles: uppercase, underline, plain
 *  - Lists, blockquotes, headings, paragraphs, hr, br, img alt text
 *
 * Runs entirely in the browser via DOMParser. Zero outbound requests.
 */
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const htmlInput = document.getElementById('html-input');
const textOutput = document.getElementById('text-output');
const lineWidthInput = document.getElementById('line-width');
const linkStyleInput = document.getElementById('link-style');
const headerStyleInput = document.getElementById('header-style');
const sampleBtn = document.getElementById('sample-btn');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const stats = document.getElementById('stats');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');

let convertTimer;
let trackedThisSession = false;

const SAMPLE_HTML = `<table align="center" width="600" style="font-family:Arial,sans-serif;">
  <tr><td>
    <h1>Welcome to MiN8T</h1>
    <p>Hi <strong>[FirstName]</strong>,</p>
    <p>Thanks for signing up. Here's what you can do next:</p>
    <ul>
      <li>Open the <a href="https://app.min8t.com/editor">email editor</a></li>
      <li>Browse <a href="https://app.min8t.com/templates">100+ templates</a></li>
      <li>Read the <a href="https://docs.min8t.com">getting-started guide</a></li>
    </ul>
    <p style="margin-top:24px;">
      <a href="https://app.min8t.com/" style="background:#0066ff;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">Get started →</a>
    </p>
    <hr>
    <p style="font-size:12px;color:#666;">
      MiN8T · 123 Example Street, San Francisco, CA<br>
      <a href="https://min8t.com/unsubscribe">Unsubscribe</a>
    </p>
  </td></tr>
</table>`;

// ===== core converter =====

function htmlToPlainText(html, opts) {
  const { lineWidth = 76, linkStyle = 'inline', headerStyle = 'uppercase' } = opts;
  if (!html.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Drop everything we never want in plain text
  doc.querySelectorAll('style, script, noscript, head, meta, link[rel="stylesheet"]').forEach((n) => n.remove());

  const ctx = { linkStyle, headerStyle, links: [] };
  let text = walk(doc.body || doc.documentElement, ctx).text.trim();

  // Reference-style link list goes at the end
  if (linkStyle === 'reference' && ctx.links.length > 0) {
    text += '\n\n' + ctx.links.map((url, i) => `[${i + 1}] ${url}`).join('\n');
  }

  // Collapse runs of 3+ newlines to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // Word-wrap at lineWidth
  text = wrap(text, lineWidth);

  return text;
}

const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'figure', 'blockquote', 'pre']);
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const SKIP_TAGS = new Set(['style', 'script', 'noscript', 'head', 'meta', 'link', 'title', 'iframe', 'object', 'embed', 'video', 'audio', 'svg']);

function walk(node, ctx) {
  if (!node) return { text: '' };
  let out = '';

  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Collapse whitespace runs
      out += child.textContent.replace(/\s+/g, ' ');
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;

    if (tag === 'br') { out += '\n'; continue; }
    if (tag === 'hr') { out += '\n\n----------\n\n'; continue; }

    if (HEADING_TAGS.includes(tag)) {
      const inner = walk(child, ctx).text.trim();
      out += '\n\n' + formatHeading(inner, ctx.headerStyle, parseInt(tag.slice(1), 10)) + '\n\n';
      continue;
    }

    if (tag === 'a') {
      const href = (child.getAttribute('href') || '').trim();
      const text = walk(child, ctx).text.trim();
      out += renderLink(text, href, ctx);
      continue;
    }

    if (tag === 'img') {
      const alt = (child.getAttribute('alt') || '').trim();
      if (alt) out += `[${alt}]`;
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      out += '\n' + renderList(child, ctx, tag === 'ol') + '\n';
      continue;
    }

    if (tag === 'blockquote') {
      const inner = walk(child, ctx).text.trim();
      out += '\n\n' + inner.split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      out += '\n\n' + walk(child, ctx).text + '\n\n';
      continue;
    }

    // Inline elements: span, strong, em, b, i, td, tr, table, etc — pass through
    out += walk(child, ctx).text;

    // Tables: separate rows with newlines for readability
    if (tag === 'tr') out += '\n';
    if (tag === 'td' || tag === 'th') out += ' ';
  }

  return { text: out };
}

function renderList(listEl, ctx, ordered) {
  const items = [...listEl.children].filter((c) => c.tagName.toLowerCase() === 'li');
  return items.map((li, i) => {
    const prefix = ordered ? `${i + 1}. ` : '* ';
    const inner = walk(li, ctx).text.trim().replace(/\n+/g, ' ');
    return prefix + inner;
  }).join('\n');
}

function renderLink(text, href, ctx) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    // anchor / mail / tel — show the text + raw href if it's mailto/tel
    if (href.startsWith('mailto:')) return `${text} <${href.slice(7)}>`;
    if (href.startsWith('tel:'))    return `${text} (${href.slice(4)})`;
    return text;
  }
  if (ctx.linkStyle === 'strip') return text;
  if (ctx.linkStyle === 'reference') {
    ctx.links.push(href);
    return `${text}[${ctx.links.length}]`;
  }
  // inline (default)
  if (text && text !== href) return `${text} (${href})`;
  return href;
}

function formatHeading(text, style, level) {
  if (style === 'uppercase') return text.toUpperCase();
  if (style === 'underline') {
    const sep = level === 1 ? '=' : '-';
    return text + '\n' + sep.repeat(Math.min(text.length, 76));
  }
  return text;
}

function wrap(text, width) {
  if (width <= 0) return text;
  return text.split('\n').map((line) => {
    if (line.length <= width) return line;
    // Don't wrap mid-URL — match URL tokens and keep them intact
    const tokens = line.split(/(\s+)/);
    const out = [];
    let cur = '';
    for (const tok of tokens) {
      if ((cur + tok).length > width && cur) {
        out.push(cur.trimEnd());
        cur = tok.replace(/^\s+/, '');
      } else {
        cur += tok;
      }
    }
    if (cur) out.push(cur);
    return out.join('\n');
  }).join('\n');
}

// ===== UI wiring =====

function regenerate() {
  const html = htmlInput.value;
  const result = htmlToPlainText(html, {
    lineWidth: parseInt(lineWidthInput.value, 10) || 76,
    linkStyle: linkStyleInput.value,
    headerStyle: headerStyleInput.value,
  });
  textOutput.value = result;
  stats.textContent = `${result.length} chars · ${result.split('\n').length} lines`;
  if (html.trim() && !trackedThisSession) {
    trackToolUsed('plain-text-converter', 'convert');
    trackedThisSession = true;
  }
}

function scheduleRegenerate() {
  clearTimeout(convertTimer);
  convertTimer = setTimeout(regenerate, 200);
}

htmlInput.addEventListener('input', scheduleRegenerate);
lineWidthInput.addEventListener('input', regenerate);
linkStyleInput.addEventListener('change', regenerate);
headerStyleInput.addEventListener('change', regenerate);

sampleBtn.addEventListener('click', () => {
  htmlInput.value = SAMPLE_HTML;
  regenerate();
  trackToolUsed('plain-text-converter', 'load-sample');
});

copyBtn.addEventListener('click', async () => {
  if (!textOutput.value) { showToast('Nothing to copy'); return; }
  try {
    await navigator.clipboard.writeText(textOutput.value);
    showToast('Plain text copied');
    trackToolUsed('plain-text-converter', 'copy');
  } catch {
    textOutput.select(); document.execCommand('copy');
    showToast('Copied');
  }
});

downloadBtn.addEventListener('click', () => {
  if (!textOutput.value) { showToast('Nothing to download'); return; }
  const blob = new Blob([textOutput.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'email-plain-text.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  trackToolUsed('plain-text-converter', 'download');
});

clearBtn.addEventListener('click', () => {
  htmlInput.value = '';
  textOutput.value = '';
  stats.textContent = '0 chars';
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('plain-text-converter', 'editor'));

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
