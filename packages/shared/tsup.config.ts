import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  // tsup's dts step sets `baseUrl`, which TypeScript 6 deprecates; see docs/decisions.md.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  // Don't wipe dist/ on every rebuild in watch mode: the API and web read it while running.
  clean: !options.watch,
  target: 'es2022',
}));
