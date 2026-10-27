import { describe, expect, it, afterEach } from 'vitest';
import { getAiProvider, setAiProviderForTests, type AiProvider } from '../../src/server/ai/provider';

const mockProvider: AiProvider = {
  generatePlan: async () => ({}) as never,
  answerCopilot: async () => ({}) as never,
};

// Provider injection keeps AI service tests deterministic and credential-free.
describe('AI provider boundary', () => {
  afterEach(() => setAiProviderForTests(null));

  it('uses the injected mock provider', () => {
    setAiProviderForTests(mockProvider);
    expect(getAiProvider()).toBe(mockProvider);
  });
});
