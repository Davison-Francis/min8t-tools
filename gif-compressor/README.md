# GIF Compressor (Email-Optimized)

**Slug:** `gif-compressor`
**Live URL:** https://min8t.com/tools/gif-compressor/
**Spec section:** §10.4 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS
- [`gifsicle-wasm-browser`](https://github.com/renzhezhilu/gifsicle-wasm-browser) v1.5.0 (MIT) — full gifsicle binary compiled to WebAssembly
- [`jszip`](https://github.com/Stuk/jszip) v3.10.1 — bulk download

WASM binary loaded from jsdelivr on first use (~600 KB), cached in browser afterward. Total bundle ~30 KB JS + 600 KB WASM (one-time).

## Files

- `index.html` — markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards
- `app.js` — drag-drop, three email-aware presets, four manual controls (width/lossy/colors/loops), live recompress on slider change (debounced 500ms), per-GIF before/after preview, ZIP bulk download, total-payload gauge
- `README.md` — this file

## Email-aware presets

| Preset | Width | Lossy | Colors | Loops | Target |
|---|---|---|---|---|---|
| **Outlook-safe** (default) | 600 px | 80 | 128 | 1 | Under 500 KB, fits 600 px email body |
| **Mobile-friendly** | 480 px | 100 | 64 | ∞ | Smaller for mobile-first sends |
| **Maximum compression** | 400 px | 200 | 32 | ∞ | Smallest possible; visible quality loss |

Manual controls override any preset. Settings re-apply live to all loaded files (debounce 500ms because gifsicle isn't free — re-running on every keystroke is wasteful).

## SEO targets

- **Primary keywords:** "gif compressor", "compress animated gif", "reduce gif file size", "gif optimizer for email"
- **Search volume:** ~50k/month — highest single-tool of the post-MVP set
- **Differentiator:** the email-aware framing. Generic GIF compressors (ezgif, online-image-tools) don't expose Outlook-safe defaults or warn about the 1 MB email payload limit. The Outlook-first-frame caveat in the FAQ alone is uncommon SEO copy.

## Acceptance checklist (from spec §10.4)

- [x] Drag-drop multi-file upload (max 25 MB per file)
- [x] Three email-aware presets (Outlook-safe / Mobile-friendly / Maximum compression)
- [x] Four manual controls: max width, lossy, colors, loops
- [x] Live recompress on any setting change (debounced 500ms)
- [x] Per-GIF before/after preview with reduction %
- [x] Total payload gauge (green / amber over 700 KB / red over 1 MB)
- [x] Per-GIF and bulk ZIP download
- [x] Clear-all button
- [x] FAQPage + WebApplication + BreadcrumbList JSON-LD (8 Q&A)
- [x] GA4 events: `tool_used` (compress / preset / download / download-zip) + `cta_clicked`
- [x] No network calls during compression — gifsicle WASM runs locally
- [ ] Lighthouse on mobile: P ≥ 90 (WASM is heavy first-load) / SEO 100 / a11y ≥ 95
- [ ] Test 5 reference GIFs (small loop, large hero, banner, transparent bg, 30+ frames) — manual

## Known caveats

- The library uses a virtual filesystem with `/in/` and `/out/` paths. The CLI command must reference both (`-o /out/foo.gif /in/foo.gif`). See `buildCommand()` for the exact format.
- gifsicle warmup is ~1-2 s on first compression as the WASM binary instantiates. After that, per-GIF compression is 1-10 s depending on size and frame count.
- WebP animation alternative is mentioned in the FAQ but not produced by this tool — gifsicle is GIF-only by design.

## Future v2 ideas

- **Frame-by-frame editor** — let users delete or duplicate specific frames, useful for trimming a GIF's tail or freezing on a specific frame for the Outlook fallback.
- **GIF → WebP conversion** with cross-client warning copy (since WebP isn't universal).
- **Static first-frame extraction** — output a JPEG of frame 0 alongside the GIF, so users can use it as the static fallback for Outlook.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/gif-compressor/
```

## Deploy

Push to `main` — auto-deploys via `.github/workflows/deploy.yml`.
