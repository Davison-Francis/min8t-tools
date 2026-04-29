# Background Remover

**Slug:** `background-remover`
**Live URL:** https://min8t.com/tools/background-remover/
**Spec section:** §6 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS
- [`@huggingface/transformers`](https://github.com/huggingface/transformers.js) v3.0.2 — runs ONNX models in the browser via WebGPU (preferred) or WASM (fallback)
- Model: **`Xenova/u2net`** — U2Net salient-object segmentation, **Apache-2.0 weights** (commercial-safe)

## Why U2Net (not a "better" model)

The spec called out three license traps that disqualify the more popular options:

| Model | License | Why we skip |
|---|---|---|
| BRIA RMBG-1.4 / RMBG-2.0 | Non-commercial only | Cannot ship to a tool we monetize indirectly |
| MODNet (pretrained weights) | CC BY-NC-SA | Same — non-commercial |
| imgly/background-removal-js | AGPL-3.0 + commercial dual | AGPL would force-license consumer code |
| **U2Net (Apache-2.0)** | **Apache-2.0** | **Commercial-safe, this is what we use** |

Output quality is slightly less polished than BRIA on hair edges, but the licensing trade is the right call for a free public tool that funnels into a commercial product.

## Architecture

1. User drops or selects an image
2. We display the original immediately
3. If model isn't loaded yet, fetch from Hugging Face's CDN (~170 MB, one time)
4. Cache in IndexedDB via Transformers.js's built-in caching
5. Run inference (WebGPU if available; WASM fallback)
6. Apply the segmentation mask as an alpha channel on a canvas
7. Offer download as transparent PNG, or composite onto a solid color first

**Privacy:** zero outbound requests for the image data. Open DevTools → Network during processing — only the model files (one-time) and HF CDN connection show up. The image itself stays in the browser.

## Performance expectations

- **Desktop with WebGPU** (Chrome 113+, Edge): 2-5 s per image
- **Desktop with WASM**: 5-15 s per image
- **Mobile**: 10-30 s (most phone GPUs don't support WebGPU yet)
- **First load**: +30-60 s for the 170 MB model download. Cached after.

## Files

- `index.html` — markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards. Includes a privacy callout above the dropzone.
- `app.js` — drag-drop upload, model lifecycle, inference, before/after compare, download PNG, optional solid-bg composite. Tracks `tool_used` (remove / download / download-with-bg) and `cta_clicked`.
- `README.md` — this file

## SEO targets

- **Primary keywords:** "background remover free", "remove background no signup", "free transparent png maker"
- **Search volume:** ~200 K/month — extremely competitive (remove.bg, Canva, Photoroom dominate paid offerings)
- **Differentiator:** "100% in-browser, your image never leaves your device" — privacy is real and verifiable in DevTools, not marketing copy. Crawlers and AI Overviews reward this kind of substantive differentiator.

## Acceptance checklist (from spec §6.6)

- [x] Drag-and-drop + click-to-upload
- [x] Model load progress bar shows during first-time download
- [x] WebGPU + WASM fallback (Transformers.js handles the selection)
- [x] PNG output with transparency
- [x] Optional solid color background picker
- [x] Reset / "Process another" button
- [x] No network calls during inference (verifiable in DevTools)
- [x] FAQPage + WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events
- [ ] Lighthouse on mobile: SEO 100, Performance ≥ 80 (model load is heavy by design) — verify after deploy
- [ ] Real-image tests: portrait, product, soft edges, hair, transparent object — manual

## Future v2 ideas

- **Self-host the ONNX model on `cdn.min8t.com`** — avoids HF rate limits + faster delivery (CF edge already serves cdn.min8t.com).
- **WebGPU detection UI** — show "GPU acceleration: enabled" when WebGPU is available.
- **Batch mode** — upload multiple images, process sequentially.
- **Model variants** — let users pick between u2net, u2netp (lighter, faster), and isnet (optional).

## Deploy

Push to `main` — auto-deploys via the GH Actions workflow.
