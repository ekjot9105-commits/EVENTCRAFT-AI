const POST_EVENT_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Validates that a milestone due date is not scheduled more than 30 days after the event date,
 * avoiding impossible schedule errors and typos. The grace window allows post-event wrap-up
 * such as vendor deposit settlements.
 */
export function validateTimelineSchedule(eventDateStr: string | null | undefined, dueDateStr: string | null | undefined): string | null {
  if (!eventDateStr || !dueDateStr) return null;
  const eventDate = new Date(eventDateStr);
  const dueDate = new Date(dueDateStr);
  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(dueDate.getTime())) return null;

  if (dueDate.getTime() > eventDate.getTime() + POST_EVENT_GRACE_MS) {
    return 'Milestone due date cannot be scheduled more than 30 days after the event date.';
  }
  return null;
}
