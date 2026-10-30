import { beforeAll, describe, expect, it } from 'vitest';
import { eventService } from '../../src/server/services/eventService';
import { planningService } from '../../src/server/services/planningService';
import { sqliteGet, sqliteInsert, sqliteTransaction, sqliteUpdate } from '../../src/server/db/sqlite';
import type { BudgetItem } from '../../src/shared/types/budget';

describe('SQLite persistence safety', () => {
  let eventId: string;

  beforeAll(async () => {
    eventId = (await eventService.create({ type: 'community', title: 'Park cleanup', budget_amount: 500 }, 'sqlite-safety-owner')).id;
  });

  it('ignores column names outside the allowlist instead of interpolating them into SQL', () => {
    const hostile = { name: 'Gloves', category: 'Supplies', estimated_cost: 40, 'id = id; DROP TABLE events; --': 'x', event_id: 'other-event' };
    const row = sqliteInsert<BudgetItem>('budget_items', eventId, hostile);
    expect(row).toMatchObject({ name: 'Gloves', event_id: eventId });

    const updated = sqliteUpdate<BudgetItem>('budget_items', eventId, row.id, { name: 'Work gloves', 'paid = 1 --': true });
    expect(updated).toMatchObject({ name: 'Work gloves', paid: false });
  });

  it('returns the current row when an update has nothing writable', () => {
    const row = sqliteInsert<BudgetItem>('budget_items', eventId, { name: 'Bags', category: 'Supplies', estimated_cost: 10 });
    expect(sqliteUpdate<BudgetItem>('budget_items', eventId, row.id, {})).toMatchObject({ id: row.id, name: 'Bags' });
  });

  it('rolls back every row of a failed batch', async () => {
    const before = (await planningService.listBudgetItems(eventId)).length;
    let insertedId = '';
    expect(() => sqliteTransaction(() => {
      insertedId = sqliteInsert<BudgetItem>('budget_items', eventId, { name: 'Rakes', category: 'Supplies', estimated_cost: 60 }).id;
      throw new Error('simulated failure');
    })).toThrow('simulated failure');
    expect(sqliteGet('budget_items', eventId, insertedId)).toBeNull();
    expect(await planningService.listBudgetItems(eventId)).toHaveLength(before);
  });

  it('bulk-creates planning records and reads them back by id', async () => {
    const created = await planningService.createTimelineItems(eventId, [{ title: 'Recruit volunteers' }, { title: 'Order supplies' }]);
    expect(created).toHaveLength(2);
    await expect(planningService.getTimelineItem(eventId, created[0]!.id)).resolves.toMatchObject({ title: 'Recruit volunteers' });
    await expect(planningService.getTimelineItem('00000000-0000-4000-8000-000000000000', created[0]!.id)).resolves.toBeNull();
    expect(await planningService.createVendors(eventId, [])).toEqual([]);
  });
});
