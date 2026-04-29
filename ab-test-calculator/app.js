// A/B Test Sample Size Calculator for Email - Tool 16
// Pure math (z-test for two proportions). No external dependencies.

import { trackToolUsed, trackCtaClicked } from '../_shared/analytics.js';

const $ = (id) => document.getElementById(id);
const baselineEl = $('baseline');
const liftEl = $('lift');
const liftLabel = $('lift-label');
const powerEl = $('power');
const confidenceEl = $('confidence');
const variantsEl = $('variants');
const dailyCapEl = $('daily-cap');
const perVariantEl = $('per-variant');
const totalListEl = $('total-list');
const daysNeededEl = $('days-needed');
const liftDisplayEl = $('lift-display');
const summaryEl = $('summary');
const shareTextEl = $('share-text');
const copyShareBtn = $('copy-share');
const ctaEditor = $('cta-editor');
const chartCanvas = $('lift-chart');
const toast = $('toast');

let liftType = 'relative'; // 'relative' or 'absolute'
let testType = 'one-sided'; // 'one-sided' or 'two-sided'

// ---- Z-table (inverse normal) ----
// We hardcode the values needed for common confidence + power settings.
function zScore(prob) {
  // Returns z such that P(Z < z) = prob, where Z ~ N(0,1).
  // Hardcoded values; sufficient for our preset levels.
  const table = {
    0.80: 0.8416,  // 80%
    0.85: 1.0364,  // 85%
    0.90: 1.2816,  // 90%
    0.95: 1.6449,  // 95% one-sided
    0.975: 1.9600, // 95% two-sided / 97.5%
    0.99: 2.3263,  // 99% one-sided
    0.995: 2.5758, // 99% two-sided / 99.5%
  };
  // Round to known keys
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    if (Math.abs(prob - k) < 1e-6) return table[k];
  }
  // Fallback: Beasley-Springer-Moro approximation
  return inverseNormalApprox(prob);
}

function inverseNormalApprox(p) {
  // Beasley-Springer-Moro approximation; accurate to ~5e-4
  if (p <= 0 || p >= 1) return 0;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// ---- Sample size calc ----
function calcSampleSize(p1, p2, power, confidence, twoSided) {
  if (p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1 || p1 === p2) return Infinity;
  const alpha = 1 - confidence;
  const zAlpha = twoSided ? zScore(1 - alpha / 2) : zScore(1 - alpha);
  const zBeta = zScore(power);
  const numerator = Math.pow(zAlpha + zBeta, 2) * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = Math.pow(p1 - p2, 2);
  return Math.ceil(numerator / denominator);
}

// ---- Compute & render ----
function getInputs() {
  const baseline = Number(baselineEl.value) / 100;
  const liftRaw = Number(liftEl.value);
  const power = Number(powerEl.value);
  const confidence = Number(confidenceEl.value);
  const variants = Number(variantsEl.value);
  const dailyCap = Number(dailyCapEl.value) || 0;

  let p2;
  if (liftType === 'relative') {
    p2 = baseline * (1 + liftRaw / 100);
  } else {
    p2 = baseline + liftRaw / 100; // absolute pp
  }
  p2 = Math.max(0.0001, Math.min(0.9999, p2));

  return { baseline, p2, liftRaw, power, confidence, variants, dailyCap };
}

function fmt(n) {
  if (!isFinite(n)) return '∞';
  return Math.round(n).toLocaleString();
}

function pct(p) {
  return (p * 100).toFixed(p < 0.01 ? 2 : p < 0.1 ? 1 : 1) + '%';
}

function compute() {
  const { baseline, p2, liftRaw, power, confidence, variants, dailyCap } = getInputs();
  if (!isFinite(baseline) || !isFinite(p2)) return;

  const twoSided = testType === 'two-sided';
  const n = calcSampleSize(baseline, p2, power, confidence, twoSided);
  const total = isFinite(n) ? n * variants : Infinity;
  const days = dailyCap > 0 && isFinite(total) ? Math.ceil(total / dailyCap) : null;

  perVariantEl.textContent = fmt(n);
  totalListEl.textContent = fmt(total);
  daysNeededEl.textContent = days != null ? `${days}d` : '-';
  const liftLabelText = liftType === 'relative' ? `+${liftRaw}% rel` : `+${liftRaw}pp`;
  liftDisplayEl.textContent = liftLabelText;

  if (!isFinite(n)) {
    summaryEl.innerHTML = `Lift is too small to detect at ${(power*100).toFixed(0)}% power. Try a larger lift or higher baseline.`;
    shareTextEl.value = '';
    drawChart(baseline, power, confidence, twoSided);
    return;
  }

  summaryEl.innerHTML = `To detect a lift from <strong>${pct(baseline)}</strong> to <strong>${pct(p2)}</strong> with <strong>${(power*100).toFixed(0)}% power</strong> and <strong>${(confidence*100).toFixed(0)}% confidence</strong> (${twoSided ? 'two-sided' : 'one-sided'}), you need <strong>${fmt(n)} subscribers per variant</strong> - <strong>${fmt(total)} total</strong> across ${variants} variant${variants > 1 ? 's' : ''}${days != null ? `, sent over <strong>${days} days</strong> at your ${dailyCap.toLocaleString()} / day cadence` : ''}.`;

  shareTextEl.value = `A/B test sample size: ${fmt(n)}/variant, ${fmt(total)} total. Detect ${pct(baseline)} → ${pct(p2)} (${liftLabelText}) at ${(power*100).toFixed(0)}% power, ${(confidence*100).toFixed(0)}% confidence ${twoSided ? '(two-sided)' : '(one-sided)'}.`;

  drawChart(baseline, power, confidence, twoSided);

  trackToolUsed('ab-test-calculator', 'compute', {
    baseline_pct: Math.round(baseline * 1000) / 10,
    lift: liftRaw,
    lift_type: liftType,
    power,
    confidence,
    test_type: testType,
    sample_per_variant: isFinite(n) ? n : 0,
  });
}

// ---- Chart: sample size vs detectable lift ----
function drawChart(baseline, power, confidence, twoSided) {
  const ctx = chartCanvas.getContext('2d');
  const W = chartCanvas.width;
  const H = chartCanvas.height;
  ctx.clearRect(0, 0, W, H);

  // Compute series: relative-lift x = 1% to 50%, y = sample size per variant
  const xs = [];
  const ys = [];
  for (let liftPct = 1; liftPct <= 50; liftPct += 1) {
    const p2 = Math.min(0.9999, baseline * (1 + liftPct / 100));
    const n = calcSampleSize(baseline, p2, power, confidence, twoSided);
    xs.push(liftPct);
    ys.push(isFinite(n) ? n : null);
  }

  const yMax = Math.max(...ys.filter((v) => v != null));
  const yMin = 0;

  const padL = 60, padR = 16, padT = 16, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xToPx = (x) => padL + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * plotW;
  // Use sqrt scale for y (sample size grows like 1/lift^2 so this linearizes)
  const yToPx = (y) => padT + plotH - (Math.sqrt(y - yMin) / Math.sqrt(yMax - yMin)) * plotH;

  // Axes
  const axisColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
  const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-green').trim() || '#28ef91';
  const fillColor = lineColor;

  ctx.strokeStyle = axisColor;
  ctx.fillStyle = axisColor;
  ctx.lineWidth = 1;
  ctx.font = '11px ui-sans-serif, system-ui, sans-serif';

  // Y axis
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // Y ticks (linear values at sqrt-scaled positions)
  for (let i = 0; i <= 4; i++) {
    const linearVal = (Math.sqrt(yMax) * (i / 4)) ** 2;
    const py = padT + plotH - (i / 4) * plotH;
    ctx.fillStyle = axisColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmt(linearVal), padL - 6, py);
    ctx.strokeStyle = 'rgba(120,120,120,0.15)';
    ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
  }

  // X ticks (every 10%)
  ctx.fillStyle = axisColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let xi = 10; xi <= 50; xi += 10) {
    const px = xToPx(xi);
    ctx.fillText(`${xi}%`, px, padT + plotH + 6);
  }

  // Plot line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] == null) continue;
    const px = xToPx(xs[i]);
    const py = yToPx(ys[i]);
    if (!started) { ctx.moveTo(px, py); started = true; }
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Fill under
  ctx.fillStyle = fillColor + '22'; // ~13% alpha
  ctx.lineTo(xToPx(xs[xs.length - 1]), padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.fill();

  // Highlight the user's current lift point
  const { liftRaw } = getInputs();
  const userLift = liftType === 'relative' ? liftRaw : (liftRaw / (baseline * 100)) * 100;
  if (userLift >= xs[0] && userLift <= xs[xs.length - 1]) {
    const p2 = Math.min(0.9999, baseline * (1 + userLift / 100));
    const n = calcSampleSize(baseline, p2, power, confidence, twoSided);
    if (isFinite(n)) {
      const px = xToPx(userLift);
      const py = yToPx(n);
      ctx.fillStyle = lineColor;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Axis labels
  ctx.fillStyle = axisColor;
  ctx.textAlign = 'center';
  ctx.fillText('Relative lift', padL + plotW / 2, padT + plotH + 22);
  ctx.save();
  ctx.translate(14, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Sample per variant', 0, 0);
  ctx.restore();
}

// ---- UI: lift type toggle ----
document.querySelectorAll('[data-lifttype]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-lifttype]').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    liftType = btn.dataset.lifttype;
    liftLabel.firstChild.nodeValue = liftType === 'relative' ? 'Expected lift (%)' : 'Expected lift (pp)';
    compute();
  });
});

document.querySelectorAll('[data-testtype]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-testtype]').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    testType = btn.dataset.testtype;
    compute();
  });
});

[baselineEl, liftEl, powerEl, confidenceEl, variantsEl, dailyCapEl].forEach((el) => {
  el.addEventListener('input', compute);
  el.addEventListener('change', compute);
});

// ---- Scenarios ----
const SCENARIOS = {
  subject: { baseline: 22, lift: 10, liftType: 'relative' },
  sendtime: { baseline: 22, lift: 5, liftType: 'relative' },
  'from-name': { baseline: 22, lift: 15, liftType: 'relative' },
  redesign: { baseline: 3, lift: 20, liftType: 'relative' },
};

document.getElementById('scenario-row').addEventListener('click', (e) => {
  const btn = e.target.closest('.scenario');
  if (!btn) return;
  const scn = SCENARIOS[btn.dataset.scenario];
  if (!scn) return;
  baselineEl.value = scn.baseline;
  liftEl.value = scn.lift;
  // Set lift type
  document.querySelectorAll('[data-lifttype]').forEach((b) => b.classList.remove('on'));
  document.querySelector(`[data-lifttype="${scn.liftType}"]`).classList.add('on');
  liftType = scn.liftType;
  liftLabel.firstChild.nodeValue = liftType === 'relative' ? 'Expected lift (%)' : 'Expected lift (pp)';
  compute();
  trackToolUsed('ab-test-calculator', 'scenario', { scenario: btn.dataset.scenario });
});

// ---- Copy ----
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

copyShareBtn.addEventListener('click', async () => {
  if (!shareTextEl.value) return;
  try {
    await navigator.clipboard.writeText(shareTextEl.value);
    showToast('Copied to clipboard');
    trackToolUsed('ab-test-calculator', 'copy');
  } catch (e) {
    shareTextEl.select();
    document.execCommand('copy');
    showToast('Copied');
  }
});

ctaEditor.addEventListener('click', () => trackCtaClicked('ab-test-calculator', 'editor'));

// Initial render
compute();
