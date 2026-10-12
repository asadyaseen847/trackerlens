import { describe, it } from 'vitest';

// TODO(Phase 1, §10)
describe('normalizeDomain', () => {
  it.todo('strips protocol, path, port and www.');
  it.todo('lowercases');
});

describe('isValidHostname', () => {
  it.todo('accepts shop.example.com');
  it.todo('rejects values without a dot, with spaces or with invalid labels');
});
