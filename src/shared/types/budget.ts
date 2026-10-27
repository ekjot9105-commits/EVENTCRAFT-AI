// ===========================================
// Budget Types
// ===========================================

export interface BudgetItem {
  id: string;
  event_id: string;
  category: string;
  name: string;
  estimated_cost: number;
  actual_cost: number | null;
  paid: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetItemPayload {
  category: string;
  name: string;
  estimated_cost: number;
  actual_cost?: number;
  paid?: boolean;
  notes?: string;
}

export interface UpdateBudgetItemPayload {
  category?: string;
  name?: string;
  estimated_cost?: number;
  actual_cost?: number | null;
  paid?: boolean;
  notes?: string;
}

export interface BudgetSummary {
  total_estimated: number;
  total_actual: number;
  total_paid: number;
  total_remaining: number;
  category_totals: Record<string, { estimated: number; actual: number }>;
  item_count: number;
}
