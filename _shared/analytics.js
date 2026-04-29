// MiN8T Tools - shared analytics helper
// Sends events directly to GA4 via the Measurement Protocol.
// We bypass gtag.js because google's gtag.js endpoint returns 404 for our
// measurement ID even though /g/collect accepts events for the same ID
// (a known GA4 propagation oddity for some properties).
//
// GA4 measurement ID: G-NZ3TYHTYSW (MainMin8t stream, id=14586533552)
// Per-page override via window.__GA_MEASUREMENT_ID__ before this module loads.

const GA_ID = window.__GA_MEASUREMENT_ID__ || 'G-NZ3TYHTYSW';
const GA_ENDPOINT = 'https://www.google-analytics.com/g/collect';

// ---- Persistent client ID (matches GA's client_id field) ----
function getClientId() {
  const KEY = '_ga_cid';
  let cid = localStorage.getItem(KEY);
  if (!cid) {
    // Format: <random>.<timestamp>, mimics GA's _ga cookie payload
    cid = `${Math.floor(Math.random() * 2147483647)}.${Math.floor(Date.now() / 1000)}`;
    try { localStorage.setItem(KEY, cid); } catch (_) { /* private mode */ }
  }
  return cid;
}

// Per-pageload session id (matches GA4's session_start grouping)
const SESSION_ID = String(Math.floor(Date.now() / 1000));

function buildBaseParams() {
  return {
    v: '2',
    tid: GA_ID,
    cid: getClientId(),
    sid: SESSION_ID,
    sct: '1',                 // session count
    seg: '1',                 // session engaged
    dl: location.href,
    dr: document.referrer || '',
    dt: document.title,
    ul: navigator.language || 'en-us',
    sr: `${screen.width}x${screen.height}`,
    _z: 'fetch',
  };
}

function send(eventName, eventParams = {}) {
  if (!GA_ID) return;
  const params = {
    ...buildBaseParams(),
    en: eventName,
  };
  // Event params get prefixed: ep.<key> for strings, epn.<key> for numbers
  for (const [k, v] of Object.entries(eventParams)) {
    if (v == null) continue;
    if (typeof v === 'number') {
      params[`epn.${k}`] = String(v);
    } else {
      params[`ep.${k}`] = String(v);
    }
  }
  const qs = new URLSearchParams(params).toString();

  // Prefer sendBeacon for reliability on page unload; fall back to fetch.
  const url = `${GA_ENDPOINT}?${qs}`;
  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon(url);
      return;
    } catch (_) { /* fall through */ }
  }
  fetch(url, { method: 'POST', keepalive: true, mode: 'no-cors' }).catch(() => {});
}

export function trackToolUsed(tool, action = 'generate', extra = {}) {
  send('tool_used', { tool, action, ...extra });
}

export function trackCtaClicked(tool, target = 'editor', extra = {}) {
  send('cta_clicked', { tool, target, ...extra });
}

// Auto-fire page_view on module load (matches gtag's default send_page_view)
if (GA_ID) send('page_view');
