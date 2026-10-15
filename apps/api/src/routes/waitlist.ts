import { waitlistBodySchema, type WaitlistResponse } from '@audience/shared';
import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { rateLimit } from '../middleware/rateLimit.js';

/** Public waitlist sign-up from /waitlist. No session needed. */
export function waitlistRouter({ repo, authRateLimit }: AppDeps): Router {
  const router = Router();

  // Same answer whether the email is new or already listed, so the form can't be used to
  // find out who signed up.
  router.post('/', rateLimit(authRateLimit), async (req, res) => {
    const { email, website } = waitlistBodySchema.parse(req.body);
    await repo.joinWaitlist({ email, website: website ?? null });
    const body: WaitlistResponse = { ok: true };
    res.status(201).json(body);
  });

  return router;
}
