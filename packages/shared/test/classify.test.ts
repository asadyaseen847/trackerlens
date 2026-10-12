import { describe, it } from 'vitest';

// TODO(Phase 2, §8): table-driven, 40+ cases
describe('classify', () => {
  it.todo('uses UTM tags over the referrer');
  it.todo('marks paid UTM mediums as paid');
  it.todo('classifies gemini.google.com as AI, not Google search');
  it.todo('classifies mail.google.com as email');
  it.todo('treats the site’s own subdomains as internal');
  it.todo('classifies an empty referrer with no UTM as direct');
});
