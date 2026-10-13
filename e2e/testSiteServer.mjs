// Serves examples/test-site with the tracking snippet filled in from the query string:
//   http://localhost:4200/?key=ws_XXXXXX&script=http://localhost:5174/js/script.js&api=http://localhost:4100/api/e
// Used by the end-to-end smoke test (BUILD_PROMPT §15).
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 4200);
const template = readFileSync(new URL('../examples/test-site/index.html', import.meta.url), 'utf8');
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  const key = url.searchParams.get('key') ?? 'ws_TEST01';
  const script = url.searchParams.get('script') ?? 'http://localhost:5173/js/script.js';
  const api = url.searchParams.get('api');
  const html = template
    .replace(
      'data-site="ws_TEST01"',
      `data-site="${escape(key)}"${api ? ` data-api="${escape(api)}"` : ''}`,
    )
    .replace('src="http://localhost:5173/js/script.js"', `src="${escape(script)}"`);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
}).listen(port, () => console.log(`test site on http://localhost:${port}`));
