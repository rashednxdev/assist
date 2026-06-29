import { z } from 'zod';
import { SELF_RATING_LEVELS } from '@ibas/shared-constants';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const upsertQuestionEvaluationSchema = z
  .object({
    selected_option_id: mongoId.optional(),
    self_rating: z.enum(SELF_RATING_LEVELS).optional(),
  })
  .superRefine((data, ctx) => {
    const hasOption = !!data.selected_option_id;
    const hasRating = !!data.self_rating;
    if (hasOption === hasRating) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either selected_option_id (MCQ/TF) or self_rating (descriptive)',
        path: ['selected_option_id'],
      });
    }
  });

export const batchQuestionEvaluationQuerySchema = z.object({
  ids: z.string().min(1),
});

export type UpsertQuestionEvaluationDto = z.infer<typeof upsertQuestionEvaluationSchema>;

export interface QuestionEvaluationRecord {
  question_id: string;
  progress_index: number;
  is_correct?: boolean;
  self_rating?: (typeof SELF_RATING_LEVELS)[number];
  selected_option_id?: string;
  updated_at?: string;
}

export interface ProgressSummary {
  total_questions: number;
  rated_questions: number;
  progress_percent: number;
}

export interface BookScopeProgress extends ProgressSummary {
  id: string;
  name: string;
  type: 'book' | 'chapter' | 'topic' | 'sub_topic';
  rule_number?: string;
  children?: BookScopeProgress[];
}

export interface PaperScopeProgress extends ProgressSummary {
  id: string;
  name: string;
  type: 'paper' | 'group' | 'question';
  question_number?: number;
  display_question_number?: string;
  children?: PaperScopeProgress[];
}
