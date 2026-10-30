import type { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { planningService } from '../services/planningService.js';
import { validateTimelineSchedule } from '../utils/timelineSchedule.js';
import {
  createBudgetItemSchema,
  updateBudgetItemSchema,
  createTimelineItemSchema,
  updateTimelineItemSchema,
  createVendorSchema,
  updateVendorSchema,
} from '../../shared/schemas/planning.schema.js';
import type { Event } from '../../shared/types/event.js';
import type { CopilotResponse } from './schemas.js';

export type CopilotProposal = NonNullable<CopilotResponse['proposal']>;
type ResourceType = 'budget' | 'timeline' | 'vendor';
type Row = { id: string } & Record<string, unknown>;

export interface AppliedProposal {
  httpStatus: 200 | 201;
  body: { status: 'applied'; type: ResourceType; item: unknown };
}

/** Per-resource adapters let every proposal action share one validated apply path. */
interface ResourceAdapter {
  label: string;
  createSchema: z.ZodType;
  updateSchema: z.ZodType;
  get(eventId: string, id: string): Promise<Row | null>;
  create(eventId: string, data: never): Promise<unknown>;
  update(eventId: string, id: string, data: never): Promise<unknown>;
}

const adapters: Record<ResourceType, ResourceAdapter> = {
  budget: {
    label: 'budget item',
    createSchema: createBudgetItemSchema,
    updateSchema: updateBudgetItemSchema,
    get: (eventId, id) => planningService.getBudgetItem(eventId, id) as unknown as Promise<Row | null>,
    create: (eventId, data) => planningService.createBudgetItem(eventId, data),
    update: (eventId, id, data) => planningService.updateBudgetItem(eventId, id, data),
  },
  timeline: {
    label: 'timeline milestone',
    createSchema: createTimelineItemSchema,
    updateSchema: updateTimelineItemSchema,
    get: (eventId, id) => planningService.getTimelineItem(eventId, id) as unknown as Promise<Row | null>,
    create: (eventId, data) => planningService.createTimelineItem(eventId, data),
    update: (eventId, id, data) => planningService.updateTimelineItem(eventId, id, data),
  },
  vendor: {
    label: 'vendor',
    createSchema: createVendorSchema,
    updateSchema: updateVendorSchema,
    get: (eventId, id) => planningService.getVendor(eventId, id) as unknown as Promise<Row | null>,
    create: (eventId, data) => planningService.createVendor(eventId, data),
    update: (eventId, id, data) => planningService.updateVendor(eventId, id, data),
  },
};

const actions: Record<CopilotProposal['action'], { type: ResourceType; mode: 'create' | 'update' }> = {
  add_budget: { type: 'budget', mode: 'create' },
  update_budget: { type: 'budget', mode: 'update' },
  add_timeline: { type: 'timeline', mode: 'create' },
  update_timeline: { type: 'timeline', mode: 'update' },
  add_vendor: { type: 'vendor', mode: 'create' },
  update_vendor: { type: 'vendor', mode: 'update' },
};

const staleError = (label: string) => new AppError(409, `The proposal is stale or the ${label} no longer exists.`);

/** True when every value the model saw is still what the database holds (compare-and-swap). */
function matchesCurrentValue(row: Row, expected: CopilotProposal['current_value']): boolean {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => row[key] === value);
}

/**
 * Applies a server-stored Copilot proposal after re-validating it against the same
 * schemas and business rules as the regular planning routes.
 */
export async function applyProposal(event: Event, proposal: CopilotProposal): Promise<AppliedProposal> {
  const { type, mode } = actions[proposal.action];
  const adapter = adapters[type];
  const schema = mode === 'create' ? adapter.createSchema : adapter.updateSchema;
  const parsed = schema.safeParse(proposal.proposed_value);
  if (!parsed.success) throw new AppError(400, `The proposed ${adapter.label} is invalid.`);

  const data = parsed.data as Record<string, unknown>;
  if (type === 'timeline') {
    const scheduleError = validateTimelineSchedule(event.date, data['due_date'] as string | null | undefined);
    if (scheduleError) throw new AppError(400, scheduleError);
  }

  if (mode === 'create') {
    const item = await adapter.create(event.id, data as never);
    return { httpStatus: 201, body: { status: 'applied', type, item } };
  }

  if (!proposal.target_id) throw new AppError(400, `The proposed ${adapter.label} update has no target.`);
  const current = await adapter.get(event.id, proposal.target_id);
  if (!current || !matchesCurrentValue(current, proposal.current_value)) throw staleError(adapter.label);

  const item = await adapter.update(event.id, proposal.target_id, data as never);
  if (!item) throw staleError(adapter.label);
  return { httpStatus: 200, body: { status: 'applied', type, item } };
}
