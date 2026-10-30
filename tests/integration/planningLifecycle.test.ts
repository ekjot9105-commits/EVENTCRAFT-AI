import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import app from '../../src/server/index.js';
import vercelHandler from '../../api/index.js';
import { LocalPlanningProvider, setAiProviderForTests, type AiProvider } from '../../src/server/ai/provider.js';
import { resetAiRateLimit } from '../../src/server/middleware/aiRateLimit.js';

const headers = { 'Content-Type': 'application/json', 'x-anon-id': 'planning-lifecycle-owner' };

describe('Planning lifecycle, exports, and AI plan versions', () => {
  let server: Server;
  let baseUrl: string;
  let eventId: string;

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}/api${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const json = async <T>(res: Response) => (await res.json()) as T;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
    const created = await api('/events', {
      method: 'POST',
      body: JSON.stringify({
        type: 'birthday', title: 'Zoya turns 30', date: '2026-12-20T18:00:00.000Z',
        guest_count: 40, location: 'Bengaluru', budget_amount: 90000, currency: 'INR',
      }),
    });
    expect(created.status).toBe(201);
    eventId = (await json<{ id: string }>(created)).id;
  });

  afterEach(() => {
    setAiProviderForTests(null);
    resetAiRateLimit();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('edits and deletes budget, timeline, and vendor records', async () => {
    for (const [resource, body, patch] of [
      ['budget', { category: 'Cake', name: 'Two-tier cake', estimated_cost: 4500 }, { paid: true, actual_cost: 4200 }],
      ['timeline', { title: 'Order balloons', due_date: '2026-12-10T10:00:00.000Z' }, { status: 'completed' }],
      ['vendors', { category: 'Music', name: 'DJ Arjun', quoted_cost: 15000 }, { status: 'booked', final_cost: 14000 }],
    ] as const) {
      const created = await json<{ id: string }>(await api(`/events/${eventId}/${resource}`, { method: 'POST', body: JSON.stringify(body) }));
      const updated = await api(`/events/${eventId}/${resource}/${created.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      expect(updated.status).toBe(200);
      expect(await json(updated)).toMatchObject(patch);

      const removed = await api(`/events/${eventId}/${resource}/${created.id}`, { method: 'DELETE' });
      expect(removed.status).toBe(204);
      const list = await json<Array<{ id: string }>>(await api(`/events/${eventId}/${resource}`));
      expect(list.some((row) => row.id === created.id)).toBe(false);
    }
  });

  it('returns 404 when patching a record that does not exist', async () => {
    const res = await api(`/events/${eventId}/vendors/00000000-0000-4000-8000-000000000000`, { method: 'PATCH', body: JSON.stringify({ name: 'Ghost' }) });
    expect(res.status).toBe(404);
  });

  it('rejects timeline milestones far past the event date', async () => {
    const res = await api(`/events/${eventId}/timeline`, { method: 'POST', body: JSON.stringify({ title: 'Too late', due_date: '2027-06-01T00:00:00.000Z' }) });
    expect(res.status).toBe(400);
    expect((await json<{ error: string }>(res)).error).toMatch(/30 days/);
  });

  it('saves and dismisses ideas', async () => {
    const idea = await json<{ id: string }>(await api(`/events/${eventId}/ideas`, {
      method: 'POST',
      body: JSON.stringify({ category: 'Decor', title: 'Neon name sign', estimated_cost: 3000 }),
    }));
    const saved = await api(`/events/${eventId}/ideas/${idea.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'saved' }) });
    expect(await json(saved)).toMatchObject({ status: 'saved' });
    const listed = await json<Array<{ id: string }>>(await api(`/events/${eventId}/ideas`));
    expect(listed.some((row) => row.id === idea.id)).toBe(true);
  });

  it('generates, applies once, and restores AI plan versions', async () => {
    const generated = await api(`/events/${eventId}/ai/generate`, { method: 'POST' });
    expect(generated.status).toBe(201);
    const plan = await json<{ plan_id: string; applied_at: string | null }>(generated);
    expect(plan.applied_at).toBeNull();

    const budgetBefore = (await json<unknown[]>(await api(`/events/${eventId}/budget`))).length;
    const applied = await api(`/events/${eventId}/ai/plans/apply`, { method: 'POST', body: JSON.stringify({ plan_id: plan.plan_id }) });
    expect(applied.status).toBe(200);
    expect((await json<{ applied_at: string }>(applied)).applied_at).toBeTruthy();
    expect((await json<unknown[]>(await api(`/events/${eventId}/budget`))).length).toBeGreaterThan(budgetBefore);

    const again = await api(`/events/${eventId}/ai/plans/apply`, { method: 'POST', body: JSON.stringify({ plan_id: plan.plan_id }) });
    expect(again.status).toBe(409);

    const restored = await api(`/events/${eventId}/ai/plans/restore`, { method: 'POST', body: JSON.stringify({ plan_id: plan.plan_id }) });
    expect(restored.status).toBe(200);

    const missing = await api(`/events/${eventId}/ai/plans/apply`, { method: 'POST', body: JSON.stringify({ plan_id: '00000000-0000-4000-8000-000000000000' }) });
    expect(missing.status).toBe(404);
  });

  it('plans in the event currency without a dollar default', async () => {
    const plan = await json<{ plan: { budget_proposal: { currency: string } } }>(await api(`/events/${eventId}/ai/generate`, { method: 'POST' }));
    expect(plan.plan.budget_proposal.currency).toBe('INR');
  });

  it('answers 502, not 500, when the model returns invalid output', async () => {
    const broken: AiProvider = {
      generatePlan: async () => ({ personalized_ideas: [{ title: '' }] }) as never,
      answerCopilot: async () => ({ answer: 42 }) as never,
    };
    setAiProviderForTests(broken);

    const ideas = await api(`/events/${eventId}/ideas/generate`, { method: 'POST' });
    expect(ideas.status).toBe(502);
    const copilot = await api(`/events/${eventId}/ai/copilot`, { method: 'POST', body: JSON.stringify({ message: 'Hi' }) });
    expect(copilot.status).toBe(502);
  });

  it('persists validated generated ideas in one batch', async () => {
    setAiProviderForTests(new LocalPlanningProvider());
    const res = await api(`/events/${eventId}/ideas/generate`, { method: 'POST' });
    expect(res.status).toBe(201);
    const ideas = await json<Array<{ event_id: string }>>(res);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((idea) => idea.event_id === eventId)).toBe(true);
  });

  it('exports an RFC 5545 calendar and a printable plan', async () => {
    const ics = await api(`/events/${eventId}/export/ics`);
    expect(ics.status).toBe(200);
    expect(ics.headers.get('content-type')).toMatch(/text\/calendar/);
    const body = await ics.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');

    const pdf = await api(`/events/${eventId}/export/pdf`);
    expect(pdf.status).toBe(200);
    expect((await pdf.text()).length).toBeGreaterThan(100);
  });

  it('serves the API through the Vercel entry even when the /api prefix is stripped', async () => {
    const bridge = createServer((req: IncomingMessage, res: ServerResponse) => vercelHandler(req, res));
    await new Promise<void>((resolve) => bridge.listen(0, resolve));
    try {
      const address = bridge.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const [prefixed, stripped] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/api/health`),
        fetch(`http://127.0.0.1:${port}/health`),
      ]);
      expect(prefixed.status).toBe(200);
      expect(stripped.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => bridge.close(() => resolve()));
    }
  });
});
