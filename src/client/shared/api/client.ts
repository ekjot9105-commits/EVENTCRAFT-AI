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

import type { Event, CreateEventPayload, UpdateEventPayload } from '../../shared/types/event';

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
