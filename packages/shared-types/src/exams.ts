import { z } from 'zod';
import { AUTHORITY_TYPES } from '@ibas/shared-constants';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().min(1),
  identity: z.string().optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createAuthoritySchema = z.object({
  department_id: mongoId,
  name: z.string().min(1),
  authority_type: z.enum(AUTHORITY_TYPES),
  description: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
});

export const updateAuthoritySchema = createAuthoritySchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createExamNameSchema = z.object({
  authority_id: mongoId,
  name: z.string().min(1),
  name_bn: z.string().optional(),
  short_name: z.string().min(1),
  short_name_bn: z.string().optional(),
  goal: z.string().optional(),
  description: z.string().optional(),
  eligibility_criteria: z.string().optional(),
  passing_criteria: z.string().optional(),
  total_attempts_allowed: z.number().int().positive().optional(),
  registration_fee: z.number().min(0),
});

export const updateExamNameSchema = createExamNameSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createExamPartSchema = z.object({
  exam_name_id: mongoId,
  name: z.string().min(1),
  name_bn: z.string().optional(),
  part_number: z.number().int().positive(),
  description: z.string().optional(),
  total_marks: z.number().positive(),
  total_marks_bn: z.string().optional(),
  pass_marks: z.number().min(0),
  pass_marks_bn: z.string().optional(),
  qualifier_outline: z.string().optional(),
  note: z.string().optional(),
});

export const updateExamPartSchema = createExamPartSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createExamTypeSchema = z.object({
  exam_name_id: mongoId,
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  total_marks: z.number().positive(),
  pass_marks: z.number().min(0),
  total_time: z.number().int().positive(),
  note: z.string().optional(),
});

export const updateExamTypeSchema = createExamTypeSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createExamSubjectSchema = z.object({
  exam_part_id: mongoId,
  exam_type_id: mongoId,
  name: z.string().min(1),
  name_bn: z.string().optional(),
  total_marks: z.number().positive(),
  total_marks_bn: z.string().optional(),
  pass_marks: z.number().min(0),
  pass_marks_bn: z.string().optional(),
});

export const updateExamSubjectSchema = createExamSubjectSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
export type CreateAuthorityDto = z.infer<typeof createAuthoritySchema>;
export type UpdateAuthorityDto = z.infer<typeof updateAuthoritySchema>;
export type CreateExamNameDto = z.infer<typeof createExamNameSchema>;
export type UpdateExamNameDto = z.infer<typeof updateExamNameSchema>;
export type CreateExamPartDto = z.infer<typeof createExamPartSchema>;
export type UpdateExamPartDto = z.infer<typeof updateExamPartSchema>;
export type CreateExamTypeDto = z.infer<typeof createExamTypeSchema>;
export type UpdateExamTypeDto = z.infer<typeof updateExamTypeSchema>;
export type CreateExamSubjectDto = z.infer<typeof createExamSubjectSchema>;
export type UpdateExamSubjectDto = z.infer<typeof updateExamSubjectSchema>;
