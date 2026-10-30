import { getSupabase } from '../db/client.js';
import { usesSqlite } from '../db/client.js';
import { sqliteGet, sqliteInsert, sqliteList, sqliteRemove, sqliteTransaction, sqliteUpdate } from '../db/sqlite.js';
import { calculateBudgetSummary } from '../utils/budgetCalculations.js';
import type { BudgetItem, CreateBudgetItemPayload, UpdateBudgetItemPayload } from '../../shared/types/budget.js';
import type { TimelineItem, CreateTimelineItemPayload, UpdateTimelineItemPayload } from '../../shared/types/timeline.js';
import type { Vendor, CreateVendorPayload, UpdateVendorPayload } from '../../shared/types/vendor.js';

type TableName = 'budget_items' | 'timeline_items' | 'vendors';

/** Provides typed persistence operations for event planning workspaces. */
export class PlanningService {
  // Shared list logic keeps ordering and event scoping consistent across tables.
  private async list<T>(table: TableName, eventId: string): Promise<T[]> {
    if (usesSqlite()) return sqliteList<T>(table, eventId);
    const { data, error } = await getSupabase().from(table).select('*').eq('event_id', eventId).order('created_at');
    if (error) throw new Error(`Failed to list ${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  async listBudgetItems(eventId: string) { return this.list<BudgetItem>('budget_items', eventId); }
  async listTimelineItems(eventId: string) { return this.list<TimelineItem>('timeline_items', eventId); }
  async listVendors(eventId: string) { return this.list<Vendor>('vendors', eventId); }

  async getBudgetItem(eventId: string, id: string) { return this.get<BudgetItem>('budget_items', eventId, id); }
  async getTimelineItem(eventId: string, id: string) { return this.get<TimelineItem>('timeline_items', eventId, id); }
  async getVendor(eventId: string, id: string) { return this.get<Vendor>('vendors', eventId, id); }

  /** Bulk inserts used when applying an AI plan: one transaction or one round trip per table. */
  async createBudgetItems(eventId: string, items: CreateBudgetItemPayload[]) { return this.insertMany<BudgetItem>('budget_items', eventId, items); }
  async createTimelineItems(eventId: string, items: CreateTimelineItemPayload[]) { return this.insertMany<TimelineItem>('timeline_items', eventId, items); }
  async createVendors(eventId: string, items: CreateVendorPayload[]) { return this.insertMany<Vendor>('vendors', eventId, items); }

  async createBudgetItem(eventId: string, data: CreateBudgetItemPayload) {
    return this.insert<BudgetItem>('budget_items', { ...data, event_id: eventId });
  }

  async updateBudgetItem(eventId: string, id: string, data: UpdateBudgetItemPayload) {
    return this.update<BudgetItem>('budget_items', eventId, id, data);
  }

  async deleteBudgetItem(eventId: string, id: string) { return this.remove('budget_items', eventId, id); }

  async createTimelineItem(eventId: string, data: CreateTimelineItemPayload) {
    return this.insert<TimelineItem>('timeline_items', { ...data, event_id: eventId });
  }

  async updateTimelineItem(eventId: string, id: string, data: UpdateTimelineItemPayload) {
    return this.update<TimelineItem>('timeline_items', eventId, id, data);
  }

  async deleteTimelineItem(eventId: string, id: string) { return this.remove('timeline_items', eventId, id); }

  async createVendor(eventId: string, data: CreateVendorPayload) {
    return this.insert<Vendor>('vendors', { ...data, event_id: eventId });
  }

  async updateVendor(eventId: string, id: string, data: UpdateVendorPayload) {
    return this.update<Vendor>('vendors', eventId, id, data);
  }

  async deleteVendor(eventId: string, id: string) { return this.remove('vendors', eventId, id); }

  calculateSummary(plannedBudget: number, items: BudgetItem[]) {
    return calculateBudgetSummary(plannedBudget, items);
  }

  private async get<T>(table: TableName, eventId: string, id: string): Promise<T | null> {
    if (usesSqlite()) return sqliteGet<T>(table, eventId, id);
    const { data, error } = await getSupabase().from(table).select('*').eq('event_id', eventId).eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    return data as T | null;
  }

  private async insertMany<T>(table: TableName, eventId: string, rows: object[]): Promise<T[]> {
    if (rows.length === 0) return [];
    if (usesSqlite()) {
      return sqliteTransaction(() => rows.map((row) => sqliteInsert<T>(table, eventId, row as Record<string, unknown>)));
    }
    const { data, error } = await getSupabase().from(table).insert(rows.map((row) => ({ ...row, event_id: eventId }))).select();
    if (error) throw new Error(`Failed to create ${table}: ${error.message}`);
    return (data ?? []) as T[];
  }

  private async insert<T>(table: TableName, payload: Record<string, unknown>): Promise<T> {
    if (usesSqlite()) {
      const { event_id, ...data } = payload;
      return sqliteInsert<T>(table, String(event_id), data);
    }
    const { data, error } = await getSupabase().from(table).insert(payload).select().single();
    if (error) throw new Error(`Failed to create ${table}: ${error.message}`);
    return data as T;
  }

  private async update<T>(table: TableName, eventId: string, id: string, payload: object): Promise<T | null> {
    if (usesSqlite()) return sqliteUpdate<T>(table, eventId, id, payload as Record<string, unknown>);
    const { data, error } = await getSupabase().from(table).update(payload).eq('event_id', eventId).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`Failed to update ${table}: ${error.message}`);
    return data as T | null;
  }

  private async remove(table: TableName, eventId: string, id: string): Promise<boolean> {
    if (usesSqlite()) return sqliteRemove(table, eventId, id);
    const { error } = await getSupabase().from(table).delete().eq('event_id', eventId).eq('id', id);
    if (error) throw new Error(`Failed to delete ${table}: ${error.message}`);
    return true;
  }
}

export const planningService = new PlanningService();
