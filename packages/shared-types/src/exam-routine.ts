import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');

export const createExamRoutineSchema = z.object({
  exam_name_id: mongoId,
  start_date: dateStr,
  /** Optional note shown with the countdown on mobile/home. */
  start_date_note: z.string().max(500).optional(),
});

export const updateExamRoutineSchema = z.object({
  start_date: dateStr.optional(),
  start_date_note: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const createExamRoutineEntrySchema = z.object({
  exam_subject_id: mongoId,
  date: dateStr,
  time: timeStr,
  instruction: z.string().max(4000).optional(),
});

export const updateExamRoutineEntrySchema = z.object({
  date: dateStr.optional(),
  time: timeStr.optional(),
  instruction: z.string().max(4000).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export type CreateExamRoutineDto = z.infer<typeof createExamRoutineSchema>;
export type UpdateExamRoutineDto = z.infer<typeof updateExamRoutineSchema>;
export type CreateExamRoutineEntryDto = z.infer<typeof createExamRoutineEntrySchema>;
export type UpdateExamRoutineEntryDto = z.infer<typeof updateExamRoutineEntrySchema>;

export interface ExamRoutineListItem {
  id: string;
  exam_name_id: string;
  exam_name: string;
  start_date: string;
  start_date_note?: string;
  entry_count: number;
}

export interface ExamRoutineEntryItem {
  id: string;
  exam_subject_id: string;
  subject_name: string;
  date: string;
  time: string;
  instruction?: string;
  sort_order: number;
}

export interface ExamRoutineDetail {
  id: string;
  exam_name_id: string;
  exam_name: string;
  start_date: string;
  start_date_note?: string;
  entries: ExamRoutineEntryItem[];
}
