// Minimal structured logger. Never pass IPs, tokens or secrets to it (§14).
// TODO(Phase 6, §17): error monitoring hook.
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => console.log(message, meta ?? ''),
  warn: (message: string, meta?: Record<string, unknown>) => console.warn(message, meta ?? ''),
  error: (message: string, meta?: Record<string, unknown>) => console.error(message, meta ?? ''),
};
