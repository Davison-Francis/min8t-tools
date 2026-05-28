/**
 * Worker: min8t-tools-api
 *
 * Public API endpoints for the free tools that need server-side compute.
 * Currently exposes one route:
 *
 *   POST /api/tools/subject-analyze
 *     body: { subject: "your subject line, max 200 chars" }
 *     200:  { score, breakdown[8], spamTriggers[], advice }
 *     400:  bad input (missing/too-long subject)
 *     405:  method not allowed
 *
 * Bound on the zone via Worker route: `min8t.com/api/tools/*` → this script.
 *
 * CORS: only `https://min8t.com` is allowed. Localhost dev for the frontend
 * uses the deployed Worker too - set REQUIRE_ORIGIN=false during dev if
 * you fork this for testing.
 */
import { SPAM_TRIGGERS } from './spam-words.js';
import { SENTIMENT_WORDS } from './sentiment-words.js';
import { scoreEmail } from './spam-rules.js';

const ALLOWED_ORIGINS = new Set([
  'https://min8t.com',
  'https://min8t-tools.pages.dev',
  'http://localhost:3000',  // local dev
  'http://localhost:8000',  // local dev
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://min8t.com';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Routing
    if (url.pathname === '/api/tools/subject-analyze') {
      return handleSubjectAnalyze(request, origin);
    }
    if (url.pathname === '/api/tools/spam-check') {
      return handleSpamCheck(request, origin);
    }
    if (url.pathname === '/api/tools/lead-capture') {
      return handleLeadCapture(request, origin, env, ctx);
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
  },
};

// ---- Lead capture (§4.3 of FREE_TOOLS_SEO_AND_LAUNCH_PLAN.md) ----
// Stores email leads in KV tagged by source tool. No transactional email
// is sent yet (no Resend/SMTP creds wired up). The lead is captured for
// later nurture campaigns.

const ALLOWED_TOOL_SLUGS = new Set([
  'utm-builder', 'image-compressor', 'email-signature-generator',
  'subject-line-analyzer', 'plain-text-converter',
  'font-checker', 'palette-extractor', 'gif-compressor', 'spam-checker',
  'inbox-preview', 'css-inliner', 'mjml-converter', 'header-analyzer',
  'button-generator', 'ab-test-calculator',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PAYLOAD_BYTES = 200_000; // 200 KB per Resend payload practical limit

// Per-tool email metadata. Keys map to tool slugs.
const TOOL_EMAIL_META = {
  'utm-builder':              { name: 'UTM Builder',                   resultLabel: 'Your tracked URL' },
  'image-compressor':         { name: 'Email Image Compressor',        resultLabel: null /* binary */ },
  'email-signature-generator':{ name: 'Email Signature Generator',     resultLabel: 'Your HTML signature' },
  'subject-line-analyzer':    { name: 'Subject Line Analyzer',         resultLabel: 'Your subject-line analysis' },
  'plain-text-converter':     { name: 'HTML to Plain Text',            resultLabel: 'Your plain-text alternative' },
  'font-checker':             { name: 'Email-Safe Font Checker',       resultLabel: 'Your font compatibility report' },
  'palette-extractor':        { name: 'Brand Color Palette',           resultLabel: 'Your brand palette' },
  'gif-compressor':           { name: 'GIF Compressor',                resultLabel: null /* binary */ },
  'spam-checker':             { name: 'Spam Score Checker',            resultLabel: 'Your spam-score breakdown' },
  'inbox-preview':            { name: 'Inbox Preview',                 resultLabel: null /* interactive */ },
  'css-inliner':              { name: 'CSS Inliner',                   resultLabel: 'Your inlined HTML' },
  'mjml-converter':           { name: 'MJML to HTML',                  resultLabel: 'Your compiled HTML' },
  'header-analyzer':          { name: 'Email Header Analyzer',         resultLabel: 'Your header analysis' },
  'button-generator':         { name: 'Bulletproof Button Generator',  resultLabel: 'Your button HTML' },
  'ab-test-calculator':       { name: 'A/B Test Sample Size',          resultLabel: 'Your sample size calculation' },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml({ toolSlug, payload }) {
  const meta = TOOL_EMAIL_META[toolSlug] || { name: 'MiN8T Tools', resultLabel: null };
  const toolUrl = `https://min8t.com/tools/${toolSlug}/`;
  const editorUrl = `https://app.min8t.com/?ref=tools-${toolSlug}-email`;
  const hasPayload = !!payload && meta.resultLabel;

  const resultBlock = hasPayload
    ? `
        <div style="margin: 24px 0; padding: 16px; background: #1a1a1a; border-radius: 8px; overflow-x: auto;">
          <div style="font-size: 12px; color: #28ef91; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">${escapeHtml(meta.resultLabel)}</div>
          <pre style="margin: 0; padding: 0; font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 12px; line-height: 1.5; color: #f4f4f4; white-space: pre-wrap; word-break: break-all;">${escapeHtml(payload)}</pre>
        </div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Your ${escapeHtml(meta.name)} result</title></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background:#f4f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;">
    <tr><td align="center" style="padding: 32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#ffffff; border-radius: 12px;">
        <tr><td style="padding: 32px;">
          <div style="display:inline-flex; align-items:center; gap:8px; margin-bottom: 24px;">
            <span style="display:inline-block; width:32px; height:32px; background:#28ef91; border-radius:50%; text-align:center; line-height:32px; font-weight:700; color:#0d0d0d;">M</span>
            <span style="font-weight:700; font-size:16px; color:#0d0d0d;">MiN8T</span>
            <span style="font-size:11px; color:#888; letter-spacing:1px; text-transform:uppercase;">Free Tools</span>
          </div>
          <h1 style="margin:0 0 16px; font-size:22px; line-height:1.3; color:#0d0d0d;">${hasPayload ? 'Here\'s your result.' : 'Thanks for joining.'}</h1>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#444;">
            You signed up after using <a href="${toolUrl}" style="color:#28ef91; text-decoration:none; font-weight:600;">${escapeHtml(meta.name)}</a>. We'll email you when we ship new tools - usually every 2-3 weeks. No marketing fluff.
          </p>
          ${resultBlock}
          <div style="margin: 32px 0 16px;">
            <a href="${editorUrl}" style="display:inline-block; padding: 12px 28px; background:#28ef91; color:#0d0d0d; text-decoration:none; border-radius: 999px; font-weight:700; font-size:14px;">Try MiN8T free</a>
          </div>
          <p style="margin:24px 0 0; font-size:13px; color:#888; line-height:1.5;">
            <strong style="color:#444;">What MiN8T is:</strong> the email design platform that pairs with these tools. Drag-and-drop editor, 108+ ESP integrations, built-in deliverability monitoring. Free tier, no credit card.
          </p>
        </td></tr>
        <tr><td style="padding: 16px 32px 24px; border-top: 1px solid #eee; font-size: 11px; color:#888; text-align:center;">
          You received this because you signed up at ${toolUrl}. To stop receiving these, reply with "unsubscribe".<br>
          MiN8T - Email design that lands.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendResultEmail({ env, toEmail, toolSlug, payload }) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  const meta = TOOL_EMAIL_META[toolSlug] || { name: 'MiN8T Tools' };
  const subject = payload && meta.resultLabel
    ? `${meta.resultLabel} | MiN8T`
    : `Welcome to MiN8T Tools`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MiN8T Tools <tools@min8t.com>',
      to: [toEmail],
      subject,
      html: buildEmailHtml({ toolSlug, payload }),
    }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    return { ok: false, error: `Resend ${r.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function handleLeadCapture(request, origin, env, ctx) {
  if (request.method !== 'POST') {
    return errResp('Method not allowed', 405, origin);
  }
  if (!env || !env.LEADS) {
    return errResp('Storage not configured', 503, origin);
  }
  let body;
  try { body = await request.json(); } catch { return errResp('Invalid JSON', 400, origin); }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const tool = String(body?.tool ?? '').trim();
  const consent = body?.consent === true;
  const payloadRaw = body?.payload;
  const payload = typeof payloadRaw === 'string' ? payloadRaw : null;

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return errResp('Invalid email', 400, origin);
  }
  if (!ALLOWED_TOOL_SLUGS.has(tool)) {
    return errResp('Invalid tool', 400, origin);
  }
  if (!consent) {
    return errResp('Consent required', 400, origin);
  }
  if (payload && payload.length > MAX_PAYLOAD_BYTES) {
    return errResp('Payload too large', 413, origin);
  }

  // Rate-limit by IP via KV TTL — at most 5 captures per minute per IP
  const cf = request.cf || {};
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipBucket = `rl:${ip}:${Math.floor(Date.now() / 60_000)}`;
  const rlCount = parseInt((await env.LEADS.get(ipBucket)) || '0', 10);
  if (rlCount >= 5) {
    return errResp('Too many requests', 429, origin);
  }

  const ts = Date.now();
  const emailHash = (await sha256Hex(email)).slice(0, 16);
  const key = `lead:${ts}:${tool}:${emailHash}`;
  const value = {
    email,
    tool,
    consent: true,
    ts,
    iso: new Date(ts).toISOString(),
    ua: (request.headers.get('User-Agent') || '').slice(0, 200),
    ip_country: cf.country || '',
    referer: (request.headers.get('Referer') || '').slice(0, 500),
  };

  // Also keep an "email index" key so future de-dupe is easy
  const indexKey = `email:${emailHash}`;
  const existing = await env.LEADS.get(indexKey, 'json');
  const tools = new Set(existing?.tools || []);
  tools.add(tool);
  const indexValue = {
    email,
    first_seen: existing?.first_seen || ts,
    last_seen: ts,
    tools: Array.from(tools),
  };

  await Promise.all([
    env.LEADS.put(key, JSON.stringify(value)),
    env.LEADS.put(indexKey, JSON.stringify(indexValue)),
    env.LEADS.put(ipBucket, String(rlCount + 1), { expirationTtl: 120 }),
  ]);

  // Send result email via Resend in the background — doesnt block response.
  // If RESEND_API_KEY is not set or send fails, the lead is still captured;
  // we just log via the KV (best-effort).
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil((async () => {
      const result = await sendResultEmail({ env, toEmail: email, toolSlug: tool, payload });
      if (!result.ok) {
        await env.LEADS.put(`emailerr:${ts}:${tool}:${emailHash}`, JSON.stringify({
          ts, tool, error: result.error,
        }), { expirationTtl: 86400 * 7 }); // keep error logs 7 days
      }
    })());
  }

  const successMsg = payload && TOOL_EMAIL_META[tool]?.resultLabel
    ? "Sent. Check your inbox in a moment."
    : "You're on the list. Check your inbox shortly.";

  return new Response(
    JSON.stringify({ ok: true, message: successMsg }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...corsHeaders(origin),
      },
    }
  );
}

async function handleSpamCheck(request, origin) {
  if (request.method !== 'POST') {
    return errResp('Method not allowed', 405, origin);
  }
  let body;
  try { body = await request.json(); } catch { return errResp('Invalid JSON', 400, origin); }
  const html = (body?.html ?? '').toString();
  if (!html.trim()) return errResp('Missing html', 400, origin);
  if (html.length > 500_000) return errResp('HTML too large (max 500 KB)', 413, origin);

  const result = scoreEmail(html);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

async function handleSubjectAnalyze(request, origin) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errResp('Invalid JSON', 400, origin);
  }
  const subject = (body?.subject ?? '').toString();
  if (!subject.trim()) return errResp('Missing subject', 400, origin);
  if (subject.length > 200) return errResp('Subject too long (max 200 chars)', 400, origin);

  const result = analyze(subject);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...corsHeaders(origin),
    },
  });
}

function errResp(msg, status, origin) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

// ====== analyzer core ======
// Returns { score, breakdown, spamTriggers, advice }
//   - score: 0-100 overall
//   - breakdown: array of 8 sub-scores, each { name, status: 'good'|'warn'|'bad', score (0-100), note }
//   - spamTriggers: array of matched words (with positions for highlighting)
//   - advice: short paragraph of summary advice

function analyze(subject) {
  const s = subject.trim();
  const sLower = s.toLowerCase();
  const breakdown = [];

  // 1. Length (0-100). Sweet spot 30-50 chars (mobile-readable, desktop-rich).
  const len = s.length;
  let lengthScore, lengthStatus, lengthNote;
  if (len === 0) { lengthScore = 0; lengthStatus = 'bad'; lengthNote = 'Empty.'; }
  else if (len < 20)  { lengthScore = 50; lengthStatus = 'warn'; lengthNote = `${len} chars - too short, missing context.`; }
  else if (len <= 50) { lengthScore = 100; lengthStatus = 'good'; lengthNote = `${len} chars - ideal mobile + desktop fit.`; }
  else if (len <= 70) { lengthScore = 75; lengthStatus = 'warn'; lengthNote = `${len} chars - fits desktop, may truncate on mobile (~30 char cap).`; }
  else                { lengthScore = 40; lengthStatus = 'bad';  lengthNote = `${len} chars - will truncate in most clients.`; }
  breakdown.push({ name: 'Length', status: lengthStatus, score: lengthScore, note: lengthNote });

  // 2. Word count. 5-9 words ideal.
  const words = s.match(/\S+/g) || [];
  const wc = words.length;
  let wcScore, wcStatus, wcNote;
  if (wc === 0)     { wcScore = 0; wcStatus = 'bad'; wcNote = 'No words.'; }
  else if (wc < 3)  { wcScore = 50; wcStatus = 'warn'; wcNote = `${wc} word${wc === 1 ? '' : 's'} - too sparse.`; }
  else if (wc <= 9) { wcScore = 100; wcStatus = 'good'; wcNote = `${wc} words - concise.`; }
  else if (wc <= 14) { wcScore = 60; wcStatus = 'warn'; wcNote = `${wc} words - verbose.`; }
  else              { wcScore = 30; wcStatus = 'bad';  wcNote = `${wc} words - too long.`; }
  breakdown.push({ name: 'Word count', status: wcStatus, score: wcScore, note: wcNote });

  // 3. Spam triggers. Each matched trigger costs ~15 points. Capped at 0.
  const matched = [];
  for (const t of SPAM_TRIGGERS) {
    const tl = t.toLowerCase();
    if (sLower.includes(tl)) {
      // try to find original-case slice for highlighting
      const idx = sLower.indexOf(tl);
      matched.push({ word: s.slice(idx, idx + t.length), index: idx });
    }
  }
  const spamScore = Math.max(0, 100 - matched.length * 25);
  const spamStatus = matched.length === 0 ? 'good' : matched.length === 1 ? 'warn' : 'bad';
  const spamNote = matched.length === 0
    ? 'No common spam triggers detected.'
    : matched.length === 1
      ? `1 trigger word: "${matched[0].word}".`
      : `${matched.length} trigger words detected - high spam risk.`;
  breakdown.push({ name: 'Spam triggers', status: spamStatus, score: spamScore, note: spamNote });

  // 4. Sentiment (-5..+5 per word, summed, normalized to 0-100).
  let sentimentSum = 0, sentimentMatches = 0;
  for (const w of words) {
    const norm = w.toLowerCase().replace(/[^a-z']/g, '');
    if (SENTIMENT_WORDS[norm] !== undefined) {
      sentimentSum += SENTIMENT_WORDS[norm];
      sentimentMatches++;
    }
  }
  const sentimentAvg = sentimentMatches > 0 ? sentimentSum / sentimentMatches : 0;
  const sentimentScore = sentimentAvg >= 1 ? 100
    : sentimentAvg >= 0 ? 75
    : sentimentAvg >= -1 ? 55
    : 30;
  const sentimentStatus = sentimentAvg >= 0 ? 'good' : sentimentAvg >= -1 ? 'warn' : 'bad';
  const sentimentNote = sentimentMatches === 0
    ? 'Neutral tone (no sentiment-loaded words).'
    : sentimentAvg > 0
      ? `Positive tone (avg ${sentimentAvg.toFixed(1)} across ${sentimentMatches} word${sentimentMatches === 1 ? '' : 's'}).`
      : sentimentAvg < 0
        ? `Negative tone (avg ${sentimentAvg.toFixed(1)}).`
        : 'Neutral tone.';
  breakdown.push({ name: 'Sentiment', status: sentimentStatus, score: sentimentScore, note: sentimentNote });

  // 5. Emoji count.
  const emojis = s.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu) || [];
  const emojiCount = emojis.length;
  let emojiScore, emojiStatus, emojiNote;
  if (emojiCount === 0)      { emojiScore = 90; emojiStatus = 'good'; emojiNote = 'No emoji - clean.'; }
  else if (emojiCount === 1) { emojiScore = 100; emojiStatus = 'good'; emojiNote = '1 emoji - adds personality.'; }
  else if (emojiCount === 2) { emojiScore = 70; emojiStatus = 'warn'; emojiNote = '2 emoji - borderline.'; }
  else                       { emojiScore = 30; emojiStatus = 'bad'; emojiNote = `${emojiCount} emoji - reads as spam.`; }
  breakdown.push({ name: 'Emoji', status: emojiStatus, score: emojiScore, note: emojiNote });

  // 6. CAPS ratio (excluding non-letters).
  const letters = s.replace(/[^A-Za-z]/g, '');
  const caps = (s.match(/[A-Z]/g) || []).length;
  const capsRatio = letters.length > 0 ? caps / letters.length : 0;
  let capsScore, capsStatus, capsNote;
  if (letters.length < 3)       { capsScore = 100; capsStatus = 'good'; capsNote = 'Too short to evaluate caps.'; }
  else if (capsRatio < 0.2)     { capsScore = 100; capsStatus = 'good'; capsNote = `${Math.round(capsRatio * 100)}% caps - natural.`; }
  else if (capsRatio < 0.5)     { capsScore = 70; capsStatus = 'warn'; capsNote = `${Math.round(capsRatio * 100)}% caps - heavy.`; }
  else                          { capsScore = 30; capsStatus = 'bad'; capsNote = `${Math.round(capsRatio * 100)}% CAPS - reads as shouting.`; }
  breakdown.push({ name: 'CAPS ratio', status: capsStatus, score: capsScore, note: capsNote });

  // 7. Personalization tokens - bonus signal.
  const tokens = [
    /\[\s*FirstName\s*\]/i,
    /\[\s*FNAME\s*\]/i,
    /\{\{\s*first[_\s]?name\s*\}\}/i,
    /\{\{\s*name\s*\}\}/i,
    /%FIRSTNAME%/i,
    /%FNAME%/i,
    /\*\|FNAME\|\*/,   // Mailchimp
    /\$\{first_name\}/i,
  ];
  const hasToken = tokens.some((re) => re.test(s));
  const personalScore = hasToken ? 100 : 70; // not a penalty if missing - just a bonus if present
  const personalStatus = hasToken ? 'good' : 'warn';
  const personalNote = hasToken
    ? 'Personalization token present - boosts open rate.'
    : 'No personalization token - consider adding [FirstName] or {{name}}.';
  breakdown.push({ name: 'Personalization', status: personalStatus, score: personalScore, note: personalNote });

  // 8. Power words - bonus.
  const POWER = ['announcing', 'introducing', 'now', 'breakthrough', 'exclusive',
    'limited', 'last chance', 'discover', 'introducing', 'unlock', 'reveal',
    'secret', 'why', 'how', 'because', 'finally', 'ready'];
  const powerHits = POWER.filter((w) => sLower.includes(w));
  const powerScore = powerHits.length > 0 ? 100 : 65;
  const powerStatus = powerHits.length > 0 ? 'good' : 'warn';
  const powerNote = powerHits.length > 0
    ? `Power words: ${powerHits.slice(0, 3).map((w) => `"${w}"`).join(', ')}.`
    : 'No high-CTR power words - consider verbs like "discover", "introducing", "unlock".';
  breakdown.push({ name: 'Power words', status: powerStatus, score: powerScore, note: powerNote });

  // ===== overall score (weighted) =====
  // Length, spam, sentiment carry more weight than bonus signals.
  const weights = {
    'Length': 0.18,
    'Word count': 0.10,
    'Spam triggers': 0.20,
    'Sentiment': 0.12,
    'Emoji': 0.10,
    'CAPS ratio': 0.10,
    'Personalization': 0.08,
    'Power words': 0.12,
  };
  let weighted = 0;
  for (const b of breakdown) weighted += b.score * weights[b.name];
  const score = Math.round(weighted);

  // ===== advice =====
  const issues = breakdown.filter((b) => b.status !== 'good');
  let advice;
  if (score >= 85) advice = 'Strong subject line. Ship it.';
  else if (score >= 70) advice = `Decent - ${issues.length} thing${issues.length === 1 ? '' : 's'} to tighten: ${issues.map((i) => i.name.toLowerCase()).join(', ')}.`;
  else if (score >= 50) advice = `Needs work. Focus on: ${issues.slice(0, 3).map((i) => i.name.toLowerCase()).join(', ')}.`;
  else advice = `High spam-filter risk. Rewrite - too many issues across ${issues.length} categor${issues.length === 1 ? 'y' : 'ies'}.`;

  return {
    score,
    breakdown,
    spamTriggers: matched,
    advice,
    meta: {
      length: len,
      wordCount: wc,
      emojiCount,
      capsRatio,
    },
  };
}
