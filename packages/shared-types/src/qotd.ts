import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');

export const createQotdEntrySchema = z.object({
  exam_subject_id: mongoId,
  date: dateStr,
  /** Hidden from regular users until this time on `date` — defaults to visible all day. */
  publish_time: timeStr.optional(),
  question_ids: z.array(mongoId).min(1).max(50),
});

export const updateQotdEntrySchema = z.object({
  question_ids: z.array(mongoId).min(1).max(50).optional(),
  publish_time: timeStr.optional(),
  is_active: z.boolean().optional(),
});

export const qotdSettingsSchema = z.object({
  show_past_days: z.coerce.number().int().min(0).max(365),
});

export const qotdQuestionsQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateQotdEntryDto = z.infer<typeof createQotdEntrySchema>;
export type UpdateQotdEntryDto = z.infer<typeof updateQotdEntrySchema>;
export type QotdSettingsDto = z.infer<typeof qotdSettingsSchema>;

/** One row in the date-first browse list — a single calendar day's worth of QOTD content. */
export interface QotdDateSummary {
  date: string;
  subject_count: number;
  question_count: number;
}

export interface QotdQuestionItem {
  id: string;
  body_en: string;
  body_bn?: string;
  question_type_code: string;
  marks: number;
  book_name?: string;
}

/** One subject's question set within a date — a date can have several of these. */
export interface QotdSubjectGroup {
  entry_id: string;
  exam_subject_id: string;
  subject_name: string;
  publish_time: string;
  questions: QotdQuestionItem[];
}

export interface QotdDateDetail {
  date: string;
  groups: QotdSubjectGroup[];
}

/** Response shape for creating/updating a single subject's entry within a date. */
export interface QotdEntryRecord {
  id: string;
  exam_subject_id: string;
  date: string;
  publish_time: string;
  question_count: number;
}
