import type { EventType } from '../../../shared/constants/eventTypes';

/** Event-type-specific conversation starters shown as chips. */
export const STARTER_PROMPTS: Record<EventType, string[]> = {
  wedding: [
    'Suggest a seating and ceremony timeline for a 120-guest wedding',
    'What are essential floral and decor arrangements for a wedding?',
    'How should we structure the rehearsal dinner and day-of hair & makeup?',
  ],
  birthday: [
    'Create a milestone birthday party theme & playlist ideas',
    'Plan a cake-cutting and surprise activity schedule',
    'Balanced kid and adult catering ideas for a birthday',
  ],
  community: [
    'What city permits do I need for a park community festival?',
    'Create a volunteer coordination and shift checklist',
    'Crowd safety, waste management and booth layout guide',
  ],
};

export const QUICK_ACTIONS = [
  'Find areas to cut 15% budget',
  'Suggest day-of schedule',
  'Check missing vendors',
  'Draft top 5 personalized ideas',
];

/** Rotating progress copy while the assistant is working. */
export const BUSY_STEPS = [
  'Reviewing your event details & budget...',
  'Evaluating timeline milestones & vendors...',
  'Formulating contextual recommendations...',
  'Polishing personalized guidance...',
];

/** Plain-language confirmation shown after a proposal is applied. */
export function confirmationMessage(action: string): string {
  if (action.includes('timeline')) return 'The confirmed timeline milestone was added to your schedule.';
  if (action.includes('vendor')) return 'The confirmed vendor recommendation was added to your checklist.';
  return 'The confirmed budget change was saved.';
}
