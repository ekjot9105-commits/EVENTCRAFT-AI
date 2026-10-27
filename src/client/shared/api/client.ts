// ===========================================
// API Client — HTTP Wrapper
// ===========================================

const API_BASE = '/api';

interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Make an API request with proper error handling.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  if (!res.ok) {
    const errorData = data as ApiError;
    throw new ApiRequestError(res.status, errorData.error, errorData.details);
  }

  return data as T;
}

// ===================== Event API =====================

import type { Event, CreateEventPayload, UpdateEventPayload } from '../../../shared/types/event';
import type { BudgetItem, CreateBudgetItemPayload, UpdateBudgetItemPayload } from '../../../shared/types/budget';
import type { TimelineItem, CreateTimelineItemPayload, UpdateTimelineItemPayload } from '../../../shared/types/timeline';
import type { Vendor, CreateVendorPayload, UpdateVendorPayload } from '../../../shared/types/vendor';

export const eventsApi = {
  list: () => request<Event[]>('/events'),

  getById: (id: string) => request<Event>(`/events/${id}`),

  create: (data: CreateEventPayload) =>
    request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateEventPayload) =>
    request<Event>(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/events/${id}`, { method: 'DELETE' }),
};

/** Event-scoped planning APIs share the same request/error boundary as events. */
export const planningApi = {
  budget: {
    list: (eventId: string) => request<BudgetItem[]>(`/events/${eventId}/budget`),
    create: (eventId: string, data: CreateBudgetItemPayload) => request<BudgetItem>(`/events/${eventId}/budget`, { method: 'POST', body: JSON.stringify(data) }),
    update: (eventId: string, itemId: string, data: UpdateBudgetItemPayload) => request<BudgetItem>(`/events/${eventId}/budget/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (eventId: string, itemId: string) => request<void>(`/events/${eventId}/budget/${itemId}`, { method: 'DELETE' }),
  },
  timeline: {
    list: (eventId: string) => request<TimelineItem[]>(`/events/${eventId}/timeline`),
    create: (eventId: string, data: CreateTimelineItemPayload) => request<TimelineItem>(`/events/${eventId}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
    update: (eventId: string, itemId: string, data: UpdateTimelineItemPayload) => request<TimelineItem>(`/events/${eventId}/timeline/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (eventId: string, itemId: string) => request<void>(`/events/${eventId}/timeline/${itemId}`, { method: 'DELETE' }),
  },
  vendors: {
    list: (eventId: string) => request<Vendor[]>(`/events/${eventId}/vendors`),
    create: (eventId: string, data: CreateVendorPayload) => request<Vendor>(`/events/${eventId}/vendors`, { method: 'POST', body: JSON.stringify(data) }),
    update: (eventId: string, itemId: string, data: UpdateVendorPayload) => request<Vendor>(`/events/${eventId}/vendors/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (eventId: string, itemId: string) => request<void>(`/events/${eventId}/vendors/${itemId}`, { method: 'DELETE' }),
  },
};
