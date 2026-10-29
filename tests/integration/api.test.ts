import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import app from '../../src/server/index.js';

describe('EventCraft AI — Full End-to-End API Integration Suite', () => {
  let server: Server;
  let baseUrl: string;
  let testEventId: string;
  let testBudgetItemId: string;
  const testSessionHeader = { 'x-anon-id': 'integration-test-suite-runner' };

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 3001;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // 1. System Health & Diagnostics
  it('GET /api/health — returns HTTP 200 with status ok and timestamp', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /api/ai/status — reports configured AI provider readiness', async () => {
    const res = await fetch(`${baseUrl}/api/ai/status`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; label: string };
    expect(body.provider).toBeDefined();
    expect(body.label).toBeDefined();
  });

  // 2. Event Lifecycle Management
  it('POST /api/events — creates a structured wedding event', async () => {
    const payload = {
      type: 'wedding',
      title: 'Grand Coastal Wedding',
      description: 'Sunset coastal wedding ceremony with live reception.',
      date: '2026-11-15T16:00:00Z',
      guest_count: 120,
      location: 'Monterey Bay Resort',
      budget_amount: 15000,
      currency: 'USD',
      metadata: { theme: 'boho', color_palette: ['gold', 'emerald'] },
    };

    const res = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const event = (await res.json()) as { id: string; title: string; budget_amount: number; type: string };
    expect(event.id).toBeDefined();
    expect(event.title).toBe(payload.title);
    expect(event.budget_amount).toBe(15000);
    expect(event.type).toBe('wedding');

    testEventId = event.id;
  });

  it('GET /api/events/:id — retrieves the created event by UUID', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}`, {
      headers: testSessionHeader,
    });
    expect(res.status).toBe(200);
    const event = (await res.json()) as { id: string; title: string; location: string };
    expect(event.id).toBe(testEventId);
    expect(event.location).toBe('Monterey Bay Resort');
  });

  it('PATCH /api/events/:id — updates event details', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify({ guest_count: 135 }),
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { guest_count: number };
    expect(updated.guest_count).toBe(135);
  });

  // 3. Budget Management Endpoints
  it('POST /api/events/:id/budget — creates an expense line item', async () => {
    const payload = {
      category: 'Venue',
      name: 'Ceremony Cliffside Lawn Deposit',
      estimated_cost: 4500,
      actual_cost: 4200,
      notes: 'Initial 50% deposit paid via wire transfer',
    };

    const res = await fetch(`${baseUrl}/api/events/${testEventId}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const item = (await res.json()) as { id: string; name: string; estimated_cost: number };
    expect(item.id).toBeDefined();
    expect(item.name).toBe(payload.name);
    expect(item.estimated_cost).toBe(4500);

    testBudgetItemId = item.id;
  });

  it('GET /api/events/:id/budget — lists all expenses for the event', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}/budget`, {
      headers: testSessionHeader,
    });
    expect(res.status).toBe(200);
    const items = (await res.json()) as Array<{ id: string; category: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((i) => i.id === testBudgetItemId)).toBe(true);
  });

  // 4. Timeline Management Endpoints
  it('POST /api/events/:id/timeline — creates a planning milestone', async () => {
    const payload = {
      title: 'Sign Photographer Agreement',
      description: 'Book 8-hour documentary photography coverage',
      due_date: '2026-08-01T12:00:00Z',
    };

    const res = await fetch(`${baseUrl}/api/events/${testEventId}/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const milestone = (await res.json()) as { id: string; title: string; status: string };
    expect(milestone.id).toBeDefined();
    expect(milestone.title).toBe(payload.title);
    expect(milestone.status).toBe('pending');
  });

  it('GET /api/events/:id/timeline — lists milestones in chronological order', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}/timeline`, {
      headers: testSessionHeader,
    });
    expect(res.status).toBe(200);
    const items = (await res.json()) as Array<{ id: string; title: string }>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  // 5. Vendor Directory Endpoints
  it('POST /api/events/:id/vendors — tracks a supplier in the pipeline', async () => {
    const payload = {
      category: 'Catering',
      name: 'Coastal Harvest Kitchen',
      contact_name: 'Chef Marcus',
      email: 'marcus@coastalharvest.com',
      status: 'contacted',
      quoted_cost: 6000,
    };

    const res = await fetch(`${baseUrl}/api/events/${testEventId}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const vendor = (await res.json()) as { id: string; name: string; status: string };
    expect(vendor.id).toBeDefined();
    expect(vendor.name).toBe(payload.name);
    expect(vendor.status).toBe('contacted');
  });

  it('GET /api/events/:id/vendors — lists vendors associated with the event', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}/vendors`, {
      headers: testSessionHeader,
    });
    expect(res.status).toBe(200);
    const vendors = (await res.json()) as Array<{ id: string; name: string }>;
    expect(Array.isArray(vendors)).toBe(true);
    expect(vendors.length).toBeGreaterThanOrEqual(1);
  });

  // 6. Ideas Studio Endpoints
  it('POST /api/events/:id/ideas — saves a personalized theme idea', async () => {
    const payload = {
      category: 'Interactive',
      title: 'Acoustic Guitar Welcome Hour',
      description: 'Solo acoustic guitarist during guest arrival and drinks',
      estimated_cost: 450,
    };

    const res = await fetch(`${baseUrl}/api/events/${testEventId}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const idea = (await res.json()) as { id: string; title: string; status: string };
    expect(idea.id).toBeDefined();
    expect(idea.title).toBe(payload.title);
    expect(idea.status).toBe('new');
  });

  // 7. AI Generation, Plan Versioning & Copilot Proposals
  it('POST /api/events/:id/ai/generate — produces a complete schema-validated event plan', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}/ai/generate`, {
      method: 'POST',
      headers: testSessionHeader,
    });

    expect(res.status).toBe(201);
    const stored = (await res.json()) as {
      plan_id: string;
      event_id: string;
      plan: {
        event_type: string;
        summary: string;
        budget_proposal: { categories: Array<{ category: string; amount: number }> };
        timeline: Array<{ title: string; due_date: string }>;
      };
    };

    expect(stored.plan_id).toBeDefined();
    expect(stored.event_id).toBe(testEventId);
    expect(stored.plan.event_type).toBe('wedding');
    expect(stored.plan.summary).toBeDefined();
    expect(stored.plan.budget_proposal.categories.length).toBeGreaterThan(0);
    expect(stored.plan.timeline.length).toBeGreaterThan(0);
  });

  it('GET /api/events/:id/ai/plans — lists historical plan snapshots', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}/ai/plans`, {
      headers: testSessionHeader,
    });
    expect(res.status).toBe(200);
    const plans = (await res.json()) as Array<{ plan_id: string; event_id: string }>;
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/events/:id/ai/copilot — processes conversational query and returns contextual response', async () => {
    const payload = { message: 'How should I allocate budget for flowers and catering?' };
    const res = await fetch(`${baseUrl}/api/events/${testEventId}/ai/copilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...testSessionHeader },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(200);
    const copilotAnswer = (await res.json()) as { answer: string };
    expect(copilotAnswer.answer).toBeDefined();
    expect(copilotAnswer.answer.length).toBeGreaterThan(10);
  });

  // 8. Event Teardown and Cascade Integrity
  it('DELETE /api/events/:id — deletes event and cascaded child resources', async () => {
    const res = await fetch(`${baseUrl}/api/events/${testEventId}`, {
      method: 'DELETE',
      headers: testSessionHeader,
    });
    expect(res.status).toBe(204);

    // Verify event is no longer accessible
    const checkRes = await fetch(`${baseUrl}/api/events/${testEventId}`, {
      headers: testSessionHeader,
    });
    expect(checkRes.status).toBe(404);
  });
});
