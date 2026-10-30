import type { z } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { planningService } from '../services/planningService.js';
import { eventService } from '../services/eventService.js';
import { ideaService } from '../services/ideaService.js';
import { buildCopilotPrompt, buildPlanPrompt } from './prompts.js';
import { copilotResponseSchema, generatedPlanSchema, type CopilotResponse, type GeneratedPlan } from './schemas.js';
import { getAiProvider } from './provider.js';
import { getPlan, listPlans, markPlanApplied, storePlan, type StoredPlan } from './planStore.js';
import type { Event } from '../../shared/types/event.js';
import type { BudgetItem } from '../../shared/types/budget.js';
import type { TimelineItem } from '../../shared/types/timeline.js';
import type { Vendor } from '../../shared/types/vendor.js';
import type { Idea } from '../../shared/types/idea.js';

interface EventContext {
  event: Event;
  budget: BudgetItem[];
  timeline: TimelineItem[];
  vendors: Vendor[];
}

type GeneratedIdea = GeneratedPlan['personalized_ideas'][number];
const generatedIdeasSchema = generatedPlanSchema.shape.personalized_ideas;

/** Model output is untrusted: anything that fails its schema is a bad gateway response, not a 500. */
function parseModelOutput<T>(schema: z.ZodType<T>, raw: unknown, what: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new AppError(502, `The AI returned an invalid ${what}. Please try again.`);
  return result.data;
}

const ideaPayload = (item: GeneratedIdea) => ({
  category: item.category,
  title: item.title,
  description: `${item.description}\nWhy it matches: ${item.why_it_matches}`,
  estimated_cost: item.estimated_cost ?? undefined,
});

/** Orchestrates trusted application context, provider calls, validation, and persistence. */
export class AiService {
  async generatePlan(eventId: string): Promise<StoredPlan> {
    const context = await this.loadContext(eventId);
    const raw = await getAiProvider().generatePlan(buildPlanPrompt(context.event, this.serialize(context)), { event: context.event });
    const plan = parseModelOutput(generatedPlanSchema, raw, 'plan');
    this.validatePlan(plan, context.event);
    return storePlan(eventId, plan);
  }

  /** Generates and saves personalized ideas only, validated against the same schema as full plans. */
  async generateIdeas(eventId: string): Promise<Idea[]> {
    const event = await this.loadEvent(eventId);
    const raw = await getAiProvider().generatePlan(buildPlanPrompt(event, JSON.stringify({ preferences: event.metadata })), { event });
    const ideas = parseModelOutput(generatedIdeasSchema, (raw as Partial<GeneratedPlan> | null)?.personalized_ideas, 'idea list');
    return ideaService.createMany(eventId, ideas.map(ideaPayload));
  }

  listPlans(eventId: string): StoredPlan[] {
    return listPlans(eventId);
  }

  async applyPlan(eventId: string, planId: string): Promise<StoredPlan> {
    const stored = getPlan(eventId, planId);
    if (!stored) throw new AppError(404, 'The plan preview is unavailable or belongs to another event.');
    if (stored.applied_at) throw new AppError(409, 'This plan version has already been applied.');
    await this.persistPlan(await this.loadEvent(eventId), stored.plan);
    return markPlanApplied(eventId, planId) as StoredPlan;
  }

  async restorePlan(eventId: string, planId: string): Promise<StoredPlan> {
    const stored = getPlan(eventId, planId);
    if (!stored) throw new AppError(404, 'The plan version is unavailable or belongs to another event.');
    await this.persistPlan(await this.loadEvent(eventId), stored.plan);
    return markPlanApplied(eventId, planId) as StoredPlan;
  }

  async answerCopilot(eventId: string, message: string): Promise<CopilotResponse> {
    const context = await this.loadContext(eventId);
    const raw = await getAiProvider().answerCopilot(
      buildCopilotPrompt(context.event, this.serialize(context), message),
      { event: context.event, message },
    );
    const answer = parseModelOutput(copilotResponseSchema, raw, 'answer');
    if (answer.proposal?.target_id && !this.ownsTarget(answer.proposal.target_id, context)) {
      throw new AppError(502, 'The AI proposed a change to a resource outside this event.');
    }
    return answer;
  }

  private async loadEvent(eventId: string): Promise<Event> {
    const event = await eventService.getById(eventId);
    if (!event) throw new AppError(404, 'Event not found.');
    return event;
  }

  private async loadContext(eventId: string): Promise<EventContext> {
    const [event, budget, timeline, vendors] = await Promise.all([
      this.loadEvent(eventId),
      planningService.listBudgetItems(eventId),
      planningService.listTimelineItems(eventId),
      planningService.listVendors(eventId),
    ]);
    return { event, budget, timeline, vendors };
  }

  private serialize(context: EventContext): string {
    return JSON.stringify({
      preferences: context.event.metadata,
      budget: context.budget,
      timeline: context.timeline,
      vendors: context.vendors,
    });
  }

  private validatePlan(plan: GeneratedPlan, event: Event): void {
    if (plan.event_type !== event.type || plan.budget_proposal.currency !== event.currency) {
      throw new AppError(502, 'Generated plan does not match the event type or currency.');
    }
    // An unset (zero) budget means "suggest one", so only a real budget caps the allocation.
    const total = plan.budget_proposal.categories.reduce((sum, item) => sum + item.amount, 0);
    if (event.budget_amount > 0 && total > event.budget_amount + 0.01) {
      throw new AppError(502, 'Generated budget allocation exceeds the event budget.');
    }
    if (event.date && plan.timeline.some((item) => new Date(item.due_date) > new Date(event.date!))) {
      throw new AppError(502, 'Generated timeline contains a deadline after the event date.');
    }
  }

  /** Writes each section in one batch, in parallel, instead of one awaited insert per row. */
  private async persistPlan(event: Event, plan: GeneratedPlan): Promise<void> {
    await Promise.all([
      planningService.createBudgetItems(event.id, plan.budget_proposal.categories.map((item) => ({
        category: item.category,
        name: `AI proposal: ${item.category}`,
        estimated_cost: item.amount,
        notes: `${item.rationale}${item.savings_suggestion ? ` Savings: ${item.savings_suggestion}` : ''}`,
      }))),
      planningService.createTimelineItems(event.id, plan.timeline.map((item, index) => ({
        title: item.title,
        description: item.description,
        due_date: item.due_date,
        sort_order: index,
      }))),
      planningService.createVendors(event.id, plan.vendor_checklist.map((item) => ({
        category: item.category,
        name: `Suggested ${item.category}`,
        notes: `${item.reason}\n${item.checklist.join('\n')}`,
        quoted_cost: item.estimated_cost ?? undefined,
      }))),
      ideaService.createMany(event.id, plan.personalized_ideas.map(ideaPayload)),
    ]);
  }

  private ownsTarget(id: string, context: EventContext): boolean {
    return [...context.budget, ...context.timeline, ...context.vendors].some((item) => item.id === id);
  }
}

export const aiService = new AiService();
