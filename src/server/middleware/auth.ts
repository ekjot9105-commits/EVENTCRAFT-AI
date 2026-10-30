import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getSupabase, usesSqlite } from '../db/client.js';

export const DEMO_OWNER_ID = 'demo-local-owner';
const ANON_COOKIE_NAME = 'ec_anon_id';

declare module 'express-serve-static-core' {
  interface Request {
    ownerId?: string;
    requestId?: string;
  }
}

/**
 * Extracts a named cookie value from a raw Cookie header string.
 */
function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
}

/** Session IDs are opaque tokens; rejecting other characters keeps them safe to echo in headers. */
const ANON_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

export function isValidAnonId(value: string | null | undefined): value is string {
  return typeof value === 'string' && ANON_ID_PATTERN.test(value);
}

function anonCookie(value: string): string {
  const secure = process.env['NODE_ENV'] === 'production' ? '; Secure' : '';
  return `${ANON_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

/**
 * Resolves an isolated session identity:
 * 1. Supabase JWT when AUTH_ENABLED=true and a Bearer token is provided.
 * 2. Anonymous per-visitor session (cookie / x-anon-id) to prevent multi-tenant collision.
 * 3. Fallback to DEMO_OWNER_ID during automated testing.
 */
export async function resolveIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // If Supabase authentication is enabled and a bearer token is present
    if (process.env['AUTH_ENABLED'] === 'true') {
      const header = req.header('authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
      if (token && !usesSqlite()) {
        const { data, error } = await getSupabase().auth.getUser(token);
        if (error || !data.user) {
          res.status(401).json({ error: 'Authentication is required.' });
          return;
        }
        req.ownerId = data.user.id;
        next();
        return;
      }
    }

    // In unit testing environments without explicit anon headers, keep the fixed test owner ID
    if (process.env['NODE_ENV'] === 'test' && !req.header('x-anon-id') && !req.header('cookie')) {
      req.ownerId = DEMO_OWNER_ID;
      next();
      return;
    }

    // Resolve anonymous visitor session ID from header or cookie
    const headerAnonId = req.header('x-anon-id');
    const cookieAnonId = parseCookie(req.headers.cookie, ANON_COOKIE_NAME);
    const existingAnonId = [headerAnonId, cookieAnonId].find(isValidAnonId);

    if (existingAnonId) {
      req.ownerId = existingAnonId;
      res.setHeader('x-anon-id', existingAnonId);
    } else {
      const newAnonId = `anon-${randomUUID()}`;
      req.ownerId = newAnonId;
      res.setHeader('x-anon-id', newAnonId);
      res.setHeader('Set-Cookie', anonCookie(newAnonId));
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function ownerId(req: Request): string {
  if (!req.ownerId) throw new Error('Authenticated owner context is missing.');
  return req.ownerId;
}
