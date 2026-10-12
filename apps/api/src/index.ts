import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './utils/logger.js';

// Fail fast on missing configuration, before handling any request.
const env = loadEnv();

const app = createApp();

// On Vercel the default export is wrapped in a Function; locally we listen ourselves.
if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });
}

export default app;
