import { z } from 'zod';
import { SYLLABUS_REF_LEVELS } from '@ibas/shared-constants';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const createSyllabusGroupSchema = z.object({
  exam_subject_id: mongoId,
  name: z.string().min(1),
  marks_allocated: z.number().positive(),
  sort_order: z.number().int().positive().optional(),
});

export const updateSyllabusGroupSchema = createSyllabusGroupSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createSyllabusTopicSchema = z.object({
  syllabus_group_id: mongoId,
  name: z.string().min(1),
  description: z.string().optional(),
  marks_weightage: z.number().min(0).optional(),
  sort_order: z.number().int().positive().optional(),
});

export const updateSyllabusTopicSchema = createSyllabusTopicSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createSyllabusSubTopicSchema = z.object({
  syllabus_topic_id: mongoId,
  name: z.string().min(1),
  description: z.string().optional(),
  sort_order: z.number().int().positive().optional(),
});

export const updateSyllabusSubTopicSchema = createSyllabusSubTopicSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createSyllabusReferenceSchema = z.object({
  syllabus_topic_id: mongoId,
  exam_subject_id: mongoId,
  ref_level: z.enum(SYLLABUS_REF_LEVELS).optional(),
  book_info_id: mongoId.optional(),
  book_chapter_id: mongoId.optional(),
  book_topic_id: mongoId.optional(),
  regulation_id: mongoId.optional(),
  relevance_note: z.string().optional(),
});

export const updateSyllabusReferenceSchema = createSyllabusReferenceSchema.partial();

export type CreateSyllabusGroupDto = z.infer<typeof createSyllabusGroupSchema>;
export type UpdateSyllabusGroupDto = z.infer<typeof updateSyllabusGroupSchema>;
export type CreateSyllabusTopicDto = z.infer<typeof createSyllabusTopicSchema>;
export type UpdateSyllabusTopicDto = z.infer<typeof updateSyllabusTopicSchema>;
export type CreateSyllabusSubTopicDto = z.infer<typeof createSyllabusSubTopicSchema>;
export type UpdateSyllabusSubTopicDto = z.infer<typeof updateSyllabusSubTopicSchema>;
export type CreateSyllabusReferenceDto = z.infer<typeof createSyllabusReferenceSchema>;
export type UpdateSyllabusReferenceDto = z.infer<typeof updateSyllabusReferenceSchema>;
