# Email Image Compressor

**Slug:** `image-compressor`
**Live URL:** https://min8t.com/tools/image-compressor/
**Spec section:** §3 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS
- [`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression) v2.0.2 — Web-Worker-based JPEG/PNG/WebP compression
- [`jszip`](https://github.com/Stuk/jszip) v3.10.1 — bulk download
- Shared chrome from `../_shared/`

## Files

- `index.html` — markup, SEO, JSON-LD schemas, FAQ, conversion CTA, related tools
- `app.js` — file upload + drag-drop, compression, live recompress on slider change (debounced 350ms), per-image preview with reduction stats, ZIP bulk download, payload gauge
- `README.md` — this file

## SEO targets

- **Primary keywords:** "compress images for email", "email image compressor", "compress image online free"
- **Differentiator:** email-aware defaults (600px width, 1MB total payload warning, JPEG-first format choice). Generic compressors don't enforce these.

## Acceptance checklist (from spec §3.5)

- [x] Drag-drop multi-file upload
- [x] Width + quality sliders update preview live (debounced 350ms)
- [x] Output format selector (JPEG / PNG / WebP) with email-safety hints
- [x] Per-image preview with thumbnail, before/after sizes, reduction %
- [x] Total payload gauge — green / amber (>700KB) / red (>1MB)
- [x] Per-image download
- [x] Bulk ZIP download
- [x] Clear-all button
- [x] 25MB per-file upload cap (silent skip with toast for over-size)
- [x] FAQ JSON-LD schema (8 Q&A)
- [x] WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events: `tool_used` (compress/download/download-zip) + `cta_clicked`
- [x] No network calls — all compression in-browser via Web Worker
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95 — verify after deploy
- [ ] Test 5 reference images (small, large, many-files, transparent PNG, GIF) — manual

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/image-compressor/
```

## Deploy

Push to `main` — auto-deploys via `.github/workflows/deploy.yml`.
