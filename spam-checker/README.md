# Spam Score Checker

**Slug:** `spam-checker`
**Live URL:** https://min8t.com/tools/spam-checker/
**API endpoint:** `POST https://min8t.com/api/tools/spam-check`
**Spec section:** §10.5 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS frontend
- **Cloudflare Worker `min8t-tools-api`** at `/api/tools/spam-check` — a **thin proxy** to [SpamCipher](https://spamcipher.com)'s scan API (`api.spamcipher.com/v1/scan`). It holds **no scoring rules of its own**; SpamCipher is the single source of truth (60+ content rules + a Naive Bayes classifier). The Worker sends `X-Partner: min8t` plus the real end-user IP so SpamCipher applies its 5-scans/day-per-IP free limit per visitor, then maps SpamCipher's response back to the `{ score, saScore, triggered, categoryTotals, advice, meta }` shape this frontend renders.

The page lives on min8t.com for SEO and traffic; only the scoring brain is borrowed. This replaced an earlier local JS rules engine (`spam-rules.js`, now deleted) that duplicated SpamCipher's rules and would have drifted out of sync.

## Files

- `index.html` - markup, SEO meta, JSON-LD schemas (WebApplication / FAQPage / BreadcrumbList), FAQ, CTA, related-tools cards, harmonized chrome (landing CSS, brand fonts, theme-color #28ef91)
- `app.js` - debounced 400ms POST to the API, score circle, category breakdown, triggered-rule cards
- `README.md` - this file

The proxy + response adapter live in `../workers/api/index.js` (`handleSpamCheck` / `adaptScanResponse`).

## Scoring

Scoring is delegated entirely to SpamCipher. The proxy adapts its response:

- **Score:** SpamCipher scores higher = worse; this UI shows an inverted 0-10 where 10 = clean, so `score = 10 - overallScore` (`saScore` carries SpamCipher's raw additive score).
- **Categories:** SpamCipher's `subject | body | html | links | positive` rules fold into this UI's `content | format | structure | links` buckets (formatting-abuse rules → format, `html` → structure, textual → content; positive signals are dropped from the issue list).

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
- [x] FAQ JSON-LD (8 Q&A) covering comparison to mail-tester, rule list, transactional caveat, privacy, false positives, scoring engine
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
