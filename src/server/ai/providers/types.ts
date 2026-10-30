import type { GeneratedPlan, CopilotResponse } from '../schemas.js';
import type { Event } from '../../../shared/types/event.js';

export class AiConfigurationError extends Error {
  override name = 'AiConfigurationError';
}

export class AiProviderError extends Error {
  override name = 'AiProviderError';
}

/** Trusted application data passed alongside the prompt, so no adapter has to parse prompt text. */
export interface PromptContext {
  event: Event;
  message?: string;
}

export interface AiProvider {
  generatePlan(prompt: string, context?: PromptContext): Promise<GeneratedPlan>;
  answerCopilot(prompt: string, context?: PromptContext): Promise<CopilotResponse>;
}

export type ModelResponse = GeneratedPlan | CopilotResponse;

/**
 * Parses a model's JSON reply, tolerating the Markdown code fences some models add.
 * Shape validation happens later against the Zod schemas in the AI service.
 */
export function parseModelJson(text: string): ModelResponse {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as ModelResponse;
  } catch {
    throw new AiProviderError('The AI provider returned malformed JSON.');
  }
}
