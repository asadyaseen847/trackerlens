/** Collect URL, set at build time from TRACKER_API_URL (see build.mjs). */
declare const __API_URL__: string;

(() => {
  try {
    const script = document.currentScript;
    const siteKey = script?.getAttribute('data-site');
    if (!siteKey) return;
    const apiUrl = script?.getAttribute('data-api') || __API_URL__;
    // TODO(Phase 2, §6): skip rules, pageview + SPA navigation, sendBeacon/fetch transport, ignore flag
    void apiUrl;
  } catch (_err) {
    // Never throw into the host page.
  }
})();
