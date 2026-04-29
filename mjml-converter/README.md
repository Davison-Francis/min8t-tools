# MJML to HTML Converter

**Slug:** `mjml-converter`
**Live URL:** https://min8t.com/tools/mjml-converter/
**Spec section:** §10.8 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## What this is

Paste MJML markup; get email-safe HTML out. Compiles entirely in your browser via the official `mjml-browser` library (MIT, by Mailjet). Three-pane layout: MJML input / compiled HTML output / live iframe preview.

## Stack

- `mjml-browser@4.15.3` loaded from `https://esm.sh/mjml-browser@4.15.3` (esm.sh transforms the CJS package into ESM and serves it gzipped).
- Vanilla JS + Web Components (no framework).
- ~140 lines of app.js; ~360 KB gzipped for the MJML library on first load (cached thereafter).

## How it works

```js
import mjml2html from 'https://esm.sh/mjml-browser@4.15.3';

const result = mjml2html(mjmlSource, {
  validationLevel: 'soft', // 'soft' | 'strict' | 'skip'
  keepComments: false,
  minify: false,
});

// result.html  -> compiled HTML
// result.errors -> array of {line, tagName, message}
```

The compiled HTML is set as `iframe.srcdoc` for the preview pane and as the value of the output textarea. Errors render in a styled panel above the FAQ.

## Validation levels

| Level | Behavior |
|---|---|
| `soft` (default) | Warns about unknown tags / invalid attributes. Compiles anyway. |
| `strict` | Refuses to compile if errors are present. |
| `skip` | No validation. Compile or fail without diagnostic info. |

## Files

- `index.html` - markup, SEO, JSON-LD (WebApplication + BreadcrumbList + FAQPage), 8-question FAQ, harmonized chrome.
- `app.js` - mjml import, three-pane wiring, debounced auto-compile, sample-loader, copy/download, error panel.
- `README.md` - this file.

## SEO targets

- **Primary keywords:** "mjml to html", "mjml compiler online", "mjml online editor free", "convert mjml to html"
- **Search volume:** ~10k/mo
- **Differentiators:** no signup, no install, faster than Mailjet's hosted demo (no server roundtrip), three-pane preview (most online MJML tools show only input+output, no live render), validation level toggle exposed.

## Acceptance checklist

- [x] Three-pane layout (MJML / HTML / iframe preview), responsive (3 cols >= 1100px / 2 cols 700-1099 / 1 col < 700).
- [x] Compile button + auto-compile-on-input (debounced 350ms).
- [x] Sample MJML loader (3-section newsletter: hero / features 3-up / footer).
- [x] Validation level select (soft / strict / skip).
- [x] Errors panel with line numbers + tag references.
- [x] Copy HTML / Download .html / Download .mjml / Clear buttons.
- [x] FAQ JSON-LD with 8 Q&A.
- [x] Live iframe preview rendering compiled HTML.
- [x] Char counters on both input and output.
- [ ] Lighthouse on mobile: P >= 90, SEO 100, a11y >= 95
- [ ] Test 5 reference inputs (Mailjet starter / 4-column responsive / hero with overlay / Outlook-strict / malformed) - manual.

## Known limitations

- **First-load cost:** mjml-browser is ~360 KB gzipped. Lazy-loaded as ES module on first compile. Subsequent compiles are local-only.
- **Custom MJML components:** the official `mjml-browser` build doesn't include third-party `mj-` components. If users need community components, they'd need a build step.
- **AMP for Email:** out of scope for MJML. Pass through `<mj-raw>` blocks if needed.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/mjml-converter/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
