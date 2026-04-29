# Email Subject Line Analyzer

**Slug:** `subject-line-analyzer`
**Live URL:** https://min8t.com/tools/subject-line-analyzer/
**API endpoint:** `POST https://min8t.com/api/tools/subject-analyze`
**Spec section:** §5 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## Stack

- Vanilla HTML + ES module JS for the frontend
- **Cloudflare Worker `min8t-tools-api`** for the scoring engine - code lives in `workers/api/`
- 8 sub-scores: length / word count / spam triggers / sentiment / emoji / CAPS ratio / personalization tokens / power words

The Worker bundles two embedded wordlists:
- `spam-words.js` - ~150 highest-impact spam triggers (distilled from `mailmeteor/spam-words` + SpamAssassin's URI/SUBJECT rules)
- `sentiment-words.js` - AFINN-style scoring, ~200 highest-impact words (subset of AFINN-165)

Total Worker bundle: ~15 KiB (5 KiB gzipped). Free tier handles all of it.

## Files

- `index.html` - markup, SEO, JSON-LD schemas, FAQ, CTA, related-tools cards
- `app.js` - debounced (300ms) POST to the API Worker, renders score circle + 8-signal breakdown + matched-trigger pills
- `README.md` - this file

## Score breakdown weights

| Signal | Weight |
|---|---|
| Length | 18% |
| Spam triggers | 20% |
| Power words | 12% |
| Sentiment | 12% |
| Word count | 10% |
| Emoji | 10% |
| CAPS ratio | 10% |
| Personalization | 8% |

Higher score = better. Above 85 ships; 70-85 needs minor tightening; below 70 should be rewritten.

## SEO targets

- **Primary keywords:** "email subject line analyzer", "subject line tester", "subject line checker free"
- **Search volume:** ~25k/month
- **Competitor reference:** CoSchedule (paid above 5/month), Sender (freemium), ISnotSPAM (no live scoring). We win on "no signup, unlimited, instant" plus the personalization + power-words bonuses that competitors don't break out.

## Acceptance checklist (from spec §5.5)

- [x] Live (debounced 300ms) updates as user types
- [x] All 8 sub-scores render with traffic-light dots
- [x] Spam triggers shown as pills with the offending word
- [x] Worker route returns < 100ms p99 (15 KiB bundle, no DB calls)
- [x] Worker errors gracefully - frontend shows a text message if the fetch fails
- [x] Inflight-cancel pattern - typing fast doesn't cause stale renders
- [x] FAQ JSON-LD (8 Q&A) + WebApplication + BreadcrumbList JSON-LD
- [x] GA4 events: `tool_used` (analyze, deduped per session) + `cta_clicked`
- [ ] Lighthouse on mobile: P ≥ 95 / SEO 100 / a11y ≥ 95 - verify after deploy

## Future v2 ideas (not in this build)

- "Try alternatives" button → calls a separate Worker endpoint that uses Workers AI (`@cf/meta/llama-3.1-8b-instruct`, free daily quota) to generate 3 alternative subject lines.
- Multi-language support - the wordlists are English-only today.
- A/B variant scoring side-by-side.

## Worker deploy

The Worker lives at `workers/api/`. Deploy with:

```bash
cd workers/api
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy
```

Or push to `main` with the GH Actions workflow active (it deploys both Workers when their respective directory changes - see `.github/workflows/deploy.yml`).
