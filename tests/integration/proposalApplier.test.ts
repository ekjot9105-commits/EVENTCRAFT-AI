import { beforeAll, describe, expect, it } from 'vitest';
import { applyProposal, type CopilotProposal } from '../../src/server/ai/proposalApplier';
import { eventService } from '../../src/server/services/eventService';
import { planningService } from '../../src/server/services/planningService';
import { AppError } from '../../src/server/middleware/errorHandler';
import type { Event } from '../../src/shared/types/event';

const OWNER = 'proposal-applier-owner';

function proposal(overrides: Partial<CopilotProposal>): CopilotProposal {
  return {
    action: 'add_budget',
    explanation: 'Test proposal',
    target_id: null,
    current_value: null,
    expected_budget_impact: 0,
    proposed_value: {},
    requires_confirmation: true,
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, statusCode: number, message: RegExp) {
  const error = await promise.then(() => null, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).statusCode).toBe(statusCode);
  expect((error as AppError).message).toMatch(message);
}

describe('Copilot proposal applier', () => {
  let event: Event;

  beforeAll(async () => {
    event = await eventService.create(
      { type: 'wedding', title: 'Applier Wedding', date: '2026-12-10T00:00:00.000Z', budget_amount: 20000, currency: 'USD' },
      OWNER,
    );
  });

  it('creates budget, timeline, and vendor records from add_* proposals', async () => {
    const budget = await applyProposal(event, proposal({
      action: 'add_budget',
      proposed_value: { category: 'Decor', name: 'Flowers', estimated_cost: 900 },
    }));
    const timeline = await applyProposal(event, proposal({
      action: 'add_timeline',
      proposed_value: { title: 'Final walkthrough', due_date: '2026-12-05T10:00:00.000Z' },
    }));
    const vendor = await applyProposal(event, proposal({
      action: 'add_vendor',
      proposed_value: { category: 'Music', name: 'DJ Nova', quoted_cost: 1200 },
    }));

    expect([budget.httpStatus, timeline.httpStatus, vendor.httpStatus]).toEqual([201, 201, 201]);
    expect(budget.body).toMatchObject({ status: 'applied', type: 'budget', item: { name: 'Flowers' } });
    expect(timeline.body.type).toBe('timeline');
    expect(vendor.body.type).toBe('vendor');
  });

  it('updates a budget item only while it still matches what the model saw', async () => {
    const item = await planningService.createBudgetItem(event.id, { category: 'Venue', name: 'Hall', estimated_cost: 8000, notes: 'Deposit due' });

    const applied = await applyProposal(event, proposal({
      action: 'update_budget',
      target_id: item.id,
      current_value: { estimated_cost: 8000 },
      proposed_value: { estimated_cost: 7200, notes: null },
    }));
    expect(applied.httpStatus).toBe(200);
    // An explicit null clears the field instead of being silently ignored.
    expect(applied.body.item).toMatchObject({ estimated_cost: 7200, notes: null });

    await expectAppError(applyProposal(event, proposal({
      action: 'update_budget',
      target_id: item.id,
      current_value: { estimated_cost: 8000 },
      proposed_value: { estimated_cost: 6000 },
    })), 409, /stale/);
  });

  it('applies the same stale check to timeline and vendor updates', async () => {
    const milestone = await planningService.createTimelineItem(event.id, { title: 'Send invites' });
    const vendor = await planningService.createVendor(event.id, { category: 'Photo', name: 'Lens Co', quoted_cost: 1500 });

    await expectAppError(applyProposal(event, proposal({
      action: 'update_timeline',
      target_id: milestone.id,
      current_value: { title: 'Something else' },
      proposed_value: { status: 'completed' },
    })), 409, /timeline milestone/);

    const updatedVendor = await applyProposal(event, proposal({
      action: 'update_vendor',
      target_id: vendor.id,
      current_value: { quoted_cost: 1500 },
      proposed_value: { quoted_cost: 1350, status: 'booked' },
    }));
    expect(updatedVendor.body.item).toMatchObject({ quoted_cost: 1350, status: 'booked' });
  });

  it('rejects targets that do not exist or belong to another event', async () => {
    await expectAppError(applyProposal(event, proposal({
      action: 'update_vendor',
      target_id: '00000000-0000-4000-8000-000000000000',
      proposed_value: { name: 'Ghost' },
    })), 409, /vendor no longer exists/);

    await expectAppError(applyProposal(event, proposal({
      action: 'update_budget',
      target_id: null,
      proposed_value: { estimated_cost: 1 },
    })), 400, /no target/);
  });

  it('re-validates model output against the shared schemas and schedule rules', async () => {
    await expectAppError(applyProposal(event, proposal({
      action: 'add_budget',
      proposed_value: { category: 'Decor', name: '', estimated_cost: -5 },
    })), 400, /invalid/);

    await expectAppError(applyProposal(event, proposal({
      action: 'add_timeline',
      proposed_value: { title: 'Way too late', due_date: '2027-06-01T00:00:00.000Z' },
    })), 400, /30 days/);
  });
});
