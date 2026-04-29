// Auto-binds the footer newsletter form so it POSTs to the working
// account_service endpoint instead of the dead /api/newsletter URL.
//
// The footer form was copy-pasted from the marketing site, where an inline
// onsubmit handler intercepts the submit and calls fetch() against
// /public/newsletter/subscribe. The tools-repo copy didn't include that
// handler, so submissions did a real form POST to /api/newsletter and 404ed.
//
// This script binds at DOMContentLoaded to any form with id starting
// "tools-newsletter-form" and replicates the marketing-site behavior with
// per-tool source tagging derived from the URL path.

const ENDPOINT = 'https://min8t.com/public/newsletter/subscribe';

function deriveSource() {
  // /tools/css-inliner/ -> "tools-css-inliner"
  const m = location.pathname.match(/\/tools\/([^/]+)\/?/);
  return m ? `tools-${m[1]}` : 'tools-index';
}

function bind(form) {
  if (form.dataset.subscribeBound === '1') return;
  form.dataset.subscribeBound = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const msg = form.querySelector('.newsletter-msg');
    const btn = form.querySelector('button[type="submit"]');
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;

    if (msg) {
      msg.textContent = '';
      msg.style.color = '#888';
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Subscribing…';
    }

    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: deriveSource() }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.success) {
        if (msg) {
          msg.style.color = '#28ef91';
          msg.textContent = data.message || 'Thanks for subscribing!';
        }
        emailInput.value = '';
      } else {
        if (msg) {
          msg.style.color = '#ef4444';
          msg.textContent = (data.error && data.error.message) || data.error || 'Something went wrong.';
        }
      }
    } catch (_) {
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = 'Network error. Please try again.';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Subscribe';
      }
    }
  });
}

function initAll() {
  document.querySelectorAll('form[id^="tools-newsletter-form"]').forEach(bind);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
