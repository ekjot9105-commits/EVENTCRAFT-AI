import type { BudgetItem } from '../../../shared/types/budget';

export interface SliceData {
  category: string;
  amount: number;
  percent: number;
  startAngle: number;
  endAngle: number;
  color: string;
  darkColor: string;
}

const CATEGORY_COLORS: Record<string, { main: string; dark: string }> = {
  'Venue': { main: '#6366F1', dark: '#4338CA' },
  'Venue & Catering': { main: '#6366F1', dark: '#4338CA' },
  'Venue & Food': { main: '#6366F1', dark: '#4338CA' },
  'Venue & Permits': { main: '#6366F1', dark: '#4338CA' },
  'Catering': { main: '#EC4899', dark: '#BE185D' },
  'Food & Supplies': { main: '#EC4899', dark: '#BE185D' },
  'Decor': { main: '#8B5CF6', dark: '#6D28D9' },
  'Flowers & Decor': { main: '#8B5CF6', dark: '#6D28D9' },
  'Cake & Decor': { main: '#F43F5E', dark: '#BE123C' },
  'Media': { main: '#06B6D4', dark: '#0E7490' },
  'Photography & Media': { main: '#06B6D4', dark: '#0E7490' },
  'Photography & Video': { main: '#06B6D4', dark: '#0E7490' },
  'Entertainment': { main: '#10B981', dark: '#047857' },
  'Music & DJ': { main: '#10B981', dark: '#047857' },
  'Entertainment & Games': { main: '#10B981', dark: '#047857' },
  'Sound & Activities': { main: '#10B981', dark: '#047857' },
  'Permits': { main: '#F59E0B', dark: '#B45309' },
  'Contingency Buffer': { main: '#EAB308', dark: '#A16207' },
  'Favors & Contingency': { main: '#EAB308', dark: '#A16207' },
  'Volunteers & Safety': { main: '#14B8A6', dark: '#0F766E' },
};

const DEFAULT_PALETTE = [
  { main: '#6366F1', dark: '#4338CA' },
  { main: '#EC4899', dark: '#BE185D' },
  { main: '#8B5CF6', dark: '#6D28D9' },
  { main: '#06B6D4', dark: '#0E7490' },
  { main: '#10B981', dark: '#047857' },
  { main: '#F59E0B', dark: '#B45309' },
];

const FALLBACK_COLOR = { main: '#6366F1', dark: '#4338CA' };

/** Groups planned costs by category into donut slices (angles in radians, clockwise from 0). */
export function buildBudgetSlices(items: BudgetItem[]): SliceData[] {
  if (!items.length) return [];
  const grouped = new Map<string, number>();
  for (const item of items) {
    const category = item.category || 'Other';
    grouped.set(category, (grouped.get(category) ?? 0) + item.estimated_cost);
  }

  const totalPlanned = Array.from(grouped.values()).reduce((a, b) => a + b, 0);
  const denominator = totalPlanned > 0 ? totalPlanned : 1;

  let currentAngle = 0;
  return Array.from(grouped.entries(), ([category, amount], index) => {
    const percent = amount / denominator;
    const palette = CATEGORY_COLORS[category] ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length] ?? FALLBACK_COLOR;
    const startAngle = currentAngle;
    currentAngle += percent * Math.PI * 2;
    return { category, amount, percent, startAngle, endAngle: currentAngle, color: palette.main, darkColor: palette.dark };
  });
}
