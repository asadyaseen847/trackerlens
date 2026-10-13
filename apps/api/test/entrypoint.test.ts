import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcFile = (name: string) => fileURLToPath(new URL(`../src/${name}`, import.meta.url));

// Vercel's Express preset uses the first of src/app, src/index, src/server whose source
// imports 'express' as the function entrypoint. It must be src/index.ts (default-exports the app).
describe('Vercel entrypoint', () => {
  it('only src/index.ts matches the entrypoint names', () => {
    expect(existsSync(srcFile('index.ts'))).toBe(true);
    for (const name of ['app.ts', 'app.js', 'server.ts', 'server.js']) {
      expect(existsSync(srcFile(name)), `src/${name} would shadow src/index.ts on Vercel`).toBe(
        false,
      );
    }
  });

  it('src/index.ts imports express, as Vercel requires', () => {
    // Same pattern Vercel uses to detect the framework import.
    const importsExpress = /(?:from|require|import)\s*(?:\(\s*)?["']express["']\s*(?:\))?/;
    expect(readFileSync(srcFile('index.ts'), 'utf8')).toMatch(importsExpress);
  });
});
