import { describe, expect, it } from 'vitest';
import {
  createSiteBodySchema,
  isValidTimeZone,
  loginBodySchema,
  signupBodySchema,
  updateSiteBodySchema,
  updateWorkspaceBodySchema,
} from '../src/schemas.js';

describe('signupBodySchema', () => {
  it('trims and lowercases the email and defaults the timezone', () => {
    const parsed = signupBodySchema.parse({
      name: ' Asad ',
      email: ' Asad@Example.COM ',
      password: 'correct horse',
    });
    expect(parsed).toEqual({
      name: 'Asad',
      email: 'asad@example.com',
      password: 'correct horse',
      timezone: 'UTC',
    });
  });

  it('rejects short passwords with a plain message', () => {
    const result = signupBodySchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Use at least 8 characters for your password.');
  });

  it('rejects passwords longer than bcrypt can use, counting bytes', () => {
    const base = { name: 'A', email: 'a@b.co' };
    expect(signupBodySchema.safeParse({ ...base, password: 'x'.repeat(72) }).success).toBe(true);
    expect(signupBodySchema.safeParse({ ...base, password: 'x'.repeat(73) }).success).toBe(false);
    // "€" is 3 bytes: 24 of them = 72 bytes (allowed), 25 = 75 bytes (too long).
    expect(signupBodySchema.safeParse({ ...base, password: '€'.repeat(24) }).success).toBe(true);
    expect(signupBodySchema.safeParse({ ...base, password: '€'.repeat(25) }).success).toBe(false);
  });

  it('rejects unknown timezones', () => {
    const result = signupBodySchema.safeParse({
      name: 'A',
      email: 'a@b.co',
      password: 'long enough',
      timezone: 'Mars/Olympus',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginBodySchema', () => {
  it('rejects an invalid email', () => {
    expect(loginBodySchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});

describe('updateWorkspaceBodySchema', () => {
  it('needs at least one field', () => {
    expect(updateWorkspaceBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(updateWorkspaceBodySchema.safeParse({ name: 'X', role: 'owner' }).success).toBe(false);
  });
});

describe('createSiteBodySchema', () => {
  it('normalizes the domain', () => {
    expect(createSiteBodySchema.parse({ domain: 'https://www.Shop.example.com/' })).toEqual({
      domain: 'shop.example.com',
    });
  });

  it('uses the prototype message for invalid domains', () => {
    const result = createSiteBodySchema.safeParse({ domain: 'localhost' });
    expect(result.error?.issues[0]?.message).toBe(
      `"localhost" doesn't look like a website address. Try something like shop.example.com.`,
    );
  });
});

describe('updateSiteBodySchema', () => {
  it('accepts a single setting', () => {
    expect(updateSiteBodySchema.parse({ paused: true })).toEqual({ paused: true });
  });

  it('rejects an empty update and non-boolean values', () => {
    expect(updateSiteBodySchema.safeParse({}).success).toBe(false);
    expect(updateSiteBodySchema.safeParse({ paused: 'yes' }).success).toBe(false);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone('Asia/Karachi')).toBe(true);
    expect(isValidTimeZone('Asia/Seoul')).toBe(true);
    expect(isValidTimeZone('Nowhere/City')).toBe(false);
  });
});
