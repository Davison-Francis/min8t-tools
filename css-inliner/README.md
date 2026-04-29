# CSS Inliner for HTML Email

**Slug:** `css-inliner`
**Live URL:** https://min8t.com/tools/css-inliner/
**Spec section:** §10.7 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## What this is

Paste HTML email source with `<style>` blocks; get back the same HTML with all CSS inlined as `style="..."` attributes per element. The original `<style>` blocks are reduced to only the rules that can't be inlined: `@media`, `@supports`, `@keyframes`, `@font-face`, `@import`, and any rule containing pseudo-classes (`:hover`, `:focus`, `::before`, etc.).

Inline styles are the only CSS form that every email client supports. Most clients strip or partially strip `<style>` blocks, so inlining is a pre-send hygiene step.

## Algorithm

1. Wrap the user's HTML in a hidden iframe (`sandbox="allow-same-origin"` so we can read its `document.styleSheets`).
2. Walk every readable stylesheet. For each rule:
   - **Style rules:** split selector on `,`. For parts containing pseudo-classes / pseudo-elements (regex `::?[a-zA-Z]` after stripping attribute selectors), preserve in the `<style>` block. For parts without pseudo-classes, queue inlining.
   - **`@media` / `@supports` / `@keyframes` / `@font-face` / `@import`:** preserve verbatim.
3. For each inlineable selector: `idoc.querySelectorAll(sel)` → for each matched element, accumulate per-property entries `{value, important, specificity, sourceOrder}` in a per-element `Map`. The winner is the entry with: higher `important`, then higher specificity (a, b, c tuple compared lex), then later source order.
4. After all rules processed: for each element with accumulated styles, write the winning entry per property as inline `style.setProperty(prop, value, important)`. Existing inline styles in the input are kept unless overridden by an `!important` rule.
5. Replace each `<style>` block's content with the rules that were preserved. If no rules were preserved, remove the empty `<style>` block.
6. Serialize: `'<!DOCTYPE html>\n' + idoc.documentElement.outerHTML`.

## Specificity

Standard (a, b, c) tuple per CSS Selectors L3:

- **a** — count of `#id` selectors
- **b** — count of `.class` / `[attr]` / `:pseudo-class` selectors
- **c** — count of element types and pseudo-elements

Comparison is lexicographic: `(1,0,0) > (0,99,99)`.

`!important` always beats non-important regardless of specificity. Source order (rule index across all stylesheets) breaks ties at equal specificity + importance.

Inline styles in the user's input are treated as "always wins for non-important conflicts" - they're only overridden by an `!important` rule from a `<style>` block. (We don't recompute their specificity; the browser already exposes them via `el.style.getPropertyValue()` and we leave those values intact.)

## What's preserved

| Rule type | Preserved? | Reason |
|---|---|---|
| `.class { ... }` | No (inlined) | inlineable |
| `#id { ... }` | No (inlined) | inlineable |
| `tag.class { ... }` | No (inlined) | inlineable |
| `tag[attr="x"] { ... }` | No (inlined) | inlineable |
| `a:hover { ... }` | Yes | state can't be inlined |
| `::before` / `::after` | Yes | pseudo-element |
| `:first-child`, `:nth-child` | Yes | state-dependent |
| `@media` | Yes | conditional |
| `@supports` | Yes | conditional |
| `@keyframes` | Yes | references named animation |
| `@font-face` | Yes | referenced by `font-family` |
| `@import` | Yes | external load |

## Stack

Vanilla HTML + ES module JS. ~250 lines of JS. No third-party libraries. The browser parses the CSS for us via `document.styleSheets` from a hidden iframe.

## Why not `juice`?

[`juice`](https://github.com/Automattic/juice) is the canonical Node.js inliner. It's not a browser library - it depends on `cheerio` (jQuery-style HTML parser for Node) and uses Node-specific APIs. There are browserify forks (`@kdcio/juice-browser`, etc.) but they ship 200+ KB of bundled deps for what the browser does natively.

The browser already parses CSS into `CSSStyleRule` objects. We use those directly. Total runtime: ~250 lines of JS vs 200+ KB of bundled deps.

The only nuance the browser doesn't handle automatically is **specificity at the per-property level for accumulated rules**. We compute that ourselves in `selectorSpecificity()` and `winsOver()`.

## Files

- `index.html` - markup, SEO, JSON-LD (WebApplication / BreadcrumbList / FAQPage), 8-question FAQ, harmonized chrome (header / footer / hero-bg).
- `app.js` - inliner core + UI plumbing.
- `README.md` - this file.

## SEO targets

- **Primary keywords:** "email css inliner", "html email css to inline", "inline css for email free", "css inliner online"
- **Search volume:** ~25k/mo combined (highest of the post-MVP set)
- **Differentiators:** no signup, no upload (all browser), preserves `@media` queries, respects specificity correctly, includes Gmail clip-threshold warning, works on `juice`-incompatible inputs (any HTML the browser can parse)

## Acceptance checklist

- [x] Paste HTML with mixed selectors, gets correctly-inlined output
- [x] `@media` queries preserved
- [x] `@keyframes` preserved
- [x] `@font-face` preserved
- [x] Pseudo-class rules (`:hover`) preserved
- [x] Specificity correctly resolves (`#id` beats `.class` beats `tag`)
- [x] `!important` correctly overrides non-important
- [x] Existing inline styles preserved (not clobbered) unless `!important` overrides
- [x] Output size displayed; warns above 102 KB Gmail clip threshold
- [x] Auto-inline-on-input toggle (debounced 250ms)
- [x] Sample email loads with mixed cases (responsive, hover, !important)
- [x] Copy / download / clear buttons
- [x] FAQ JSON-LD with 8 Q&A
- [x] Zero outbound requests for HTML data
- [ ] Lighthouse on mobile: P >= 90, SEO 100, a11y >= 95
- [ ] Test 5 reference inputs (responsive newsletter / promotional with hover / transactional / dark-mode / heavy nested-table) - manual

## Known limitations

- **`@import` rules referencing external stylesheets** are preserved verbatim. The inliner doesn't fetch them - we'd need CORS to access cross-origin stylesheets and emails generally can't load external CSS anyway.
- **`@layer` cascade layers** are processed but the layer ordering isn't fully respected - layers within a single sheet collapse. Acceptable for email since `@layer` isn't supported in any email client.
- **CSS-in-JS / styled-components output** with hash-suffixed class names works fine - the inliner cares about whether the selector matches, not what the class is named.
- **Fragments without `<html>` / `<body>`** are wrapped automatically by the browser when written to the iframe. The serialized output will include the wrapper - users can strip it back to a fragment manually.

## Future v2

- **Strip unused selectors** before inlining (a la `email-comb` from codsen). Saves output size.
- **Compress repeated style fragments** by extracting common substrings.
- **MJML / Maizzle build-step integration** - one-click "I'm using MJML" that runs MJML compile first then inlines.
- **Diff view** showing which selectors mapped to which elements.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/css-inliner/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
