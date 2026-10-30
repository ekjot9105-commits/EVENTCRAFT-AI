import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../src/server/index.js';

/**
 * Vercel Serverless Function entry point.
 * Bridges incoming Vercel HTTP requests to the Express application, which serves the
 * API only under /api; restore that prefix if the platform rewrite removed it.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
