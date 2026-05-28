/**
 * Worker: min8t-tools-router
 *
 * Path-routes `min8t.com/tools/*` to the `min8t-tools.pages.dev` Pages project,
 * keeping the public URL on the apex domain so Google sees one canonical
 * surface for SEO purposes. The marketing site at `min8t.com/` is unaffected
 * - anything not matching `/tools/*` never hits this Worker.
 *
 * Bound on the zone via Worker route: `min8t.com/tools/*` → this script.
 */
const SPAMCIPHER_ORIGIN = 'https://spamcipher.com';
const MIN8T_CANONICAL = 'https://min8t.com/tools/spam-checker/';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // /tools (no trailing slash) → /tools/  (redirect, keeps SEO clean)
    if (url.pathname === '/tools') {
      return Response.redirect(`${url.origin}/tools/`, 301);
    }

    // ── Removed tools — redirect to /tools/ index ──
    if (url.pathname.match(/^\/tools\/background-remover(\/|$)/)) {
      return Response.redirect(`${url.origin}/tools/`, 301);
    }

    // ── SpamCipher reverse proxy ──
    // /tools/spam-checker(/)  → proxy spamcipher.com/check (HTML rewritten)
    // /tools/spam-checker/... → proxy spamcipher.com/... for sub-assets
    if (url.pathname.match(/^\/tools\/spam-checker(\/|$)/)) {
      return handleSpamChecker(request, url);
    }

    // ── Trailing-slash redirect for tool folders ──
    // Pages itself would 308 /foo → /foo/ but its Location strips the
    // /tools/ prefix (it doesn't know the real public path). Handle it
    // here so the Location header keeps /tools/ and Google doesn't flag
    // the URL as "Page with redirect" pointing somewhere broken.
    const toolFolderMatch = url.pathname.match(/^\/tools\/([a-z0-9-]+)$/i);
    if (toolFolderMatch) {
      return Response.redirect(`${url.origin}/tools/${toolFolderMatch[1]}/${url.search}`, 301);
    }

    // ── Default: forward to Pages ──
    const stripped = url.pathname.replace(/^\/tools\/?/, '/');
    const target = new URL(stripped + url.search, 'https://min8t-tools.pages.dev');

    const proxyRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });
    proxyRequest.headers.set('Host', 'min8t-tools.pages.dev');

    const resp = await fetch(proxyRequest);

    // Belt-and-suspenders: if Pages still returns a 3xx with a Location
    // that doesn't start with /tools/, rewrite it to include the prefix
    // so downstream clients (Google bot, etc.) don't follow it off-path.
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (loc && loc.startsWith('/') && !loc.startsWith('/tools/')) {
        const fixed = new Headers(resp.headers);
        fixed.set('location', '/tools' + loc);
        return new Response(resp.body, { status: resp.status, headers: fixed });
      }
    }

    return resp;
  },
};

async function handleSpamChecker(request, url) {
  const subPath = url.pathname.replace(/^\/tools\/spam-checker\/?/, '');

  // The main page request (empty subpath) → fetch /check from SpamCipher
  // Asset requests (images, css, js, fonts) → fetch from SpamCipher origin
  const targetPath = subPath ? '/' + subPath : '/check';
  const target = new URL(targetPath + url.search, SPAMCIPHER_ORIGIN);

  const proxyReq = new Request(target, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'manual',
  });
  proxyReq.headers.set('Host', 'spamcipher.com');

  const resp = await fetch(proxyReq);
  const contentType = resp.headers.get('content-type') || '';

  // Only rewrite HTML responses (the main page)
  if (!contentType.includes('text/html')) {
    return resp;
  }

  let html = await resp.text();

  // Rewrite canonical + OG URLs to min8t.com
  html = html.replace(
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${MIN8T_CANONICAL}">`
  );
  html = html.replace(
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${MIN8T_CANONICAL}">`
  );

  // Rewrite title to include Min8T
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    '<title>Free Email Spam Score Checker - Min8T Tools</title>'
  );
  html = html.replace(
    /<meta name="description"[^>]*>/i,
    '<meta name="description" content="Paste your email HTML and get instant deliverability analysis with 60+ rules and AI classification. Free tool by Min8T, powered by SpamCipher.">'
  );

  // Rewrite relative asset paths so they resolve through spamcipher.com
  // /images/... → https://spamcipher.com/images/...
  // /styles/... → https://spamcipher.com/styles/...
  // /scripts/.. → https://spamcipher.com/scripts/...
  html = html.replace(/(?:href|src)="\/(?!\/)(images|styles|scripts|fonts)([^"]*)"/g,
    (match, dir, rest) => match.replace(`/${dir}${rest}`, `${SPAMCIPHER_ORIGIN}/${dir}${rest}`)
  );

  // Rewrite the "Powered by Min8T" link to just "Part of Min8T Tools"
  html = html.replace(
    /Powered by <a[^>]*>Min8T<\/a>/i,
    'Part of <a href="https://min8t.com/tools/" style="color:var(--brand);font-weight:600;">Min8T Tools</a>'
  );

  // Rewrite the Home nav link to point back to min8t.com/tools/
  html = html.replace(
    /<a[^>]*href="[^"]*"[^>]*>Home<\/a>/i,
    '<a href="/tools/" class="nav-center-link">Min8T Tools</a>'
  );

  const headers = new Headers(resp.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.delete('content-length');
  // Cache the proxied page at the edge for 5 min
  headers.set('cache-control', 'public, s-maxage=300, max-age=60');

  return new Response(html, {
    status: resp.status,
    headers,
  });
}
