# Spam Score Checker

**Slug:** `spam-checker`
**Live URL:** https://min8t.com/tools/spam-checker/
**API endpoint:** `POST https://min8t.com/api/tools/spam-check`
**Spec section:** §10.5 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS frontend
- **Cloudflare Worker `min8t-tools-api`** for the scoring engine. Code lives in `workers/api/spam-rules.js`.

The spec offered two paths for this tool: SpamAssassin daemon on the production VM (more accurate, more ops burden), or a pure-JS rules engine in the Worker (~70% of spam signal, zero VM dependency, fits the Cloudflare-only stance of the rest of the tool repo). We took the JS-rules path. Reasoning: this is a free SEO funnel tool, not core product, and adding a VM dependency for tools/ would invert the carefully-kept separation between the two deploy pipelines.

## Files

- `index.html` - markup, SEO meta, JSON-LD schemas (WebApplication / FAQPage / BreadcrumbList), FAQ, CTA, related-tools cards, harmonized chrome (landing CSS, brand fonts, theme-color #28ef91)
- `app.js` - debounced 400ms POST to the API, score circle, category breakdown, triggered-rule cards
- `README.md` - this file

The rules engine itself: `../workers/api/spam-rules.js`.

## Rules summary (21 across 4 categories)

**Content (6 rules):**
- `CONTENT_SPAM_TRIGGERS` - matches against ~150 highest-impact spam-words list
- `CONTENT_URGENCY` - "act now", "limited time", "final notice", "don't miss"
- `CONTENT_GENERIC_GREETING` - "Dear Customer / Sir/Madam / valued member"
- `CONTENT_FORWARD_FRIEND` - chain-letter pattern
- `CONTENT_FREE_GUARANTEE` - "100% free / guaranteed / risk-free"
- `CONTENT_MONEY_BACK` - "money-back guarantee", "no obligation"

**Format (4 rules):**
- `FORMAT_CAPS_RATIO` - >30% uppercase letters (graduated, up to +2.5)
- `FORMAT_EXCLAMATION_RUNS` - !!  ???  runs
- `FORMAT_DOLLAR_RUNS` - $$$, €€€
- `FORMAT_EMOJI_HEAVY` - >5 emoji in body

**Structure (6 rules):**
- `STRUCTURE_IMAGE_ONLY` - text-to-image ratio too low
- `STRUCTURE_HIDDEN_TEXT_WHITE_ON_WHITE` - keyword-stuffing trick
- `STRUCTURE_TINY_FONT` - font-size: 0/1px/2px (also keyword stuffing)
- `STRUCTURE_NO_UNSUBSCRIBE` - CAN-SPAM compliance signal
- `STRUCTURE_NO_PHYSICAL_ADDRESS` - CAN-SPAM compliance signal
- `STRUCTURE_HUGE_HTML` - over 100KB (Gmail clip threshold)

**Links (5 rules):**
- `LINKS_SHORTENER` - bit.ly / t.co / tinyurl / goo.gl etc
- `LINKS_IP_URL` - http://1.2.3.4/ - phishing signature
- `LINKS_MISMATCH` - link text URL ≠ href URL (phishing)
- `LINKS_TOO_MANY` - >30 anchor tags
- `LINKS_MANY_REDIRECTORS` - link.* / click.* / track.* host patterns

Aggregate SpamAssassin-style score is converted to 0-10 user-facing scale (10 = clean, ≤5 = crossed the standard SA spam threshold).

## SEO targets

- **Primary keywords:** "spam score checker", "email spam test free", "spamassassin online", "check email deliverability free"
- **Search volume:** ~20k/month
- **Differentiator vs mail-tester:** no signup, no rate limits, no test-email-required workflow. We trade send-time signals (reputation, auth) for design-time speed.

## Acceptance checklist (from spec §10.5)

- [x] Live debounced (400ms) POST to the Worker as user types
- [x] 0-10 score circle with green/amber/red border per tier
- [x] Category breakdown (content/format/structure/links) with per-category points
- [x] Triggered-rule cards with badge, name, description, points
- [x] Severe rules (≥2 points) get a red left-border to distinguish from minor (amber)
- [x] "Use sample (spammy)" button loads a known-bad email for demo
- [x] Inflight-cancel via AbortController
- [x] FAQ JSON-LD (8 Q&A) covering comparison to mail-tester, rule list, transactional caveat, privacy, false positives, open-source rules
- [x] WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events: `tool_used` (check / load-sample) + `cta_clicked`
- [x] CORS on the Worker: min8t.com + pages.dev preview + localhost dev
- [x] Worker bundle: ~27 KiB total (8.6 KiB gzipped)
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95

## Future v2

- **Rule explanations** - clicking a triggered rule expands a "how to fix" snippet ("Replace 'Dear Customer' with the recipient's first name via merge tag.")
- **Send-this-email check** - integrate with mail-tester or a self-hosted SpamAssassin instance for the full send-time check, surfaced as an optional second-pass scoring tier.
- **Rule severity profile** - let users pick "marketing" vs "transactional" vs "B2B" so transactional users don't see a no-unsubscribe rule firing.
- **Auth records hint** - cross-link to DeliverIQ for SPF/DKIM/DMARC checks (we deliberately don't replicate those - they're DeliverIQ's territory per spec §1.3).

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/spam-checker/
```

## Worker deploy

The Worker lives at `workers/api/`. Deploy with:

```bash
cd workers/api
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy
```

Or push to `main` with the GH Actions workflow active (it deploys both Workers when their respective directory changes).
