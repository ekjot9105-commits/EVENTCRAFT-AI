import { vi } from 'vitest';
import type { Event } from '../../../src/shared/types/event';
import type { BudgetItem, BudgetSummary } from '../../../src/shared/types/budget';
import type { TimelineItem } from '../../../src/shared/types/timeline';
import type { Vendor } from '../../../src/shared/types/vendor';
import type { Idea } from '../../../src/shared/types/idea';

export const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const stamp = '2026-10-01T00:00:00.000Z';

export const event: Event = {
  id: EVENT_ID,
  owner_id: 'anon-test',
  type: 'wedding',
  title: 'Asha & Dev Wedding',
  description: 'Garden ceremony with an evening reception.',
  date: '2026-12-10T00:00:00.000Z',
  guest_count: 120,
  location: 'Pune',
  budget_amount: 20000,
  currency: 'USD',
  metadata: { style: 'Modern' },
  created_at: stamp,
  updated_at: stamp,
};

export const budgetItem: BudgetItem = {
  id: '22222222-2222-4222-8222-222222222222', event_id: EVENT_ID, category: 'Venue', name: 'Garden hall',
  estimated_cost: 8000, actual_cost: 7500, paid: true, notes: null, sort_order: 0, created_at: stamp, updated_at: stamp,
};

export const budgetSummary: BudgetSummary = {
  planned_budget: 20000, planned_spending: 8000, actual_spending: 7500, paid_amount: 7500,
  remaining_budget: 12000, usage_percentage: 40, over_budget: false,
  category_totals: { Venue: { estimated: 8000, actual: 7500 } }, item_count: 1,
};

export const timelineItem: TimelineItem = {
  id: '33333333-3333-4333-8333-333333333333', event_id: EVENT_ID, title: 'Send invitations', description: 'Digital invites',
  due_date: '2026-11-15T00:00:00.000Z', status: 'pending', sort_order: 0, created_at: stamp, updated_at: stamp,
};

export const vendor: Vendor = {
  id: '44444444-4444-4444-8444-444444444444', event_id: EVENT_ID, category: 'Photography', name: 'Lens & Light',
  contact_name: 'Mira', phone: null, email: 'mira@example.com', website: null, status: 'contacted',
  quoted_cost: 1800, final_cost: null, notes: null, created_at: stamp, updated_at: stamp,
};

export const idea: Idea = {
  id: '55555555-5555-4555-8555-555555555555', event_id: EVENT_ID, category: 'Decor', title: 'Fairy light canopy',
  description: 'Warm lights over the dance floor.', estimated_cost: 150, status: 'new', created_at: stamp,
};

export const copilotAnswer = {
  answer: 'Here is a day-of schedule for your wedding.',
  needs_clarification: false,
  clarification_question: null,
  proposal: {
    proposal_id: '66666666-6666-4666-8666-666666666666',
    action: 'add_timeline',
    explanation: 'Add "Final vendor walkthrough" to your timeline.',
    target_id: null,
    current_value: null,
    expected_budget_impact: 0,
    proposed_value: { title: 'Final vendor walkthrough' },
    requires_confirmation: true,
  },
};

type Handler = (body: unknown) => { status?: number; body?: unknown };

const e = `/events/${EVENT_ID}`;
const defaultRoutes: Record<string, Handler> = {
  'GET /events': () => ({ body: [event] }),
  [`GET ${e}`]: () => ({ body: event }),
  [`GET ${e}/budget`]: () => ({ body: [budgetItem] }),
  [`GET ${e}/budget/summary`]: () => ({ body: budgetSummary }),
  [`GET ${e}/timeline`]: () => ({ body: [timelineItem] }),
  [`GET ${e}/vendors`]: () => ({ body: [vendor] }),
  [`GET ${e}/ideas`]: () => ({ body: [idea] }),
  [`GET ${e}/ai/plans`]: () => ({ body: [] }),
  'GET /ai/status': () => ({ body: { provider: 'local', label: 'Local starter' } }),
  [`POST ${e}/ai/copilot`]: () => ({ body: copilotAnswer }),
  [`POST ${e}/ai/copilot/confirm`]: () => ({ status: 201, body: { status: 'applied', type: 'timeline' } }),
  [`POST ${e}/budget`]: (body) => ({ status: 201, body: { ...budgetItem, ...(body as object), id: crypto.randomUUID() } }),
  [`POST ${e}/timeline`]: (body) => ({ status: 201, body: { ...timelineItem, ...(body as object), id: crypto.randomUUID() } }),
  [`POST ${e}/vendors`]: (body) => ({ status: 201, body: { ...vendor, ...(body as object), id: crypto.randomUUID() } }),
};

export interface RecordedCall { method: string; path: string; body: unknown; headers: Record<string, string> }

/** Routes the browser client's fetch calls to in-memory fixtures and records them. */
export function installApiMock(overrides: Record<string, Handler> = {}) {
  const routes = { ...defaultRoutes, ...overrides };
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = url.replace(/^\/api/, '');
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body, headers: (init.headers ?? {}) as Record<string, string> });
    const handler = routes[`${method} ${path}`];
    const result = handler ? handler(body) : { status: method === 'DELETE' ? 204 : 200, body: method === 'GET' ? [] : {} };
    const status = result.status ?? 200;
    return {
      ok: status < 400,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => result.body,
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
