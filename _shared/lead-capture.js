// Shared lead-capture component for tools.
// Renders an inline email-capture form into a target element.
// On submit, POSTs to /api/tools/lead-capture (Worker-backed, KV-stored).

const ENDPOINT = 'https://min8t.com/api/tools/lead-capture';

const STYLES = `
  .lc-wrap {
    margin-top: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: rgba(40, 239, 145, 0.04);
    border: 1px solid rgba(40, 239, 145, 0.2);
    border-radius: var(--radius-md);
  }
  .lc-wrap .lc-title {
    font-weight: 700; font-size: 0.95rem; color: var(--text-primary);
    margin-bottom: 4px;
  }
  .lc-wrap .lc-blurb {
    font-size: 0.85rem; color: var(--text-secondary);
    margin-bottom: var(--space-sm); line-height: 1.5;
  }
  .lc-form { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
  .lc-form input[type="email"] {
    flex: 1; min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg);
    color: var(--text-primary);
    font-size: 0.9rem;
  }
  .lc-form button {
    padding: 10px 20px;
    background: var(--brand-green);
    color: var(--text-primary);
    border: 0; border-radius: 999px;
    font-weight: 700; font-size: 0.9rem; cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
  }
  .lc-form button:hover { transform: translateY(-1px); }
  .lc-form button:disabled { opacity: 0.6; cursor: wait; }
  .lc-consent {
    margin-top: var(--space-sm);
    font-size: 0.75rem; color: var(--text-muted);
    line-height: 1.5;
    display: flex; align-items: flex-start; gap: 6px;
  }
  .lc-consent input { margin-top: 3px; accent-color: var(--brand-green); }
  .lc-consent label { cursor: pointer; }
  .lc-msg { margin-top: var(--space-sm); font-size: 0.85rem; min-height: 18px; }
  .lc-msg.ok    { color: var(--success); font-weight: 600; }
  .lc-msg.err   { color: var(--danger); }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = STYLES;
  document.head.appendChild(s);
}

/**
 * Render the lead-capture form into `target`.
 * @param {Object} opts
 * @param {HTMLElement} opts.target  - element to render into (form replaces its content)
 * @param {string} opts.tool         - tool slug for tagging in KV
 * @param {string} [opts.title]      - heading text
 * @param {string} [opts.blurb]      - subtitle/blurb under heading
 * @param {string} [opts.cta]        - button label
 */
export function renderLeadCapture(opts) {
  const target = opts.target;
  const tool = opts.tool;
  if (!target || !tool) return;

  injectStyles();

  target.innerHTML = `
    <div class="lc-wrap">
      <div class="lc-title">${opts.title || 'Get notified about new tools'}</div>
      <div class="lc-blurb">${opts.blurb || "We're shipping new free tools every few weeks. We'll email when each one lands. No spam."}</div>
      <form class="lc-form" novalidate>
        <input type="email" name="email" placeholder="your@email.com" required autocomplete="email" spellcheck="false">
        <button type="submit">${opts.cta || 'Notify me'}</button>
      </form>
      <div class="lc-consent">
        <input type="checkbox" id="lc-consent-${tool}" required>
        <label for="lc-consent-${tool}">I agree to receive occasional MiN8T tool updates. Unsubscribe anytime.</label>
      </div>
      <div class="lc-msg" role="status" aria-live="polite"></div>
    </div>
  `;

  const form = target.querySelector('.lc-form');
  const emailInput = target.querySelector('input[type="email"]');
  const consentInput = target.querySelector('.lc-consent input');
  const submitBtn = target.querySelector('button[type="submit"]');
  const msg = target.querySelector('.lc-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'lc-msg';
    msg.textContent = '';

    const email = emailInput.value.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.className = 'lc-msg err';
      msg.textContent = 'Please enter a valid email.';
      return;
    }
    if (!consentInput.checked) {
      msg.className = 'lc-msg err';
      msg.textContent = 'Please tick the consent box.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tool, consent: true }),
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data?.ok) {
        msg.className = 'lc-msg ok';
        msg.textContent = data.message || "You're on the list. ✓";
        form.style.display = 'none';
        target.querySelector('.lc-consent').style.display = 'none';
      } else if (resp.status === 429) {
        msg.className = 'lc-msg err';
        msg.textContent = 'Too many requests. Try again in a minute.';
        submitBtn.disabled = false;
        submitBtn.textContent = opts.cta || 'Notify me';
      } else {
        msg.className = 'lc-msg err';
        msg.textContent = data?.error || 'Could not save. Try again shortly.';
        submitBtn.disabled = false;
        submitBtn.textContent = opts.cta || 'Notify me';
      }
    } catch (err) {
      msg.className = 'lc-msg err';
      msg.textContent = 'Network error. Try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = opts.cta || 'Notify me';
    }
  });
}
