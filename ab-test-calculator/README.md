# A/B Test Sample Size Calculator for Email Marketers

**Slug:** `ab-test-calculator`
**Live URL:** https://min8t.com/tools/ab-test-calculator/
**Spec section:** §10.11 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## What this is

Pure-math sample size calculator for email A/B tests. Standard two-proportion z-test:

```
n = (z_alpha + z_beta)^2 * (p1*(1-p1) + p2*(1-p2)) / (p1 - p2)^2
```

Where:
- `p1` = baseline rate
- `p2` = lifted rate
- `z_alpha` = critical value at confidence level (one- or two-sided)
- `z_beta` = critical value at power
- `n` = required sample per variant

Same math as Optimizely, VWO, and Evan Miller's calculator. Email-marketer framing is the SEO wedge - presets are pre-loaded for subject-line, send-time, from-name, and redesign tests.

## Inputs

| Field | Default | Notes |
|---|---|---|
| Baseline rate | 22% | Industry-typical email open rate |
| Lift type | Relative | Toggle to absolute (pp) |
| Expected lift | 10% | Direction of difference |
| Power | 80% | 80 / 85 / 90 / 95 |
| Confidence | 95% | 90 / 95 / 99 |
| Test type | One-sided | Toggle to two-sided |
| Variants | 2 | 2 / 3 / 4 (control + N variants) |
| Daily cap | (optional) | If set, computes "days needed" |

## Outputs

- **Per-variant sample** (the headline number)
- **Total list size** (per-variant × variants)
- **Days needed** (total / daily cap, if cap set)
- **Detectable lift** (echo of input, with units)
- **Plain-English summary** ("To detect a lift from 22% to 24.2% with 80% power and 95% confidence, you need 7,420 subscribers per variant.")
- **Copy-line** (one-line summary for sharing in Slack)
- **Chart** showing sample size vs detectable relative lift (sqrt y-scale because sample size grows like 1/lift^2 - linear scale would be unreadable). Highlights the user's current lift as a dot.

## Z-table

We hardcode z-scores for the common confidence + power levels (80%, 85%, 90%, 95% one-sided, 95% two-sided, 99% one-sided, 99% two-sided). Falls back to Beasley-Springer-Moro inverse-normal approximation for any other value (accuracy ~5e-4, more than enough for sample sizes rounded up).

## Files

- `index.html` - markup, SEO, JSON-LD (WebApplication / BreadcrumbList / FAQPage), 8-question FAQ, harmonized chrome.
- `app.js` - z-table + sample-size formula + chart rendering + scenario presets + copy-line builder.
- `README.md` - this file.

## SEO targets

- **Primary keywords:** "email a/b test sample size calculator", "ab test sample size calculator", "email split test calculator"
- **Search volume:** ~8k/mo
- **Differentiator:** email-marketer framing (open/click rates as defaults), pre-loaded scenarios (subject / send-time / from-name / redesign), one-line shareable summary, sqrt-scale visualization showing lift sensitivity.

## Acceptance checklist

- [x] Two-proportion z-test sample size calculation
- [x] Lift type toggle: relative (%) / absolute (pp)
- [x] Power selector: 80 / 85 / 90 / 95%
- [x] Confidence selector: 90 / 95 / 99%
- [x] One-sided / two-sided toggle
- [x] Variant count (2 / 3 / 4)
- [x] Optional daily-cap input that computes days-needed
- [x] Plain-English summary with all parameters echoed
- [x] Shareable copy-line for Slack
- [x] Sample-size-vs-lift chart with user's current point highlighted
- [x] 4 preset scenarios (subject / send-time / from-name / redesign)
- [x] FAQ JSON-LD with 8 Q&A
- [x] Pure browser - zero outbound requests
- [x] Sticky form panel on desktop, stacked on mobile
- [ ] Lighthouse on mobile: P >= 90, SEO 100, a11y >= 95
- [ ] Cross-check 5 scenarios against Optimizely + Evan Miller calculators - manual

## Verification (against Evan Miller's calculator)

Standard z-test for two proportions, one-sided, 80% power, 95% confidence:
- Baseline 22%, +10% relative lift -> p2=24.2% -> ~5,500 per variant
- Baseline 5%, +20% relative lift -> p2=6.0% -> ~7,500 per variant
- Baseline 10%, +5% relative lift -> p2=10.5% -> ~37,000 per variant

(Numbers may differ by ±1% depending on whether the source calculator uses pooled or unpooled variance estimates - we use unpooled, the convention for sample-size planning.)

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/ab-test-calculator/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
