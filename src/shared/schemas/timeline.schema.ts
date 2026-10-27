// ===========================================
// Timeline Validation Schemas
// ===========================================

import { z } from 'zod';
import { TIMELINE_STATUSES } from '../constants/statusEnums.js';

export const createTimelineItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  due_date: z.string().datetime({ offset: true }).optional(),
  status: z.enum(TIMELINE_STATUSES).optional().default('pending'),
  sort_order: z.number().int().min(0).optional(),
});

export const updateTimelineItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.enum(TIMELINE_STATUSES).optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type CreateTimelineItemInput = z.infer<typeof createTimelineItemSchema>;
export type UpdateTimelineItemInput = z.infer<typeof updateTimelineItemSchema>;
