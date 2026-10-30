import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AiConfigurationError,
  AiProviderError,
  GeminiProvider,
  LocalModelProvider,
  LocalPlanningProvider,
  getAiProvider,
  getAiProviderStatus,
  parseModelJson,
  resolveAiProviderKind,
  setAiProviderForTests,
} from '../../src/server/ai/provider';
import { isGeminiConfigured } from '../../src/server/ai/providers/geminiProvider';

const copilotJson = {
  answer: 'Book the venue first.',
  needs_clarification: false,
  clarification_question: null,
  proposal: null,
};

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('parseModelJson', () => {
  it('parses plain JSON and strips Markdown code fences', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(parseModelJson('```\n{"a":3}\n```')).toEqual({ a: 3 });
  });

  it('wraps malformed output in a typed provider error', () => {
    expect(() => parseModelJson('not json')).toThrow(AiProviderError);
  });
});

describe('provider selection', () => {
  it('treats the .env.example placeholder key as unconfigured', () => {
    expect(isGeminiConfigured(undefined)).toBe(false);
    expect(isGeminiConfigured('your-gemini-api-key')).toBe(false);
    expect(isGeminiConfigured('real-key')).toBe(true);
  });

  it.each([
    [{ AI_PROVIDER: 'ollama' }, 'ollama'],
    [{ AI_PROVIDER: 'lmstudio' }, 'lmstudio'],
    [{ AI_PROVIDER: 'gemini' }, 'gemini'],
    [{ GEMINI_API_KEY: 'real-key' }, 'gemini'],
    [{ GEMINI_API_KEY: 'your-gemini-api-key' }, 'local'],
    [{ AI_PROVIDER: 'local', GEMINI_API_KEY: 'real-key' }, 'local'],
    [{}, 'local'],
  ])('resolves %j to %s', (env, expected) => {
    expect(resolveAiProviderKind(env as NodeJS.ProcessEnv)).toBe(expected);
  });

  it('reports labels for each keyless provider', () => {
    const previous = { provider: process.env['AI_PROVIDER'], model: process.env['LOCAL_AI_MODEL'] };
    try {
      process.env['AI_PROVIDER'] = 'ollama';
      process.env['LOCAL_AI_MODEL'] = 'qwen2.5:7b';
      expect(getAiProviderStatus()).toEqual({ provider: 'ollama', label: 'Ollama: qwen2.5:7b' });
      process.env['AI_PROVIDER'] = 'lmstudio';
      expect(getAiProviderStatus()).toEqual({ provider: 'lmstudio', label: 'LM Studio: qwen2.5:7b' });
    } finally {
      for (const [key, value] of [['AI_PROVIDER', previous.provider], ['LOCAL_AI_MODEL', previous.model]] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('builds a local-model adapter lazily when one is configured', () => {
    const previous = process.env['AI_PROVIDER'];
    try {
      setAiProviderForTests(null);
      process.env['AI_PROVIDER'] = 'ollama';
      expect(getAiProvider()).toBeInstanceOf(LocalModelProvider);
    } finally {
      setAiProviderForTests(null);
      if (previous === undefined) delete process.env['AI_PROVIDER'];
      else process.env['AI_PROVIDER'] = previous;
    }
  });
});

describe('GeminiProvider', () => {
  it('refuses to start without a real server-side key', () => {
    expect(() => new GeminiProvider('your-gemini-api-key')).toThrow(AiConfigurationError);
    expect(() => new GeminiProvider('')).toThrow(AiConfigurationError);
  });

  it('names configuration errors so the error handler can map them to 503', () => {
    expect(new AiConfigurationError('x').name).toBe('AiConfigurationError');
    expect(new AiProviderError('x').name).toBe('AiProviderError');
  });
});

describe('LocalModelProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the Ollama chat endpoint and parses fenced JSON content', async () => {
    const fetchMock = mockFetchOnce({ message: { content: '```json\n' + JSON.stringify(copilotJson) + '\n```' } });
    const provider = new LocalModelProvider('ollama', 'http://127.0.0.1:11434/', 'llama3.2:3b', 1000);

    await expect(provider.answerCopilot('prompt')).resolves.toEqual(copilotJson);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'llama3.2:3b', format: 'json', stream: false });
  });

  it('calls the OpenAI-compatible LM Studio endpoint', async () => {
    const fetchMock = mockFetchOnce({ choices: [{ message: { content: JSON.stringify(copilotJson) } }] });
    const provider = new LocalModelProvider('lmstudio', 'http://127.0.0.1:1234', 'local-model', 1000);

    await expect(provider.answerCopilot('prompt')).resolves.toEqual(copilotJson);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:1234/v1/chat/completions');
    expect(JSON.parse(init.body)).toMatchObject({ response_format: { type: 'json_object' } });
  });

  it.each([
    ['an HTTP error', () => mockFetchOnce({}, { ok: false, status: 500 })],
    ['an empty payload', () => mockFetchOnce({ message: {} })],
    ['malformed JSON', () => mockFetchOnce({ message: { content: 'nope' } })],
    ['a network failure', () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))],
  ])('falls back to the deterministic planner on %s', async (_label, arrange) => {
    arrange();
    const provider = new LocalModelProvider('ollama', 'http://127.0.0.1:11434', 'llama3.2:3b', 1000);
    const plan = await provider.generatePlan('Generate a structured birthday event plan for "Party". Budget: USD 800; date: not provided;');
    expect(plan.event_type).toBe('birthday');
    expect(plan.budget_proposal.categories.length).toBeGreaterThan(0);
  });
});

describe('LocalPlanningProvider copilot', () => {
  const prompt = (question: string, currency = 'INR') =>
    `Event: Asha Wedding (wedding), budget ${currency} 500000, date unknown.\n<user_question>\n${question}\n</user_question>`;

  it('quotes savings in the event currency instead of assuming dollars', async () => {
    const answer = await new LocalPlanningProvider().answerCopilot(prompt('Where can I cut costs?'));
    expect(answer.answer).not.toContain('$');
    expect(answer.answer).toMatch(/₹|INR/);
    expect(answer.proposal?.action).toBe('add_budget');
  });

  it('answers idea and general questions without proposing mutations', async () => {
    const provider = new LocalPlanningProvider();
    expect((await provider.answerCopilot(prompt('Any creative theme ideas?'))).proposal).toBeNull();
    expect((await provider.answerCopilot(prompt('What should I do first?'))).proposal).toBeNull();
  });
});
