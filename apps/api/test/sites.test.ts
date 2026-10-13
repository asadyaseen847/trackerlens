import { SITE_KEY_RE } from '@audience/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signedInAgent, testApp } from './helpers.js';

describe('sites CRUD', () => {
  it('requires a session', async () => {
    const { app } = testApp();
    expect((await request(app).get('/api/sites')).status).toBe(401);
    expect((await request(app).post('/api/sites').send({ domain: 'a.com' })).status).toBe(401);
  });

  it('adds a normalized domain with a public site key, then lists it', async () => {
    const { app } = testApp();
    const { agent } = await signedInAgent(app);

    const created = await agent
      .post('/api/sites')
      .send({ domain: 'https://www.Shop.Example.com/x' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      domain: 'shop.example.com',
      status: 'waiting',
      settings: { includeSubdomains: false, paused: false, allowLocalhost: false },
    });
    expect(created.body.siteKey).toMatch(SITE_KEY_RE);

    const list = await agent.get('/api/sites');
    expect(list.status).toBe(200);
    expect(list.body.sites).toHaveLength(1);
    expect(list.body.sites[0]).toMatchObject({ domain: 'shop.example.com', visits30d: 0 });
    expect(list.body.sites[0].sparkline).toHaveLength(14);
  });

  it('rejects invalid and duplicate domains with readable messages', async () => {
    const { app } = testApp();
    const { agent } = await signedInAgent(app);

    const invalid = await agent.post('/api/sites').send({ domain: 'not a website' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toContain("doesn't look like a website address");

    await agent.post('/api/sites').send({ domain: 'shop.example.com' }).expect(201);
    const dup = await agent.post('/api/sites').send({ domain: 'WWW.shop.example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('shop.example.com is already in your list.');
  });

  it('updates settings, and paused shows as the status', async () => {
    const { app } = testApp();
    const { agent } = await signedInAgent(app);
    const { body: site } = await agent.post('/api/sites').send({ domain: 'a.example.com' });

    const res = await agent
      .patch(`/api/sites/${site.id}`)
      .send({ includeSubdomains: true, paused: true });
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({ includeSubdomains: true, paused: true });
    expect(res.body.status).toBe('paused');

    const bad = await agent.patch(`/api/sites/${site.id}`).send({ siteKey: 'ws_HACKED' });
    expect(bad.status).toBe(400);
  });

  it('returns the snippet for the site', async () => {
    const { app } = testApp();
    const { agent } = await signedInAgent(app);
    const { body: site } = await agent.post('/api/sites').send({ domain: 'a.example.com' });

    const res = await agent.get(`/api/sites/${site.id}/snippet`);
    expect(res.status).toBe(200);
    expect(res.body.html).toContain('traffic tracking for a.example.com');
    expect(res.body.html).toContain(`data-site="${site.siteKey}"`);
    expect(res.body.html).toContain('/js/script.js');
  });

  it('removes a site', async () => {
    const { app, repo } = testApp();
    const { agent } = await signedInAgent(app);
    const { body: site } = await agent.post('/api/sites').send({ domain: 'a.example.com' });

    await agent.delete(`/api/sites/${site.id}`).expect(204);
    expect(repo.sites).toHaveLength(0);
    expect((await agent.get(`/api/sites/${site.id}`)).status).toBe(404);
  });

  it('only lets the owner remove a site', async () => {
    const { app, repo } = testApp();
    const { agent, me } = await signedInAgent(app);
    const { body: site } = await agent.post('/api/sites').send({ domain: 'a.example.com' });

    const member = repo.members.find((m) => m.user_id === me.user.id);
    if (member) member.role = 'member';
    const res = await agent.delete(`/api/sites/${site.id}`);
    expect(res.status).toBe(403);
    expect(repo.sites).toHaveLength(1);
  });

  it('answers 404 for ids that are not UUIDs', async () => {
    const { app } = testApp();
    const { agent } = await signedInAgent(app);
    expect((await agent.get('/api/sites/not-a-uuid')).status).toBe(404);
  });
});

describe('workspace isolation (§10, §14)', () => {
  it("never lets one workspace read, change or delete another workspace's site", async () => {
    const { app, repo } = testApp();
    const alice = await signedInAgent(app, 'Alice');
    const bob = await signedInAgent(app, 'Bob');

    const { body: aliceSite } = await alice.agent
      .post('/api/sites')
      .send({ domain: 'alice.example.com' });

    // Bob doesn't see it in his list.
    expect((await bob.agent.get('/api/sites')).body.sites).toEqual([]);

    // Every :id route answers 404 for Bob, exactly like a missing site.
    expect((await bob.agent.get(`/api/sites/${aliceSite.id}`)).status).toBe(404);
    expect((await bob.agent.get(`/api/sites/${aliceSite.id}/snippet`)).status).toBe(404);
    expect(
      (await bob.agent.patch(`/api/sites/${aliceSite.id}`).send({ paused: true })).status,
    ).toBe(404);
    expect((await bob.agent.delete(`/api/sites/${aliceSite.id}`)).status).toBe(404);

    // Nothing changed.
    expect(repo.sites).toHaveLength(1);
    expect(repo.sites[0]?.paused).toBe(false);

    // The same domain can exist in two different workspaces.
    expect((await bob.agent.post('/api/sites').send({ domain: 'alice.example.com' })).status).toBe(
      201,
    );
  });
});
