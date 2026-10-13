import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The first test in each worker builds the Postgres template (PGlite + all migrations).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
