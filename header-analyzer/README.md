# Email Header Analyzer

**Slug:** `header-analyzer`
**Live URL:** https://min8t.com/tools/header-analyzer/
**Spec section:** §10.9 of `IMPLEMENTATION/specs/FREE_TOOLS_LANDING_PAGES_SPEC.md`

## What this is

Paste raw email headers (the full `Header: value` lines you get from "Show original" / "View source" / "All Headers" in any mail client). The analyzer:

1. Parses RFC-5322 headers (with continuation-line folding).
2. Walks the `Received:` chain in chronological order (origin first).
3. Computes per-hop time delays.
4. Decodes `Authentication-Results:` and `ARC-Authentication-Results:` for SPF / DKIM / DMARC verdicts.
5. Extracts originating IP from the bottom-most `Received:` header.
6. Parses the `DKIM-Signature` header for signing domain + selector.
7. Flags suspicious patterns: hop delays > 60s, hop count > 10, From/Return-Path domain mismatch, DKIM/From domain misalignment, missing auth headers, missing Message-ID.

All in your browser. Zero outbound requests.

## Stack

Vanilla JS. ~330 LOC. No dependencies.

## How parsing works

### Headers
- Normalize line endings (`\r\n` / `\r` -> `\n`).
- Split at first blank line (header/body boundary per RFC 5322).
- For each line: if starts with whitespace, append to previous header's value (continuation); else split on first `:` into `{name, value}`.

### Received hops
- Each `Received:` value has form: `from <host> (<info>) by <host> with <protocol> id <id> for <addr>; <date>`.
- Extract `from`, `by`, IP (from `[1.2.3.4]` or first dotted-quad in trace), and timestamp (after last `;`).
- Headers come top-down in the file but Received headers are added at the **top** as the message moves, so we **reverse** the list to get chronological order (origin first).
- Per-hop delay = `hops[i].date - hops[i-1].date` in seconds.

### Authentication-Results
- Format: `host; spf=verdict (...); dkim=verdict header.i=@domain header.s=selector header.b=...; dmarc=verdict ...`
- Split on `;`, parse each token with `^(spf|dkim|dmarc)\s*=\s*([a-z]+)`.
- For DKIM, also extract `header.i=` (signing domain) and `header.s=` (selector).
- `ARC-Authentication-Results:` parsed identically; falls back to ARC verdicts if no top-level `Authentication-Results` found (forwarded messages).

### DKIM-Signature
- Format: `v=1; a=rsa-sha256; c=relaxed/relaxed; d=domain; s=selector; ...; b=signature`
- Token-split on `;`, key=value parse.

### Suspicious flags
- SPF/DKIM/DMARC missing or non-pass.
- From-domain != Return-Path domain (classic spoofing tell, also normal for many ESPs and forwarders).
- DKIM signing domain not aligned with From: domain (DMARC requires alignment).
- Missing Message-ID.
- Hop count > 10.
- Per-hop delay > 60s.

## Files

- `index.html` - markup, SEO, JSON-LD (WebApplication / BreadcrumbList / FAQPage), 8-question FAQ, harmonized chrome.
- `app.js` - parser + renderer + UI plumbing + 2 sample header sets (clean Gmail-to-Gmail, spoofed message).
- `README.md` - this file.

## SEO targets

- **Primary keywords:** "email header analyzer", "trace email headers", "email header lookup free", "email source viewer"
- **Search volume:** ~15k/mo
- **Differentiators:** no signup, no upload, cleaner UX than Microsoft MHA, includes spoofed sample for demonstration, links to MXToolbox/Spamhaus for IP reputation lookup.

## Acceptance checklist

- [x] Paste headers, see parsed summary + auth verdicts + hop trail + raw table
- [x] Two sample loaders: clean Gmail-to-Gmail; spoofed message with SPF/DKIM/DMARC fail
- [x] Suspicious pattern detection: SPF/DKIM/DMARC fail, From/Return-Path mismatch, DKIM domain misalignment, missing Message-ID, long hop chain, slow hops
- [x] Originating IP extracted with one-click MXToolbox + Spamhaus reputation links
- [x] Hop trail rendered with per-hop delays, warn-styled if > 60s
- [x] Searchable raw header table
- [x] FAQ JSON-LD with 8 Q&A
- [x] Zero outbound requests for header data
- [ ] Lighthouse on mobile: P >= 90, SEO 100, a11y >= 95
- [ ] Test 5 reference inputs (clean / multi-hop relayed / SPF-fail / DMARC-quarantine / forwarded-with-ARC) - manual

## Limitations

- **No live IP reputation lookup.** Would require a backend with rate-limited DNS. We surface the IP and link to MXToolbox/Spamhaus for manual lookups.
- **Date parsing depends on JS Date constructor.** Most RFC-5322 dates work; some unusual formats may show as "(no date)".
- **No PGP/S-MIME signature validation.** Out of scope - those are separate tools.

## Local dev

```bash
cd /path/to/min8t-tools
npx serve .
# open http://localhost:3000/header-analyzer/
```

## Deploy

Push to `main` - auto-deploys via `.github/workflows/deploy.yml`.
