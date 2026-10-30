import type { GeneratedPlan, CopilotResponse } from '../schemas.js';
import type { Event } from '../../../shared/types/event.js';
import type { AiProvider, PromptContext } from './types.js';

/** The facts the deterministic planner needs, independent of prompt wording. */
interface PlanningBrief {
  type: Event['type'];
  title: string;
  currency: string;
  budget: number;
  guests: string;
  location: string;
  eventTime: number;
  message: string;
}

const DEFAULT_BUDGET: Record<Event['type'], number> = { wedding: 5000, birthday: 1000, community: 2500 };
const DEFAULT_LEAD_TIME_MS = 60 * 86_400_000;

const parseEventTime = (value: string | null | undefined): number => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? Date.now() + DEFAULT_LEAD_TIME_MS : time;
};

/** Preferred path: read the trusted event record directly. */
function briefFromEvent(event: Event, message = ''): PlanningBrief {
  return {
    type: event.type,
    title: event.title,
    currency: event.currency,
    budget: event.budget_amount > 0 ? event.budget_amount : DEFAULT_BUDGET[event.type],
    guests: event.guest_count ? String(event.guest_count) : '50',
    location: event.location || 'Main Venue',
    eventTime: parseEventTime(event.date),
    message,
  };
}

/** Compatibility path for callers that only have a prompt string (e.g. direct provider tests). */
function briefFromPrompt(prompt: string): PlanningBrief {
  const copilot = prompt.match(/Event:\s*([^(]+)\s*\((wedding|birthday|community)\),\s*budget\s*([A-Z]{3})\s*([\d.]+)/i);
  const type = (copilot?.[2]?.toLowerCase() ?? prompt.match(/structured (wedding|birthday|community) event plan/i)?.[1] ?? 'community') as Event['type'];
  const rawBudget = Number(copilot?.[4] ?? prompt.match(/Budget:\s*[A-Z]{3}\s*([\d.]+)/i)?.[1] ?? 0);
  const questions = [...prompt.matchAll(/<user_question>([\s\S]*?)<\/user_question>/gi)];
  return {
    type,
    title: copilot?.[1]?.trim() ?? prompt.match(/plan for "([^"]+)"/)?.[1] ?? 'your event',
    currency: copilot?.[3] ?? prompt.match(/Budget:\s*([A-Z]{3})/i)?.[1] ?? 'USD',
    budget: rawBudget > 0 ? rawBudget : DEFAULT_BUDGET[type],
    guests: prompt.match(/guests:\s*([^;]+)/i)?.[1]?.trim() ?? '50',
    location: prompt.match(/location:\s*([^.]+)\./i)?.[1]?.trim() ?? 'Main Venue',
    eventTime: parseEventTime(prompt.match(/date:\s*([^;]+)/i)?.[1]?.trim()),
    message: (questions[questions.length - 1]?.[1] ?? prompt.match(/User question:\s*([\s\S]+?)(?=\nFor any requested|$)/i)?.[1] ?? '').trim(),
  };
}

const toBrief = (prompt: string, context?: PromptContext) =>
  context ? briefFromEvent(context.event, context.message) : briefFromPrompt(prompt);

/** Formats amounts in the event's own currency instead of assuming dollars. */
function money(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Intelligent, production-safe provider for offline evaluation and instant deployment fallback.
 * Calculates exact budget allocations, realistic timelines, vendor requirements, and interactive copilot answers.
 */
export class LocalPlanningProvider implements AiProvider {
  async generatePlan(prompt: string, context?: PromptContext): Promise<GeneratedPlan> {
    const { type, currency, budget, guests, location, eventTime } = toBrief(prompt, context);

    const deadlineAtDaysBefore = (days: number) => new Date(Math.max(Date.now() + 86_400_000, eventTime - days * 86_400_000)).toISOString();

    const categories: Array<[string, number, string]> = type === 'wedding'
      ? [
          ['Venue & Catering', 0.45, 'Core celebration hall and guest dining reception.'],
          ['Photography & Video', 0.15, 'Full-day event coverage and highlight album.'],
          ['Flowers & Decor', 0.15, 'Ceremony backdrop, table centerpieces, and ambiance.'],
          ['Music & Entertainment', 0.15, 'Sound system, ceremony audio, and reception DJ.'],
          ['Contingency Buffer', 0.10, 'Reserved cushion for guest adjustments and incidentals.'],
        ]
      : type === 'birthday'
        ? [
            ['Venue & Food', 0.40, 'Party space reservation, meals, and celebratory drinks.'],
            ['Entertainment & Games', 0.25, 'Host, games, party playlist, or live performer.'],
            ['Cake & Decorations', 0.20, 'Custom milestone cake, balloons, and theme backdrop.'],
            ['Favors & Contingency', 0.15, 'Guest takeaway favors and reserve funds.'],
          ]
        : [
            ['Venue & Permits', 0.35, 'Park or hall rental fee and municipal permits.'],
            ['Food & Supplies', 0.30, 'Community refreshments, tableware, and materials.'],
            ['Activities & Audio', 0.20, 'PA system, microphones, and stage setup.'],
            ['Safety & Volunteers', 0.15, 'First aid kit, volunteer t-shirts, and signage.'],
          ];

    return {
      event_type: type,
      summary: `A personalized ${type} plan designed for ${guests} guests in ${location} with an allocated budget of ${currency} ${budget.toLocaleString()}. Every detail has been structured for stress-free execution.`,
      assumptions: ['Budget allocations are balanced according to typical industry standards.', 'Final vendor quotes should be confirmed upon booking.'],
      preferences_incorporated: ['Target budget allocation', 'Guest count and venue scale', 'Event type milestones'],
      items_to_verify: ['Confirm venue capacity and cancellation policy', 'Request written quotes from preferred caterers', 'Review AV sound ordinance for the location'],
      budget_proposal: {
        currency,
        categories: categories.map(([category, ratio, rationale]) => ({
          category,
          amount: Math.round(budget * Number(ratio) * 100) / 100,
          rationale,
          priority: category.includes('Contingency') ? 'important' : 'essential',
          savings_suggestion: 'Book early or bundle services to save 10-15%.',
        })),
      },
      timeline: [
        { title: 'Finalize Venue Contract & Deposit', description: 'Confirm booking, security deposit, and access hours.', due_date: deadlineAtDaysBefore(45), priority: 'high', category: 'Venue', dependencies: [], generated_deadline: true },
        { title: 'Lock in Catering & Menu Choices', description: 'Sample menu items and accommodate dietary requirements.', due_date: deadlineAtDaysBefore(30), priority: 'high', category: 'Catering', dependencies: [], generated_deadline: true },
        { title: 'Book Photographer & Music', description: 'Sign agreement with media team and curate playlist brief.', due_date: deadlineAtDaysBefore(21), priority: 'medium', category: 'Entertainment', dependencies: [], generated_deadline: true },
        { title: 'Send Invitations & Track RSVPs', description: 'Send digital/print invites and gather confirmed guest count.', due_date: deadlineAtDaysBefore(14), priority: 'high', category: 'Guests', dependencies: [], generated_deadline: true },
        { title: 'Finalize Day-Of Schedule & Walkthrough', description: 'Review load-in timeline with all vendors and key coordinators.', due_date: deadlineAtDaysBefore(3), priority: 'high', category: 'Coordination', dependencies: [], generated_deadline: true },
      ],
      vendor_checklist: [
        { category: 'Venue Coordinator', reason: 'Critical for site access, tables, and power hookups.', booking_deadline: deadlineAtDaysBefore(45), checklist: ['Verify contract', 'Review floorplan', 'Confirm load-in time'], estimated_cost: Math.round(budget * 0.35) },
        { category: 'Caterer / Baker', reason: 'Main dining and celebratory cake/dessert service.', booking_deadline: deadlineAtDaysBefore(30), checklist: ['Tasting session', 'Dietary menu check', 'Final head count deadline'], estimated_cost: Math.round(budget * 0.25) },
        { category: 'Photographer / Videographer', reason: 'Capturing memories and high-res highlight video.', booking_deadline: deadlineAtDaysBefore(21), checklist: ['Portfolio review', 'Shot list creation', 'Deposit payment'], estimated_cost: Math.round(budget * 0.15) },
        { category: 'Music & Sound DJ', reason: 'Keeps guests engaged and manages ceremony/announcement audio.', booking_deadline: deadlineAtDaysBefore(14), checklist: ['Do-not-play list', 'Microphone check', 'Timeline sync'], estimated_cost: Math.round(budget * 0.15) },
      ],
      personalized_ideas: [
        { title: type === 'wedding' ? 'Polaroid Guestbook with Audio Messages' : type === 'birthday' ? 'Personalized Memory Video & Quiz' : 'Community Story & Contribution Wall', category: 'Interactive', description: 'An engaging station where attendees can leave personal notes, photos, and voice memos to celebrate the occasion.', why_it_matches: 'Creates high emotional value with minimal budget investment.', estimated_cost: 120, assumptions: ['Station table provided by venue.'] },
        { title: type === 'wedding' ? 'Signature Couple Mocktails / Cocktails' : type === 'birthday' ? 'Themed Dessert & Candy Bar' : 'Local Artisan Refreshment Showcase', category: 'Food & Drink', description: 'Two custom signature drinks named after the hosts, offering a memorable flavor experience.', why_it_matches: 'Cost-effective way to elevate guest hospitality.', estimated_cost: 200, assumptions: ['Approved by venue catering guidelines.'] },
        { title: 'Ambient Fairy Light & Candle Canopy', category: 'Decor', description: 'Warm cascading fairy lights and flameless led candles that create an intimate, upscale atmosphere.', why_it_matches: 'Instantly transforms any hall or outdoor space into a luxury environment.', estimated_cost: 150, assumptions: ['Power outlets accessible nearby.'] },
      ],
      event_day_schedule: [
        { relative_time: '08:30 AM', activity: 'Vendor & Catering Load-in', description: 'Venue opens for kitchen prep, table staging, and sound checks.', duration_minutes: 90, dependencies: [] },
        { relative_time: '11:00 AM', activity: 'Floral & Decor Placement', description: 'Centerpieces, signs, and photo booth setup.', duration_minutes: 60, dependencies: [] },
        { relative_time: '01:00 PM', activity: 'Guest Arrival & Welcome Drink', description: 'Background music starts, guests check in and mingle.', duration_minutes: 45, dependencies: [] },
        { relative_time: '02:00 PM', activity: 'Main Ceremony / Kickoff', description: 'Key focal moment, speeches, and official celebration.', duration_minutes: 60, dependencies: [] },
        { relative_time: '03:30 PM', activity: 'Meal & Social Entertainment', description: 'Buffet or plated dining, toasts, and music program.', duration_minutes: 120, dependencies: [] },
        { relative_time: '06:00 PM', activity: 'Highlights & Teardown', description: 'Cake cutting, final remarks, vendor load-out, and venue clean up.', duration_minutes: 60, dependencies: [] },
      ],
    };
  }

  async answerCopilot(prompt: string, context?: PromptContext): Promise<CopilotResponse> {
    const { title, type, currency, budget, message } = toBrief(prompt, context);
    const lower = message.toLowerCase();

    // 1. Cut budget question
    if (lower.includes('cut') || lower.includes('save') || lower.includes('reduce') || lower.includes('15%')) {
      const cutAmount = Math.round(budget * 0.15 * 100) / 100;
      const targetBudget = Math.max(0, budget - cutAmount);
      return {
        answer: `To cut 15% (${money(currency, cutAmount)}) from "${title}":\n\n1. **Decor & Florals**: Switch to seasonal flowers or rental greenery to save ~${money(currency, Math.round(cutAmount * 0.4))}.\n2. **Catering Options**: Adjust to family-style or buffet service to save ~${money(currency, Math.round(cutAmount * 0.4))}.\n3. **Invitations & Printables**: Opt for digital RSVP portals to save ~${money(currency, Math.round(cutAmount * 0.2))}.\n\nI have generated a budget optimization proposal below to adjust your planned expenses.`,
        needs_clarification: false,
        clarification_question: null,
        proposal: {
          action: 'add_budget',
          explanation: `Add 15% Budget Optimization Reserve saving ${money(currency, cutAmount)} (New Target: ${money(currency, targetBudget)})`,
          target_id: null,
          current_value: null,
          expected_budget_impact: -cutAmount,
          proposed_value: {
            category: 'Contingency',
            name: `15% Budget Savings (${currency})`,
            estimated_cost: 0,
            notes: `Targeted 15% savings of ${money(currency, cutAmount)} applied across catering and decor packages.`,
          },
          requires_confirmation: true,
        },
      };
    }

    // 2. Day-of schedule or timeline question
    if (lower.includes('schedule') || lower.includes('run-of-show') || lower.includes('day-of') || lower.includes('timeline') || lower.includes('milestone')) {
      return {
        answer: `Here is the recommended Day-Of Run-of-Show schedule for ${title}:\n\n• **08:30 AM**: Vendor & Catering arrival and load-in.\n• **10:30 AM**: Sound check, lighting test, and floral placement.\n• **01:00 PM**: Guest arrival with welcome refreshments.\n• **02:00 PM**: Main program / ceremony kickoff.\n• **03:30 PM**: Meal service, toasts, and social entertainment.\n• **06:00 PM**: Highlight celebration, final photos, and closing remarks.\n• **07:30 PM**: Vendor load-out and venue handover.\n\nI have prepared a proposal to add a key pre-event milestone to your Timeline.`,
        needs_clarification: false,
        clarification_question: 'Would you like to adjust any of the start times based on your venue access hours?',
        proposal: {
          action: 'add_timeline',
          explanation: `Add "Final Vendor Walkthrough & Tech Rehearsal" milestone to your event timeline.`,
          target_id: null,
          current_value: null,
          expected_budget_impact: 0,
          proposed_value: {
            title: 'Final Vendor Walkthrough & Tech Rehearsal',
            description: 'Verify floor plans, load-in timing, electrical access, and sound checks with all key vendors.',
            status: 'pending',
            sort_order: 10,
          },
          requires_confirmation: true,
        },
      };
    }

    // 3. Vendor checklist or hire question
    if (lower.includes('vendor') || lower.includes('missing') || lower.includes('hire') || lower.includes('book')) {
      const vendorCost = Math.round(budget * 0.12 * 100) / 100;
      return {
        answer: `For your ${type} ("${title}"), ensure these essential vendor categories are covered:\n\n1. **Venue Coordinator**: Confirm access times and table layout.\n2. **Caterer / Bakery**: Lock in head count and menu dietary preferences.\n3. **Photographer**: Share your priority shot list.\n4. **Audio / DJ**: Provide your entrance and background music playlist.\n5. **Florals & Rentals**: Confirm delivery and teardown window.\n\nI have generated a recommendation proposal below to add a specialized vendor to your checklist.`,
        needs_clarification: false,
        clarification_question: 'Have you already received quotes from your top venue choice?',
        proposal: {
          action: 'add_vendor',
          explanation: `Add recommended vendor "Sound & Visuals Production" for ${currency} ${vendorCost.toFixed(2)}.`,
          target_id: null,
          current_value: null,
          expected_budget_impact: vendorCost,
          proposed_value: {
            category: 'Entertainment & AV',
            name: 'Sound & Visuals Production',
            status: 'not_started',
            quoted_cost: vendorCost,
            notes: `Tailored for ${title} (${type}) guest count and acoustic layout.`,
          },
          requires_confirmation: true,
        },
      };
    }

    // 4. Ideas question
    if (lower.includes('idea') || lower.includes('theme') || lower.includes('suggestion') || lower.includes('creative')) {
      return {
        answer: `Top personalized ideas for ${title}:\n\n1. **Audio & Polaroid Guestbook**: Guests snap a photo and record a 30-second audio toast.\n2. **Signature Host Mocktails**: Two custom drinks with custom names celebrating the hosts.\n3. **Milestone Photo Gallery**: A timeline display of memories along the entrance walkway.\n4. **Interactive Trivia / Game Corner**: Personalized questions about the couple/honoree/community.\n5. **Local Artisan Treat Table**: Small batch local pastries or snacks for late-evening energy.`,
        needs_clarification: false,
        clarification_question: null,
        proposal: null,
      };
    }

    // Default intelligent response
    return {
      answer: `For "${title}" (${type}, planned budget: ${currency} ${budget.toLocaleString()}):\n\nYour highest priority right now is locking in the primary venue and core catering contracts. Once those are established, your timeline milestones will guide your remaining decor, photography, and entertainment bookings smoothly.\n\nFeel free to ask me to "Suggest day-of schedule", "Find areas to cut 15% budget", or "Check missing vendors" at any time!`,
      needs_clarification: false,
      clarification_question: null,
      proposal: null,
    };
  }
}
