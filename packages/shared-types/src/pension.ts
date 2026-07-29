import { z } from 'zod';
import { PENSION_LEAVE_DEDUCTION_RULES, PENSION_LEAVE_PAY_CATEGORIES } from '@ibas/shared-constants';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
/** Client/server both synthesize these fallback ids when a leave type isn't seeded in the DB (see ensureRestLeaveType / ensureSuspensionAndUnauthorizedLeaveTypes). */
const autoLeaveTypeId = z.enum(['__auto_rest__', '__auto_suspension__', '__auto_unauthorised__']);

export const pensionLeaveTypeSchema = z.object({
  id: z.string(),
  code: z.string().min(1).max(32),
  name_en: z.string().min(1),
  name_bn: z.string().optional(),
  description_en: z.string().optional(),
  pay_category: z.enum(PENSION_LEAVE_PAY_CATEGORIES),
  deduction_rule: z.enum(PENSION_LEAVE_DEDUCTION_RULES),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  is_auto_entitlement: z.boolean().default(false),
  entitlement_days_per_cycle: z.number().positive().optional(),
  entitlement_cycle_years: z.number().positive().optional(),
  allowance_basic_months: z.number().positive().optional(),
});

export const createPensionLeaveTypeSchema = pensionLeaveTypeSchema.omit({ id: true }).extend({
  code: z.string().min(1).max(32).regex(/^[A-Z0-9_]+$/),
});

export const updatePensionLeaveTypeSchema = createPensionLeaveTypeSchema.partial();

export const pensionEnjoyedLeaveSchema = z.object({
  leave_type_id: z.union([mongoId, autoLeaveTypeId]),
  days: z.number().positive(),
});

export const pensionCalculateSchema = z.object({
  join_date: z.string().min(1),
  end_date: z.string().min(1),
  last_basic_salary: z.number().positive(),
  enjoyed_leaves: z.array(pensionEnjoyedLeaveSchema).default([]),
});

export const pensionPrlCalculateSchema = z.object({
  dob: z.string().min(1),
  prl_date: z.string().min(1).optional(),
  total_leave_months: z.number().min(0),
  last_basic_salary: z.number().positive(),
  chosen_lump_sum_months: z.number().min(0).optional(),
});

export type PensionLeaveTypeDto = z.infer<typeof pensionLeaveTypeSchema>;
export type CreatePensionLeaveTypeDto = z.infer<typeof createPensionLeaveTypeSchema>;
export type UpdatePensionLeaveTypeDto = z.infer<typeof updatePensionLeaveTypeSchema>;
export type PensionCalculateDto = z.infer<typeof pensionCalculateSchema>;
export type PensionPrlCalculateDto = z.infer<typeof pensionPrlCalculateSchema>;
