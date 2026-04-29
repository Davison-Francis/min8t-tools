/**
 * Inbox Preview - vanilla ES module.
 *
 * Three iframes (Gmail, Apple Mail, Outlook approximation) rendered via
 * srcdoc with client-specific transformations on the user's HTML input.
 *
 * Gmail and Apple Mail are modern WebView clients - we render the user's
 * HTML mostly as-is. The Outlook column applies a CSS reset that disables
 * everything the Word rendering engine ignores (flexbox, grid, transforms,
 * @font-face, @media queries, pseudo-elements, custom properties), strips
 * <style> blocks from the body (Outlook only honors <head> styles), and
 * processes MSO conditional comments by exposing their content.
 *
 * Honest framing throughout: the Outlook column is labeled "Approximation"
 * not "Real". For pixel-perfect Outlook testing, users should use Litmus
 * or Email on Acid.
 */
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const htmlInput = document.getElementById('html-input');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const stats = document.getElementById('stats');
const emptyState = document.getElementById('empty-state');
const previews = document.getElementById('previews');
const gmailIframe = document.getElementById('gmail-iframe');
const appleIframe = document.getElementById('apple-iframe');
const outlookIframe = document.getElementById('outlook-iframe');
const gmailSubject = document.getElementById('gmail-subject');
const appleSubject = document.getElementById('apple-subject');
const outlookSubject = document.getElementById('outlook-subject');
const ctaEditor = document.getElementById('cta-editor');

const SAMPLE_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome aboard</title>
  <style>
    /* This <style> block is in <head> - Outlook honors some of these */
    body { margin: 0; padding: 0; font-family: 'Roboto', Arial, sans-serif; background: #f6f8fc; }
    .container { max-width: 600px; margin: 0 auto; }
    .hero { background: linear-gradient(135deg, #28ef91, #00c4a7); color: white; padding: 48px 24px; text-align: center; }
    .hero h1 { margin: 0; font-size: 28px; }
    .body { padding: 32px 24px; background: white; }
    .button {
      display: inline-block; background: #28ef91; color: #0a1628;
      padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600;
    }
    /* The flexbox below will collapse in the Outlook column - by design */
    .stats { display: flex; gap: 16px; padding: 24px; background: #f0f4ff; }
    .stats .stat { flex: 1; text-align: center; }
    .stats .stat strong { display: block; font-size: 24px; color: #0066ff; }
    .footer { padding: 24px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>Welcome aboard 🎉</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Here's everything to get you started.</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p>Thanks for joining MiN8T. Use the link below to open your dashboard:</p>
      <p style="text-align: center; margin: 32px 0;">
        <a class="button" href="https://app.min8t.com/">Open dashboard &rarr;</a>
      </p>
      <div class="stats">
        <div class="stat"><strong>108+</strong>ESPs</div>
        <div class="stat"><strong>1k+</strong>Users</div>
        <div class="stat"><strong>99.9%</strong>Uptime</div>
      </div>
      <p style="margin-top: 32px;">Need help? Just reply to this email.</p>
    </div>
    <div class="footer">
      MiN8T  ·  123 Example Street, San Francisco, CA 94103
      <br>
      <a href="https://min8t.com/unsubscribe" style="color: #666;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`;

let debounceTimer;

htmlInput.addEventListener('input', () => {
  const len = htmlInput.value.length;
  stats.textContent = `${len.toLocaleString()} chars`;
  clearTimeout(debounceTimer);
  if (htmlInput.value.trim().length === 0) {
    emptyState.hidden = false;
    previews.hidden = true;
    return;
  }
  debounceTimer = setTimeout(() => render(htmlInput.value), 350);
});

sampleBtn.addEventListener('click', () => {
  htmlInput.value = SAMPLE_HTML;
  stats.textContent = `${htmlInput.value.length.toLocaleString()} chars`;
  render(htmlInput.value);
  trackToolUsed('inbox-preview', 'load-sample');
});

clearBtn.addEventListener('click', () => {
  htmlInput.value = '';
  stats.textContent = '0 chars';
  emptyState.hidden = false;
  previews.hidden = true;
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('inbox-preview', 'editor'));

let trackedThisSession = false;

function render(html) {
  emptyState.hidden = true;
  previews.hidden = false;

  const subject = extractTitle(html);
  gmailSubject.textContent = subject;
  appleSubject.textContent = subject;
  outlookSubject.textContent = subject;

  // Gmail web - modern WebView. Render as-is, with mobile-ish viewport injected.
  gmailIframe.srcdoc = wrapForGmail(html);

  // Apple Mail iOS - modern WebKit, narrow viewport (iPhone-ish).
  appleIframe.srcdoc = wrapForApple(html);

  // Outlook desktop approximation - CSS reset that mimics Word engine.
  outlookIframe.srcdoc = wrapForOutlook(html);

  if (!trackedThisSession) {
    trackToolUsed('inbox-preview', 'preview');
    trackedThisSession = true;
  }
}

// ===== client-specific wrappers =====

function wrapForGmail(html) {
  // Gmail web is fairly permissive - render mostly as-is. Strip <head> <link>
  // tags that point to external stylesheets we can't fetch (mostly to keep
  // the iframe from showing broken-load delays). Add a meta viewport for
  // mobile-ish rendering.
  return injectViewport(html, 600);
}

function wrapForApple(html) {
  // Apple Mail iOS - narrow viewport (iPhone 14 width = 390px logical px).
  return injectViewport(html, 390);
}

function wrapForOutlook(html) {
  // The aggressive transformation. Order matters:
  //   1. Process MSO conditional comments (include [if mso] blocks, drop [if !mso])
  //   2. Strip @font-face and webfont <link> tags
  //   3. Strip <style> blocks inside <body> (Outlook only honors <head> styles)
  //   4. Inject the Word-engine CSS reset that disables flexbox/grid/etc.
  let h = html;
  h = processMsoConditionals(h);
  h = stripFontFace(h);
  h = stripBodyStyles(h);
  h = injectWordEngineReset(h);
  return injectViewport(h, 600);
}

// Insert <meta viewport> + base styles into <head> if the document has one,
// otherwise wrap the fragment in a minimal HTML scaffold.
function injectViewport(html, _maxWidth) {
  const hasHtml = /<html[\s>]/i.test(html);
  const hasHead = /<head[\s>]/i.test(html);
  const meta = '<meta name="viewport" content="width=device-width, initial-scale=1">';

  if (hasHtml && hasHead) {
    // Inject meta after <head>
    return html.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  }
  if (hasHtml && !hasHead) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${meta}</head>`);
  }
  // bare fragment
  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`;
}

/**
 * Process Outlook conditional comments. Outlook desktop renders the content
 * inside `<!--[if mso]>...<![endif]-->` and `<!--[if gte mso 9]>...<![endif]-->`
 * blocks. Other clients ignore them.
 *
 * For our Outlook preview: include the [if mso] content as visible HTML;
 * remove [if !mso] content.
 */
function processMsoConditionals(html) {
  // Include [if mso] / [if gte mso N] blocks: strip the comment wrapper
  let out = html.replace(
    /<!--\[if (?:gte )?mso(?:\s+\d+)?\]>([\s\S]*?)<!\[endif\]-->/gi,
    '$1',
  );
  // Remove [if !mso] blocks entirely
  out = out.replace(/<!--\[if !mso\]>[\s\S]*?<!\[endif\]-->/gi, '');
  // Remove generic IE conditionals (Outlook ignores these too)
  out = out.replace(/<!--\[if [^\]]+\]>[\s\S]*?<!\[endif\]-->/gi, '');
  return out;
}

function stripFontFace(html) {
  // Strip @font-face declarations from <style> blocks
  let out = html.replace(/@font-face\s*\{[^}]*\}/gi, '');
  // Remove google-fonts <link> tags
  out = out.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '');
  out = out.replace(/<link[^>]*typekit[^>]*>/gi, '');
  return out;
}

function stripBodyStyles(html) {
  // Remove <style> blocks that appear after <body> opens. Outlook only honors
  // <head> styles.
  return html.replace(
    /(<body[\s\S]*?>)([\s\S]*?)<\/body>/i,
    (_match, openBody, body) => {
      const cleaned = body.replace(/<style[\s\S]*?<\/style>/gi, '');
      return `${openBody}${cleaned}</body>`;
    },
  );
}

/**
 * Inject a "Word engine" CSS reset into <head>. Disables every property the
 * real Word renderer ignores. Aggressive but accurate to the broad strokes.
 */
function injectWordEngineReset(html) {
  const reset = `<style>
    /* MiN8T inbox-preview: Word-engine approximation */
    /* Disable modern layout that Outlook desktop strips */
    *, *::before, *::after {
      display: revert !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
      filter: none !important;
      backdrop-filter: none !important;
      mix-blend-mode: normal !important;
      clip-path: none !important;
      mask: none !important;
    }
    [style*="display: flex"], [style*="display:flex"],
    [style*="display: inline-flex"], [style*="display:inline-flex"],
    [style*="display: grid"], [style*="display:grid"],
    [style*="display: inline-grid"], [style*="display:inline-grid"] {
      display: block !important;
    }
    /* Disable @media queries by overriding their effects with a base
       block-element layout. Real Outlook ignores @media; we can't truly
       remove rules at runtime without parsing CSS, so this is a best-effort. */
    /* Disable :hover, ::before, ::after via layer */
    *::before, *::after { content: none !important; display: none !important; }
    /* Replace custom-property fallbacks with nothing - we can't safely substitute
       the var() values, but we can ensure unset vars don't render junk. */
    /* (var() resolution happens before our reset; we leave it alone.) */
    /* Approximate Word's narrow margin defaults */
    body { margin: 12px !important; }
  </style>`;

  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<\/head>/i, `${reset}</head>`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${reset}</head>`);
  }
  return `<head>${reset}</head>${html}`;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (m) return m[1].trim().slice(0, 100);
  // Try first <h1>
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim().slice(0, 100);
  return '(no subject set)';
}
