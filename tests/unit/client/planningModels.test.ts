import { describe, expect, it } from 'vitest';
import { countByUrgency, getUrgency, starterMilestones } from '../../../src/client/features/planning/timelineModel';
import { buildBudgetSlices } from '../../../src/client/shared/components/budgetSlices';
import { formatMoney } from '../../../src/client/shared/utils/formatMoney';
import { confirmationMessage } from '../../../src/client/features/assistant/copilotPrompts';
import { budgetItem, timelineItem } from './apiMock';

const now = new Date('2026-11-10T12:00:00.000Z');
const at = (due_date: string | null, status: 'pending' | 'completed' = 'pending') => ({ ...timelineItem, due_date, status });

describe('timeline urgency', () => {
  it.each([
    [at('2026-11-01T00:00:00.000Z'), 'Overdue'],
    [at('2026-11-14T00:00:00.000Z'), 'Due this week'],
    [at('2026-12-20T00:00:00.000Z'), 'Upcoming'],
    [at(null), 'Upcoming'],
    [at('2026-11-01T00:00:00.000Z', 'completed'), 'Completed'],
  ] as const)('classifies %j as %s', (item, expected) => {
    expect(getUrgency(item, now)).toBe(expected);
  });

  it('counts every bucket', () => {
    const counts = countByUrgency([at('2026-11-01T00:00:00.000Z'), at('2026-11-14T00:00:00.000Z'), at(null, 'completed')], now);
    expect(counts).toEqual({ Overdue: 1, 'Due this week': 1, Upcoming: 0, Completed: 1 });
  });

  it('schedules starter milestones before the event and never in the past', () => {
    const milestones = starterMilestones('2026-12-31T00:00:00.000Z', now.getTime());
    expect(milestones).toHaveLength(5);
    const times = milestones.map((m) => new Date(m.due_date).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.min(...times)).toBeGreaterThan(now.getTime());

    const soon = starterMilestones('2026-11-12T00:00:00.000Z', now.getTime());
    expect(soon.every((m) => new Date(m.due_date).getTime() > now.getTime())).toBe(true);
  });
});

describe('budget donut slices', () => {
  it('groups by category and covers the full circle', () => {
    const slices = buildBudgetSlices([
      { ...budgetItem, category: 'Venue', estimated_cost: 600 },
      { ...budgetItem, category: 'Venue', estimated_cost: 200 },
      { ...budgetItem, category: 'Mystery', estimated_cost: 200 },
    ]);
    expect(slices.map((slice) => [slice.category, slice.amount])).toEqual([['Venue', 800], ['Mystery', 200]]);
    expect(slices[0]!.percent).toBeCloseTo(0.8);
    expect(slices.at(-1)!.endAngle).toBeCloseTo(Math.PI * 2);
    expect(slices[1]!.color).toMatch(/^#/);
  });

  it('returns no slices for an empty budget', () => {
    expect(buildBudgetSlices([])).toEqual([]);
  });
});

describe('formatting helpers', () => {
  it('formats money in the event currency', () => {
    expect(formatMoney(1500, 'INR')).toMatch(/₹|INR/);
    expect(formatMoney(1500, 'EUR')).toMatch(/€|EUR/);
    expect(formatMoney(12, 'NOT-A-CODE')).toBe('NOT-A-CODE 12.00');
  });

  it('describes confirmed Copilot actions in plain language', () => {
    expect(confirmationMessage('add_timeline')).toMatch(/timeline/);
    expect(confirmationMessage('update_vendor')).toMatch(/vendor/);
    expect(confirmationMessage('add_budget')).toMatch(/budget/);
  });
});
