import { z } from 'zod';
import {
  BOOK_LANGUAGES,
  OPTION_KEYS,
  QUESTION_DIFFICULTIES,
  QUESTION_LINK_LEVELS,
  QUESTION_REVIEW_STATUSES,
  QUESTION_SORT_OPTIONS,
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
  /** Legacy top-level comparison; prefer nested `section.table`. Null clears the legacy field. */
  model_answer_comparison: comparisonTableSchema.nullish(),
  model_answer: z.string().optional(),
  note: z.string().optional(),
  reference_regulation_id: mongoId.optional(),
  options: z.array(questionOptionInputSchema).optional(),
  correct_option_key: z.enum(OPTION_KEYS).optional(),
  correct_true_false: z.enum(['true', 'false']).optional(),
  book_links: z.array(questionBookLinkInputSchema).optional(),
  /** Create this question as a prototype sharing its model answer from an existing "mother" question. */
  mother_question_id: mongoId.optional(),
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
  /** No longer used to restrict the search — duplicate-checking now spans every question type. */
  question_type_id: mongoId.optional(),
  exclude_id: mongoId.optional(),
  threshold: z.coerce.number().min(0).max(1).default(0.5),
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
  /** Draft / quality_check / published — a finer-grained alternative to is_published. */
  review_status: z.enum(QUESTION_REVIEW_STATUSES).optional(),
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
  /** Filter questions tagged with this exam subject (multi-tag). */
  exam_subject_id: mongoId.optional(),
  /** List sort order, defaults to most-recently-updated first. */
  sort: z.enum(QUESTION_SORT_OPTIONS).optional(),
  /** Page size (load first N, then request more with offset). */
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** How many rows to skip (for infinite scroll / pagination). */
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * "Link to another question's answer" search — any word in `q` matching anywhere in a question
 * (any status except trashed) counts, ranked by % of query words matched, 50%+ by default.
 */
export const linkQuestionSearchQuerySchema = z.object({
  q: z.string().min(1),
  exclude_id: mongoId.optional(),
  book_chapter_id: mongoId.optional(),
  book_info_id: mongoId.optional(),
  /** When set, only published / unpublished questions (paper compose needs published-only). */
  is_published: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  threshold: z.coerce.number().min(0).max(1).default(0.5),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type LinkQuestionSearchQuery = z.infer<typeof linkQuestionSearchQuerySchema>;

export const marathonReviewQuerySchema = z.object({
  q: z.string().optional(),
  /** Page size (load first N, then request more with offset). */
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** How many rows to skip (for sequential / paginated loads). */
  offset: z.coerce.number().int().min(0).default(0),
});

export type MarathonReviewQuery = z.infer<typeof marathonReviewQuerySchema>;

/** Mobile delta-sync: pull questions changed since `since` (omit for a full first sync). */
export const questionsSyncQuerySchema = z.object({
  since: z.coerce.date().optional(),
  /** Opaque `updated_at|id` seek cursor for continuing a run past a same-`updated_at` tie. */
  cursor: z.string().optional(),
  /** Page size within one sync run. */
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type QuestionsSyncQuery = z.infer<typeof questionsSyncQuerySchema>;

export interface QuestionSyncOption {
  /** Real QuestionOption `_id` — needed so an offline-viewed MCQ can still submit `selected_option_id`. */
  id: string;
  option_key: string;
  option_text_en: string;
  option_text_bn?: string;
  is_correct: boolean;
}

export interface QuestionSyncRow {
  id: string;
  question_type_code: string;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  time_seconds: number;
  is_published: boolean;
  is_active: boolean;
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  /** Exam subjects tagged on this question (multi). */
  subjects?: Array<{ id: string; name: string; name_bn?: string }>;
  updated_at: string;
  /** Present only for question_type_code === 'MCQ'. */
  options?: QuestionSyncOption[];
  explanation_sections?: ExplanationSection[];
}

export interface QuestionSyncDeletion {
  question_id: string;
  deleted_at: string;
}

export const createQuestionTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32).regex(/^[A-Z0-9_]+$/),
  has_options: z.boolean(),
  note: z.string().optional(),
});

export const updateQuestionTypeSchema = createQuestionTypeSchema.partial().extend({
  is_active: z.boolean().optional(),
});

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
  book_chapter_id: mongoId.optional(),
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
  book_chapter_id: mongoId.optional(),
  /** Existing question type id (prefer current Descriptive). Must be a non-option type. */
  question_type_id: mongoId.optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional().default('medium'),
  marks: z.number().positive().optional().default(5),
  negative_marks: z.number().min(0).optional().default(0),
  time_seconds: z.number().int().positive().optional().default(300),
  language: z.enum(BOOK_LANGUAGES).optional().default('bn'),
  rows: z.array(batchDescriptiveImportRowSchema).min(1).max(500),
});

export type BatchDescriptiveImportRow = z.infer<typeof batchDescriptiveImportRowSchema>;
export type BatchDescriptiveImportDto = z.infer<typeof batchDescriptiveImportSchema>;

/** One DIFFERENCES row: question + its comparison-table model answer. */
export const batchDifferencesImportRowSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
  model_answer_comparison: comparisonTableSchema,
});

export const batchDifferencesImportSchema = z.object({
  book_chapter_id: mongoId.optional(),
  /** Existing question type id (prefer current DIFFERENCES). Must be a non-option type. */
  question_type_id: mongoId.optional(),
  difficulty: z.enum(QUESTION_DIFFICULTIES).optional().default('medium'),
  marks: z.number().positive().optional().default(5),
  negative_marks: z.number().min(0).optional().default(0),
  time_seconds: z.number().int().positive().optional().default(300),
  language: z.enum(BOOK_LANGUAGES).optional().default('bn'),
  rows: z.array(batchDifferencesImportRowSchema).min(1).max(500),
});

export type BatchDifferencesImportRow = z.infer<typeof batchDifferencesImportRowSchema>;
export type BatchDifferencesImportDto = z.infer<typeof batchDifferencesImportSchema>;

/** Shared body for batch trash / restore / permanent delete. */
export const batchQuestionIdsSchema = z.object({
  ids: z.array(mongoId).min(1, 'Select at least one question').max(100),
});

export type BatchQuestionIdsDto = z.infer<typeof batchQuestionIdsSchema>;

/** Add one exam subject tag to a question (toggle on). */
export const questionSubjectLinkInputSchema = z.object({
  exam_subject_id: mongoId,
});

export type QuestionSubjectLinkInput = z.infer<typeof questionSubjectLinkInputSchema>;

/** Tag many questions with one or more subjects in one action (add-only). */
export const batchQuestionSubjectLinksSchema = z.object({
  ids: z.array(mongoId).min(1, 'Select at least one question').max(100),
  exam_subject_ids: z.array(mongoId).min(1, 'Select at least one subject').max(50),
});

export type BatchQuestionSubjectLinksDto = z.infer<typeof batchQuestionSubjectLinksSchema>;

/** Quick-tag: link a question onto a book's first chapter (Books & Tools chapter questions). */
export const questionBookFirstChapterLinkInputSchema = z.object({
  book_info_id: mongoId,
});

export type QuestionBookFirstChapterLinkInput = z.infer<typeof questionBookFirstChapterLinkInputSchema>;

/** Tag many questions onto each book's first chapter when not already on that book (add-only). */
export const batchQuestionBookFirstChapterLinksSchema = z.object({
  ids: z.array(mongoId).min(1, 'Select at least one question').max(100),
  book_info_ids: z.array(mongoId).min(1, 'Select at least one book').max(50),
});

export type BatchQuestionBookFirstChapterLinksDto = z.infer<
  typeof batchQuestionBookFirstChapterLinksSchema
>;

/** Make this question a "prototype" that shares its model answer from a "mother" question. */
export const setMotherQuestionSchema = z.object({
  mother_question_id: mongoId,
});

export type SetMotherQuestionDto = z.infer<typeof setMotherQuestionSchema>;

/** Page size for answer PDF export — half_a4 uses ~65% font size (35% reduced). */
export const answerPdfPageSizeSchema = z.enum(['a4', 'half_a4']);
export type AnswerPdfPageSize = z.infer<typeof answerPdfPageSizeSchema>;

export const answerPdfRequestSchema = z.object({
  question_ids: z.array(mongoId).min(1).max(40),
  page_size: answerPdfPageSizeSchema.default('a4'),
});
export type AnswerPdfRequestDto = z.infer<typeof answerPdfRequestSchema>;

export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionDto = z.infer<typeof updateQuestionSchema>;
export type QuestionBookLinkInput = z.infer<typeof questionBookLinkInputSchema>;
export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;
export type CreateQuestionTypeDto = z.infer<typeof createQuestionTypeSchema>;
export type UpdateQuestionTypeDto = z.infer<typeof updateQuestionTypeSchema>;
