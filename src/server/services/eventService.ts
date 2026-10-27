// ===========================================
// Event Service — Business Logic
// ===========================================

import { getSupabase } from '../db/client.js';
import { usesSqlite } from '../db/client.js';
import { sqliteCreateEvent, sqliteDeleteEvent, sqliteGetEvent, sqliteListEvents, sqliteUpdateEvent } from '../db/sqlite.js';
import type { Event, CreateEventPayload, UpdateEventPayload } from '../../shared/types/event.js';

export class EventService {
  /**
   * Create a new event.
   */
  async create(data: CreateEventPayload): Promise<Event> {
    if (usesSqlite()) return sqliteCreateEvent(data);
    const supabase = getSupabase();
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        date: data.date ?? null,
        guest_count: data.guest_count ?? null,
        location: data.location ?? null,
        budget_amount: data.budget_amount ?? 0,
        currency: data.currency ?? 'USD',
        metadata: data.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }

    return event as Event;
  }

  /**
   * Get a single event by ID.
   */
  async getById(id: string): Promise<Event | null> {
    if (usesSqlite()) return sqliteGetEvent(id);
    const supabase = getSupabase();
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch event: ${error.message}`);
    }

    return event as Event;
  }

  /**
   * List all events, ordered by creation date (newest first).
   */
  async list(): Promise<Event[]> {
    if (usesSqlite()) return sqliteListEvents();
    const supabase = getSupabase();
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list events: ${error.message}`);
    }

    return (events ?? []) as Event[];
  }

  /**
   * Update an existing event.
   */
  async update(id: string, data: UpdateEventPayload): Promise<Event | null> {
    if (usesSqlite()) return sqliteUpdateEvent(id, data);
    const supabase = getSupabase();
    const { data: event, error } = await supabase
      .from('events')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to update event: ${error.message}`);
    }

    return event as Event;
  }

  /**
   * Delete an event and all associated data (cascade).
   */
  async delete(id: string): Promise<boolean> {
    if (usesSqlite()) return sqliteDeleteEvent(id);
    const supabase = getSupabase();
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete event: ${error.message}`);
    }

    return true;
  }
}

// Singleton instance
export const eventService = new EventService();
