import { BRAND_NAME, IGNORE_PARAM, TRACKER_PATH } from './constants.js';

export interface SnippetSite {
  domain: string;
  siteKey: string;
}

/** Public URL of the tracker script, served by the web app (BUILD_PROMPT §4). */
export function trackerScriptUrl(appOrigin: string): string {
  return `${appOrigin.replace(/\/+$/, '')}${TRACKER_PATH}`;
}

/** The one-line tracking code shown to customers (BUILD_PROMPT §6). */
export function buildSnippet(site: SnippetSite, trackerUrl: string): string {
  return [
    `<!-- ${BRAND_NAME} traffic tracking for ${site.domain} -->`,
    `<script defer data-site="${site.siteKey}" src="${trackerUrl}"></script>`,
  ].join('\n');
}

/** Link the customer opens once in each browser to stop counting their own visits (§6). */
export function ignoreVisitsUrl(domain: string): string {
  return `https://${domain}/?${IGNORE_PARAM}=1`;
}
