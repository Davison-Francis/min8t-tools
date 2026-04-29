// MiN8T Tools — shared analytics helper
// Each tool calls trackToolUsed() once per successful action and trackCtaClicked()
// when the user follows a conversion link.
// GA4 measurement ID is injected by Pages env var GA_MEASUREMENT_ID at build time
// (or hardcoded once we have it).

const GA_ID = window.__GA_MEASUREMENT_ID__ || ''; // set by inline script in each page

function ensureGtag() {
  if (window.gtag || !GA_ID) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: true });
}

export function trackToolUsed(tool, action = 'generate', extra = {}) {
  ensureGtag();
  if (!window.gtag) return;
  window.gtag('event', 'tool_used', { tool, action, ...extra });
}

export function trackCtaClicked(tool, target = 'editor', extra = {}) {
  ensureGtag();
  if (!window.gtag) return;
  window.gtag('event', 'cta_clicked', { tool, target, ...extra });
}

// Auto-init: if GA_ID is set, fire pageview on load
if (GA_ID) ensureGtag();
