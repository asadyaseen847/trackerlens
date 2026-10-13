import type { ApiErrorBody } from '@audience/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError, NotImplementedError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: 'Not found' };
  res.status(404).json(body);
};

/** Always answers JSON. Never leaks stack traces or internal messages in production. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (res.headersSent) return;

  const isProd = process.env.NODE_ENV === 'production';

  if (err instanceof NotImplementedError) {
    const body: ApiErrorBody = { error: err.message, phase: err.phase };
    res.status(501).json(body);
    return;
  }

  if (err instanceof HttpError) {
    const body: ApiErrorBody = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    // The first issue's message is written for people ("Enter a valid email address.").
    const body: ApiErrorBody = {
      error: err.issues[0]?.message ?? 'Invalid request',
      details: err.issues,
    };
    res.status(400).json(body);
    return;
  }

  // express.json() parse errors and payload-too-large come through with a status.
  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
      ? err.status
      : 500;

  if (status >= 500) {
    logger.error('Unhandled error', {
      method: req.method,
      path: req.path,
      error: err instanceof Error ? err.message : String(err),
      ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    });
  }

  const message =
    status >= 500 && isProd
      ? 'Something went wrong'
      : err instanceof Error
        ? err.message
        : 'Something went wrong';
  const body: ApiErrorBody = { error: message };
  res.status(status).json(body);
};
