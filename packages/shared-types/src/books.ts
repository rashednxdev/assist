import { z } from 'zod';
import { BOOK_LANGUAGES, REGULATION_TYPES } from '@ibas/shared-constants';

export const createBookTypeSchema = z.object({
  name: z.string().min(1),
  name_bn: z.string().min(1),
  code: z.string().min(1).regex(/^[A-Z0-9_]+$/),
  description: z.string().optional(),
  notes: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().optional(),
});

export const updateBookTypeSchema = createBookTypeSchema.partial();

export const createBookSchema = z.object({
  book_type_id: z.string().regex(/^[a-f\d]{24}$/i),
  name: z.string().min(1),
  name_bn: z.string().min(1),
  short_name: z.string().min(1),
  description: z.string().min(1),
  edition: z.string().optional(),
  publish_date: z.coerce.date().optional(),
  published_by: z.string().optional(),
  effective_date: z.coerce.date().optional(),
  is_part: z.boolean().default(false),
  language: z.enum(BOOK_LANGUAGES).default('both'),
  cover_image_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateBookSchema = createBookSchema.partial().extend({
  is_active: z.boolean().optional(),
  is_superseded: z.boolean().optional(),
  superseded_by: z.string().optional(),
});

export const createBookPartSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().optional(),
  description: z.string().optional(),
  part_number: z.number().int().positive(),
});

export const createBookChapterSchema = z.object({
  book_parts_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  name: z.string().min(1),
  sub_name: z.string().optional(),
  chapter_number: z.string().min(1),
  description: z.string().optional(),
  sort_order: z.number().int().positive().optional(),
});

export const updateBookChapterSchema = createBookChapterSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createBookTopicSchema = z.object({
  name: z.string().optional(),
  sub_name: z.string().optional(),
  rule_number: z.string().min(1),
  description: z.string().optional(),
  note: z.string().optional(),
  effective_date: z.coerce.date().optional(),
  sort_order: z.number().int().positive().optional(),
});

export const updateBookTopicSchema = createBookTopicSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const bookSubTopicFieldsSchema = z.object({
  name: z.string().optional(),
  rule_number: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
  sort_order: z.number().int().positive().optional(),
});

export const createBookSubTopicSchema = bookSubTopicFieldsSchema.refine(
  (data) => Boolean(data.name?.trim() || data.rule_number?.trim()),
  { message: 'Sub-rule number or title is required' },
);

export const updateBookSubTopicSchema = bookSubTopicFieldsSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createRegulationSchema = z.object({
  book_info_id: z.string().regex(/^[a-f\d]{24}$/i),
  book_chapter_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  book_topic_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  regulation_no: z.string().min(1),
  title: z.string().min(1),
  full_text: z.string().min(1),
  regulation_type: z.enum(REGULATION_TYPES),
  effective_date: z.coerce.date(),
  applicable_to: z.array(z.string()).min(1),
  payment_related: z.boolean().default(false),
  receipt_related: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

export const updateRegulationSchema = createRegulationSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createAmendmentSchema = z.object({
  amendment_no: z.string().min(1),
  amendment_date: z.coerce.date(),
  issued_by: z.string().min(1),
  circular_ref: z.string().optional(),
  old_text: z.string().optional(),
  new_text: z.string().min(1),
  change_summary: z.string().min(1),
});

export const bookTreeQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(5).default(2),
});

export const bookChildrenQuerySchema = z.object({
  type: z.enum(['part', 'chapter', 'topic']),
  id: z.string().regex(/^[a-f\d]{24}$/i),
});

export const regulationSearchSchema = z.object({
  q: z.string().optional(),
  book_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  regulation_type: z.enum(REGULATION_TYPES).optional(),
  payment_related: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateBookTypeDto = z.infer<typeof createBookTypeSchema>;
export type UpdateBookTypeDto = z.infer<typeof updateBookTypeSchema>;
export type CreateBookDto = z.infer<typeof createBookSchema>;
export type UpdateBookDto = z.infer<typeof updateBookSchema>;
export type CreateBookChapterDto = z.infer<typeof createBookChapterSchema>;
export type UpdateBookChapterDto = z.infer<typeof updateBookChapterSchema>;
export type CreateBookTopicDto = z.infer<typeof createBookTopicSchema>;
export type UpdateBookTopicDto = z.infer<typeof updateBookTopicSchema>;
export type CreateBookSubTopicDto = z.infer<typeof createBookSubTopicSchema>;
export type UpdateBookSubTopicDto = z.infer<typeof updateBookSubTopicSchema>;
export type CreateRegulationDto = z.infer<typeof createRegulationSchema>;
export type UpdateRegulationDto = z.infer<typeof updateRegulationSchema>;
export type CreateAmendmentDto = z.infer<typeof createAmendmentSchema>;
