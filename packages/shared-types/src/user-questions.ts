import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const submitUserQuestionSchema = z.object({
  exam_subject_id: mongoId,
  body: z.string().min(5, 'Please write a more complete question').max(2000),
});

export const rejectUserQuestionSchema = z.object({
  admin_note: z.string().max(500).optional(),
});

export const acceptUserQuestionSchema = z.object({
  linked_question_id: mongoId,
});

export const listAdminSubmittedQuestionsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
});

export type SubmitUserQuestionDto = z.infer<typeof submitUserQuestionSchema>;
export type RejectUserQuestionDto = z.infer<typeof rejectUserQuestionSchema>;
export type AcceptUserQuestionDto = z.infer<typeof acceptUserQuestionSchema>;

export type SubmittedQuestionStatus = 'pending' | 'accepted' | 'rejected';

export interface MySubmittedQuestionRecord {
  id: string;
  exam_subject_id: string;
  subject_name: string;
  body: string;
  status: SubmittedQuestionStatus;
  linked_question_id?: string;
  admin_note?: string;
  created_at: string;
}

export interface AdminSubmittedQuestionRecord {
  id: string;
  user_id: string;
  user_name: string;
  exam_subject_id: string;
  subject_name: string;
  body: string;
  status: SubmittedQuestionStatus;
  linked_question_id?: string;
  admin_note?: string;
  created_at: string;
}
