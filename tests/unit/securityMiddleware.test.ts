import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { aiRateLimit, resetAiRateLimit, trackedRateLimitKeys } from '../../src/server/middleware/aiRateLimit';
import { isValidAnonId, resolveIdentity, ownerId } from '../../src/server/middleware/auth';
import { requestContext } from '../../src/server/middleware/requestContext';
import { validateTimelineSchedule } from '../../src/server/utils/timelineSchedule';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
  setHeader(name: string, value: string): void;
}

function mockResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  };
}

function mockRequest(init: { ip?: string; ownerId?: string; headers?: Record<string, string> } = {}): Request {
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ip: init.ip ?? '203.0.113.5',
    ownerId: init.ownerId,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function run(middleware: (req: Request, res: Response, next: NextFunction) => unknown, req: Request) {
  const res = mockResponse();
  const next = vi.fn();
  middleware(req, res as unknown as Response, next);
  return { res, next };
}

describe('aiRateLimit', () => {
  beforeEach(() => resetAiRateLimit());
  afterEach(() => vi.useRealTimers());

  it('allows ten AI calls per session per minute and then returns 429 with Retry-After', () => {
    for (let i = 0; i < 10; i++) {
      expect(run(aiRateLimit, mockRequest({ ownerId: 'session-a' })).next).toHaveBeenCalled();
    }
    const { res, next } = run(aiRateLimit, mockRequest({ ownerId: 'session-a' }));
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('cannot be bypassed by rotating client-supplied session IDs from one IP', () => {
    for (let i = 0; i < 30; i++) {
      expect(run(aiRateLimit, mockRequest({ ownerId: `rotating-${i}` })).next).toHaveBeenCalled();
    }
    expect(run(aiRateLimit, mockRequest({ ownerId: 'rotating-fresh' })).res.statusCode).toBe(429);
    expect(run(aiRateLimit, mockRequest({ ip: '198.51.100.7', ownerId: 'other-user' })).next).toHaveBeenCalled();
  });

  it('frees the budget once the one-minute window passes', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 10; i++) run(aiRateLimit, mockRequest({ ownerId: 'session-b' }));
    expect(run(aiRateLimit, mockRequest({ ownerId: 'session-b' })).res.statusCode).toBe(429);
    vi.advanceTimersByTime(60_001);
    expect(run(aiRateLimit, mockRequest({ ownerId: 'session-b' })).next).toHaveBeenCalled();
  });

  it('keeps tracked keys bounded under a flood of unique clients', () => {
    for (let i = 0; i < 6_000; i++) {
      run(aiRateLimit, mockRequest({ ip: `10.0.${Math.floor(i / 250)}.${i % 250}`, ownerId: `flood-${i}` }));
    }
    expect(trackedRateLimitKeys()).toBeLessThanOrEqual(10_000);
  });
});

describe('resolveIdentity', () => {
  const previousEnv = process.env['NODE_ENV'];
  afterEach(() => { process.env['NODE_ENV'] = previousEnv; });

  async function identify(headers: Record<string, string>) {
    const req = mockRequest({ headers });
    const res = mockResponse();
    const next = vi.fn();
    await resolveIdentity(req, res as unknown as Response, next);
    return { req, res, next };
  }

  it('accepts only opaque, header-safe session IDs', () => {
    expect(isValidAnonId('anon-0f8c2a4e-1234')).toBe(true);
    expect(isValidAnonId('short')).toBe(false);
    expect(isValidAnonId('has spaces in it')).toBe(false);
    expect(isValidAnonId('x'.repeat(101))).toBe(false);
    expect(isValidAnonId(undefined)).toBe(false);
  });

  it('reuses a valid header session ID', async () => {
    const { req, next } = await identify({ 'x-anon-id': 'tenant-session-001' });
    expect(req.ownerId).toBe('tenant-session-001');
    expect(next).toHaveBeenCalled();
  });

  it('falls back to a valid cookie when the header is malformed', async () => {
    const { req } = await identify({ 'x-anon-id': '<script>', cookie: 'theme=dark; ec_anon_id=cookie-session-42' });
    expect(req.ownerId).toBe('cookie-session-42');
  });

  it('issues a fresh HttpOnly session for malformed cookies instead of failing', async () => {
    const { req, res, next } = await identify({ cookie: 'ec_anon_id=%E0%A4%A' });
    expect(req.ownerId).toMatch(/^anon-/);
    expect(res.headers['set-cookie']).toContain('HttpOnly');
    expect(next).toHaveBeenCalledWith();
  });

  it('marks the session cookie Secure in production', async () => {
    process.env['NODE_ENV'] = 'production';
    const { res } = await identify({ cookie: 'unrelated=1' });
    expect(res.headers['set-cookie']).toContain('; Secure');
  });

  it('refuses to continue when no owner was resolved', () => {
    expect(() => ownerId(mockRequest())).toThrow(/owner context/);
  });
});

describe('requestContext', () => {
  it('echoes a safe upstream request ID', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'edge-123:abc' } });
    const { res } = run(requestContext, req);
    expect(res.headers['x-request-id']).toBe('edge-123:abc');
  });

  it('replaces unsafe or oversized request IDs with a UUID', () => {
    for (const value of ['bad value with spaces', 'x'.repeat(200)]) {
      const { res } = run(requestContext, mockRequest({ headers: { 'x-request-id': value } }));
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});

describe('validateTimelineSchedule', () => {
  const eventDate = '2026-12-10T00:00:00.000Z';

  it('allows milestones up to 30 days after the event for wrap-up tasks', () => {
    expect(validateTimelineSchedule(eventDate, '2026-12-01T00:00:00.000Z')).toBeNull();
    expect(validateTimelineSchedule(eventDate, '2027-01-09T00:00:00.000Z')).toBeNull();
  });

  it('rejects milestones scheduled well past the event', () => {
    expect(validateTimelineSchedule(eventDate, '2027-02-01T00:00:00.000Z')).toMatch(/30 days/);
  });

  it('skips the rule when either date is missing or invalid', () => {
    expect(validateTimelineSchedule(null, '2027-02-01T00:00:00.000Z')).toBeNull();
    expect(validateTimelineSchedule(eventDate, undefined)).toBeNull();
    expect(validateTimelineSchedule('not a date', '2027-02-01T00:00:00.000Z')).toBeNull();
  });
});
