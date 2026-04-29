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
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // /tools (no trailing slash) → /tools/  (redirect, keeps SEO clean - one canonical URL)
    if (url.pathname === '/tools') {
      return Response.redirect(`${url.origin}/tools/`, 301);
    }

    // Strip the /tools prefix before forwarding to Pages.
    // /tools/        → /
    // /tools/foo/    → /foo/
    // /tools/a/b.css → /a/b.css
    const stripped = url.pathname.replace(/^\/tools\/?/, '/');
    const target = new URL(stripped + url.search, 'https://min8t-tools.pages.dev');

    // Forward the original request to Pages with the rewritten URL. We pass
    // through method, headers, body - Pages handles caching and edge response
    // from there.
    const proxyRequest = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });
    // The Host header on the outgoing fetch must point at Pages so the right
    // project's content is returned.
    proxyRequest.headers.set('Host', 'min8t-tools.pages.dev');

    const response = await fetch(proxyRequest);

    // Pass the response straight through. Pages already serves the right
    // headers (content-type, caching, etc.) for static assets.
    return response;
  },
};
