import { describe, expect, it } from 'vitest';
import { checkDomainInput, isValidHostname, normalizeDomain } from '../src/domain.js';

describe('normalizeDomain', () => {
  it.each([
    ['shop.example.com', 'shop.example.com'],
    ['  Shop.Example.COM  ', 'shop.example.com'],
    ['https://shop.example.com', 'shop.example.com'],
    ['http://shop.example.com/', 'shop.example.com'],
    ['https://www.example.com/pricing?ref=1#top', 'example.com'],
    ['www.example.com', 'example.com'],
    ['example.com:8080', 'example.com'],
    ['https://user:pass@example.com:443/x', 'example.com'],
    ['example.com.', 'example.com'],
    ['blog.www.example.com', 'blog.www.example.com'],
    ['', ''],
  ])('%j -> %j', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe('isValidHostname', () => {
  it.each(['shop.example.com', 'example.co.uk', 'my-brand.io', 'a1.example.pk'])(
    'accepts %s',
    (host) => {
      expect(isValidHostname(host)).toBe(true);
    },
  );

  it.each([
    'localhost',
    'example',
    'exa mple.com',
    '-bad.example.com',
    'bad-.example.com',
    'example.c',
    '192.168.1.1',
    'example..com',
    `${'a'.repeat(64)}.com`,
  ])('rejects %s', (host) => {
    expect(isValidHostname(host)).toBe(false);
  });
});

describe('checkDomainInput', () => {
  it('returns the normalized domain', () => {
    expect(checkDomainInput('https://www.Shop.example.com/')).toEqual({
      ok: true,
      domain: 'shop.example.com',
    });
  });

  it('asks for an address when empty', () => {
    expect(checkDomainInput('   ')).toEqual({
      ok: false,
      error: 'Type your website address, like shop.example.com.',
    });
  });

  it('explains invalid addresses', () => {
    expect(checkDomainInput('not a site')).toEqual({
      ok: false,
      error: `"not a site" doesn't look like a website address. Try something like shop.example.com.`,
    });
  });
});
