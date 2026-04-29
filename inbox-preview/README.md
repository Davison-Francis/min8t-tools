# Inbox Preview

**Slug:** `inbox-preview`
**Live URL:** https://min8t.com/tools/inbox-preview/
**Spec section:** §10.6 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## What this is

Three iframes side-by-side rendering the user's HTML email under three client-style chromes:

1. **Gmail Web** - render mostly as-is (modern WebView, accepts modern CSS)
2. **Apple Mail (iOS)** - render mostly as-is, narrow viewport (390 px logical width)
3. **Outlook Desktop (Win)** - aggressive CSS reset that mimics the Word rendering engine

Honest framing throughout: the Outlook column is labeled "Approximation". For pixel-perfect Outlook desktop testing, users still need Litmus or Email on Acid (which run real Word on real Windows VMs).

## What it is NOT

- A Litmus replacement. Litmus runs real VMs and captures real screenshots.
- A guarantee that what you see is what your recipients see. Real email rendering depends on user fonts, dark-mode setting, image-blocking preferences, and dozens of other factors we can't simulate.

## Outlook approximation

The Outlook iframe applies these transformations to the input HTML:

1. **Process MSO conditional comments** - `<!--[if mso]>...<![endif]-->` blocks are unwrapped and rendered (Outlook desktop honors them); `<!--[if !mso]>...<![endif]-->` blocks are stripped entirely.
2. **Strip `@font-face` declarations** - Outlook desktop's Word engine ignores them.
3. **Strip Google Fonts / Typekit `<link>` tags** - same reason.
4. **Strip `<style>` blocks inside `<body>`** - Outlook only honors `<style>` in `<head>`.
5. **Inject a Word-engine CSS reset** that disables:
   - `display: flex` / `display: grid` (reset to `block`)
   - `transform`, `transition`, `animation`, `filter`, `backdrop-filter`, `clip-path`, `mask`
   - `::before` / `::after` pseudo-elements
6. **Approximate Word's default margins** (12 px body margin).

What it doesn't catch: Word-engine quirks that aren't expressible as CSS-property exclusions. Real-world examples: cell-spacing handling, inline-block computation, image scaling on hi-DPI screens, line-height interpretation. For those, you still need real Outlook.

## Stack

Vanilla HTML + ES module JS. No third-party libraries. The whole thing is ~300 lines of JS.

## Files

- `index.html` - markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards. Includes an honesty banner above the previews and a "what we strip" section explaining the Outlook transformation.
- `app.js` - input handling, three iframe renderers, MSO conditional processing, font-face stripping, body-styles stripping, Word-engine CSS reset injection, sample-load.
- `README.md` - this file.

## SEO targets

- **Primary keywords:** "email preview tool", "test html email", "email client preview", "outlook email preview free"
- **Search volume:** ~10k/mo - most searches go to paid tools (Litmus, Email on Acid). We win on "free, instant, no signup" with honest framing about the partial-win.
- **Differentiator:** the honesty itself. Most "free" inbox preview tools claim parity they can't deliver. Telling users explicitly "Outlook is an approximation, use Litmus for real" is unusual SEO copy that crawlers and AI Overviews tend to reward.

## Acceptance checklist (from spec §10.6)

- [x] Three preview cards (Gmail / Apple Mail / Outlook) side-by-side on desktop, stacked on mobile
- [x] Each preview has client-themed chrome (subject + from line styled like the real client)
- [x] Live debounced (350 ms) rendering as user types
- [x] "Use sample email" button loads a representative HTML email demo
- [x] Outlook approximation processes MSO conditionals, strips `@font-face`, strips body `<style>`, applies Word-engine CSS reset
- [x] Honesty banner above the previews explicitly stating the partial-win nature
- [x] "Approximation" badge on the Outlook column; "Close to real" on Gmail and Apple Mail
- [x] FAQ JSON-LD (8 Q&A) covering Litmus comparison, why Outlook can't be replicated, what the approximation does, Gmail mobile vs web, scope (3 clients only), privacy, input format, screenshots
- [x] WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events: `tool_used` (preview / load-sample) + `cta_clicked`
- [x] Zero outbound requests for HTML data - everything in iframe srcdoc
- [ ] Lighthouse on mobile: P ≥ 90, SEO 100, a11y ≥ 95
- [ ] Test 5 reference inputs (table-only / flexbox-heavy / image-only / Apple-Mail-optimized / Outlook-optimized) - manual

## Future v2

- **Dark-mode toggle** per preview - simulate Apple Mail dark mode and Gmail dark mode (these have different override rules).
- **Image-blocking simulator** - show how the email looks when recipients have images blocked by default.
- **Side-by-side diff highlighter** - visually mark elements that render differently across the three previews (e.g. a flexbox container that collapsed in the Outlook column).
- **More clients** if visual layout density allows: Yahoo Mail, Outlook on the web, Samsung Mail. Diminishing returns since most cluster with Gmail or Apple Mail.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/inbox-preview/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
