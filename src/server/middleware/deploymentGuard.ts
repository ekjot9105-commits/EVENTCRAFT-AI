import type { NextFunction, Request, Response } from 'express';

/**
 * Prevents the single-user demo API from being exposed as a production service.
 * A real auth/ownership middleware must replace this guard before deployment.
 */
export function deploymentGuard(_req: Request, res: Response, next: NextFunction): void {
  if (process.env['NODE_ENV'] === 'production' && process.env['AUTH_ENABLED'] !== 'true') {
    res.status(503).json({
      error: 'Production API access is disabled until authentication and event ownership are configured.',
    });
    return;
  }
  next();
}
