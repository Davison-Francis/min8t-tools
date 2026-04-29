// MJML to HTML Converter - Tool 13
// Loads mjml-browser (MIT) from esm.sh and compiles client-side.

import mjml2html from 'https://esm.sh/mjml-browser@4.15.3';
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const $ = (id) => document.getElementById(id);
const input = $('mjml-input');
const output = $('html-output');
const previewIframe = $('preview-iframe');
const inputStats = $('input-stats');
const outputStats = $('output-stats');
const previewStatus = $('preview-status');
const compileBtn = $('compile-btn');
const sampleBtn = $('sample-btn');
const copyBtn = $('copy-btn');
const downloadHtmlBtn = $('download-html-btn');
const downloadMjmlBtn = $('download-mjml-btn');
const clearBtn = $('clear-btn');
const autoToggle = $('auto-toggle');
const validationSelect = $('validation-select');
const errorsPanel = $('errors-panel');
const errorsList = $('errors-list');
const ctaEditor = $('cta-editor');
const toast = $('toast');

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function updateInputStats() {
  inputStats.textContent = `${input.value.length.toLocaleString()} chars`;
}

function updateOutputStats(html) {
  outputStats.textContent = `${html ? html.length.toLocaleString() : 0} chars`;
}

function renderErrors(errors) {
  if (!errors || !errors.length) {
    errorsPanel.classList.remove('show');
    errorsList.innerHTML = '';
    return;
  }
  errorsPanel.classList.add('show');
  errorsList.innerHTML = errors
    .map((e) => {
      const line = e.line != null ? `line ${e.line}` : '';
      const tag = e.tagName ? `<${e.tagName}>` : '';
      const msg = (e.message || String(e)).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
      const meta = [line, tag].filter(Boolean).join(' · ');
      return `<span class="err">${meta ? meta + ': ' : ''}${msg}</span>`;
    })
    .join('');
}

let runToken = 0;
async function runCompile(reason = 'manual') {
  const src = input.value.trim();
  if (!src) {
    output.value = '';
    previewIframe.srcdoc = '';
    previewStatus.textContent = 'empty';
    updateOutputStats('');
    renderErrors([]);
    return;
  }

  const token = ++runToken;
  previewStatus.textContent = 'compiling…';

  try {
    const result = mjml2html(src, {
      validationLevel: validationSelect.value,
      keepComments: false,
      minify: false,
    });
    if (token !== runToken) return;

    const html = result.html || '';
    output.value = html;
    previewIframe.srcdoc = html;
    previewStatus.textContent = html ? 'live' : 'no output';
    updateOutputStats(html);

    const errors = (result.errors || []).map((e) => ({
      line: e.line,
      tagName: e.tagName,
      message: e.message || e.formattedMessage,
    }));
    renderErrors(errors);

    trackToolUsed('mjml-converter', reason, {
      input_chars: src.length,
      output_chars: html.length,
      errors: errors.length,
    });
  } catch (e) {
    if (token !== runToken) return;
    output.value = `<!-- MJML compile error: ${e.message} -->`;
    previewIframe.srcdoc = `<pre style="font-family:monospace;color:#c00;padding:16px;">MJML compile error:\n\n${e.message}</pre>`;
    previewStatus.textContent = 'error';
    updateOutputStats(output.value);
    renderErrors([{ message: e.message }]);
  }
}

let debounceTimer = null;
function scheduleAutoCompile() {
  if (!autoToggle.checked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runCompile('auto'), 350);
}

input.addEventListener('input', () => {
  updateInputStats();
  scheduleAutoCompile();
});

validationSelect.addEventListener('change', () => runCompile('validation-change'));

compileBtn.addEventListener('click', () => runCompile('manual'));

sampleBtn.addEventListener('click', () => {
  input.value = SAMPLE_MJML;
  updateInputStats();
  runCompile('sample');
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  output.value = '';
  previewIframe.srcdoc = '';
  previewStatus.textContent = 'empty';
  updateInputStats();
  updateOutputStats('');
  renderErrors([]);
});

copyBtn.addEventListener('click', async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    showToast('HTML copied to clipboard');
    trackToolUsed('mjml-converter', 'copy');
  } catch (e) {
    output.select();
    document.execCommand('copy');
    showToast('HTML copied');
  }
});

downloadHtmlBtn.addEventListener('click', () => {
  if (!output.value) return;
  download(output.value, 'compiled-email.html', 'text/html;charset=utf-8');
  showToast('Downloaded compiled-email.html');
  trackToolUsed('mjml-converter', 'download-html');
});

downloadMjmlBtn.addEventListener('click', () => {
  if (!input.value) return;
  download(input.value, 'email.mjml', 'text/plain;charset=utf-8');
  showToast('Downloaded email.mjml');
  trackToolUsed('mjml-converter', 'download-mjml');
});

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

ctaEditor.addEventListener('click', () => trackCtaClicked('mjml-converter', 'editor'));

updateInputStats();

// ---- Sample MJML: 3-section newsletter (hero, features, footer) ----
const SAMPLE_MJML = `<mjml>
  <mj-head>
    <mj-title>This week at MiN8T</mj-title>
    <mj-attributes>
      <mj-all font-family="Roboto, Helvetica, Arial, sans-serif" />
      <mj-text color="#1a1a1a" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f4f7">

    <!-- Hero -->
    <mj-section background-color="#2b312c" padding="40px 24px">
      <mj-column>
        <mj-text color="#28ef91" font-size="12px" letter-spacing="2px" text-transform="uppercase" font-weight="700">
          Issue #042
        </mj-text>
        <mj-text color="#ffffff" font-size="32px" font-weight="700" line-height="1.2" padding-top="8px">
          5 new free tools for email marketers
        </mj-text>
        <mj-text color="rgba(255,255,255,0.75)" font-size="16px" padding-top="12px">
          We just shipped a CSS inliner, MJML converter, header analyzer, button generator, and A/B sample size calculator. All free, all browser-based, all no-signup.
        </mj-text>
        <mj-button href="https://min8t.com/tools/" background-color="#28ef91" color="#2b312c" font-weight="700" border-radius="999px" padding-top="20px" inner-padding="14px 32px">
          Browse all tools
        </mj-button>
      </mj-column>
    </mj-section>

    <!-- Features 3-up -->
    <mj-section background-color="#ffffff" padding="32px 16px">
      <mj-column>
        <mj-text font-size="14px" font-weight="700" color="#28ef91" text-transform="uppercase" letter-spacing="1px">CSS Inliner</mj-text>
        <mj-text font-size="14px" padding-top="8px">Convert &lt;style&gt; blocks to inline attributes. Preserves @media + pseudo-classes.</mj-text>
        <mj-button href="https://min8t.com/tools/css-inliner/" background-color="transparent" color="#2b312c" border="2px solid #2b312c" font-weight="700" border-radius="999px" inner-padding="10px 20px" font-size="13px">Try it</mj-button>
      </mj-column>
      <mj-column>
        <mj-text font-size="14px" font-weight="700" color="#28ef91" text-transform="uppercase" letter-spacing="1px">MJML Converter</mj-text>
        <mj-text font-size="14px" padding-top="8px">Compile MJML to email-safe HTML in your browser. Live preview included.</mj-text>
        <mj-button href="https://min8t.com/tools/mjml-converter/" background-color="transparent" color="#2b312c" border="2px solid #2b312c" font-weight="700" border-radius="999px" inner-padding="10px 20px" font-size="13px">Try it</mj-button>
      </mj-column>
      <mj-column>
        <mj-text font-size="14px" font-weight="700" color="#28ef91" text-transform="uppercase" letter-spacing="1px">Header Analyzer</mj-text>
        <mj-text font-size="14px" padding-top="8px">Paste raw email headers, see hop trail + SPF/DKIM/DMARC verdicts.</mj-text>
        <mj-button href="https://min8t.com/tools/header-analyzer/" background-color="transparent" color="#2b312c" border="2px solid #2b312c" font-weight="700" border-radius="999px" inner-padding="10px 20px" font-size="13px">Try it</mj-button>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 16px 32px">
      <mj-column>
        <mj-divider border-color="#e8e8ec" border-width="1px" />
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#ffffff" padding="0 24px 40px">
      <mj-column>
        <mj-text font-size="13px" color="#888888" align="center">
          You're receiving this because you signed up at min8t.com.
        </mj-text>
        <mj-text font-size="13px" color="#888888" align="center" padding-top="8px">
          <a href="#" style="color:#888;">Unsubscribe</a> &middot; <a href="#" style="color:#888;">View in browser</a>
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`;
