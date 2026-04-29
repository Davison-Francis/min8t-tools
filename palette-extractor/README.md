# Brand Color Extractor

**Slug:** `palette-extractor`
**Live URL:** https://min8t.com/tools/palette-extractor/
**Spec section:** §10.3 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS, no build pipeline
- [`colorthief`](https://github.com/lokesh/color-thief) v2.4.0 (MIT) — Modified Median Cut color quantization for dominant-color extraction
- [`chroma-js`](https://github.com/gka/chroma.js) v3.1.2 (BSD-3) — color space conversions, OKLab interpolation for tint generation, WCAG contrast calculation

Both libraries pulled from jsdelivr ESM. Total bundle ~30 KB gzipped, no build step.

## Files

- `index.html` — markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards
- `app.js` — pipeline (file → image → ColorThief → 5 base colors → 9-step scales → output formats), 4 export formats (CSS / Tailwind / JSON / SCSS), live editing of base colors with regeneration
- `README.md` — this file

## Pipeline

1. User drops or selects an image (max 10 MB)
2. Image loads into a hidden `<img>`, then a hidden canvas via ColorThief
3. ColorThief returns 5 dominant colors as RGB triplets
4. For each base color: generate 9 steps (50, 100, 200, ..., 900) by interpolating in OKLab space toward white (light steps) and toward `#0a1628` near-black (dark steps)
5. For each step: compute WCAG 2.1 contrast ratio against white and black; tag AA pass (≥4.5:1) and AAA pass (≥7:1)
6. Render the palette UI — 5 rows, each showing the base + 9-step scale with hex tooltips and accessibility badges
7. User can edit any base hex inline → scale regenerates live
8. Export tab switcher: CSS variables, Tailwind theme.colors, JSON, SCSS
9. Copy or download as a file

## SEO targets

- **Primary keywords:** "extract colors from logo", "brand color palette generator", "image color extractor", "color palette from image"
- **Search volume:** ~15k/mo
- **Differentiator:** instant CSS / Tailwind / JSON / SCSS export, with WCAG contrast checks. Most online palette tools dump 5 colors with no scale and no accessibility info.

## Acceptance checklist (from spec §10.3)

- [x] Drag-drop or click upload (max 10 MB, accept JPEG/PNG/WebP/SVG)
- [x] 5 base colors via ColorThief
- [x] 9-step scale per color (50, 100, 200, 300, 400, 500, 600, 700, 800, 900) with OKLab interpolation
- [x] WCAG AA + AAA badges per step (vs better of white/black background)
- [x] Hover swatch shows hex; click swatch copies hex
- [x] Inline base-color editing (hex input regenerates scale live)
- [x] 4 export formats: CSS variables / Tailwind theme.colors / JSON / SCSS
- [x] Copy + download per format
- [x] JSON tab surfaces a "Use in MiN8T Brand Guidelines" deep-link CTA (the strongest funnel hook of any post-MVP tool — output goes directly into the existing Brand Guidelines module)
- [x] FAQ JSON-LD (8 Q&A) + WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events: `tool_used` (extract / copy-format / download / switch-format / copy-swatch) + `cta_clicked` (brand-guidelines / brand-guidelines-deep)
- [x] No network calls during extraction — runs entirely in the browser
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95 — verify after deploy
- [ ] Test 5 reference images (Stripe logo, Slack logo, brand photo, busy hero, single-color icon) — manual

## Future v2

- **Format the JSON to match Brand Guidelines' import schema exactly** so the deep-link `?palette=<encoded>` actually loads the palette pre-populated in the editor (rather than asking the user to paste).
- **Color-blindness simulator** — show how the palette renders to deuteranopia / protanopia / tritanopia. Useful for accessibility-conscious brands.
- **Lock specific base colors** — let the user pin one extracted color and re-extract the remaining 4 (e.g., when the algorithm picks a near-miss).
- **Palette comparison** — load two images, see palettes side-by-side. Useful for redesign / brand-refresh work.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/palette-extractor/
```

## Deploy

Push to `main` — auto-deploys via `.github/workflows/deploy.yml`.
