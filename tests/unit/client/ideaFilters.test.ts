import { describe, expect, it } from 'vitest';
import { filterIdeas } from '../../../src/client/features/ideas/ideaFilters';
import type { Idea } from '../../../src/shared/types/idea';

const idea = (overrides: Partial<Idea>): Idea => ({
  id: '55555555-5555-4555-8555-555555555555',
  event_id: '11111111-1111-4111-8111-111111111111',
  category: 'Decor',
  title: 'Lantern walkway',
  description: 'Warm lights for an interactive guest activity.',
  estimated_cost: 120,
  status: 'new',
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('filterIdeas', () => {
  it('removes dismissed ideas and returns all active ideas for the all tag', () => {
    expect(filterIdeas([idea({}), idea({ id: '66666666-6666-4666-8666-666666666666', status: 'dismissed' })], '#All')).toHaveLength(1);
  });

  it('matches concepts using title, description, category, and cost', () => {
    expect(filterIdeas([idea({})], '#BudgetFriendly')).toHaveLength(1);
    expect(filterIdeas([idea({})], '#Decor')).toHaveLength(1);
    expect(filterIdeas([idea({})], '#Interactive')).toHaveLength(1);
    expect(filterIdeas([idea({ description: 'A formal venue contract', estimated_cost: 1000 })], '#Food & Drink')).toHaveLength(0);
  });
});
