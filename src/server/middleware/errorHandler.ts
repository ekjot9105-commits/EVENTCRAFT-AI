// ===========================================
// Error Handling Middleware
// ===========================================

import type { Request, Response, NextFunction } from 'express';

/**
 * Custom application error with status code.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Not Found error factory.
 */
export function notFound(resource: string, id: string): AppError {
  return new AppError(404, `${resource} with id '${id}' not found`);
}

/**
 * Global error handler middleware.
 * MUST have 4 parameters for Express to recognize it as error middleware.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the full error server-side (never expose to client)
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  if (!(err instanceof AppError)) {
    console.error(err.stack);
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Generic server error — don't leak internals
  res.status(500).json({
    error: 'An unexpected error occurred. Please try again.',
  });
}
