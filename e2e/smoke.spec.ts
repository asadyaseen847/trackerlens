import { expect, test } from '@playwright/test';
import { PORTS } from './playwright.config';

const WEB = `http://localhost:${PORTS.WEB}`;
const testSite = (key: string) =>
  `http://localhost:${PORTS.SITE}/?key=${key}&script=${WEB}/js/script.js&api=http://localhost:${PORTS.API}/api/e`;

test('tracker → collect → database → dashboard', async ({ browser }) => {
  // 1. Sign up and add a website (localhost allowed, since the test site runs there).
  const dashboard = await browser.newContext({ baseURL: WEB });
  const api = dashboard.request;
  const email = `e2e-${Date.now()}@example.com`;
  const signup = await api.post('/api/auth/signup', {
    data: { name: 'E2E', email, password: 'correct horse battery', timezone: 'UTC' },
  });
  expect(signup.status()).toBe(201);
  const site = await (
    await api.post('/api/sites', { data: { domain: 'e2e-shop.example.com' } })
  ).json();
  await api.patch(`/api/sites/${site.id}`, { data: { allowLocalhost: true } });
  expect((await (await api.get(`/api/sites/${site.id}/status`)).json()).installed).toBe(false);

  // 2. A real visitor opens the test site. Playwright marks its browser as automated
  //    (navigator.webdriver), which the tracker deliberately ignores, so pretend to be a person.
  const visitor = await browser.newContext();
  await visitor.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', { get: () => false });
  });
  const page = await visitor.newPage();
  // (sendBeacon bodies aren't visible to Playwright; the database checks below prove the payload.)
  const hit = page.waitForRequest((r) => r.url().endsWith('/api/e') && r.method() === 'POST');
  await page.goto(testSite(site.siteKey));
  await hit;

  // A single-page-app navigation counts as a second page view in the same visit.
  const second = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/e'));
  await page.evaluate(() => history.pushState({}, '', '/pricing'));
  await second;

  // 3. The visit and both page views reached the database.
  await expect
    .poll(async () => (await (await api.get(`/api/sites/${site.id}/status`)).json()).installed)
    .toBe(true);
  await expect
    .poll(async () => (await (await api.get(`/api/stats/overview?site=${site.id}`)).json()).kpis)
    .toMatchObject({ visits: { value: 1 }, pageviews: { value: 2 } });

  // 4. The dashboard shows it.
  const ui = await dashboard.newPage();
  await ui.goto(`/app/websites?site=${site.id}`);
  await expect(ui.getByRole('heading', { name: 'Traffic for e2e-shop.example.com' })).toBeVisible();
  await expect(
    ui.getByRole('listitem').filter({ hasText: 'Typed in or bookmarked' }),
  ).toBeVisible();
  const visitsTile = ui.locator('section[aria-label="How much traffic"] > div').first();
  await expect(visitsTile).toContainText('Visits');
  await expect(visitsTile).toContainText('1');

  // 5. "Check installation" says it's working.
  await ui.goto(`/app/install?site=${site.id}`);
  await ui.getByRole('button', { name: 'Check installation' }).click();
  await expect(ui.getByText(/✓ Working\. Last visit/)).toBeVisible();
});

test('the tracker ignores automated browsers and the "ignore my visits" flag', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ baseURL: WEB });
  await ctx.request.post('/api/auth/signup', {
    data: {
      name: 'E2E',
      email: `e2e-${Date.now()}-b@example.com`,
      password: 'correct horse battery',
    },
  });
  const site = await (
    await ctx.request.post('/api/sites', { data: { domain: 'e2e-b.example.com' } })
  ).json();
  await ctx.request.patch(`/api/sites/${site.id}`, { data: { allowLocalhost: true } });

  // Automated browser (navigator.webdriver = true): nothing is sent.
  const botContext = await browser.newContext();
  await botContext.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', { get: () => true });
  });
  const bot = await botContext.newPage();
  let sent = 0;
  bot.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/e') && sent++);
  await bot.goto(testSite(site.siteKey));
  await bot.waitForTimeout(1500);
  expect(sent).toBe(0);

  // A person who opened ?trackerlens_ignore=1 once: nothing is sent afterwards either.
  const owner = await browser.newContext();
  await owner.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', { get: () => false });
  });
  const page = await owner.newPage();
  let ownerSent = 0;
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/e') && ownerSent++);
  await page.goto(`${testSite(site.siteKey)}&trackerlens_ignore=1`);
  await page.goto(testSite(site.siteKey));
  await page.waitForTimeout(1500);
  expect(ownerSent).toBe(0);
});
