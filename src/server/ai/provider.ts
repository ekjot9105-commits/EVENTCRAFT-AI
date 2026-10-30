import { GeminiProvider, isGeminiConfigured } from './providers/geminiProvider.js';
import { LocalModelProvider } from './providers/localModelProvider.js';
import { LocalPlanningProvider } from './providers/localPlanningProvider.js';
import type { AiProvider } from './providers/types.js';

export { AiConfigurationError, AiProviderError, parseModelJson, type AiProvider } from './providers/types.js';
export { GeminiProvider, LocalModelProvider, LocalPlanningProvider };

export type AiProviderKind = 'gemini' | 'ollama' | 'lmstudio' | 'local';

/** Single source of truth for which adapter the current environment selects. */
export function resolveAiProviderKind(env: NodeJS.ProcessEnv = process.env): AiProviderKind {
  const configured = env['AI_PROVIDER'];
  if (configured === 'ollama' || configured === 'lmstudio') return configured;
  if (configured === 'gemini' || (!configured && isGeminiConfigured(env['GEMINI_API_KEY']))) return 'gemini';
  return 'local';
}

let provider: AiProvider | null = null;

/** Lazily create the provider so normal non-AI routes work without credentials. */
export function getAiProvider(): AiProvider {
  if (provider) return provider;
  const kind = resolveAiProviderKind();
  provider = kind === 'gemini'
    ? new GeminiProvider()
    : kind === 'local'
      ? new LocalPlanningProvider()
      : new LocalModelProvider(kind);
  return provider;
}

export function setAiProviderForTests(next: AiProvider | null): void {
  provider = next;
}

export function getAiProviderStatus(): { provider: AiProviderKind; label: string } {
  const kind = resolveAiProviderKind();
  const model = process.env['LOCAL_AI_MODEL'];
  switch (kind) {
    case 'ollama': return { provider: kind, label: `Ollama: ${model ?? 'llama3.2:3b'}` };
    case 'lmstudio': return { provider: kind, label: `LM Studio: ${model ?? 'local-model'}` };
    case 'gemini': return { provider: kind, label: 'Gemini connected' };
    default: return { provider: kind, label: 'Local starter' };
  }
}
