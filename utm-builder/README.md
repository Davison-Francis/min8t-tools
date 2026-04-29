# UTM Campaign URL Builder

**Slug:** `utm-builder`
**Live URL:** https://min8t.com/tools/utm-builder/
**Spec section:** `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md` §2 (in the main product repo)

## Stack

- Vanilla HTML + ES module JS, no build pipeline
- [`qrcode`](https://github.com/soldair/node-qrcode) v1.5.3 from jsdelivr for QR rendering
- Shared chrome from `../_shared/styles.css` and `../_shared/analytics.js`

## Files

- `index.html` — markup, SEO meta, JSON-LD schemas (WebApplication / BreadcrumbList / FAQPage), tool UI, FAQ, conversion CTA, related-tools cards
- `app.js` — form-to-URL logic, QR generation, localStorage recents (last 5), copy-to-clipboard, GA4 events
- `README.md` — this file

## SEO targets

- **Primary keywords:** "utm builder", "utm link builder", "campaign url builder", "free utm generator"
- **Search volume:** ~30k/month combined
- **Differentiator:** unlimited use, no signup, in-browser persistence (recents in localStorage), QR code download

## Acceptance checklist (from spec §2.5)

- [x] All 5 UTM fields update the URL live as user types
- [x] Copy-to-clipboard with toast confirmation (with `document.execCommand` fallback for old browsers)
- [x] QR code renders and downloads as PNG on click
- [x] localStorage recents work (last 5 source/medium/campaign combos), display as clickable pills
- [x] Required-field validation (URL must parse; source/medium/campaign must have values)
- [x] FAQ JSON-LD schema present and valid
- [x] WebApplication + BreadcrumbList JSON-LD schemas present
- [x] CTA click fires `cta_clicked` GA4 event with `tool: utm-builder, target: editor`
- [x] Tool usage fires `tool_used` GA4 event (deduped to one per session)
- [ ] Lighthouse on mobile: Performance ≥ 95, SEO = 100, Accessibility ≥ 95 — **verify after deploy**
- [ ] FAQ schema validates on https://validator.schema.org — **verify after deploy**

## Local development

No build step. Serve the repo root with any static server:

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/utm-builder/
```

## Deploy

Push to `main`. The `.github/workflows/deploy.yml` workflow auto-deploys to Cloudflare Pages.
