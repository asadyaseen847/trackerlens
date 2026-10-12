export interface SnippetSite {
  domain: string;
  siteKey: string;
}

/**
 * The one-line tracking code shown to customers (BUILD_PROMPT §6).
 * TODO(Phase 1, §6): build the comment line + <script defer data-site=… src=…>.
 */
export function buildSnippet(_site: SnippetSite, _trackerUrl: string): string {
  return '';
}
