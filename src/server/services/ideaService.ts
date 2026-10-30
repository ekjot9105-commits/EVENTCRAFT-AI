import { getSupabase } from '../db/client.js';
import { usesSqlite } from '../db/client.js';
import { sqliteCreateIdea, sqliteListIdeas, sqliteTransaction, sqliteUpdateIdea } from '../db/sqlite.js';
import type { CreateIdeaPayload, Idea, UpdateIdeaPayload } from '../../shared/types/idea.js';

/** Provides event-scoped persistence for generated and user-saved ideas. */
export class IdeaService {
  async list(eventId: string): Promise<Idea[]> {
    if (usesSqlite()) return sqliteListIdeas(eventId);
    const { data, error } = await getSupabase().from('ideas').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list ideas: ${error.message}`);
    return (data ?? []) as Idea[];
  }

  async create(eventId: string, payload: CreateIdeaPayload): Promise<Idea> {
    if (usesSqlite()) return sqliteCreateIdea(eventId, payload);
    const { data, error } = await getSupabase().from('ideas').insert({ ...payload, event_id: eventId }).select().single();
    if (error) throw new Error(`Failed to create idea: ${error.message}`);
    return data as Idea;
  }

  /** Persists a batch of generated ideas atomically (SQLite) or in one request (Supabase). */
  async createMany(eventId: string, payloads: CreateIdeaPayload[]): Promise<Idea[]> {
    if (payloads.length === 0) return [];
    if (usesSqlite()) return sqliteTransaction(() => payloads.map((payload) => sqliteCreateIdea(eventId, payload)));
    const { data, error } = await getSupabase().from('ideas').insert(payloads.map((payload) => ({ ...payload, event_id: eventId }))).select();
    if (error) throw new Error(`Failed to create ideas: ${error.message}`);
    return (data ?? []) as Idea[];
  }

  async update(eventId: string, id: string, payload: UpdateIdeaPayload): Promise<Idea | null> {
    if (usesSqlite()) return sqliteUpdateIdea(eventId, id, payload);
    const { data, error } = await getSupabase().from('ideas').update(payload).eq('event_id', eventId).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`Failed to update idea: ${error.message}`);
    return data as Idea | null;
  }
}

export const ideaService = new IdeaService();
