import type { TimelineItem } from '../../../shared/types/timeline';

export type Urgency = 'Overdue' | 'Due this week' | 'Upcoming' | 'Completed';
export type UrgencyFilter = 'All' | Urgency;
export type TimelineViewMode = '3d-highway' | 'gantt-table' | 'milestones' | 'run-of-show';

export const URGENCY_FILTERS: readonly UrgencyFilter[] = ['All', 'Overdue', 'Due this week', 'Upcoming', 'Completed'];

const DAY_MS = 86_400_000;

/** Classifies a milestone relative to `now`; pure so it can be unit-tested without the UI. */
export function getUrgency(item: TimelineItem, now = new Date()): Urgency {
  if (item.status === 'completed') return 'Completed';
  if (!item.due_date) return 'Upcoming';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);
  const due = new Date(item.due_date);
  if (due < startOfToday) return 'Overdue';
  if (due <= endOfWeek) return 'Due this week';
  return 'Upcoming';
}

export function countByUrgency(items: TimelineItem[], now = new Date()): Record<Urgency, number> {
  const counts: Record<Urgency, number> = { Overdue: 0, 'Due this week': 0, Upcoming: 0, Completed: 0 };
  for (const item of items) counts[getUrgency(item, now)]++;
  return counts;
}

export const URGENCY_BADGE: Record<Urgency, string> = {
  Overdue: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  'Due this week': 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  Upcoming: 'bg-surface-700/50 text-surface-300',
  Completed: 'bg-emerald-500/20 text-emerald-300',
};

/** Standard planning milestones, counted back from the event date (never in the past). */
export function starterMilestones(eventDate: string | null | undefined, now = Date.now()): Array<{ title: string; due_date: string }> {
  const eventTime = eventDate ? new Date(eventDate).getTime() : now + 60 * DAY_MS;
  const daysBefore = (days: number) => new Date(Math.max(now + DAY_MS, eventTime - days * DAY_MS)).toISOString();
  return [
    { title: 'Confirm Venue Contract & Deposit', due_date: daysBefore(45) },
    { title: 'Lock in Catering & Dietary Choices', due_date: daysBefore(30) },
    { title: 'Book Photographer & Music Team', due_date: daysBefore(21) },
    { title: 'Send Invitations & Confirm RSVPs', due_date: daysBefore(14) },
    { title: 'Day-Of Setup & Event Execution', due_date: daysBefore(0) },
  ];
}

export const RUN_OF_SHOW_SLOTS = [
  '08:00 AM — Vendor & Catering Load-in',
  '10:30 AM — Decor, Floral & AV Soundcheck',
  '01:00 PM — Guest Arrival & Welcome Refreshments',
  '02:00 PM — Main Ceremony / Event Kickoff',
  '04:00 PM — Dinner, Toasts & Entertainment',
  '07:30 PM — Cake Cutting / Highlight Moment',
  '09:30 PM — Closing Remarks & Teardown',
];

export const VIEW_MODES: ReadonlyArray<{ id: TimelineViewMode; icon: string; label: string; activeClass: string; title?: string }> = [
  { id: '3d-highway', icon: '🛣️', label: '3D Spatial Highway', activeClass: 'bg-gradient-to-r from-brand-700 to-indigo-700 text-white shadow-lg shadow-brand-600/30 ring-1 ring-white/20' },
  { id: 'gantt-table', icon: '📊', label: 'Accessible 2D Gantt', activeClass: 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-white/20', title: 'Accessible 2D high-contrast Gantt table for screen readers and reduced motion' },
  { id: 'milestones', icon: '📅', label: 'Milestone List', activeClass: 'bg-brand-700 text-white shadow-md' },
  { id: 'run-of-show', icon: '⏱️', label: 'Day-Of "Run-of-Show" View', activeClass: 'bg-brand-700 text-white shadow-md' },
];
