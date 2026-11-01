import type { Idea } from '../../../shared/types/idea';

export const TAG_CHIPS = ['#All', '#BudgetFriendly', '#Entertainment', '#Decor', '#Interactive', '#Food & Drink'] as const;
export type IdeaTag = typeof TAG_CHIPS[number];

/** Keeps filtering rules pure and independently testable from workspace state. */
export function filterIdeas(ideas: Idea[], selectedTag: IdeaTag): Idea[] {
  const active = ideas.filter((idea) => idea.status !== 'dismissed');
  if (selectedTag === '#All') return active;
  return active.filter((idea) => {
    const text = `${idea.title} ${idea.description} ${idea.category}`.toLowerCase();
    if (selectedTag === '#BudgetFriendly') return (idea.estimated_cost != null && idea.estimated_cost < 250) || text.includes('budget') || text.includes('diy');
    if (selectedTag === '#Entertainment') return text.includes('music') || text.includes('game') || text.includes('dance') || text.includes('entertainment');
    if (selectedTag === '#Decor') return text.includes('decor') || text.includes('floral') || text.includes('flower') || text.includes('light');
    if (selectedTag === '#Interactive') return text.includes('interactive') || text.includes('guest') || text.includes('activity') || text.includes('photo');
    if (selectedTag === '#Food & Drink') return text.includes('food') || text.includes('drink') || text.includes('cake') || text.includes('catering') || text.includes('bar');
    return true;
  });
}
