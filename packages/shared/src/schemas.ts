import { z } from 'zod';
import { SITE_KEY_RE } from './constants.js';
import { checkDomainInput } from './domain.js';

/** True for IANA zones the runtime knows, e.g. "Asia/Karachi". */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ message: 'Enter a valid email address.' }));

/** UTF-8 byte length (shared code runs in browsers and Node, so no TextEncoder/Buffer types). */
function utf8Length(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// bcrypt only uses the first 72 bytes of a password.
const password = z
  .string()
  .min(8, 'Use at least 8 characters for your password.')
  .refine((v) => utf8Length(v) <= 72, 'Use 72 characters or fewer.');

const personName = z.string().trim().min(1, 'Enter your name.').max(80);
const workspaceName = z.string().trim().min(1, 'Enter a workspace name.').max(80);
const timezone = z.string().refine(isValidTimeZone, 'Pick a valid timezone.');

/* ---------- auth (§10) ---------- */

export const signupBodySchema = z.object({
  name: personName,
  email,
  password,
  /** The browser's timezone; the workspace uses it for daily/weekly buckets. */
  timezone: timezone.default('UTC'),
});
export type SignupBody = z.input<typeof signupBodySchema>;

export const loginBodySchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.').max(200),
});
export type LoginBody = z.input<typeof loginBodySchema>;

/* ---------- workspace (§10) ---------- */

export const updateWorkspaceBodySchema = z
  .object({ name: workspaceName.optional(), timezone: timezone.optional() })
  .strict()
  .refine((v) => v.name !== undefined || v.timezone !== undefined, 'Nothing to update.');
export type UpdateWorkspaceBody = z.input<typeof updateWorkspaceBodySchema>;

/* ---------- sites (§10) ---------- */

/** Normalizes the domain and rejects invalid ones with the prototype's messages. */
export const createSiteBodySchema = z.object({
  domain: z
    .string()
    .max(300)
    .transform((value, ctx) => {
      const check = checkDomainInput(value);
      if (!check.ok) {
        ctx.addIssue({ code: 'custom', message: check.error });
        return z.NEVER;
      }
      return check.domain;
    }),
});
export type CreateSiteBody = z.input<typeof createSiteBodySchema>;

export const updateSiteBodySchema = z
  .object({
    includeSubdomains: z.boolean().optional(),
    paused: z.boolean().optional(),
    allowLocalhost: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Nothing to update.');
export type UpdateSiteBody = z.input<typeof updateSiteBodySchema>;

/** What the tracker sends (§6): site key, page URL, referrer, window width. */
export const collectPayloadSchema = z
  .object({
    s: z.string().regex(SITE_KEY_RE),
    u: z.string().min(1).max(2000),
    r: z.string().max(2000).nullable(),
    w: z.number().int().min(0).max(100_000),
  })
  .strict();
export type CollectPayload = z.infer<typeof collectPayloadSchema>;

/* ---------- stats (§10) ---------- */

const CHANNEL_IDS = ['social', 'search', 'email', 'ai', 'direct', 'other'] as const;
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

/** ?site=&period=&channels=&device=&country= — the dashboard's filters. */
export const statsQuerySchema = z.object({
  site: z.preprocess(emptyToUndefined, z.union([z.literal('all'), z.uuid()]).default('all')),
  period: z.preprocess(
    emptyToUndefined,
    z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('daily'),
  ),
  channels: z.preprocess(
    (v) => (typeof v === 'string' && v !== '' ? v.split(',') : undefined),
    z.array(z.enum(CHANNEL_IDS)).min(1).optional(),
  ),
  device: z.preprocess(emptyToUndefined, z.enum(['phone', 'tablet', 'desktop']).optional()),
  country: z.preprocess(
    (v) => (typeof v === 'string' && v !== '' ? v.toUpperCase() : undefined),
    z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
  ),
});
export type StatsQueryParams = z.output<typeof statsQuerySchema>;

export const breakdownQuerySchema = statsQuerySchema.extend({
  dimension: z.enum(['platform', 'page', 'campaign', 'country', 'device']),
  limit: z.coerce.number().int().min(1).max(250).default(10),
});

export const socialQuerySchema = z.object({
  period: statsQuerySchema.shape.period,
});
