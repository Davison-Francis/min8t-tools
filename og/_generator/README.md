# OG image generator

Generates 1200×630 PNG OG images for each tool in the collection.

## Why static PNGs (not Workers/dynamic)

Slack, LinkedIn, Discord, Facebook scrapers all want raster images. Static PNGs on a CDN are simpler than dynamic generation and have no cold-start cost.

Each PNG is ~55-70 KB. 16 images = ~1 MB total. Negligible on git.

## Stack

- Node (any modern version) for the generator
- `rsvg-convert` (from `librsvg`) for SVG→PNG conversion: `brew install librsvg` on macOS, `apt install librsvg2-bin` on Linux

No npm dependencies. Plain `fs` + `child_process.execSync`.

## Re-run

```bash
cd og/_generator
node build.js
# PNGs are emitted to ./out/ — copy to ../  to publish
cp out/*.png ../
```

## Adding a new tool

1. Add an entry to `tools.json` with `slug`, `title`, `subtitle`.
2. Run the generator.
3. Copy the new PNG up one level.
4. Add `og:image` / `twitter:image` meta tags to the new tool's `index.html`:

   ```html
   <meta property="og:image" content="https://min8t.com/tools/og/<slug>.png">
   <meta property="og:image:width" content="1200">
   <meta property="og:image:height" content="630">
   <meta property="og:image:alt" content="<Title>">
   <meta name="twitter:image" content="https://min8t.com/tools/og/<slug>.png">
   ```

## Design

Per-tool 1200×630 layout:

- Dark canvas (`#0d0d0d` → `#1a1a1a` gradient)
- 8 px brand-green vertical accent strip (left edge)
- Diagonal brand-green gradient flourish (top-right corner)
- "MiN8T / FREE TOOLS" wordmark with circle-M (top-left)
- "NO SIGNUP" pill (top-right, brand-green outlined)
- Tool title in Helvetica Neue Bold 84pt (centred-left, wraps to 2 lines if needed)
- Subtitle in Helvetica Neue Regular 28pt (below title)
- Tool URL in SF Mono 20pt (bottom-left, muted)
- "Try it free →" CTA in brand-green (bottom-right)

Helvetica Neue is the system fallback chosen because:
- librsvg has limited woff2 support (the brand fonts are PP Neue Montreal in woff2)
- Helvetica Neue is geometrically close to PP Neue Montreal
- Renders perfectly with librsvg without needing font embedding

## Validation

After generating, validate via:

- https://www.opengraph.xyz/?url=https%3A%2F%2Fmin8t.com%2Ftools%2Fcss-inliner%2F
- https://cards-dev.twitter.com/validator (deprecated but still works)
- Slack DM: paste the tool URL, check the unfurl
