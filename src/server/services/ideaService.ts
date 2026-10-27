import { getSupabase } from '../db/client.js';
import type { CreateIdeaPayload, Idea, UpdateIdeaPayload } from '../../shared/types/idea.js';

/** Provides event-scoped persistence for generated and user-saved ideas. */
export class IdeaService {
  async list(eventId: string): Promise<Idea[]> {
    const { data, error } = await getSupabase().from('ideas').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list ideas: ${error.message}`);
    return (data ?? []) as Idea[];
  }

  async create(eventId: string, payload: CreateIdeaPayload): Promise<Idea> {
    const { data, error } = await getSupabase().from('ideas').insert({ ...payload, event_id: eventId }).select().single();
    if (error) throw new Error(`Failed to create idea: ${error.message}`);
    return data as Idea;
  }

  async update(eventId: string, id: string, payload: UpdateIdeaPayload): Promise<Idea | null> {
    const { data, error } = await getSupabase().from('ideas').update(payload).eq('event_id', eventId).eq('id', id).select().maybeSingle();
    if (error) throw new Error(`Failed to update idea: ${error.message}`);
    return data as Idea | null;
  }
}

export const ideaService = new IdeaService();
