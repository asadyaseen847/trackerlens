import { describe, expect, it } from 'vitest';
import { BRAND_NAME, IGNORE_PARAM } from '../src/constants.js';
import { buildSnippet, ignoreVisitsUrl, trackerScriptUrl } from '../src/snippet.js';

describe('trackerScriptUrl', () => {
  it('appends /js/script.js to the app origin', () => {
    expect(trackerScriptUrl('https://app.example.com')).toBe(
      'https://app.example.com/js/script.js',
    );
  });

  it('ignores trailing slashes', () => {
    expect(trackerScriptUrl('http://localhost:5173/')).toBe('http://localhost:5173/js/script.js');
  });
});

describe('buildSnippet', () => {
  it('builds the comment and the deferred script tag', () => {
    const html = buildSnippet(
      { domain: 'shop.example.com', siteKey: 'ws_7Q2K9X' },
      'https://app.example.com/js/script.js',
    );
    expect(html).toBe(
      `<!-- ${BRAND_NAME} traffic tracking for shop.example.com -->\n` +
        '<script defer data-site="ws_7Q2K9X" src="https://app.example.com/js/script.js"></script>',
    );
  });
});

describe('ignoreVisitsUrl', () => {
  it('links to the site with the ignore flag', () => {
    expect(ignoreVisitsUrl('shop.example.com')).toBe(`https://shop.example.com/?${IGNORE_PARAM}=1`);
  });
});
