import type { NextFunction, Request, Response } from 'express';
import { getSupabase, usesSqlite } from '../db/client.js';

export const DEMO_OWNER_ID = 'demo-local-owner';

declare module 'express-serve-static-core' {
  interface Request {
    ownerId?: string;
    requestId?: string;
  }
}

/** Resolves a local demo identity or a Supabase JWT without exposing auth data to routes. */
export async function resolveIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (process.env['AUTH_ENABLED'] !== 'true') {
      req.ownerId = DEMO_OWNER_ID;
      next();
      return;
    }
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token || usesSqlite()) {
      if (usesSqlite() && process.env['NODE_ENV'] !== 'production') {
        req.ownerId = DEMO_OWNER_ID;
        next();
        return;
      }
      res.status(401).json({ error: 'Authentication is required.' });
      return;
    }
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Authentication is required.' });
      return;
    }
    req.ownerId = data.user.id;
    next();
  } catch (error) {
    next(error);
  }
}

export function ownerId(req: Request): string {
  if (!req.ownerId) throw new Error('Authenticated owner context is missing.');
  return req.ownerId;
}
