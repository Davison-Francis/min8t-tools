# Email Signature Generator

**Slug:** `email-signature-generator`
**Live URL:** https://min8t.com/tools/email-signature-generator/
**Spec section:** §4 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

Vanilla HTML + ES module JS. **No fork** of mailtutan/email-signature-generator - wrote fresh templates instead. Reasoning:

- Mailtutan's repo is Vue 3 + Vite, which would have been the only build pipeline in our otherwise vanilla-JS repo.
- The interesting part of a signature generator is the *templates* (Outlook-safe HTML) - we wrote three new ones from scratch following the caniemail compatibility matrix.
- Maintenance cost of a fork (rebasing, prop drift, dependency updates) outweighs the time saved.

## Files

- `index.html` - markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards
- `app.js` - three template renderers (classic / minimal / accent), live preview into a sandboxed iframe via `srcdoc`, dual-mode copy (rich content via `ClipboardItem` + plain HTML source), color picker / text sync, GA4 events
- `README.md` - this file

## Outlook compatibility

Every template is built using only what survives Outlook's Word rendering engine:

- `<table>` / `<tr>` / `<td>` for layout - no flexbox, no grid, no margin
- Inline `style` only - no `<style>` blocks (Outlook ignores them anyway)
- Pixel widths only - no rem / em / %
- `cellpadding` + `cellspacing` for spacing
- JPEG/PNG photos hosted at a URL (no data: URLs - Outlook may strip them)
- Plain text social links styled as colored pills - no image icons (avoids Outlook's image-block defaults)

## SEO targets

- **Primary keywords:** "free email signature generator", "html email signature", "outlook email signature template"
- **Search volume:** ~50k/month - highest single-tool of the 5 MVP tools
- **Differentiator:** "no signup, unlimited use, three working Outlook-safe templates"

## Acceptance checklist (from spec §4.5)

- [x] All form fields update preview live (debounced via natural input event flow)
- [x] 3 templates work + switching preserves form data (form state held in DOM)
- [x] Photo URL input (no upload - host on CDN; documented as best practice for Outlook)
- [x] Social links - only filled fields appear (LinkedIn, Twitter/X, Instagram, GitHub)
- [x] Brand color picker + hex text input, kept in sync
- [x] "Copy for Gmail / Apple Mail" - uses `ClipboardItem` to paste as rich content
- [x] "Copy HTML source" - plain-text copy of raw markup
- [x] HTML source viewer (collapsible `<details>`)
- [x] FAQ JSON-LD (9 Q&A)
- [x] WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events: `tool_used` (generate / switch-template / copy-rich / copy-source) + `cta_clicked`
- [x] No MiN8T branding in the generated HTML - output is user-owned
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95 - verify after deploy
- [ ] Real Outlook desktop test - paste rich-copy version into Outlook 2019 signature editor; should render exactly as preview

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/email-signature-generator/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
