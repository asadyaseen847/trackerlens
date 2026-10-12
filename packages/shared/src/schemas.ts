import { z } from 'zod';

// TODO(Phase 1, §10): signup / login / workspace / site settings schemas, with real validation
export const createSiteBodySchema = z.object({
  domain: z.string(),
});
export type CreateSiteBody = z.infer<typeof createSiteBodySchema>;

// TODO(Phase 2, §7): tighten the tracker payload { s, u, r, w } (lengths, URL checks)
export const collectPayloadSchema = z.object({
  s: z.string(),
  u: z.string(),
  r: z.string().nullable(),
  w: z.number(),
});
export type CollectPayload = z.infer<typeof collectPayloadSchema>;

// TODO(Phase 3, §10): stats query string (site, period, channels, device, country)
export const statsQuerySchema = z.object({});
