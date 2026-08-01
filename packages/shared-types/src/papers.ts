import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');

export const createPaperTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32),
  description: z.string().optional(),
});

export const updatePaperTypeSchema = createPaperTypeSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const createPaperSchema = z.object({
  exam_subject_id: mongoId,
  paper_type_id: mongoId,
  name: z.string().min(1),
  exam_session_id: mongoId,
  total_marks: z.number().positive(),
  pass_marks: z.number().min(0),
  duration_minutes: z.number().positive(),
  instructions: z.string().optional(),
});

export const updatePaperSchema = createPaperSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const listPapersQuerySchema = z.object({
  exam_subject_id: mongoId.optional(),
  exam_session_id: mongoId.optional(),
  is_published: z.enum(['true', 'false']).optional(),
});

export const publishExamWeekSchema = z.object({
  exam_week_date: dateStr,
  /** Hidden from regular users until this time on exam_week_date — defaults to visible all day. */
  exam_week_publish_time: timeStr.optional(),
});

export interface ExamWeekSummary {
  week_start: string;
  week_end: string;
  paper_count: number;
}

export const createPaperGroupSchema = z.object({
  name: z.string().min(1),
  group_number: z.number().int().positive(),
  marks: z.number().min(0),
  instructions: z.string().optional(),
});

export const updatePaperGroupSchema = createPaperGroupSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const paperQuestionFieldsSchema = z.object({
  from_question_bank: z.boolean().default(false),
  question_id: mongoId.optional(),
  paper_group_id: mongoId.optional(),
  question_number: z.number().int().positive(),
  display_question_number: z.string().optional(),
  header_text: z.string().optional(),
  marks: z.number().min(0),
  marks_display_bn: z.string().optional(),
  is_compulsory: z.boolean().default(true),
});

function validatePaperQuestion(data: z.infer<typeof paperQuestionFieldsSchema>, ctx: z.RefinementCtx) {
  if (data.from_question_bank) {
    if (!data.question_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a published question from the bank',
        path: ['question_id'],
      });
    }
  }
}

export const createPaperQuestionSchema = paperQuestionFieldsSchema.superRefine(validatePaperQuestion);

export const updatePaperQuestionSchema = z
  .object({
    from_question_bank: z.boolean().optional(),
    question_id: mongoId.optional(),
    paper_group_id: mongoId.optional(),
    question_number: z.number().int().positive().optional(),
    display_question_number: z.string().optional(),
    header_text: z.string().optional(),
    marks: z.number().min(0).optional(),
    marks_display_bn: z.string().optional(),
    is_compulsory: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from_question_bank === true && data.question_id !== undefined && !data.question_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Select a published question from the bank',
        path: ['question_id'],
      });
    }
  });

export const batchAddPaperQuestionsSchema = z.object({
  question_ids: z.array(mongoId).min(1),
  marks_per_question: z.number().positive().optional(),
});

export const createChildQuestionSchema = z.object({
  question_id: mongoId,
  part_label: z.string().min(1),
  marks: z.number().min(0),
  marks_display_bn: z.string().optional(),
});

export const updateChildQuestionSchema = createChildQuestionSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type PublishExamWeekDto = z.infer<typeof publishExamWeekSchema>;

export type CreatePaperTypeDto = z.infer<typeof createPaperTypeSchema>;
export type UpdatePaperTypeDto = z.infer<typeof updatePaperTypeSchema>;
export type CreatePaperDto = z.infer<typeof createPaperSchema>;
export type UpdatePaperDto = z.infer<typeof updatePaperSchema>;
export type ListPapersQuery = z.infer<typeof listPapersQuerySchema>;
export type CreatePaperGroupDto = z.infer<typeof createPaperGroupSchema>;
export type UpdatePaperGroupDto = z.infer<typeof updatePaperGroupSchema>;
export type CreatePaperQuestionDto = z.infer<typeof createPaperQuestionSchema>;
export type UpdatePaperQuestionDto = z.infer<typeof updatePaperQuestionSchema>;
export type BatchAddPaperQuestionsDto = z.infer<typeof batchAddPaperQuestionsSchema>;
export type CreateChildQuestionDto = z.infer<typeof createChildQuestionSchema>;
export type UpdateChildQuestionDto = z.infer<typeof updateChildQuestionSchema>;
