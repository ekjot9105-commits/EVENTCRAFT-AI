import type { NextFunction, Request, Response } from 'express';
import { isProductionModeConfigured } from '../config.js';

/**
 * Prevents the single-user demo API from being exposed as a production service.
 * A real auth/ownership middleware must replace this guard before deployment.
 */
export function deploymentGuard(_req: Request, res: Response, next: NextFunction): void {
  if (process.env['DISABLE_PRODUCTION_API'] === 'true') {
    res.status(503).json({
      error: 'Production API access is disabled by configuration.',
    });
    return;
  }
  if (!isProductionModeConfigured()) {
    res.status(503).json({
      error: 'Production API mode is not configured. Set AUTH_ENABLED=true or DEMO_MODE=true.',
    });
    return;
  }
  next();
}
