import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import helmetImport from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';

// helmet ships separate ESM and CommonJS type declarations. Vercel's build typecheck resolves the
// CommonJS ones, where the default import is the module object rather than the function, so accept
// either shape. See docs/decisions.md.
const helmet = (typeof helmetImport === 'function'
  ? helmetImport
  : (helmetImport as unknown as { default: typeof helmetImport })
      .default) as unknown as () => RequestHandler;

/**
 * Builds the Express app. Kept separate from index.ts so tests can use it without listening.
 * Not named app.ts: Vercel picks src/app.ts as the entrypoint before src/index.ts.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
