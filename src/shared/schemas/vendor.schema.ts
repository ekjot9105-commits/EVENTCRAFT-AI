// ===========================================
// Vendor Validation Schemas
// ===========================================

import { z } from 'zod';
import { VENDOR_STATUSES } from '../constants/statusEnums.js';

export const createVendorSchema = z.object({
  category: z.string().min(1, 'Category is required').max(100),
  name: z.string().min(1, 'Vendor name is required').max(200),
  contact_name: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').max(254).optional().or(z.literal('')),
  website: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  status: z.enum(VENDOR_STATUSES).optional().default('not_started'),
  quoted_cost: z.number().min(0).max(10_000_000).optional(),
  final_cost: z.number().min(0).max(10_000_000).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateVendorSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  contact_name: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().max(254).optional().nullable().or(z.literal('')),
  website: z.string().url().max(500).optional().nullable().or(z.literal('')),
  status: z.enum(VENDOR_STATUSES).optional(),
  quoted_cost: z.number().min(0).max(10_000_000).optional().nullable(),
  final_cost: z.number().min(0).max(10_000_000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
