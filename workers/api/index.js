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
  async fetch(request) {
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

    return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
  },
};

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
