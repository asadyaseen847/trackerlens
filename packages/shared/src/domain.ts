/** Hostname with at least one dot and a letter-only TLD (same rule as the prototype). */
const HOSTNAME_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Turn whatever the customer typed into a bare hostname: strip protocol, credentials, path,
 * query, hash, port, trailing dot and "www.", and lowercase. "https://WWW.Shop.com:443/a?b"
 * becomes "shop.com".
 */
export function normalizeDomain(input: string): string {
  const withoutProtocol = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = (withoutProtocol.split(/[/?#]/)[0] ?? '')
    .replace(/^[^@]*@/, '')
    .replace(/:\d*$/, '')
    .replace(/\.$/, '');
  return host.replace(/^www\./, '');
}

/** True when the value is a valid public hostname (no IPs, no localhost, no spaces). */
export function isValidHostname(hostname: string): boolean {
  return HOSTNAME_RE.test(hostname);
}

export type DomainCheck = { ok: true; domain: string } | { ok: false; error: string };

/**
 * Normalize and validate a website address typed by a customer, with the prototype's
 * plain-language error messages. Duplicate checks happen on the server.
 */
export function checkDomainInput(input: string): DomainCheck {
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false, error: 'Type your website address, like shop.example.com.' };
  if (!isValidHostname(domain)) {
    return {
      ok: false,
      error: `"${domain}" doesn't look like a website address. Try something like shop.example.com.`,
    };
  }
  return { ok: true, domain };
}
