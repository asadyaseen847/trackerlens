// Structured logger (Phase 6). One JSON line per event, which Vercel's log view can filter.
// Never pass IPs, tokens, secrets or request bodies to it (§14).
//
// Error monitoring hook: when ERROR_WEBHOOK_URL is set (e.g. a Slack or Discord incoming
// webhook), every error is also posted there as a short message. Fire-and-forget, so a slow or
// failing webhook never affects a request.

type Level = 'info' | 'warn' | 'error';
type Meta = Record<string, unknown>;

const isTest = () => process.env['NODE_ENV'] === 'test';

function write(level: Level, message: string, meta?: Meta) {
  if (isTest() && level !== 'error') return;
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function notify(message: string, meta?: Meta) {
  const url = process.env['ERROR_WEBHOOK_URL'];
  if (!url || isTest()) return;
  const details = meta ? ` ${JSON.stringify(meta).slice(0, 1500)}` : '';
  const text = `TrackerLens API error: ${message}${details}`;
  // Slack reads "text", Discord reads "content".
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, content: text }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => undefined);
}

export const logger = {
  info: (message: string, meta?: Meta) => write('info', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  error: (message: string, meta?: Meta) => {
    write('error', message, meta);
    notify(message, meta);
  },
};
