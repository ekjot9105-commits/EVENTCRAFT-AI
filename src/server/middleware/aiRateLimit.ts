import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 60_000;
/** Per-session budget for expensive AI calls. */
const MAX_PER_OWNER = 10;
/**
 * Per-IP ceiling. Session IDs are client-supplied, so this stops a caller from
 * bypassing the session limit by rotating x-anon-id, while leaving headroom for
 * several people behind one NAT.
 */
const MAX_PER_IP = 30;
/** Hard cap on tracked keys so a flood of unique keys cannot exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;
/** Each request records an IP key and an owner key. */
const KEYS_PER_REQUEST = 2;

const requests = new Map<string, number[]>();

function recentHits(key: string, now: number): number[] {
  return (requests.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
}

/** Drops expired windows; if still near the cap, evicts the oldest keys first. */
function prune(now: number): void {
  for (const [key, hits] of requests) {
    if (hits.every((time) => now - time >= WINDOW_MS)) requests.delete(key);
  }
  for (const key of requests.keys()) {
    if (requests.size + KEYS_PER_REQUEST <= MAX_TRACKED_KEYS) break;
    requests.delete(key);
  }
}

/** Applies a small in-memory guard to expensive AI routes in demo deployments. */
export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  if (requests.size + KEYS_PER_REQUEST > MAX_TRACKED_KEYS) prune(now);

  const ipKey = `ip:${req.ip ?? 'unknown'}`;
  const ownerKey = `owner:${req.ownerId ?? req.ip ?? 'unknown'}`;
  const ipHits = recentHits(ipKey, now);
  const ownerHits = recentHits(ownerKey, now);

  if (ownerHits.length >= MAX_PER_OWNER || ipHits.length >= MAX_PER_IP) {
    const oldest = Math.min(...(ownerHits.length >= MAX_PER_OWNER ? ownerHits : ipHits));
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))));
    res.status(429).json({ error: 'AI request limit reached. Please try again later.' });
    return;
  }

  requests.set(ipKey, [...ipHits, now]);
  requests.set(ownerKey, [...ownerHits, now]);
  next();
}

/** Clears limiter state between tests. */
export function resetAiRateLimit(): void {
  requests.clear();
}

/** Number of tracked keys; exposed for tests of the memory bound. */
export function trackedRateLimitKeys(): number {
  return requests.size;
}
