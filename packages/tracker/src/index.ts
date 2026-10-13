/**
 * TrackerLens tracking script (BUILD_PROMPT §6). Cookie-free; must stay under 1.5 KB gzipped.
 *
 *   <script defer data-site="ws_7Q2K9X" src="https://…/js/script.js"></script>
 *
 * Optional attributes: data-api (custom collect URL), data-allow-localhost.
 */

/** Collect URL and "ignore my visits" parameter, set at build time (see build.mjs). */
declare const __API_URL__: string;
declare const __IGNORE_PARAM__: string;

(() => {
  try {
    const doc = document;
    const loc = location;
    const nav = navigator;
    const script = doc.currentScript;
    const site = script && script.getAttribute('data-site');
    if (!script || !site) return;
    const api = script.getAttribute('data-api') || __API_URL__;

    // "Ignore my visits": ?<param>=1 sets a flag in this browser, ?<param>=0 removes it.
    try {
      const flag = new URLSearchParams(loc.search).get(__IGNORE_PARAM__);
      if (flag === '1') {
        localStorage.setItem(__IGNORE_PARAM__, '1');
        console.log('TrackerLens: visits from this browser are now ignored.');
      } else if (flag === '0') {
        localStorage.removeItem(__IGNORE_PARAM__);
      }
      if (localStorage.getItem(__IGNORE_PARAM__) === '1') return;
    } catch (_e) {
      // Storage blocked: keep tracking normally.
    }

    if (loc.protocol === 'file:' || nav.webdriver) return;
    if (
      /^(localhost|127\.0\.0\.1|\[::1\])$/.test(loc.hostname) &&
      !script.hasAttribute('data-allow-localhost')
    ) {
      return;
    }

    let lastPath: string | undefined;
    let lastAt = 0;

    const send = () => {
      try {
        const now = Date.now();
        const path = loc.pathname;
        // SPA routers often fire twice for one navigation.
        if (path === lastPath && now - lastAt < 1000) return;
        lastPath = path;
        lastAt = now;
        const body = JSON.stringify({
          s: site,
          u: loc.href.split('#')[0],
          r: doc.referrer || null,
          w: innerWidth,
        });
        // text/plain avoids a CORS preflight.
        if (!(nav.sendBeacon && nav.sendBeacon(api, new Blob([body], { type: 'text/plain' })))) {
          fetch(api, {
            method: 'POST',
            body,
            keepalive: true,
            headers: { 'Content-Type': 'text/plain' },
          }).catch(() => {});
        }
      } catch (_e) {
        // Never throw into the host page.
      }
    };

    // Single-page apps: count each URL change.
    const hist = history;
    (['pushState', 'replaceState'] as const).forEach((method) => {
      const original = hist[method];
      hist[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args);
        send();
        return result;
      };
    });
    addEventListener('popstate', send);

    // Prerendered pages count when the visitor actually sees them.
    if ((doc.visibilityState as string) === 'prerender') {
      const onVisible = () => {
        if ((doc.visibilityState as string) !== 'prerender') {
          doc.removeEventListener('visibilitychange', onVisible);
          send();
        }
      };
      doc.addEventListener('visibilitychange', onVisible);
    } else {
      send();
    }
  } catch (_e) {
    // Never throw into the host page.
  }
})();
