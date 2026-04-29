# HTML to Plain-Text Email Converter

**Slug:** `plain-text-converter`
**Live URL:** https://min8t.com/tools/plain-text-converter/
**Spec section:** §10.1 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

Vanilla HTML + ES module JS. **No third-party library** — uses the browser's built-in `DOMParser` to walk the HTML tree and emit plain text directly. The spec called for `turndown` but turndown emits Markdown; we want a pure plain-text MIME alternative without `**bold**` or `[text](url)` syntax. A custom 150-line walker gives us exactly the right output and avoids a dependency.

## Files

- `index.html` — markup, SEO meta, JSON-LD schemas, FAQ, CTA, related-tools cards
- `app.js` — DOM walker + UI wiring (live conversion, debounce 200ms, copy / download / sample-load)
- `README.md` — this file

## Conversion behaviour

| Source | Output |
|---|---|
| `<h1>`–`<h6>` | UPPERCASE / underline-with-`=`/`-` / plain (user choice) with surrounding blank lines |
| `<p>`, `<div>`, `<section>`, etc | Surrounded by blank lines |
| `<a href="https://...">text</a>` | `text (https://…)` inline / numbered references at end / strip URL (user choice) |
| `<a href="mailto:…">x</a>` | `x <foo@bar>` |
| `<a href="tel:…">` | `x (123-456)` |
| `<ul>` / `<ol>` | `* item` or `1. item` |
| `<blockquote>` | Each line prefixed with `> ` |
| `<img alt="X">` | `[X]` (or skipped if no alt) |
| `<br>` | newline |
| `<hr>` | blank line + `----------` + blank line |
| `<style>`, `<script>`, `<iframe>` etc | stripped entirely |

URLs are protected from word-wrap — the wrapper preserves whitespace boundaries so a long URL never gets broken across lines.

## SEO targets

- **Primary keywords:** "html email to plain text", "convert html to plain text email", "multipart email plain text"
- **Search volume:** ~5k/month — niche but the searcher is guaranteed an email user
- **Differentiator:** in-browser, no signup, configurable link style + heading style + line width. Most online converters are server-based and dump generic output.

## Acceptance checklist (from spec §10.1)

- [x] Live conversion as user types (debounce 200ms)
- [x] All three link styles work (inline / reference / strip)
- [x] All three heading styles work (uppercase / underline / plain)
- [x] Configurable line width (default 76 per RFC 5322 practical convention)
- [x] Copy plain text + download as `.txt`
- [x] Sample HTML email button to demo without your own input
- [x] FAQ JSON-LD (8 Q&A) + WebApplication + BreadcrumbList
- [x] GA4 events: `tool_used` (convert / copy / download / load-sample) + `cta_clicked`
- [x] No network calls — pure in-browser via `DOMParser`
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95 — verify after deploy
- [ ] Test 5 reference inputs (newsletter / transactional / marketing / AMP / minimal) — manual

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/plain-text-converter/
```

## Deploy

Push to `main` — auto-deploys via `.github/workflows/deploy.yml`.
