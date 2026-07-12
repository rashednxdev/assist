import { z } from 'zod';
import { USER_STATUSES, USER_TYPES } from '@ibas/shared-constants';

export const workflowRoleTagSchema = z.object({
  role_id: z.string(),
  role_code: z.string(),
  is_active: z.boolean(),
  assigned_at: z.coerce.date(),
  assigned_by: z.string(),
});

export const userSchema = z.object({
  _id: z.string().optional(),
  employee_id: z.string().optional(),
  nid: z.string().optional(),
  full_name_en: z.string().min(1),
  full_name_bn: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(11),
  dob: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  profile_photo: z.string().url().optional(),
  user_type: z.enum(USER_TYPES),
  workflow_roles: z.array(workflowRoleTagSchema).default([]),
  status: z.enum(USER_STATUSES),
  is_verified: z.boolean(),
  is_super_admin: z.boolean(),
  created_by: z.string(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginDto = z.infer<typeof loginSchema>;

export * from './auth.js';
export * from './workflow.js';
export * from './bilingual.js';
export * from './users.js';
export * from './setup.js';
export * from './books.js';
export * from './explanation.js';
export * from './comparison-table.js';
export * from './questions.js';
export * from './exams.js';
export * from './syllabus.js';
export * from './papers.js';
export * from './subscription.js';
export * from './evaluation.js';
export * from './pension.js';
export * from './pension-calculator.js';
export * from './joining-period.js';
export * from './joining-period-calculator.js';
