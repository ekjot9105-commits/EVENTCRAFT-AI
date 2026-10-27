import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Event, CreateEventPayload, UpdateEventPayload } from '../../shared/types/event.js';
import type { Idea, CreateIdeaPayload, UpdateIdeaPayload } from '../../shared/types/idea.js';
import type { IdeaStatus } from '../../shared/constants/statusEnums.js';

type SqliteRow = Record<string, unknown>;

const databasePath = resolve(process.env['SQLITE_PATH'] || 'data/eventcraft.sqlite');
let database: DatabaseSync | null = null;

/** Provides the local, file-backed database used when Supabase is not configured. */
export function getSqlite(): DatabaseSync {
  if (database) return database;
  mkdirSync(dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL DEFAULT 'demo-local-owner', type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      date TEXT, guest_count INTEGER, location TEXT, budget_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD', metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS budget_items (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category TEXT NOT NULL, name TEXT NOT NULL, estimated_cost REAL NOT NULL DEFAULT 0,
      actual_cost REAL, paid INTEGER NOT NULL DEFAULT 0, notes TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS timeline_items (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT, due_date TEXT, status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category TEXT NOT NULL, name TEXT NOT NULL, contact_name TEXT, phone TEXT, email TEXT,
      website TEXT, status TEXT NOT NULL DEFAULT 'not_started', quoted_cost REAL, final_cost REAL,
      notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      category TEXT NOT NULL, title TEXT NOT NULL, description TEXT, estimated_cost REAL,
      status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_plans (
      plan_id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      plan_json TEXT NOT NULL, generated_at TEXT NOT NULL, applied_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_budget_event ON budget_items(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_timeline_event ON timeline_items(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_vendors_event ON vendors(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_ideas_event ON ideas(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_ai_plans_event ON ai_plans(event_id, generated_at);
  `);
  try { database.exec("ALTER TABLE events ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'demo-local-owner'"); } catch { /* Existing databases already have the column. */ }
  return database;
}

export function resetSqlite(): void {
  database?.close();
  database = null;
}

const now = () => new Date().toISOString();
const toSqlValue = (value: unknown): SQLInputValue => {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return JSON.stringify(value);
};
const parseMetadata = (value: unknown): Record<string, unknown> => {
  try { return JSON.parse(String(value || '{}')) as Record<string, unknown>; }
  catch { return {}; }
};
const eventRow = (row: SqliteRow): Event => ({ ...row, metadata: parseMetadata(row['metadata']) } as Event);
const booleanRow = <T extends SqliteRow>(row: T): T => ({ ...row, paid: Boolean(row['paid']) });

export function sqliteCreateEvent(data: CreateEventPayload, ownerId = 'demo-local-owner'): Event {
  const timestamp = now();
  const id = randomUUID();
  getSqlite().prepare(`INSERT INTO events (id,owner_id,type,title,description,date,guest_count,location,budget_amount,currency,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ownerId, data.type, data.title, data.description ?? null, data.date ?? null, data.guest_count ?? null, data.location ?? null, data.budget_amount ?? 0, data.currency ?? 'USD', JSON.stringify(data.metadata ?? {}), timestamp, timestamp);
  return sqliteGetEvent(id) as Event;
}
export function sqliteGetEvent(id: string, ownerId?: string): Event | null {
  const row = getSqlite().prepare(ownerId ? 'SELECT * FROM events WHERE id = ? AND owner_id = ?' : 'SELECT * FROM events WHERE id = ?').get(...(ownerId ? [id, ownerId] : [id])) as SqliteRow | undefined;
  return row ? eventRow(row) : null;
}
export function sqliteListEvents(ownerId = 'demo-local-owner'): Event[] {
  return (getSqlite().prepare('SELECT * FROM events WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId) as SqliteRow[]).map(eventRow);
}
export function sqliteUpdateEvent(id: string, data: UpdateEventPayload, ownerId?: string): Event | null {
  const current = sqliteGetEvent(id, ownerId);
  if (!current) return null;
  const next = { ...current, ...data, metadata: data.metadata ?? current.metadata, updated_at: now() };
  getSqlite().prepare(`UPDATE events SET title=?,description=?,date=?,guest_count=?,location=?,budget_amount=?,currency=?,metadata=?,updated_at=? WHERE id=? AND owner_id=?`)
    .run(next.title, next.description, next.date, next.guest_count, next.location, next.budget_amount, next.currency, JSON.stringify(next.metadata), next.updated_at, id, ownerId ?? 'demo-local-owner');
  return sqliteGetEvent(id, ownerId);
}
export function sqliteDeleteEvent(id: string, ownerId = 'demo-local-owner'): boolean {
  getSqlite().prepare('DELETE FROM events WHERE id = ? AND owner_id = ?').run(id, ownerId);
  return true;
}

type PlanningTable = 'budget_items' | 'timeline_items' | 'vendors';
export function sqliteList<T>(table: PlanningTable, eventId: string): T[] {
  const rows = getSqlite().prepare(`SELECT * FROM ${table} WHERE event_id = ? ORDER BY created_at`).all(eventId) as SqliteRow[];
  return (table === 'budget_items' ? rows.map(booleanRow) : rows) as T[];
}
export function sqliteInsert<T>(table: PlanningTable, eventId: string, data: Record<string, unknown>): T {
  const id = randomUUID();
  const timestamp = now();
  const columns = ['id', 'event_id', ...Object.keys(data), 'created_at', 'updated_at'];
  const values = [id, eventId, ...Object.values(data), timestamp, timestamp].map(toSqlValue);
  getSqlite().prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...values);
  const row = getSqlite().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as SqliteRow;
  return (table === 'budget_items' ? booleanRow(row) : row) as T;
}
export function sqliteUpdate<T>(table: PlanningTable, eventId: string, id: string, data: Record<string, unknown>): T | null {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  const values = entries.map(([, value]) => toSqlValue(value));
  getSqlite().prepare(`UPDATE ${table} SET ${entries.map(([key]) => `${key} = ?`).join(',')}, updated_at = ? WHERE event_id = ? AND id = ?`).run(...values, now(), eventId, id);
  const row = getSqlite().prepare(`SELECT * FROM ${table} WHERE event_id = ? AND id = ?`).get(eventId, id) as SqliteRow | undefined;
  return row ? (table === 'budget_items' ? booleanRow(row) : row) as T : null;
}
export function sqliteRemove(table: PlanningTable, eventId: string, id: string): boolean {
  getSqlite().prepare(`DELETE FROM ${table} WHERE event_id = ? AND id = ?`).run(eventId, id);
  return true;
}

export function sqliteStorePlan(eventId: string, planId: string, plan: unknown, generatedAt: string): void {
  getSqlite().prepare('INSERT INTO ai_plans (plan_id,event_id,plan_json,generated_at,applied_at) VALUES (?,?,?,?,NULL)')
    .run(planId, eventId, JSON.stringify(plan), generatedAt);
}

export function sqliteListPlans(eventId: string): Array<{ plan_id: string; event_id: string; generated_at: string; applied_at: string | null; plan: unknown }> {
  const rows = getSqlite().prepare('SELECT * FROM ai_plans WHERE event_id = ? ORDER BY generated_at DESC').all(eventId) as SqliteRow[];
  return rows.map((row) => ({ plan_id: String(row['plan_id']), event_id: String(row['event_id']), generated_at: String(row['generated_at']), applied_at: row['applied_at'] ? String(row['applied_at']) : null, plan: JSON.parse(String(row['plan_json'])) as unknown }));
}

export function sqliteMarkPlanApplied(eventId: string, planId: string): void {
  getSqlite().prepare('UPDATE ai_plans SET applied_at = ? WHERE event_id = ? AND plan_id = ?').run(now(), eventId, planId);
}

export function sqliteListIdeas(eventId: string): Idea[] {
  return getSqlite().prepare('SELECT * FROM ideas WHERE event_id = ? ORDER BY created_at DESC').all(eventId) as unknown as Idea[];
}
export function sqliteCreateIdea(eventId: string, data: CreateIdeaPayload): Idea {
  const idea: Idea = { id: randomUUID(), event_id: eventId, category: data.category, title: data.title, description: data.description ?? null, estimated_cost: data.estimated_cost ?? null, status: 'new' as IdeaStatus, created_at: now() };
  getSqlite().prepare('INSERT INTO ideas (id,event_id,category,title,description,estimated_cost,status,created_at) VALUES (?,?,?,?,?,?,?,?)').run(idea.id, idea.event_id, idea.category, idea.title, idea.description, idea.estimated_cost, idea.status, idea.created_at);
  return idea;
}
export function sqliteUpdateIdea(eventId: string, id: string, data: UpdateIdeaPayload): Idea | null {
  getSqlite().prepare('UPDATE ideas SET status = ? WHERE event_id = ? AND id = ?').run(data.status, eventId, id);
  return getSqlite().prepare('SELECT * FROM ideas WHERE event_id = ? AND id = ?').get(eventId, id) as unknown as Idea | null;
}
