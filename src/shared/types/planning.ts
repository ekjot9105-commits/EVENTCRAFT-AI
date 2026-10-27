import type { BudgetItem } from './budget.js';
import type { TimelineItem } from './timeline.js';
import type { Vendor } from './vendor.js';

/** Derived figures displayed by the budget workspace and future dashboards. */
export interface BudgetSummary {
  planned_budget: number;
  planned_spending: number;
  actual_spending: number;
  paid_amount: number;
  remaining_budget: number;
  usage_percentage: number;
  over_budget: boolean;
  category_totals: Record<string, { estimated: number; actual: number }>;
  item_count: number;
}

/** Complete event-scoped planning payload used by aggregate views. */
export interface PlanningData {
  budgetItems: BudgetItem[];
  timelineItems: TimelineItem[];
  vendors: Vendor[];
  budgetSummary: BudgetSummary;
}
