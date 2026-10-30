import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Accept only opaque, header-safe IDs from upstream proxies. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

/** Adds a safe correlation ID to responses without logging private event content. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
