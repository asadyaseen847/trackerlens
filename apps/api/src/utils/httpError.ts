import type { RequestHandler } from 'express';

/** An error with an HTTP status that the error handler turns into a JSON response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 501 for endpoints that a later build phase implements. */
export class NotImplementedError extends HttpError {
  constructor(public readonly phase: number) {
    super(501, 'Not implemented');
    this.name = 'NotImplementedError';
  }
}

/** Route handler placeholder: answers 501 { error: "Not implemented", phase }. */
export function notImplemented(phase: number): RequestHandler {
  return (_req, _res, next) => {
    next(new NotImplementedError(phase));
  };
}
