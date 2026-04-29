# Email-Safe Font Checker

**Slug:** `font-checker`
**Live URL:** https://min8t.com/tools/font-checker/
**Spec section:** §10.2 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

Vanilla HTML + ES module JS. Two static data tables embedded in `font-data.js`:

- **CLIENTS** — 15 major email clients with `@font-face` support level (yes / partial / no), sourced from caniemail.com (CC BY 4.0, snapshot 2026-04)
- **FONTS** — ~50 fonts classified as `web-safe` / `system` / `webfont`, each with a recommended fallback CSS stack

Unknown fonts (anything the user types that isn't in the table) are treated as `webfont` — the safe default for any custom font name.

## Files

- `index.html` — markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards
- `font-data.js` — CLIENTS array + FONTS dictionary + `lookupFont()` helper
- `app.js` — UI wiring (live lookup with 200ms debounce, quick-font chips, copy-stack button, GA4 events)
- `README.md` — this file

## SEO targets

- **Primary keywords:** "email safe fonts", "fonts that work in outlook", "gmail font support", "google fonts in email"
- **Search volume:** ~8k/mo
- **Differentiator:** per-client matrix (15 clients) plus instant copy-paste CSS stack. Most online "web-safe fonts" articles are static lists; this is interactive.

## Acceptance checklist (from spec §10.2)

- [x] Live font lookup with 200ms debounce
- [x] 10 quick-font chips for one-click demo
- [x] Per-client matrix (15 clients) with color-coded status (renders / falls back)
- [x] Verdict pill + 1-line explanation per font category
- [x] Copy-paste-ready CSS `font-family` stack
- [x] FAQ JSON-LD (8 Q&A) + WebApplication + BreadcrumbList
- [x] GA4 events: `tool_used` (check / copy-stack) + `cta_clicked`
- [x] Unknown-font handling: defaults to "webfont" treatment with a generic stack
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95 — verify after deploy

## Future v2

- **Auto-update CLIENTS data** from caniemail's GitHub via a GH Actions cron (weekly fetch + commit) — keeps the matrix accurate as email clients change.
- **Side-by-side preview** — render the requested font in `<iframe>` views styled like Gmail / Outlook / Apple Mail with the page CSS isolated. Visual demonstration beats a table for some users.
- **Stack builder UI** — let the user drag-arrange a custom fallback chain instead of using the recommended one.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/font-checker/
```

## Deploy

Push to `main` — auto-deploys via `.github/workflows/deploy.yml`.
