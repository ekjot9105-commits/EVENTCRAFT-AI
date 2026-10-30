// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiUrl, eventsApi, exportApi, ideasApi, planningApi } from '../../../src/client/shared/api/client';
import { EVENT_ID, installApiMock } from './apiMock';

describe('apiUrl', () => {
  it('keeps same-origin requests under /api', () => {
    expect(apiUrl('/events')).toBe('/api/events');
    expect(apiUrl('events')).toBe('/api/events');
  });

  it('adds the /api prefix to external hosts only when missing', () => {
    expect(apiUrl('/events', 'https://api.example.com')).toBe('https://api.example.com/api/events');
    expect(apiUrl('/events', 'https://api.example.com/api')).toBe('https://api.example.com/api/events');
  });
});

describe('request', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('persists the server-issued session ID and sends it on later calls', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json', 'x-anon-id': 'anon-session-123' }), json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await eventsApi.list();
    await eventsApi.list();

    expect(localStorage.getItem('eventcraft_anon_id')).toBe('anon-session-123');
    expect(fetchMock.mock.calls[1]![1].headers).toMatchObject({ 'x-anon-id': 'anon-session-123', 'Content-Type': 'application/json' });
  });

  it('normalises API failures into ApiRequestError with field details', async () => {
    installApiMock({
      'POST /events': () => ({ status: 400, body: { error: 'Validation failed', details: [{ field: 'title', message: 'Required' }] } }),
    });

    const error = await eventsApi.create({ type: 'birthday', title: '' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 400, message: 'Validation failed', details: [{ field: 'title' }] });
  });

  it('falls back to a generic message when the error body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, headers: new Headers({ 'content-type': 'text/html' }), json: async () => null }));
    await expect(eventsApi.getById(EVENT_ID)).rejects.toThrow('Request failed with status 502');
  });

  it('returns undefined for 204 responses', async () => {
    installApiMock();
    await expect(planningApi.vendors.remove(EVENT_ID, 'vendor-1')).resolves.toBeUndefined();
  });

  it('sends JSON bodies with the right method for event-scoped writes', async () => {
    const { calls } = installApiMock();
    await planningApi.budget.update(EVENT_ID, 'item-1', { paid: true });
    await ideasApi.save(EVENT_ID, 'idea-1');
    expect(calls.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'PATCH', path: `/events/${EVENT_ID}/budget/item-1`, body: { paid: true } },
      { method: 'PATCH', path: `/events/${EVENT_ID}/ideas/idea-1`, body: { status: 'saved' } },
    ]);
  });

  it('opens exports through the configured API base without leaking window.opener', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    exportApi.downloadIcs(EVENT_ID);
    exportApi.downloadPdf(EVENT_ID);
    expect(open).toHaveBeenNthCalledWith(1, `/api/events/${EVENT_ID}/export/ics`, '_blank', 'noopener');
    expect(open).toHaveBeenNthCalledWith(2, `/api/events/${EVENT_ID}/export/pdf`, '_blank', 'noopener');
  });
});
