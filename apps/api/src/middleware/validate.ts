import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates request parts with zod. Parsed values go to res.locals.body / .query / .params
 * (Express 5's req.query is read-only). ZodErrors become 400s in errorHandler.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    if (schemas.body) res.locals['body'] = schemas.body.parse(req.body);
    if (schemas.query) res.locals['query'] = schemas.query.parse(req.query);
    if (schemas.params) res.locals['params'] = schemas.params.parse(req.params);
    next();
  };
}
