/**
 * Email-body spam rules, modeled after a SpamAssassin subset.
 *
 * Each rule has a positive `weight` (points added when the rule fires) and a
 * `test(input)` that returns either a boolean (full weight) or a number
 * (multiplied weight). The aggregate SA-style score is the sum across fired
 * rules. We then convert that to a 0-10 user-facing score where 10 = clean.
 *
 * Categories help group results in the UI:
 *   content   - phrasing, language patterns
 *   structure - HTML markup issues, hidden text, image-only emails
 *   links     - URL patterns (shorteners, IP-based, repetition)
 *   format    - formatting abuse (CAPS, exclamations, emoji, money symbols)
 *
 * Weights roughly correspond to SpamAssassin score points. Aggregate of 5+ in
 * SA = "treat as spam"; we display the 0-10 inverse so users get a positive
 * scoring intuition.
 *
 * Reference: SpamAssassin's actual rules at apache/spamassassin (Apache-2.0).
 * This is a curated subset of the highest-impact body/structure rules,
 * adapted for body-only (we don't have headers).
 */

import { SPAM_TRIGGERS } from './spam-words.js';

// Build a single regex from the spam-words list, matched word-boundary-ish.
// We escape regex metas; the words themselves are mostly plain.
const SPAM_TRIGGER_RE = (() => {
  const escaped = SPAM_TRIGGERS
    .filter((w) => w.length >= 3)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length); // longer first so multi-word matches first
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
})();

const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

// URL shorteners commonly abused in spam
const SHORTENERS = new Set([
  'bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'lnkd.in', 'tiny.cc', 'shorturl.at', 'rb.gy',
]);

export const RULES = [
  // ===== content =====
  {
    id: 'CONTENT_SPAM_TRIGGERS',
    category: 'content',
    name: 'Spam-trigger phrases',
    description: 'Body contains words/phrases historically associated with spam (free, act now, guaranteed, etc.).',
    test: (text /*, html */) => {
      const matches = text.match(SPAM_TRIGGER_RE);
      const count = matches ? matches.length : 0;
      return Math.min(count * 0.5, 4); // cap at +4
    },
    weight: 1, // multiplier (rule already returns weighted points)
  },
  {
    id: 'CONTENT_URGENCY',
    category: 'content',
    name: 'Urgency language',
    description: 'Phrases like "act now", "limited time", "final notice", "don\'t miss" - common in spam.',
    weight: 1.0,
    test: (text) => /\b(act now|limited time|last chance|final notice|don'?t miss|expires (today|soon)|hurry|while supplies last)\b/i.test(text),
  },
  {
    id: 'CONTENT_GENERIC_GREETING',
    category: 'content',
    name: 'Generic greeting',
    description: 'Greetings like "Dear Customer", "Dear Sir/Madam" suggest mass send with no personalisation.',
    weight: 0.8,
    test: (text) => /\b(dear (sir|madam|customer|friend|valued (customer|member))|to whom it may concern)\b/i.test(text),
  },
  {
    id: 'CONTENT_FORWARD_FRIEND',
    category: 'content',
    name: 'Forward-to-friends pattern',
    description: '"Forward this to 10 friends" / chain-letter style copy.',
    weight: 1.5,
    test: (text) => /\bforward (this|to)\s+(\d+|to)\s+(friends|people|contacts)\b/i.test(text),
  },
  {
    id: 'CONTENT_FREE_GUARANTEE',
    category: 'content',
    name: '"100% free" / "100% guaranteed" claims',
    description: 'Strong guarantee + "100%" combinations are a top SpamAssassin trigger.',
    weight: 1.5,
    test: (text) => /\b100\s*%\s*(free|guaranteed?|risk[- ]?free|no risk)\b/i.test(text),
  },
  {
    id: 'CONTENT_MONEY_BACK',
    category: 'content',
    name: 'Money-back / no-obligation',
    description: '"Money back guarantee" and "no obligation" cluster heavily in spam.',
    weight: 1.0,
    test: (text) => /\b(money[- ]?back guarantee|no obligation|no purchase necessary|risk[- ]?free trial)\b/i.test(text),
  },

  // ===== format =====
  {
    id: 'FORMAT_CAPS_RATIO',
    category: 'format',
    name: 'Excessive capital letters',
    description: 'More than 30% of letters are uppercase. Reads as shouting.',
    weight: 1,
    test: (text) => {
      const letters = text.replace(/[^A-Za-z]/g, '');
      if (letters.length < 30) return false;
      const caps = letters.replace(/[a-z]/g, '').length;
      const ratio = caps / letters.length;
      if (ratio < 0.30) return false;
      return Math.min((ratio - 0.30) * 8, 2.5); // up to +2.5
    },
  },
  {
    id: 'FORMAT_EXCLAMATION_RUNS',
    category: 'format',
    name: 'Multiple exclamation marks',
    description: 'Runs of !! or ??? signal hyped or panicked tone.',
    weight: 0.7,
    test: (text) => {
      const runs = (text.match(/!{2,}|\?{2,}/g) || []).length;
      if (runs === 0) return false;
      return Math.min(runs * 0.5, 1.5);
    },
  },
  {
    id: 'FORMAT_DOLLAR_RUNS',
    category: 'format',
    name: 'Money symbols ($$$, €€€)',
    description: 'Runs of currency symbols are a classic spam marker.',
    weight: 1.5,
    test: (text) => /[$€£¥]{2,}/.test(text),
  },
  {
    id: 'FORMAT_EMOJI_HEAVY',
    category: 'format',
    name: 'Heavy emoji use',
    description: 'More than 5 emoji in body - often spam newsletter signal.',
    weight: 0.8,
    test: (text) => {
      const emojis = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu) || []).length;
      return emojis > 5 ? 1 : false;
    },
  },

  // ===== structure =====
  {
    id: 'STRUCTURE_IMAGE_ONLY',
    category: 'structure',
    name: 'Image-only email',
    description: 'Almost no text content vs. images - spam filters dock heavily for this.',
    weight: 2.5,
    test: (text, html) => {
      const imgCount = (html.match(/<img[\s>]/gi) || []).length;
      if (imgCount === 0) return false;
      const visibleText = text.replace(/\s+/g, ' ').trim();
      const ratio = visibleText.length / Math.max(imgCount * 200, 200);
      return ratio < 0.5;
    },
  },
  {
    id: 'STRUCTURE_HIDDEN_TEXT_WHITE_ON_WHITE',
    category: 'structure',
    name: 'Hidden text (white-on-white)',
    description: 'Text styled white on white background - keyword-stuffing trick that filters detect.',
    weight: 3.0,
    test: (_text, html) => {
      // Look for color: white/#fff alongside background-color: white/#fff in same style attribute
      const styles = html.match(/style="[^"]+"/gi) || [];
      return styles.some((s) => /color:\s*(?:#fff|#ffffff|white)/i.test(s) && /background(?:-color)?:\s*(?:#fff|#ffffff|white)/i.test(s));
    },
  },
  {
    id: 'STRUCTURE_TINY_FONT',
    category: 'structure',
    name: 'Tiny / zero-size font (hidden text)',
    description: 'font-size: 0 / 1px / 2px - keyword stuffing trick.',
    weight: 2.5,
    test: (_text, html) => /font-size:\s*[012]p[xt]/i.test(html),
  },
  {
    id: 'STRUCTURE_NO_UNSUBSCRIBE',
    category: 'structure',
    name: 'No unsubscribe link',
    description: 'Required by CAN-SPAM and most ESPs for marketing email.',
    weight: 1.5,
    test: (text /*, html */) => !/\bunsubscribe\b/i.test(text),
  },
  {
    id: 'STRUCTURE_NO_PHYSICAL_ADDRESS',
    category: 'structure',
    name: 'No physical address',
    description: 'CAN-SPAM requires a postal address. Rough heuristic: looks for ZIP/postcode pattern or country names.',
    weight: 1.0,
    test: (text) => {
      // US ZIP / UK postcode / generic 5-digit
      const hasUSZip = /\b\d{5}(-\d{4})?\b/.test(text);
      const hasUKPost = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i.test(text);
      const hasGenericPost = /\b\d{4,6}\b.{0,40}(street|road|ave|avenue|st\.|rd\.)/i.test(text);
      return !(hasUSZip || hasUKPost || hasGenericPost);
    },
  },
  {
    id: 'STRUCTURE_HUGE_HTML',
    category: 'structure',
    name: 'Oversized HTML',
    description: 'HTML over 100 KB - Gmail clips above 102 KB. Spam filters and inbox heuristics also penalise.',
    weight: 1.5,
    test: (_text, html) => {
      const kb = html.length / 1024;
      if (kb < 100) return false;
      return Math.min((kb - 100) / 50, 2);
    },
  },

  // ===== links =====
  {
    id: 'LINKS_SHORTENER',
    category: 'links',
    name: 'URL shortener',
    description: 'Links use URL shorteners (bit.ly, t.co, tinyurl.com, etc.) - common in spam to mask destinations.',
    weight: 1.5,
    test: (_text, html) => {
      const urls = html.match(URL_RE) || [];
      let count = 0;
      for (const u of urls) {
        try {
          const host = new URL(u).hostname.toLowerCase();
          if (SHORTENERS.has(host)) count++;
        } catch { /* ignore */ }
      }
      return count > 0 ? Math.min(count * 0.7, 2.5) : false;
    },
  },
  {
    id: 'LINKS_IP_URL',
    category: 'links',
    name: 'IP-based URL',
    description: 'Links to raw IP addresses (instead of domains) - almost always malicious.',
    weight: 3.0,
    test: (_text, html) => /https?:\/\/\d+\.\d+\.\d+\.\d+/i.test(html),
  },
  {
    id: 'LINKS_MISMATCH',
    category: 'links',
    name: 'Link text doesn\'t match destination',
    description: '<a href="https://X">https://Y</a> - link text shows one URL but href goes elsewhere. Phishing pattern.',
    weight: 2.0,
    test: (_text, html) => {
      const matches = html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(https?:\/\/[^<]+)</gi);
      for (const m of matches) {
        try {
          const aHost = new URL(m[1]).hostname;
          const tHost = new URL(m[2]).hostname;
          if (aHost !== tHost) return true;
        } catch { /* ignore */ }
      }
      return false;
    },
  },
  {
    id: 'LINKS_TOO_MANY',
    category: 'links',
    name: 'Excessive links',
    description: 'More than 30 links in body - spam filters dock heavily for this.',
    weight: 1.5,
    test: (_text, html) => {
      const linkCount = (html.match(/<a\s[^>]*href=/gi) || []).length;
      if (linkCount < 30) return false;
      return Math.min((linkCount - 30) / 20, 2);
    },
  },
  {
    id: 'LINKS_MANY_REDIRECTORS',
    category: 'links',
    name: 'Tracking-redirector URLs',
    description: 'Links wrapped in tracking redirectors (link.example.com, click.example.com, r.example.com) - heavy use looks spammy even when the underlying brand is legit.',
    weight: 0.5,
    test: (_text, html) => {
      const urls = html.match(URL_RE) || [];
      let count = 0;
      for (const u of urls) {
        try {
          const host = new URL(u).hostname.toLowerCase();
          if (/^(link|click|track|r|redirect|t)\..+/.test(host)) count++;
        } catch { /* ignore */ }
      }
      return count > 5 ? Math.min(count / 10, 1) : false;
    },
  },
];

/**
 * Run all rules against an email body.
 * Returns a structured score breakdown.
 *
 *   { saScore, score, triggered: [{id,...}], category_totals, advice }
 *
 * - saScore: SpamAssassin-style points (positive = bad). 0 is clean, 5+ = spam.
 * - score:   0-10 user-facing scale (10 = best, 0 = guaranteed spam).
 */
export function scoreEmail(html) {
  // Strip HTML to plain text for content rules
  const text = stripHtml(html);
  const triggered = [];
  const categoryTotals = { content: 0, format: 0, structure: 0, links: 0 };
  let saScore = 0;

  for (const rule of RULES) {
    const hit = rule.test(text, html);
    if (!hit) continue;
    const points = typeof hit === 'number' ? hit * rule.weight : rule.weight;
    if (points <= 0) continue;
    triggered.push({ id: rule.id, category: rule.category, name: rule.name, description: rule.description, points: round(points, 2) });
    categoryTotals[rule.category] += points;
    saScore += points;
  }

  saScore = round(saScore, 2);
  const score = round(Math.max(0, 10 - saScore), 1);

  let advice;
  if (saScore < 1)      advice = 'Looks clean. Spam filters won\'t flag this on body alone.';
  else if (saScore < 3) advice = `Minor issues. ${triggered.length} rules fired - usually safe but tighten the worst.`;
  else if (saScore < 5) advice = `Moderate spam risk. Fix the top issues below before sending.`;
  else                  advice = `High spam risk. Aggregate exceeds the standard 5.0 threshold - rewrite before sending.`;

  return {
    saScore,
    score,
    triggered: triggered.sort((a, b) => b.points - a.points),
    categoryTotals: Object.fromEntries(Object.entries(categoryTotals).map(([k, v]) => [k, round(v, 2)])),
    advice,
    meta: {
      htmlBytes: html.length,
      textChars: text.length,
      ruleCount: RULES.length,
    },
  };
}

function stripHtml(html) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function round(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
