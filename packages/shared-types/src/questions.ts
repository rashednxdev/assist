import { z } from 'zod';
import {
  BOOK_LANGUAGES,
  OPTION_KEYS,
  QUESTION_DIFFICULTIES,
  QUESTION_LINK_LEVELS,
} from '@ibas/shared-constants';
import { explanationSectionSchema, type ExplanationSection } from './explanation.js';
import { comparisonTableSchema, type ComparisonTable } from './comparison-table.js';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const questionBookLinkInputSchema = z.object({
  id: mongoId.optional(),
  link_level: z.enum(QUESTION_LINK_LEVELS),
  book_chapter_id: mongoId,
  book_topic_id: mongoId.optional(),
  book_sub_topic_id: mongoId.optional(),
  regulation_id: mongoId.optional(),
});

export const questionOptionInputSchema = z.object({
  option_key: z.enum(OPTION_KEYS),
  option_text_en: z.string().min(1),
  option_text_bn: z.string().optional(),
});

const questionFieldsSchema = z.object({
  question_type_id: mongoId,
  book_chapter_id: mongoId.optional(),
  book_topic_id: mongoId.optional(),
  book_sub_topic_id: mongoId.optional(),
  regulation_id: mongoId.optional(),
  link_level: z.enum(QUESTION_LINK_LEVELS).optional(),
  body_en: z.string().min(1, 'Question text is required'),
  body_bn: z.string().optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES),
  marks: z.number().positive(),
  negative_marks: z.number().min(0).optional(),
  time_seconds: z.number().int().positive(),
  language: z.enum(BOOK_LANGUAGES).default('both'),
  explanation_sections: z.array(explanationSectionSchema).optional(),
  model_answer_sections: z.array(explanationSectionSchema).optional(),
  /** Comparison table model answer for DIFFERENCES question type. */
  model_answer_comparison: comparisonTableSchema.optional(),
  model_answer: z.string().optional(),
  note: z.string().optional(),
  reference_regulation_id: mongoId.optional(),
  options: z.array(questionOptionInputSchema).optional(),
  correct_option_key: z.enum(OPTION_KEYS).optional(),
  correct_true_false: z.enum(['true', 'false']).optional(),
  book_links: z.array(questionBookLinkInputSchema).optional(),
});

function validateBookLink(
  data: {
    link_level?: string;
    book_chapter_id?: string;
    book_topic_id?: string;
    book_sub_topic_id?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (!data.link_level) return;
  if (!data.book_chapter_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Chapter is required when linking to book content',
      path: ['book_chapter_id'],
    });
  }
  if (data.link_level === 'rule' && !data.book_topic_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Rule/topic is required when link level is rule',
      path: ['book_topic_id'],
    });
  }
  if (data.link_level === 'sub_rule' && (!data.book_topic_id || !data.book_sub_topic_id)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Rule and sub-rule are required when link level is sub-rule',
      path: ['book_sub_topic_id'],
    });
  }
}

function validateBookLinkItem(
  data: {
    link_level: string;
    book_chapter_id?: string;
    book_topic_id?: string;
    book_sub_topic_id?: string;
  },
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
) {
  if (!data.book_chapter_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Chapter is required when linking to book content',
      path: [...pathPrefix, 'book_chapter_id'],
    });
  }
  if (data.link_level === 'rule' && !data.book_topic_id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Rule/topic is required when link level is rule',
      path: [...pathPrefix, 'book_topic_id'],
    });
  }
  if (data.link_level === 'sub_rule' && (!data.book_topic_id || !data.book_sub_topic_id)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Rule and sub-rule are required when link level is sub-rule',
      path: [...pathPrefix, 'book_sub_topic_id'],
    });
  }
}

export const createQuestionSchema = questionFieldsSchema.superRefine((data, ctx) => {
  if (data.book_links?.length) {
    data.book_links.forEach((link, i) => validateBookLinkItem(link, ctx, ['book_links', i]));
  } else {
    validateBookLink(data, ctx);
  }
});

export const updateQuestionSchema = questionFieldsSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const similarQuestionsQuerySchema = z.object({
  text: z.string().min(1),
  question_type_id: mongoId,
  exclude_id: mongoId.optional(),
  threshold: z.coerce.number().min(0).max(1).default(0.6),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const listQuestionsQuerySchema = z.object({
  q: z.string().optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
  question_type_id: mongoId.optional(),
  question_type_code: z.string().optional(),
  is_published: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /** When true, list soft-deleted (trashed) questions only. */
  trashed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  book_chapter_id: mongoId.optional(),
  book_topic_id: mongoId.optional(),
  book_sub_topic_id: mongoId.optional(),
  regulation_id: mongoId.optional(),
  /** Filter questions linked to any chapter of this book. */
  book_info_id: mongoId.optional(),
  /** Page size (load first N, then request more with offset). */
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** How many rows to skip (for infinite scroll / pagination). */
  offset: z.coerce.number().int().min(0).default(0),
});

export const marathonReviewQuerySchema = z.object({
  q: z.string().optional(),
  /** Page size (load first N, then request more with offset). */
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** How many rows to skip (for sequential / paginated loads). */
  offset: z.coerce.number().int().min(0).default(0),
});

export type MarathonReviewQuery = z.infer<typeof marathonReviewQuerySchema>;

export const createQuestionTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32).regex(/^[A-Z0-9_]+$/),
  has_options: z.boolean(),
  note: z.string().optional(),
});

export const updateQuestionTypeSchema = createQuestionTypeSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const generateQuestionAiSchema = z.object({
  question_type_id: mongoId,
  book_chapter_id: mongoId,
  book_topic_id: mongoId.optional(),
  book_sub_topic_id: mongoId.optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
  instructions: z.string().max(500).optional(),
});

export type GenerateQuestionAiDto = z.infer<typeof generateQuestionAiSchema>;

export interface GeneratedQuestionDraft {
  body_en: string;
  body_bn: string;
  options: QuestionOptionInput[];
  correct_option_key?: (typeof OPTION_KEYS)[number];
  correct_true_false?: 'true' | 'false';
  explanation_sections: ExplanationSection[];
  model_answer_sections: ExplanationSection[];
}

/** One MCQ row from CSV (first 7 columns). Extra columns like topic are ignored. */
export const batchMcqImportRowSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
  option_a: z.string().min(1, 'Option A is required'),
  option_b: z.string().min(1, 'Option B is required'),
  option_c: z.string().min(1, 'Option C is required'),
  option_d: z.string().min(1, 'Option D is required'),
  correct_option: z
    .string()
    .min(1)
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.enum(['a', 'b', 'c', 'd'], { errorMap: () => ({ message: 'Correct option must be A, B, C, or D' }) })),
  explanation: z.string().optional().default(''),
});

export const batchMcqImportSchema = z.object({
  book_chapter_id: mongoId,
  publish: z.boolean().optional().default(false),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional().default('medium'),
  marks: z.number().positive().optional().default(1),
  negative_marks: z.number().min(0).optional().default(0),
  time_seconds: z.number().int().positive().optional().default(60),
  language: z.enum(BOOK_LANGUAGES).optional().default('bn'),
  rows: z.array(batchMcqImportRowSchema).min(1).max(500),
});

export type BatchMcqImportRow = z.infer<typeof batchMcqImportRowSchema>;
export type BatchMcqImportDto = z.infer<typeof batchMcqImportSchema>;

/** One descriptive row: question + optional model-answer title/description/note. */
export const batchDescriptiveImportRowSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
  title: z.string().optional().default(''),
  description: z.string().optional().default(''),
  note: z.string().optional().default(''),
});

export const batchDescriptiveImportSchema = z.object({
  book_chapter_id: mongoId,
  /** Existing question type id (prefer current Descriptive). Must be a non-option type. */
  question_type_id: mongoId.optional(),
  publish: z.boolean().optional().default(false),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional().default('medium'),
  marks: z.number().positive().optional().default(5),
  negative_marks: z.number().min(0).optional().default(0),
  time_seconds: z.number().int().positive().optional().default(300),
  language: z.enum(BOOK_LANGUAGES).optional().default('bn'),
  rows: z.array(batchDescriptiveImportRowSchema).min(1).max(500),
});

export type BatchDescriptiveImportRow = z.infer<typeof batchDescriptiveImportRowSchema>;
export type BatchDescriptiveImportDto = z.infer<typeof batchDescriptiveImportSchema>;

/** Shared body for batch trash / restore / permanent delete. */
export const batchQuestionIdsSchema = z.object({
  ids: z.array(mongoId).min(1, 'Select at least one question').max(100),
});

export type BatchQuestionIdsDto = z.infer<typeof batchQuestionIdsSchema>;

export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema>;
export type QuestionBookLinkInput = z.infer<typeof questionBookLinkInputSchema>;
export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;
export type CreateQuestionTypeDto = z.infer<typeof createQuestionTypeSchema>;
export type UpdateQuestionTypeDto = z.infer<typeof updateQuestionTypeSchema>;
