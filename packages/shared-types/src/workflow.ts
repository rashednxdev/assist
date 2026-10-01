import { z } from 'zod';
import { STEP_ACTIONS, TASK_RUN_STATUSES, WORKFLOW_FIELD_TYPES } from '@ibas/shared-constants';

const fieldBaseSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  label_bn: z.string().optional(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  placeholder_bn: z.string().optional(),
  validation: z.string().optional(),
  hint: z.string().optional(),
  hint_bn: z.string().optional(),
  sort_order: z.number().int(),
});

export const workflowFieldSchema = z.discriminatedUnion('type', [
  fieldBaseSchema.extend({ type: z.literal('text') }),
  fieldBaseSchema.extend({ type: z.literal('number') }),
  fieldBaseSchema.extend({ type: z.literal('date') }),
  fieldBaseSchema.extend({ type: z.literal('otp') }),
  fieldBaseSchema.extend({ type: z.literal('file') }),
  fieldBaseSchema.extend({
    type: z.literal('select'),
    options: z.array(z.string()).min(1),
    options_bn: z.array(z.string()).optional(),
  }),
]);

export type WorkflowField = z.infer<typeof workflowFieldSchema>;
export const workflowFieldTypeSchema = z.enum(WORKFLOW_FIELD_TYPES);

const mongoIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid module id');

export const createTaskSchema = z.object({
  name_en: z.string().min(1, 'Task name is required'),
  name_bn: z.string().optional(),
  code: z
    .string()
    .min(1, 'Task code is required')
    .max(30)
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers, and underscores only'),
  module_id: mongoIdSchema,
  description_en: z.string().min(1, 'Description is required'),
  description_bn: z.string().optional(),
  estimated_time: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  /** iBAS++ Workspace areas whose Procedures tab lists this task. */
  ibas_areas: z.array(z.string().regex(/^IBAS_[A-Z0-9_]{2,30}$/)).max(20).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createStepSchema = z.object({
  title_en: z.string().min(1),
  title_bn: z.string().optional(),
  description_en: z.string().min(1),
  description_bn: z.string().optional(),
  role_code: z.string().min(1),
  fields: z.array(workflowFieldSchema).optional(),
  condition_text: z.string().optional(),
  handoff_msg: z.string().optional(),
  handoff_role: z.string().optional(),
  is_optional: z.boolean().optional(),
  is_auto: z.boolean().optional(),
  nav_menu_path: z.string().optional(),
});

export const updateStepSchema = createStepSchema.partial();

export const reorderStepsSchema = z.object({
  step_ids: z.array(z.string()).min(1),
});

export const startRunSchema = z.object({
  office_code: z.string().min(1).default('HQ-001'),
  fiscal_year: z.string().min(1),
  month: z.string().optional(),
  reference_no: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const respondStepSchema = z.object({
  action: z.enum(STEP_ACTIONS).default('submit'),
  field_responses: z.record(z.unknown()).optional(),
  remarks: z.string().optional(),
});

export const cancelRunSchema = z.object({
  reason: z.string().optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type CreateStepDto = z.infer<typeof createStepSchema>;
export type UpdateStepDto = z.infer<typeof updateStepSchema>;
export type StartRunDto = z.infer<typeof startRunSchema>;
export type RespondStepDto = z.infer<typeof respondStepSchema>;
export type CancelRunDto = z.infer<typeof cancelRunSchema>;

export const taskRunStatusSchema = z.enum(TASK_RUN_STATUSES);

export const workflowRoleInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Code may use capital letters, digits and underscores (start with a letter)'),
  name_en: z.string().trim().min(1, 'Name is required').max(120),
  name_bn: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  description_en: z.string().trim().max(500).default(''),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #1d4ed8'),
  level: z.coerce.number().int().min(1).max(99),
  can_submit: z.boolean().default(false),
  can_forward: z.boolean().default(false),
  can_approve: z.boolean().default(false),
  is_active: z.boolean().default(true),
});
export type WorkflowRoleInput = z.infer<typeof workflowRoleInputSchema>;

export interface WorkflowRoleAdminItem {
  id: string;
  code: string;
  name_en: string;
  name_bn?: string;
  description_en: string;
  color: string;
  level: number;
  can_submit: boolean;
  can_forward: boolean;
  can_approve: boolean;
  is_system: boolean;
  is_active: boolean;
  step_count: number;
  user_count: number;
}
