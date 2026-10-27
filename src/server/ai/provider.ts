import { GoogleGenAI } from '@google/genai';
import type { GeneratedPlan, CopilotResponse } from './schemas.js';

export class AiConfigurationError extends Error {}
export class AiProviderError extends Error {}

export interface AiProvider {
  generatePlan(prompt: string): Promise<GeneratedPlan>;
  answerCopilot(prompt: string): Promise<CopilotResponse>;
}

/** Gemini adapter; API credentials never cross this server boundary. */
export class GeminiProvider implements AiProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  ) {
    if (!apiKey || apiKey === 'your-gemini-api-key') {
      throw new AiConfigurationError('Gemini is not configured. Set GEMINI_API_KEY on the server.');
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generatePlan(prompt: string): Promise<GeneratedPlan> {
    return this.generate(prompt) as Promise<GeneratedPlan>;
  }

  async answerCopilot(prompt: string): Promise<CopilotResponse> {
    return this.generate(prompt) as Promise<CopilotResponse>;
  }

  private async generate(prompt: string): Promise<GeneratedPlan | CopilotResponse> {
    try {
      const request = this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 8192),
        },
      });
      const response = await Promise.race([
        request,
        new Promise<never>((_, reject) => setTimeout(() => reject(new AiProviderError('Gemini request timed out.')), 30_000)),
      ]);
      if (!response.text) throw new AiProviderError('Gemini returned an empty response.');
      return JSON.parse(response.text) as GeneratedPlan | CopilotResponse;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('Gemini could not complete the request.');
    }
  }
}

let provider: AiProvider | null = null;

/** Lazily create the provider so normal non-AI routes work without credentials. */
export function getAiProvider(): AiProvider {
  return provider ??= new GeminiProvider();
}

export function setAiProviderForTests(next: AiProvider | null): void {
  provider = next;
}
