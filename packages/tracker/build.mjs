// Bundles the tracker into apps/web/public/js/script.js and enforces the 1.5 KB gzip budget (BUILD_PROMPT §6).
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, '../../apps/web/public/js/script.js');
const apiUrl = process.env.TRACKER_API_URL ?? 'http://localhost:4000/api/e';
const LIMIT_BYTES = 1536;

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(here, 'src/index.ts')],
  outfile,
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2017',
  legalComments: 'none',
  define: { __API_URL__: JSON.stringify(apiUrl) },
});

const code = readFileSync(outfile);
const gzipped = gzipSync(code, { level: 9 }).length;
console.log(
  `tracker: ${outfile}\n  collect URL: ${apiUrl}\n  size: ${code.length} B minified, ${gzipped} B gzipped (limit ${LIMIT_BYTES} B)`,
);

if (gzipped > LIMIT_BYTES) {
  console.error(`tracker is over the ${LIMIT_BYTES} B gzip budget`);
  process.exit(1);
}
