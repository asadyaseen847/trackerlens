import type { RequestHandler } from 'express';

/**
 * Open CORS for the collect endpoint only: any origin, POST + OPTIONS, no credentials (§7.1).
 * Also undoes helmet's same-origin resource policy, which would block cross-site use.
 */
export const collectCors: RequestHandler = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};
