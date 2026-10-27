import { GoogleGenAI } from '@google/genai';
import type { GeneratedPlan, CopilotResponse } from './schemas.js';
import type { Event } from '../../shared/types/event.js';

export class AiConfigurationError extends Error {}
export class AiProviderError extends Error {}

type LocalModelKind = 'ollama' | 'lmstudio';

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

/**
 * Adapter for free local models. Ollama and LM Studio expose localhost APIs,
 * so no API key or event data leaves the user's machine.
 */
export class LocalModelProvider implements AiProvider {
    private readonly kind: LocalModelKind;
    private readonly baseUrl: string;
    private readonly model: string;
    private readonly timeoutMs: number;

    constructor(
      kind: LocalModelKind = process.env['AI_PROVIDER'] === 'lmstudio' ? 'lmstudio' : 'ollama',
      baseUrl = process.env['LOCAL_AI_BASE_URL'] ?? (kind === 'lmstudio' ? 'http://127.0.0.1:1234' : 'http://127.0.0.1:11434'),
      model = process.env['LOCAL_AI_MODEL'] ?? (kind === 'lmstudio' ? 'local-model' : 'llama3.2:3b'),
      timeoutMs = Number(process.env['LOCAL_AI_TIMEOUT_MS'] ?? 45_000),
    ) {
      this.kind = kind;
      this.baseUrl = baseUrl.replace(/\/$/, '');
      this.model = model;
      this.timeoutMs = timeoutMs;
    }

    generatePlan(prompt: string): Promise<GeneratedPlan> {
      return this.request(prompt) as Promise<GeneratedPlan>;
    }

    answerCopilot(prompt: string): Promise<CopilotResponse> {
      return this.request(prompt) as Promise<CopilotResponse>;
    }

    private async request(prompt: string): Promise<GeneratedPlan | CopilotResponse> {
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
        const payload: unknown = await response.json();
        const content = this.content(payload);
        if (!content) throw new AiProviderError(`Local ${this.kind} model returned no content.`);
        return JSON.parse(content) as GeneratedPlan | CopilotResponse;
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw new AiProviderError(`Local ${this.kind} model is unavailable. Start it locally or use the built-in starter mode.`);
      } finally {
        clearTimeout(timeout);
      }
    }

    private endpoint(): string {
      return this.kind === 'ollama' ? `${this.baseUrl}/api/chat` : `${this.baseUrl}/v1/chat/completions`;
    }

    private body(prompt: string): Record<string, unknown> {
      if (this.kind === 'ollama') {
        return { model: this.model, messages: [{ role: 'user', content: prompt }], stream: false, format: 'json', options: { temperature: 0.2 } };
      }
      return { model: this.model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.2, stream: false };
    }

    private content(payload: unknown): string | null {
      if (!payload || typeof payload !== 'object') return null;
      const record = payload as Record<string, unknown>;
      if (this.kind === 'ollama') {
        const message = record['message'];
        const content = message && typeof message === 'object' ? (message as Record<string, unknown>)['content'] : null;
        return typeof content === 'string' ? content : null;
      }
      const choices = record['choices'];
      const first = Array.isArray(choices) ? choices[0] : null;
      const message = first && typeof first === 'object' ? (first as Record<string, unknown>)['message'] : null;
      const content = message && typeof message === 'object' ? (message as Record<string, unknown>)['content'] : null;
      return typeof content === 'string' ? content : null;
    }
}

/**
 * Credential-free provider for local evaluation. It creates an honest,
 * deterministic starter plan; Gemini remains the production provider when a
 * key is configured.
 */
export class LocalPlanningProvider implements AiProvider {
  async generatePlan(prompt: string): Promise<GeneratedPlan> {
    const type = (prompt.match(/structured (wedding|birthday|community) event plan/)?.[1] ?? 'community') as Event['type'];
    const currency = prompt.match(/Budget: ([A-Z]{3})/)?.[1] ?? 'USD';
    const budget = Number(prompt.match(/budget [A-Z]{3} ([\d.]+)/)?.[1] ?? 0);
    const guests = prompt.match(/guests: ([^;]+)/)?.[1]?.trim() ?? 'not provided';
    const location = prompt.match(/location: ([^.]+)\./)?.[1]?.trim() ?? 'not provided';
    const eventDate = prompt.match(/date: ([^;]+)/)?.[1]?.trim();
    const deadline = eventDate && eventDate !== 'not provided'
      ? new Date(new Date(eventDate).getTime() - 7 * 86_400_000).toISOString()
      : new Date(Date.now() + 14 * 86_400_000).toISOString();
    const categories: Array<[string, number]> = type === 'wedding'
      ? [['Venue & catering', 0.45], ['Photography', 0.15], ['Decor & florals', 0.15], ['Music & entertainment', 0.15], ['Contingency', 0.10]]
      : type === 'birthday'
        ? [['Venue & food', 0.40], ['Activities', 0.25], ['Cake & decor', 0.20], ['Contingency', 0.15]]
        : [['Venue & accessibility', 0.30], ['Food & supplies', 0.30], ['Activities', 0.20], ['Volunteer support', 0.10], ['Contingency', 0.10]];
    return {
      event_type: type,
      summary: `A practical ${type} starter plan for ${guests} guests in ${location}, based on the saved event brief. Review the estimates and adjust them in the workspaces.`,
      assumptions: ['This is a local starter plan because no Gemini API key is configured.', 'Vendor availability and final prices must be verified by the organizer.'],
      preferences_incorporated: ['Event type', 'Saved budget', 'Saved event date'],
      items_to_verify: ['Confirm venue availability', 'Confirm vendor quotes', 'Confirm accessibility and dietary needs'],
      budget_proposal: {
        currency,
        categories: categories.map(([category, ratio]) => ({
          category,
          amount: Math.round(budget * Number(ratio) * 100) / 100,
          rationale: `Starter allocation for ${category.toLowerCase()}.`,
          priority: category === 'Contingency' ? 'important' : 'essential',
        })),
      },
      timeline: [
        { title: 'Confirm venue and date', description: 'Verify the venue, capacity, access, and booking terms.', due_date: deadline, priority: 'high', category: 'Venue', dependencies: [], generated_deadline: true },
      ],
      vendor_checklist: [
        { category: type === 'community' ? 'Venue and accessibility' : 'Catering', reason: 'A core service for this event type.', booking_deadline: deadline, checklist: ['Request a written quote', 'Confirm availability and requirements'], estimated_cost: null },
      ],
      personalized_ideas: [
        { title: type === 'wedding' ? 'Guest memory station' : type === 'birthday' ? 'Personalized activity corner' : 'Community story wall', category: 'Personalization', description: `A simple interactive element for ${guests} guests at ${location} that helps people contribute and feel included.`, why_it_matches: 'It uses the saved event type, guest context, location, and available budget while leaving accessibility and dietary choices for organizer review.', estimated_cost: null, assumptions: ['Organizer will confirm materials, accessibility, and dietary needs.'] },
      ],
      event_day_schedule: [{ relative_time: 'Event start', activity: 'Welcome and orientation', description: 'Welcome guests and share the schedule, access information, and key contacts.', duration_minutes: 30, dependencies: [] }],
    };
  }

  async answerCopilot(prompt: string): Promise<CopilotResponse> {
    const event = prompt.match(/Event: (.+) \((wedding|birthday|community)\), budget ([A-Z]{3}) ([\d.]+)/);
    const title = event?.[1] ?? 'your event';
    return {
      answer: `For ${title}, start with the next unconfirmed venue or vendor decision, then review the saved timeline and budget records. This local assistant uses the event context available on the server.`,
      needs_clarification: false,
      clarification_question: null,
      proposal: null,
    };
  }
}

let provider: AiProvider | null = null;

/** Lazily create the provider so normal non-AI routes work without credentials. */
export function getAiProvider(): AiProvider {
  if (provider) return provider;
  const configuredProvider = process.env['AI_PROVIDER'];
  const geminiConfigured = Boolean(process.env['GEMINI_API_KEY']) && process.env['GEMINI_API_KEY'] !== 'your-gemini-api-key';
  provider = configuredProvider === 'gemini' || (!configuredProvider && geminiConfigured)
    ? new GeminiProvider()
    : configuredProvider === 'ollama' || configuredProvider === 'lmstudio'
      ? new LocalModelProvider(configuredProvider)
      : new LocalPlanningProvider();
  return provider;
}

export function setAiProviderForTests(next: AiProvider | null): void {
  provider = next;
}

export function getAiProviderStatus(): { provider: 'gemini' | 'ollama' | 'lmstudio' | 'local'; label: string } {
  const configured = process.env['AI_PROVIDER'];
  const geminiConfigured = Boolean(process.env['GEMINI_API_KEY']) && process.env['GEMINI_API_KEY'] !== 'your-gemini-api-key';
  if (configured === 'ollama') return { provider: 'ollama', label: `Ollama: ${process.env['LOCAL_AI_MODEL'] ?? 'llama3.2:3b'}` };
  if (configured === 'lmstudio') return { provider: 'lmstudio', label: `LM Studio: ${process.env['LOCAL_AI_MODEL'] ?? 'local-model'}` };
  if (configured === 'gemini' || (!configured && geminiConfigured)) return { provider: 'gemini', label: 'Gemini connected' };
  return { provider: 'local', label: 'Local starter' };
}
