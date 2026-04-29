# Bulletproof Email Button Generator

**Slug:** `button-generator`
**Live URL:** https://min8t.com/tools/button-generator/
**Spec section:** §10.10 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## What this is

Form-driven generator for email-safe CTA buttons. Outputs the **full bulletproof button pattern** - HTML for modern clients + VML `<v:roundrect>` fallback for Outlook desktop. The differentiator is that we ship the VML fallback. Most free button generators skip it; their buttons render as squares in Outlook desktop.

## The bulletproof pattern

```html
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
             xmlns:w="urn:schemas-microsoft-com:office:word"
             href="..." style="..." arcsize="..." fillcolor="...">
  <w:anchorlock/>
  <center style="...">Button text</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a class="btn-cta" href="..." style="...">Button text</a>
<!--<![endif]-->
```

Modern clients see only the inner `<a>`. Outlook 2007-2019 desktop (and parts of Microsoft 365 on Windows) honor the `[if mso]` conditional and render the VML version. Result: every client sees a real rounded button.

## Inputs

| Field | Default | Notes |
|---|---|---|
| Text | "Read the post" | Click target text |
| URL | `https://min8t.com/articles` | Link destination |
| Background color | `#28ef91` | MiN8T brand green |
| Text color | `#2b312c` | MiN8T brand dark |
| Border color | `#28ef91` | Same as bg by default (no visible border) |
| Border width (px) | 0 | 0-4 supported |
| Corner radius (px) | 999 | Pill shape; use 0 for square, 6 for Stripe-style |
| Font size (px) | 16 | 10-32 |
| Padding X (px) | 32 | Horizontal padding |
| Padding Y (px) | 14 | Vertical padding |
| Font family | `Arial, Helvetica, sans-serif` | Email-safe stacks only |
| Font weight | 700 | 400-700 |
| Alignment | center | left/center/right |
| Target | `_blank` | New tab or same tab |

## Presets

| Name | Style |
|---|---|
| Stripe-style | Indigo (#635bff), 6px radius, semi-bold |
| Mailchimp-style | Yellow (#ffe01b), 4px radius, bold |
| Minimal | Black, 0px radius, medium weight |
| Pill | MiN8T green, 999px radius, bold |
| Square | Red (#dc2626), 0px radius, bold |
| Outlined | White bg + black border, 999px radius |

## VML arcsize calculation

VML's `arcsize` is a percentage of the smaller dimension of the rectangle. We approximate the button height as `padY*2 + fontSize + 4` (line-height adjustment) and convert the requested radius to a percentage:

```js
arcsize = Math.min(50, round((radius / estHeight) * 50)) + '%'
```

Caps at 50% (above which Outlook rounds to a circle anyway). For `radius >= height/2`, this gives a fully-pilled VML.

## Files

- `index.html` - markup, SEO, JSON-LD (WebApplication / BreadcrumbList / FAQPage), 8-question FAQ, harmonized chrome.
- `app.js` - form wiring, button HTML builder, VML arcsize math, 6 presets, live iframe preview, copy button.
- `README.md` - this file.

## SEO targets

- **Primary keywords:** "bulletproof email button generator", "html email button generator", "email cta button code", "outlook email button"
- **Search volume:** ~5k/mo
- **Differentiator:** VML fallback. Most free generators skip it; we make it the default.

## Acceptance checklist

- [x] Form-driven generator with 14 inputs
- [x] 6 presets (Stripe / Mailchimp / Minimal / Pill / Square / Outlined)
- [x] Live iframe preview rendering the modern HTML side
- [x] VML `<v:roundrect>` fallback wrapped in `[if mso]` conditional comment
- [x] Modern HTML wrapped in `[if !mso]` conditional comment
- [x] arcsize calculated from radius
- [x] Copy HTML button
- [x] Sticky controls panel on desktop, stacked on mobile
- [x] FAQ JSON-LD with 8 Q&A
- [x] Zero outbound requests
- [ ] Lighthouse on mobile: P >= 90, SEO 100, a11y >= 95
- [ ] Manual: each preset rendered correctly across modern WebView + Outlook approximation

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/button-generator/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
