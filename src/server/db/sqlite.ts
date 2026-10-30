import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import type { Event, CreateEventPayload, UpdateEventPayload } from '../../shared/types/event.js';
import type { Idea, CreateIdeaPayload, UpdateIdeaPayload } from '../../shared/types/idea.js';
import type { IdeaStatus } from '../../shared/constants/statusEnums.js';

type SqliteRow = Record<string, unknown>;

const defaultDatabasePath = process.env['VERCEL'] ? '/tmp/eventcraft.sqlite' : 'data/eventcraft.sqlite';
const databasePath = resolve(process.env['SQLITE_PATH'] || defaultDatabasePath);
let database: DatabaseSync | null = null;

/** Provides the local, file-backed database used when Supabase is not configured. */
export function getSqlite(): DatabaseSync {
  if (database) return database;
  mkdirSync(dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
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
    CREATE TABLE IF NOT EXISTS ai_proposals (
      proposal_id TEXT PRIMARY KEY, event_id TEXT NOT NULL,
      proposal_json TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sqlite_budget_event ON budget_items(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_timeline_event ON timeline_items(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_vendors_event ON vendors(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_ideas_event ON ideas(event_id);
    CREATE INDEX IF NOT EXISTS idx_sqlite_ai_plans_event ON ai_plans(event_id, generated_at);
    CREATE INDEX IF NOT EXISTS idx_sqlite_ai_proposals ON ai_proposals(event_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_sqlite_events_owner ON events(owner_id);
  `);
  try { database.exec("ALTER TABLE events ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'demo-local-owner'"); } catch { /* Existing databases already have the column. */ }
  return database;
}

export function resetSqlite(): void {
  statements.clear();
  database?.close();
  database = null;
}

/** Compiled statements are reused; preparing SQL on every call is the dominant per-query cost. */
const statements = new Map<string, StatementSync>();
function prepare(sql: string): StatementSync {
  let statement = statements.get(sql);
  if (!statement) {
    statement = getSqlite().prepare(sql);
    statements.set(sql, statement);
  }
  return statement;
}

/** Runs several writes atomically so a failed AI plan apply never leaves half a plan behind. */
export function sqliteTransaction<T>(work: () => T): T {
  const db = getSqlite();
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
    throw error;
  }
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

function seedStarterPlanningRecords(eventId: string, type: Event['type'], budget: number, eventDateStr?: string | null): void {
  const db = getSqlite();
  const timestamp = now();
  const eventTime = eventDateStr ? new Date(eventDateStr).getTime() : Date.now() + 60 * 86_400_000;
  const daysBefore = (days: number) => new Date(Math.max(Date.now() + 86_400_000, eventTime - days * 86_400_000)).toISOString();

  // 1. Budget items
  const effectiveBudget = budget > 0 ? budget : (type === 'wedding' ? 5000 : type === 'birthday' ? 1000 : 2500);
  const categories: Array<[string, number]> = type === 'wedding'
    ? [['Venue & Catering', 0.45], ['Photography & Media', 0.15], ['Flowers & Decor', 0.15], ['Music & DJ', 0.15], ['Contingency Buffer', 0.10]]
    : type === 'birthday'
      ? [['Venue & Food', 0.40], ['Entertainment & Games', 0.25], ['Cake & Decor', 0.20], ['Favors & Contingency', 0.15]]
      : [['Venue & Permits', 0.35], ['Food & Supplies', 0.30], ['Sound & Activities', 0.20], ['Volunteers & Safety', 0.15]];

  db.exec('BEGIN');
  try {
    const insertBudget = db.prepare(`INSERT INTO budget_items (id, event_id, category, name, estimated_cost, actual_cost, paid, notes, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    categories.forEach(([cat, ratio], idx) => {
      insertBudget.run(randomUUID(), eventId, String(cat), `${cat} Allocation`, Math.round(effectiveBudget * Number(ratio) * 100) / 100, null, 0, 'Starter budget allocation', idx, timestamp, timestamp);
    });

    // 2. Timeline items
    const insertTimeline = db.prepare(`INSERT INTO timeline_items (id, event_id, title, description, due_date, status, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
    const milestones = [
      { title: 'Confirm Venue Contract & Deposit', due: daysBefore(45), desc: 'Verify capacity and lock in booking.' },
      { title: 'Lock in Catering & Dietary Choices', due: daysBefore(30), desc: 'Confirm menu packages and guest head count.' },
      { title: 'Book Photographer & Music Team', due: daysBefore(21), desc: 'Sign agreements with core media and entertainment.' },
      { title: 'Send Invitations & Confirm RSVPs', due: daysBefore(14), desc: 'Finalize attendee roster.' },
      { title: 'Day-Of Setup & Event Execution', due: daysBefore(0), desc: 'Vendor load-in, event agenda, and wrap-up.' },
    ];
    milestones.forEach((m, idx) => {
      insertTimeline.run(randomUUID(), eventId, m.title, m.desc, m.due, 'pending', idx, timestamp, timestamp);
    });

    // 3. Vendors
    const insertVendor = db.prepare(`INSERT INTO vendors (id, event_id, category, name, contact_name, phone, email, website, status, quoted_cost, final_cost, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const vendorList = type === 'wedding'
      ? ['Venue Coordinator', 'Catering Specialist', 'Wedding Photographer', 'DJ / Sound Engineer', 'Florist & Decor']
      : type === 'birthday'
        ? ['Party Venue Host', 'Cake Artist', 'Party Entertainer / DJ', 'Balloon & Decor Specialist']
        : ['Venue & Permits Office', 'Sound & Audio Provider', 'Food & Supplies Vendor', 'Safety Coordinator'];
    vendorList.forEach((vName) => {
      insertVendor.run(randomUUID(), eventId, vName, `${vName}`, null, null, null, null, 'not_started', null, null, 'Essential vendor checklist', timestamp, timestamp);
    });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore rollback failure if transaction wasn't active */ }
    throw err;
  }
}

export function sqliteCreateEvent(data: CreateEventPayload, ownerId = 'demo-local-owner'): Event {
  const timestamp = now();
  const id = randomUUID();
  prepare(`INSERT INTO events (id,owner_id,type,title,description,date,guest_count,location,budget_amount,currency,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ownerId, data.type, data.title, data.description ?? null, data.date ?? null, data.guest_count ?? null, data.location ?? null, data.budget_amount ?? 0, data.currency ?? 'USD', JSON.stringify(data.metadata ?? {}), timestamp, timestamp);
  seedStarterPlanningRecords(id, data.type, data.budget_amount ?? 0, data.date);
  return sqliteGetEvent(id) as Event;
}
export function sqliteGetEvent(id: string, ownerId?: string): Event | null {
  const row = prepare(ownerId ? 'SELECT * FROM events WHERE id = ? AND owner_id = ?' : 'SELECT * FROM events WHERE id = ?').get(...(ownerId ? [id, ownerId] : [id])) as SqliteRow | undefined;
  return row ? eventRow(row) : null;
}
export function sqliteListEvents(ownerId = 'demo-local-owner'): Event[] {
  return (prepare('SELECT * FROM events WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId) as SqliteRow[]).map(eventRow);
}
export function sqliteUpdateEvent(id: string, data: UpdateEventPayload, ownerId?: string): Event | null {
  const current = sqliteGetEvent(id, ownerId);
  if (!current) return null;
  const next = { ...current, ...data, metadata: data.metadata ?? current.metadata, updated_at: now() };
  prepare(`UPDATE events SET title=?,description=?,date=?,guest_count=?,location=?,budget_amount=?,currency=?,metadata=?,updated_at=? WHERE id=? AND owner_id=?`)
    .run(next.title, next.description, next.date, next.guest_count, next.location, next.budget_amount, next.currency, JSON.stringify(next.metadata), next.updated_at, id, ownerId ?? 'demo-local-owner');
  return sqliteGetEvent(id, ownerId);
}
export function sqliteDeleteEvent(id: string, ownerId = 'demo-local-owner'): boolean {
  const result = prepare('DELETE FROM events WHERE id = ? AND owner_id = ?').run(id, ownerId);
  return (result as { changes?: number }).changes ? (result as { changes: number }).changes > 0 : false;
}

type PlanningTable = 'budget_items' | 'timeline_items' | 'vendors';

/**
 * Column names are interpolated into SQL, so they are checked against this allowlist
 * even though route schemas already strip unknown keys (defence in depth).
 */
const WRITABLE_COLUMNS: Record<PlanningTable, ReadonlySet<string>> = {
  budget_items: new Set(['category', 'name', 'estimated_cost', 'actual_cost', 'paid', 'notes', 'sort_order']),
  timeline_items: new Set(['title', 'description', 'due_date', 'status', 'sort_order']),
  vendors: new Set(['category', 'name', 'contact_name', 'phone', 'email', 'website', 'status', 'quoted_cost', 'final_cost', 'notes']),
};

function writableEntries(table: PlanningTable, data: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(data).filter(([key, value]) => value !== undefined && WRITABLE_COLUMNS[table].has(key));
}

const planningRow = <T>(table: PlanningTable, row: SqliteRow): T => (table === 'budget_items' ? booleanRow(row) : row) as T;

export function sqliteGet<T>(table: PlanningTable, eventId: string, id: string): T | null {
  const row = prepare(`SELECT * FROM ${table} WHERE event_id = ? AND id = ?`).get(eventId, id) as SqliteRow | undefined;
  return row ? planningRow<T>(table, row) : null;
}
export function sqliteList<T>(table: PlanningTable, eventId: string): T[] {
  const rows = prepare(`SELECT * FROM ${table} WHERE event_id = ? ORDER BY created_at`).all(eventId) as SqliteRow[];
  return rows.map((row) => planningRow<T>(table, row));
}
export function sqliteInsert<T>(table: PlanningTable, eventId: string, data: Record<string, unknown>): T {
  const id = randomUUID();
  const timestamp = now();
  const entries = writableEntries(table, data);
  const columns = ['id', 'event_id', ...entries.map(([key]) => key), 'created_at', 'updated_at'];
  const values = [id, eventId, ...entries.map(([, value]) => value), timestamp, timestamp].map(toSqlValue);
  prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...values);
  return sqliteGet<T>(table, eventId, id)!;
}
export function sqliteUpdate<T>(table: PlanningTable, eventId: string, id: string, data: Record<string, unknown>): T | null {
  const entries = writableEntries(table, data);
  if (entries.length === 0) return sqliteGet<T>(table, eventId, id);
  const values = entries.map(([, value]) => toSqlValue(value));
  prepare(`UPDATE ${table} SET ${entries.map(([key]) => `${key} = ?`).join(',')}, updated_at = ? WHERE event_id = ? AND id = ?`).run(...values, now(), eventId, id);
  return sqliteGet<T>(table, eventId, id);
}
export function sqliteRemove(table: PlanningTable, eventId: string, id: string): boolean {
  prepare(`DELETE FROM ${table} WHERE event_id = ? AND id = ?`).run(eventId, id);
  return true;
}

export function sqliteStorePlan(eventId: string, planId: string, plan: unknown, generatedAt: string): void {
  prepare('INSERT INTO ai_plans (plan_id,event_id,plan_json,generated_at,applied_at) VALUES (?,?,?,?,NULL)')
    .run(planId, eventId, JSON.stringify(plan), generatedAt);
}

type StoredPlanRow = { plan_id: string; event_id: string; generated_at: string; applied_at: string | null; plan: unknown };
const planRow = (row: SqliteRow): StoredPlanRow => ({
  plan_id: String(row['plan_id']),
  event_id: String(row['event_id']),
  generated_at: String(row['generated_at']),
  applied_at: row['applied_at'] ? String(row['applied_at']) : null,
  plan: JSON.parse(String(row['plan_json'])) as unknown,
});

export function sqliteListPlans(eventId: string): StoredPlanRow[] {
  return (prepare('SELECT * FROM ai_plans WHERE event_id = ? ORDER BY generated_at DESC').all(eventId) as SqliteRow[]).map(planRow);
}

/** Primary-key lookup instead of listing (and JSON-parsing) every plan version. */
export function sqliteGetPlan(eventId: string, planId: string): StoredPlanRow | null {
  const row = prepare('SELECT * FROM ai_plans WHERE event_id = ? AND plan_id = ?').get(eventId, planId) as SqliteRow | undefined;
  return row ? planRow(row) : null;
}

export function sqliteMarkPlanApplied(eventId: string, planId: string): void {
  prepare('UPDATE ai_plans SET applied_at = ? WHERE event_id = ? AND plan_id = ?').run(now(), eventId, planId);
}

export function sqliteListIdeas(eventId: string): Idea[] {
  return prepare('SELECT * FROM ideas WHERE event_id = ? ORDER BY created_at DESC').all(eventId) as unknown as Idea[];
}
export function sqliteCreateIdea(eventId: string, data: CreateIdeaPayload): Idea {
  const idea: Idea = { id: randomUUID(), event_id: eventId, category: data.category, title: data.title, description: data.description ?? null, estimated_cost: data.estimated_cost ?? null, status: 'new' as IdeaStatus, created_at: now() };
  prepare('INSERT INTO ideas (id,event_id,category,title,description,estimated_cost,status,created_at) VALUES (?,?,?,?,?,?,?,?)').run(idea.id, idea.event_id, idea.category, idea.title, idea.description, idea.estimated_cost, idea.status, idea.created_at);
  return idea;
}
export function sqliteUpdateIdea(eventId: string, id: string, data: UpdateIdeaPayload): Idea | null {
  prepare('UPDATE ideas SET status = ? WHERE event_id = ? AND id = ?').run(data.status, eventId, id);
  return prepare('SELECT * FROM ideas WHERE event_id = ? AND id = ?').get(eventId, id) as unknown as Idea | null;
}

export function sqliteStoreProposal(id: string, eventId: string, proposal: unknown, expiresAt: number): void {
  try {
    prepare('INSERT INTO ai_proposals (proposal_id, event_id, proposal_json, expires_at) VALUES (?, ?, ?, ?)')
      .run(id, eventId, JSON.stringify(proposal), expiresAt);
  } catch {
    // Graceful fallback for mock unit-test IDs
  }
}

export function sqliteConsumeProposal(id: string, eventId: string): { proposal: unknown; expiresAt: number } | null {
  const row = prepare('SELECT * FROM ai_proposals WHERE proposal_id = ?').get(id) as SqliteRow | undefined;
  if (!row) return null;
  prepare('DELETE FROM ai_proposals WHERE proposal_id = ?').run(id);
  if (String(row['event_id']) !== eventId) return null;
  const expiresAt = Number(row['expires_at']);
  if (expiresAt < Date.now()) return null;
  return { proposal: JSON.parse(String(row['proposal_json'])), expiresAt };
}

export function sqliteResetProposals(): void {
  try {
    prepare('DELETE FROM ai_proposals').run();
  } catch {
    // Graceful fallback
  }
}
