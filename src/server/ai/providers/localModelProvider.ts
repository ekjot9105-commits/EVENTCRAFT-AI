import type { GeneratedPlan, CopilotResponse } from '../schemas.js';
import { AiProviderError, parseModelJson, type AiProvider, type ModelResponse, type PromptContext } from './types.js';
import { LocalPlanningProvider } from './localPlanningProvider.js';

export type LocalModelKind = 'ollama' | 'lmstudio';

const DEFAULTS: Record<LocalModelKind, { baseUrl: string; model: string }> = {
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2:3b' },
  lmstudio: { baseUrl: 'http://127.0.0.1:1234', model: 'local-model' },
};

/** Safely reads a nested string property from an untrusted JSON payload. */
function readString(value: unknown, ...path: Array<string | number>): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string | number, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

/**
 * Adapter for free local models. Ollama and LM Studio expose localhost APIs,
 * so no API key or event data leaves the user's machine.
 */
export class LocalModelProvider implements AiProvider {
  private readonly baseUrl: string;
  private readonly fallback = new LocalPlanningProvider();

  constructor(
    private readonly kind: LocalModelKind = process.env['AI_PROVIDER'] === 'lmstudio' ? 'lmstudio' : 'ollama',
    baseUrl = process.env['LOCAL_AI_BASE_URL'] ?? DEFAULTS[kind].baseUrl,
    private readonly model = process.env['LOCAL_AI_MODEL'] ?? DEFAULTS[kind].model,
    private readonly timeoutMs = Number(process.env['LOCAL_AI_TIMEOUT_MS'] ?? 45_000),
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async generatePlan(prompt: string, context?: PromptContext): Promise<GeneratedPlan> {
    try {
      return (await this.request(prompt)) as GeneratedPlan;
    } catch {
      return this.fallback.generatePlan(prompt, context);
    }
  }

  async answerCopilot(prompt: string, context?: PromptContext): Promise<CopilotResponse> {
    try {
      return (await this.request(prompt)) as CopilotResponse;
    } catch {
      return this.fallback.answerCopilot(prompt, context);
    }
  }

  private async request(prompt: string): Promise<ModelResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.body(prompt)),
        signal: controller.signal,
      });
      if (!response.ok) throw new AiProviderError(`Local ${this.kind} model returned HTTP ${response.status}.`);
      const content = this.content(await response.json());
      if (!content) throw new AiProviderError(`Local ${this.kind} model returned no content.`);
      return parseModelJson(content);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(`Local ${this.kind} model is unavailable.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private endpoint(): string {
    return this.kind === 'ollama' ? `${this.baseUrl}/api/chat` : `${this.baseUrl}/v1/chat/completions`;
  }

  private body(prompt: string): Record<string, unknown> {
    const messages = [{ role: 'user', content: prompt }];
    if (this.kind === 'ollama') {
      return { model: this.model, messages, stream: false, format: 'json', options: { temperature: 0.2 } };
    }
    return { model: this.model, messages, response_format: { type: 'json_object' }, temperature: 0.2, stream: false };
  }

  private content(payload: unknown): string | null {
    return this.kind === 'ollama'
      ? readString(payload, 'message', 'content')
      : readString(payload, 'choices', 0, 'message', 'content');
  }
}
