/**
 * Spam Score Checker - vanilla ES module.
 *
 * Live debounced POST to /api/tools/spam-check (the min8t-tools-api Worker).
 * Worker runs 21 SpamAssassin-style rules and returns score + breakdown.
 * Frontend renders score circle, category breakdown, and triggered-rule cards.
 *
 * Inflight-cancel pattern via AbortController so fast typing doesn't cause
 * stale renders.
 */
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const API = '/api/tools/spam-check';
const DEBOUNCE_MS = 400;
const MAX_CHARS = 500_000;

const htmlInput = document.getElementById('html-input');
const stats = document.getElementById('stats');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const emptyState = document.getElementById('empty-state');
const results = document.getElementById('results');
const scoreCircle = document.getElementById('score-circle');
const scoreNum = document.getElementById('score-num');
const scoreAdvice = document.getElementById('score-advice');
const scoreDetail = document.getElementById('score-detail');
const categoryTotalsEl = document.getElementById('category-totals');
const triggeredSection = document.getElementById('triggered-section');
const triggeredList = document.getElementById('triggered-list');
const cleanState = document.getElementById('clean-state');
const toast = document.getElementById('toast');
const ctaEditor = document.getElementById('cta-editor');

const SAMPLE_HTML = `<html><body>
<h1 style="color:#FF0000">FREE GIFT INSIDE!!! ACT NOW!!!</h1>
<p>Dear Customer,</p>
<p>You are a WINNER! 100% GUARANTEED money back!!! Don't miss this LIMITED TIME offer.</p>
<p>Click here for your prize: <a href="http://1.2.3.4/redeem">https://safe-link.com</a></p>
<p>Buy now! Hurry while supplies last! $$$ </p>
<p>More tracking links:
<a href="https://bit.ly/x">tracker1</a>,
<a href="https://t.co/y">tracker2</a>,
<a href="https://goo.gl/z">tracker3</a></p>
<p style="font-size:1px;color:#fff">free viagra cialis casino weight loss credit cheap meds online pharmacy</p>
</body></html>`;

let debounceTimer;
let inflight;
let trackedThisSession = false;

htmlInput.addEventListener('input', () => {
  const len = htmlInput.value.length;
  stats.textContent = `${len.toLocaleString()} chars`;
  stats.style.color = len > MAX_CHARS ? 'var(--danger)' : '';

  clearTimeout(debounceTimer);
  if (htmlInput.value.trim().length === 0) {
    emptyState.hidden = false;
    results.hidden = true;
    return;
  }
  if (len > MAX_CHARS) {
    showToast(`HTML over ${MAX_CHARS.toLocaleString()} chars - won't be scored`);
    return;
  }
  debounceTimer = setTimeout(() => check(htmlInput.value), DEBOUNCE_MS);
});

sampleBtn.addEventListener('click', () => {
  htmlInput.value = SAMPLE_HTML;
  stats.textContent = `${htmlInput.value.length.toLocaleString()} chars`;
  check(htmlInput.value);
  trackToolUsed('spam-checker', 'load-sample');
});

clearBtn.addEventListener('click', () => {
  htmlInput.value = '';
  stats.textContent = '0 chars';
  emptyState.hidden = false;
  results.hidden = true;
});

ctaEditor?.addEventListener('click', () => trackCtaClicked('spam-checker', 'editor'));

async function check(html) {
  inflight?.abort();
  inflight = new AbortController();
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
      signal: inflight.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      renderError(err.error || `HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    render(data);
    if (!trackedThisSession) {
      trackToolUsed('spam-checker', 'check');
      trackedThisSession = true;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error(err);
    renderError('Couldn\'t reach the scoring service.');
  }
}

function render(data) {
  emptyState.hidden = true;
  results.hidden = false;

  // Score circle + tier
  scoreNum.innerHTML = `${data.score}<small>/10</small>`;
  scoreCircle.classList.remove('score-good', 'score-warn', 'score-bad');
  if (data.score >= 8)      scoreCircle.classList.add('score-good');
  else if (data.score >= 6) scoreCircle.classList.add('score-warn');
  else                       scoreCircle.classList.add('score-bad');

  scoreAdvice.textContent = data.advice;
  scoreDetail.textContent = `SA-style points: ${data.saScore}  ·  ${data.triggered.length}/${data.meta.ruleCount} rules fired  ·  ${formatBytes(data.meta.htmlBytes)}`;

  // Category totals
  categoryTotalsEl.innerHTML = '';
  const cats = [
    ['content', 'Content'],
    ['format', 'Format'],
    ['structure', 'Structure'],
    ['links', 'Links'],
  ];
  for (const [k, label] of cats) {
    const v = data.categoryTotals[k] || 0;
    const cls = v === 0 ? 'zero' : v < 2 ? 'warn' : 'bad';
    const cat = document.createElement('div');
    cat.className = 'cat';
    cat.innerHTML = `<div class="label">${label}</div><div class="v ${cls}">+${v}</div>`;
    categoryTotalsEl.appendChild(cat);
  }

  // Triggered rules
  if (data.triggered.length === 0) {
    triggeredSection.hidden = true;
    cleanState.hidden = false;
  } else {
    cleanState.hidden = true;
    triggeredSection.hidden = false;
    triggeredList.innerHTML = '';
    for (const rule of data.triggered) {
      const card = document.createElement('div');
      card.className = 'triggered-rule' + (rule.points >= 2 ? ' severe' : '');
      card.innerHTML = `
        <span class="badge">${escapeHtml(rule.category)}</span>
        <div>
          <div class="rule-name">${escapeHtml(rule.name)}</div>
          <div class="rule-desc">${escapeHtml(rule.description)}</div>
        </div>
        <span class="points">+${rule.points}</span>
      `;
      triggeredList.appendChild(card);
    }
  }
}

function renderError(msg) {
  emptyState.hidden = true;
  results.hidden = false;
  scoreNum.innerHTML = `—<small>/10</small>`;
  scoreCircle.className = 'score-circle';
  scoreAdvice.textContent = msg;
  scoreDetail.textContent = '';
  categoryTotalsEl.innerHTML = '';
  triggeredSection.hidden = true;
  cleanState.hidden = true;
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}
