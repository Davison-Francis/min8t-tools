# MiN8T Free Tools

Free SEO-driving tools for email marketers, served at **`min8t.com/tools/<slug>/`**.

This repo is **deliberately separated from the main MiN8T product repo** (`Davison-Francis/min8tEmail`). Tools here never merge into the product, and product code never lands here. Both repos share the `min8t.com` apex via a Cloudflare Worker that path-routes `min8t.com/tools/*` → this Pages project.

## Spec

The canonical implementation spec lives in the main repo at:
**[`IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`](https://github.com/Davison-Francis/min8tEmail/blob/main/IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md)**

Read that first — it covers architecture, SEO non-negotiables, per-tool functional specs, build order, and acceptance criteria.

## Layout

```
min8t-tools/
├── _shared/              # Shared chrome (header, footer, CSS, analytics)
├── _index.html           # Tools landing page (lists all tools)
├── utm-builder/          # Tool 1 — UTM Campaign URL Builder
├── image-compressor/     # Tool 2 — HTML Email Image Compressor
├── email-signature-generator/  # Tool 3
├── subject-line-analyzer/      # Tool 4 (frontend; Worker is in workers/)
├── background-remover/   # Tool 5
├── workers/              # Cloudflare Workers (subject-analyzer, etc.)
└── 404.html
```

Each tool is a self-contained `index.html` + `app.js` + `README.md` (SEO copy source-of-truth).

## Development

No build pipeline by default — vanilla HTML + ES modules served directly. If a specific tool needs a build (Tool 3 ships a Vue fork), it lives in its own subdirectory with its own `package.json` and the build output goes into the same directory under `dist/` which Pages will serve.

```bash
# local dev — any static server works
npx serve .
# or:
python3 -m http.server 8000
```

Open `http://localhost:8000/utm-builder/` etc.

## Deploy

Auto-deployed by Cloudflare Pages on every push to `main`. The Pages project is `min8t-tools` (separate from `min8t-landing`), routed at `min8t.com/tools/*` via a Worker.

```bash
git push origin main   # triggers Pages build + deploy
```

## License

MIT — see `LICENSE`. Each forked tool retains its upstream license; per-tool licenses are noted in each tool's directory README.
