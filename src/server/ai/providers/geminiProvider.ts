import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import type { GeneratedPlan, CopilotResponse } from '../schemas.js';
import { AiConfigurationError, AiProviderError, parseModelJson, type AiProvider, type ModelResponse, type PromptContext } from './types.js';
import { LocalPlanningProvider } from './localPlanningProvider.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;

/** Treats the placeholder value from .env.example as "not configured". */
export function isGeminiConfigured(apiKey = process.env['GEMINI_API_KEY']): boolean {
  return Boolean(apiKey) && apiKey !== 'your-gemini-api-key';
}

/** Gemini adapter; API credentials never cross this server boundary. */
export class GeminiProvider implements AiProvider {
  private static readonly cache = new Map<string, { data: ModelResponse; expiresAt: number }>();

  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly fallback = new LocalPlanningProvider();

  constructor(
    apiKey = process.env['GEMINI_API_KEY'],
    model = process.env['GEMINI_MODEL'] || DEFAULT_GEMINI_MODEL,
  ) {
    if (!isGeminiConfigured(apiKey)) {
      throw new AiConfigurationError('Gemini is not configured. Set GEMINI_API_KEY on the server.');
    }
    this.client = new GoogleGenAI({ apiKey: apiKey! });
    this.model = model;
  }

  async generatePlan(prompt: string, context?: PromptContext): Promise<GeneratedPlan> {
    try {
      return (await this.generate(prompt)) as GeneratedPlan;
    } catch {
      return this.fallback.generatePlan(prompt, context);
    }
  }

  async answerCopilot(prompt: string, context?: PromptContext): Promise<CopilotResponse> {
    try {
      return (await this.generate(prompt)) as CopilotResponse;
    } catch {
      return this.fallback.answerCopilot(prompt, context);
    }
  }

  /** Clears the shared response cache between tests. */
  static resetCache(): void {
    GeminiProvider.cache.clear();
  }

  private async generate(prompt: string): Promise<ModelResponse> {
    const key = createHash('sha256').update(`${this.model}:${prompt}`).digest('hex');
    const cached = GeminiProvider.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    let timer: NodeJS.Timeout | undefined;
    try {
      const request = this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: Number(process.env['GEMINI_MAX_OUTPUT_TOKENS'] ?? 8192),
        },
      });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AiProviderError('Gemini request timed out.')), REQUEST_TIMEOUT_MS);
      });
      const response = await Promise.race([request, timeout]);
      if (!response.text) throw new AiProviderError('Gemini returned an empty response.');
      const parsed = parseModelJson(response.text);
      this.remember(key, parsed);
      return parsed;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('Gemini could not complete the request.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Bounded FIFO cache so repeated identical prompts skip a paid model call. */
  private remember(key: string, data: ModelResponse): void {
    if (GeminiProvider.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = GeminiProvider.cache.keys().next().value;
      if (oldestKey) GeminiProvider.cache.delete(oldestKey);
    }
    GeminiProvider.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
