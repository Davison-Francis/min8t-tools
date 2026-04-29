/**
 * Subject Line Analyzer — vanilla ES module.
 *
 * Debounces input by 300ms then POSTs to the min8t-tools-api Worker at
 * /api/tools/subject-analyze. Renders the 0-100 score plus 8-signal
 * breakdown and any matched spam triggers.
 *
 * On Worker error or offline, falls back to a text message — keeps the
 * tool usable for at least the basic length/charcount feedback.
 */
import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const API = '/api/tools/subject-analyze';
const DEBOUNCE_MS = 300;

const subjectInput = document.getElementById('subject');
const charCount = document.getElementById('char-count');
const emptyState = document.getElementById('empty-state');
const results = document.getElementById('results');
const scoreCircle = document.getElementById('score-circle');
const scoreNum = document.getElementById('score-num');
const scoreAdvice = document.getElementById('score-advice');
const breakdown = document.getElementById('breakdown');
const triggersBlock = document.getElementById('triggers-block');
const triggersList = document.getElementById('triggers-list');
const ctaEditor = document.getElementById('cta-editor');

let debounceTimer;
let inflightController;
let trackedThisSession = false;

subjectInput.addEventListener('input', () => {
  const len = subjectInput.value.length;
  charCount.textContent = `${len} / 200 chars`;
  charCount.classList.toggle('warn', len > 70);
  charCount.classList.toggle('bad',  len > 150);

  clearTimeout(debounceTimer);
  if (subjectInput.value.trim().length === 0) {
    emptyState.hidden = false;
    results.hidden = true;
    return;
  }
  debounceTimer = setTimeout(() => analyze(subjectInput.value), DEBOUNCE_MS);
});

async function analyze(subject) {
  // Cancel any inflight request to avoid stale renders
  inflightController?.abort();
  inflightController = new AbortController();
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject }),
      signal: inflightController.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      renderError(err.error || `HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    render(data);
    if (!trackedThisSession) {
      trackToolUsed('subject-line-analyzer', 'analyze');
      trackedThisSession = true;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error('analyze failed:', err);
    renderError('Couldn\'t reach the scoring service. Check your connection.');
  }
}

function render(data) {
  emptyState.hidden = true;
  results.hidden = false;

  // Score circle
  scoreNum.textContent = data.score;
  scoreCircle.classList.remove('score-good', 'score-warn', 'score-bad');
  if (data.score >= 80)      scoreCircle.classList.add('score-good');
  else if (data.score >= 60) scoreCircle.classList.add('score-warn');
  else                       scoreCircle.classList.add('score-bad');

  scoreAdvice.textContent = data.advice;

  // Breakdown signals
  breakdown.innerHTML = '';
  for (const sig of data.breakdown) {
    const el = document.createElement('div');
    el.className = `signal ${sig.status}`;
    el.innerHTML = `
      <span class="dot"></span>
      <span class="signal-name">${escapeHtml(sig.name)}</span>
      <span class="signal-note">${escapeHtml(sig.note)}</span>
    `;
    breakdown.appendChild(el);
  }

  // Triggers
  if (data.spamTriggers && data.spamTriggers.length > 0) {
    triggersBlock.hidden = false;
    triggersList.innerHTML = data.spamTriggers
      .map((t) => `<span class="trigger-pill">${escapeHtml(t.word)}</span>`)
      .join('');
  } else {
    triggersBlock.hidden = true;
  }
}

function renderError(msg) {
  emptyState.hidden = true;
  results.hidden = false;
  scoreNum.textContent = '—';
  scoreCircle.className = 'score-circle';
  scoreAdvice.textContent = msg;
  breakdown.innerHTML = '';
  triggersBlock.hidden = true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

ctaEditor?.addEventListener('click', () => trackCtaClicked('subject-line-analyzer', 'editor'));
