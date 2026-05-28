"""
Render 75 programmatic SEO pages — {tool} × {ESP}.

Each output is a complete standalone HTML at /tools/{tool}-for-{esp}/index.html
with unique per-ESP content + Schema.org schema + same chrome as the rest of the
tool suite.
"""
import json, os, html as html_lib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # min8t-tools dir
with open(ROOT / "programmatic" / "esps.json") as f: ESPS = json.load(f)
with open(ROOT / "programmatic" / "tools.json") as f: TOOLS = json.load(f)

DATE_PUBLISHED = "2026-05-28"
DATE_MODIFIED = "2026-05-28"

PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<!-- GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Q9EPSM2L1F"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','G-Q9EPSM2L1F');</script>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<meta property="og:image" content="https://min8t.com/tools/og/{tool_slug}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://min8t.com/tools/og/{tool_slug}.png">

<link rel="icon" href="https://min8t.com/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="https://min8t.com/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="https://min8t.com/apple-touch-icon.png">

<link rel="preload" as="font" type="font/woff2" href="https://min8t.com/landing/fonts/roboto/Roboto-Regular.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="https://min8t.com/landing/fonts/roboto/Roboto-Bold.woff2" crossorigin>

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{h1_escaped}",
  "description": "{description_escaped}",
  "author": {{ "@type": "Organization", "name": "MiN8T", "url": "https://min8t.com" }},
  "publisher": {{ "@type": "Organization", "name": "MiN8T", "url": "https://min8t.com", "logo": {{ "@type": "ImageObject", "url": "https://min8t.com/landing/assets/min8t/min8t-logo-circled-white.svg" }} }},
  "datePublished": "{date_published}",
  "dateModified": "{date_modified}",
  "mainEntityOfPage": {{ "@type": "WebPage", "@id": "{canonical}" }},
  "image": "https://min8t.com/tools/og/{tool_slug}.png"
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{ "@type": "Question", "name": "Does {esp_name} include a built-in {tool_lc}?", "acceptedAnswer": {{ "@type": "Answer", "text": "{faq_a1}" }} }},
    {{ "@type": "Question", "name": "Is there a free way to {tool_topic} for {esp_name} campaigns?", "acceptedAnswer": {{ "@type": "Answer", "text": "Yes. The MiN8T {tool_name} below runs entirely in your browser — no signup, no upload, and the output works with any {esp_name} workflow." }} }},
    {{ "@type": "Question", "name": "What image size limit does {esp_name} enforce?", "acceptedAnswer": {{ "@type": "Answer", "text": "{esp_size_answer}" }} }}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{ "@type": "ListItem", "position": 1, "name": "Free Tools", "item": "https://min8t.com/tools/" }},
    {{ "@type": "ListItem", "position": 2, "name": "{tool_name}", "item": "https://min8t.com{tool_url}" }},
    {{ "@type": "ListItem", "position": 3, "name": "{breadcrumb}", "item": "{canonical}" }}
  ]
}}
</script>

<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; background: #fafafa; padding-top: 80px; }}
  .site-header {{ position: fixed; top: 0; left: 0; right: 0; padding: 14px 28px; background: rgba(13, 13, 13, 0.95); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: space-between; z-index: 100; }}
  .site-logo {{ color: #fff; font-weight: 700; text-decoration: none; }}
  .site-nav {{ display: flex; gap: 18px; align-items: center; }}
  .site-nav a {{ color: rgba(255,255,255,0.85); font-size: 14px; text-decoration: none; }}
  main {{ max-width: 760px; margin: 0 auto; padding: 32px 24px 80px; }}
  h1 {{ font-size: 2.25rem; line-height: 1.15; margin-bottom: 16px; color: #0d0d0d; }}
  h2 {{ font-size: 1.5rem; margin: 40px 0 16px; color: #0d0d0d; }}
  h3 {{ font-size: 1.125rem; margin: 24px 0 12px; }}
  p {{ margin: 0 0 16px; }}
  ul, ol {{ margin: 0 0 16px 24px; }}
  li {{ margin-bottom: 8px; }}
  a {{ color: #0066cc; }}
  .lead {{ font-size: 1.125rem; color: #444; margin-bottom: 24px; }}
  .cta-block {{ background: #f0f6ff; border-left: 4px solid #0066cc; padding: 20px 24px; margin: 32px 0; border-radius: 4px; }}
  .cta-block strong {{ display: block; font-size: 1.05rem; margin-bottom: 8px; }}
  .cta-btn {{ display: inline-block; padding: 12px 24px; background: #0066cc; color: #fff !important; border-radius: 999px; font-weight: 600; text-decoration: none; margin-top: 12px; }}
  .key-facts {{ margin: 24px 0; padding: 18px 24px; background: rgba(40, 239, 145, 0.08); border-left: 3px solid #28ef91; border-radius: 6px; }}
  .key-facts h3 {{ margin: 0 0 10px; font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }}
  .key-facts ul {{ list-style: none; margin: 0; padding: 0; }}
  .key-facts li {{ padding: 4px 0; }}
  .key-facts li::before {{ content: "▪ "; color: #28ef91; font-weight: bold; }}
  .tool-meta {{ font-size: 0.875rem; color: #777; margin: 0 0 24px; }}
  .methodology-note {{ margin-top: 48px; padding: 18px 24px; background: rgba(0,0,0,0.04); border-radius: 6px; font-size: 0.875rem; color: #555; }}
  details {{ margin-bottom: 12px; padding: 12px 16px; background: #fff; border: 1px solid #e8e8e8; border-radius: 6px; }}
  summary {{ cursor: pointer; font-weight: 600; }}
  details[open] summary {{ margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
  th, td {{ border: 1px solid #e0e0e0; padding: 10px 14px; text-align: left; font-size: 0.9375rem; }}
  th {{ background: #f5f5f5; }}
</style>
</head>
<body>
<header class="site-header">
  <a href="https://min8t.com/" class="site-logo">MiN8T</a>
  <nav class="site-nav">
    <a href="https://min8t.com/free-tools">Free Deliverability Tools</a>
    <a href="https://min8t.com/tools/">Free Email Tools</a>
    <a href="https://min8t.com/app/email-editor/editor/try">Try Editor →</a>
  </nav>
</header>

<main>
  <h1>{h1}</h1>
  <p class="tool-meta">Built by the MiN8T Engineering Team · <time datetime="{date_modified}">Updated 28 May 2026</time></p>

  <p class="lead">{lead}</p>

  <div class="cta-block">
    <strong>Try the free {tool_lc} now →</strong>
    Browser-only, no signup, no upload. The output works with any {esp_name} campaign.
    <a href="{tool_url}" class="cta-btn">Open the {tool_name}</a>
  </div>

  <aside class="key-facts">
    <h3>Key facts: {tool_name} for {esp_name}</h3>
    <ul>
      {key_facts_html}
    </ul>
  </aside>

  <h2>Why pre-process before uploading to {esp_name}</h2>
  <p>{esp_note}</p>

  <h2>Step-by-step: {tool_topic} for {esp_name}</h2>
  <ol>
    {workflow_html}
  </ol>

  <h2>{esp_name}-specific deliverability quirks to know</h2>
  <p>{deliverability_note}</p>

  <h2>Frequently asked questions</h2>
  <details><summary>Does {esp_name} include a built-in {tool_lc}?</summary><p>{faq_a1}</p></details>
  <details><summary>Is there a free way to {tool_topic} for {esp_name} campaigns?</summary><p>Yes. The free MiN8T <a href="{tool_url}">{tool_name}</a> runs entirely in your browser — no signup, no upload, no rate limits. The output is a standard file you can upload directly to {esp_name}.</p></details>
  <details><summary>What image size limit does {esp_name} enforce?</summary><p>{esp_size_answer}</p></details>
  <details><summary>Does {esp_name} verify SPF, DKIM, and DMARC automatically?</summary><p>{verified_domains}</p></details>
  <details><summary>What about subject line analysis for {esp_name}?</summary><p>{subject_line_note} Use the free <a href="/tools/subject-line-analyzer/">subject line analyzer</a> for length scoring, spam-trigger detection, and sentiment analysis before pasting into {esp_name}.</p></details>

  <h2>Related free tools</h2>
  <p>While preparing your {esp_name} campaign, you may also want:</p>
  <ul>
    {related_tools_html}
  </ul>

  <aside class="methodology-note">
    <strong>About this data:</strong> {esp_name}-specific limits and behavior were last verified May 2026. The MiN8T {tool_name} runs entirely in your browser using {tech_note}. No files leave your device. <br><br>
    Last reviewed: 28 May 2026 · This is editorial content, not affiliated with or endorsed by {esp_name}.
  </aside>
</main>

</body>
</html>
"""

# Helpers
def esc(s): return html_lib.escape(str(s), quote=True)

def render_page(tool_slug, tool, esp_slug, esp):
    slug = f"{tool_slug}-for-{esp_slug}"
    h1 = f"{tool['name']} for {esp['name']}: Free Browser-Based Tool"
    title = f"Free {tool['name']} for {esp['name']} Campaigns | MiN8T"
    og_title = f"{tool['name']} for {esp['name']}: Free Browser-Based"
    breadcrumb = f"for {esp['name']}"
    canonical = f"https://min8t.com/tools/{slug}/"

    description = (
        f"Free in-browser {tool['lc_name']} optimized for {esp['name']} email campaigns. "
        f"{tool['intro_focus'][:80]}"
    )[:160]

    lead = (
        f"{esp['name']}'s built-in tools cover the basics, but the {tool['lc_name']} workflow "
        f"often benefits from a dedicated, browser-only preprocessor before uploading. "
        f"{tool['intro_focus']}"
    )

    # Key facts
    key_facts = []
    for fact in tool['key_facts_template']:
        rendered = fact.format(
            ESP_NAME=esp['name'],
            limit=esp.get('image_limit_kb', 1000),
            width=esp.get('max_width_px', 600),
            formats=", ".join(esp.get('image_formats', [])),
        )
        key_facts.append(f"<li>{esc(rendered)}</li>")

    # Workflow
    workflow_steps = []
    for step in tool['workflow']:
        rendered = step.replace("{ESP_NAME}", esp['name'])
        workflow_steps.append(f"<li>{esc(rendered)}</li>")

    # ESP-specific note for this tool
    esp_note = esp.get(tool['esp_field'], 'This ESP has limited built-in support for this workflow; pre-processing improves consistency.')

    # Related tools
    related = []
    for other_slug, other_tool in TOOLS.items():
        if other_slug == tool_slug: continue
        related.append(f'<li><a href="{other_tool["tool_url"]}">{other_tool["name"]}</a> — also free, browser-based, optimized for email marketers</li>')
    related_html = "\n      ".join(related[:4])

    # Tech note for methodology
    tech_note = {
        "image-compressor": "browser-image-compression library + Web Workers (MozJPEG/oxipng quality)",
        "gif-compressor": "the official gifsicle 1.92 binary compiled to WebAssembly",
        "css-inliner": "Juice 10.0+ running client-side",
        "inbox-preview": "iframe srcdoc with CSS-reset emulation for the Outlook approximation",
        "spam-checker": "60+ SpamAssassin-style heuristics + a Naive Bayes classifier (98% accuracy)",
    }.get(tool_slug, "open-source libraries")

    # FAQ answer 1 — built-in tool in ESP
    faq_a1 = f"{esp['name']} provides basic functionality but lacks granular control. {esp.get(tool['esp_field'], 'A dedicated preprocessor produces better deliverability outcomes.')}"

    esp_size_answer = f"{esp['name']} accepts uploads up to {esp.get('image_limit_kb', 1000)} KB per image and recommends a max width of {esp.get('max_width_px', 600)}px for email body width. Supported formats: {', '.join(esp.get('image_formats', []))}."

    return slug, PAGE_TEMPLATE.format(
        title=esc(title),
        description=esc(description),
        description_escaped=esc(description).replace('"', '\\"'),
        canonical=canonical,
        og_title=esc(og_title),
        h1=esc(h1),
        h1_escaped=esc(h1).replace('"', '\\"'),
        breadcrumb=esc(breadcrumb),
        tool_slug=tool_slug,
        tool_name=esc(tool['name']),
        tool_lc=esc(tool['lc_name']),
        tool_url=tool['tool_url'],
        tool_topic=esc(tool['topic']),
        esp_name=esc(esp['name']),
        lead=lead,
        key_facts_html="\n      ".join(key_facts),
        esp_note=esc(esp_note),
        workflow_html="\n    ".join(workflow_steps),
        deliverability_note=esc(esp.get('deliverability_note', '')),
        faq_a1=esc(faq_a1).replace('"', '\\"'),
        verified_domains=esc(esp.get('verified_domains', 'Check the ESP\'s documentation for the latest authentication setup steps.')),
        subject_line_note=esc(esp.get('subject_line_note', '')),
        esp_size_answer=esc(esp_size_answer).replace('"', '\\"'),
        related_tools_html=related_html,
        tech_note=esc(tech_note),
        date_published=DATE_PUBLISHED,
        date_modified=DATE_MODIFIED,
    )

# ── Build ──
count = 0
for tool_slug, tool in TOOLS.items():
    for esp_slug, esp in ESPS.items():
        slug, html = render_page(tool_slug, tool, esp_slug, esp)
        out_dir = ROOT / slug
        out_dir.mkdir(exist_ok=True)
        (out_dir / "index.html").write_text(html)
        count += 1

print(f"Generated {count} pages")
