// ===========================================
// Budget Validation Schemas
// ===========================================

import { z } from 'zod';

export const createBudgetItemSchema = z.object({
  category: z.string().min(1, 'Category is required').max(100),
  name: z.string().min(1, 'Name is required').max(200),
  estimated_cost: z.number().min(0, 'Cost cannot be negative').max(10_000_000),
  actual_cost: z.number().min(0).max(10_000_000).optional(),
  paid: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional(),
});

export const updateBudgetItemSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  estimated_cost: z.number().min(0).max(10_000_000).optional(),
  actual_cost: z.number().min(0).max(10_000_000).optional().nullable(),
  paid: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
