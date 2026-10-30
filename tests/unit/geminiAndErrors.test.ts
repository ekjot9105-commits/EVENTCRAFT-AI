import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { GeminiProvider } = await import('../../src/server/ai/providers/geminiProvider');
const { AiConfigurationError, AiProviderError } = await import('../../src/server/ai/providers/types');
const { AppError, errorHandler, notFound, serviceUnavailable } = await import('../../src/server/middleware/errorHandler');

const copilotJson = { answer: 'Book the venue.', needs_clarification: false, clarification_question: null, proposal: null };
const event = {
  id: 'e1', owner_id: 'o', type: 'birthday' as const, title: 'Party', description: null, date: null,
  guest_count: 20, location: 'Delhi', budget_amount: 30000, currency: 'INR', metadata: {}, created_at: '', updated_at: '',
};

describe('GeminiProvider', () => {
  beforeEach(() => {
    generateContent.mockReset();
    GeminiProvider.resetCache();
  });
  afterEach(() => vi.useRealTimers());

  it('uses the configured model and parses fenced JSON', async () => {
    generateContent.mockResolvedValue({ text: '```json\n' + JSON.stringify(copilotJson) + '\n```' });
    const provider = new GeminiProvider('real-key', 'gemini-2.5-pro');
    await expect(provider.answerCopilot('prompt-a')).resolves.toEqual(copilotJson);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-pro', config: expect.objectContaining({ responseMimeType: 'application/json' }) }));
  });

  it('serves repeated identical prompts from cache', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(copilotJson) });
    const provider = new GeminiProvider('real-key');
    await provider.answerCopilot('same prompt');
    await provider.answerCopilot('same prompt');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('falls back to the event-aware local planner when Gemini fails', async () => {
    generateContent.mockRejectedValue(new Error('quota exceeded'));
    const provider = new GeminiProvider('real-key');
    const plan = await provider.generatePlan('prompt', { event });
    expect(plan.event_type).toBe('birthday');
    expect(plan.budget_proposal.currency).toBe('INR');

    generateContent.mockResolvedValue({ text: '' });
    const answer = await provider.answerCopilot('another prompt', { event, message: 'What vendors am I missing?' });
    expect(answer.proposal?.action).toBe('add_vendor');
  });

  it('times out slow requests and falls back', async () => {
    vi.useFakeTimers();
    generateContent.mockReturnValue(new Promise(() => {}));
    const pending = new GeminiProvider('real-key').answerCopilot('slow prompt', { event, message: 'hello' });
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(pending).resolves.toMatchObject({ proposal: null });
  });
});

describe('errorHandler', () => {
  function respond(error: Error) {
    const res = { statusCode: 0, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(error, { requestId: 'req-1' } as Request, res as unknown as Response, vi.fn());
    return res;
  }
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [notFound('Event', 'x'), 404, /not found/],
    [serviceUnavailable('down'), 503, /down/],
    [new AppError(409, 'conflict'), 409, /conflict/],
    [new AiConfigurationError('no key'), 503, /not configured/],
    [new AiProviderError('boom'), 502, /could not complete/],
    [new Error('Missing SUPABASE_URL'), 503, /Database is not configured/],
    [new Error('secret internal detail'), 500, /unexpected error/],
  ])('maps %s to HTTP %i without leaking internals', (error, status, message) => {
    const res = respond(error);
    expect(res.statusCode).toBe(status);
    expect(res.body).toMatchObject({ error: expect.stringMatching(message), request_id: 'req-1' });
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});
