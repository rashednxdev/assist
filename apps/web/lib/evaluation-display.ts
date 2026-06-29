import type { SelfRatingLevel } from '@ibas/shared-constants';
import type { PaperQuestionRow } from '@/lib/paper-display';

export interface QuestionEvalBrief {
  question_id: string;
  progress_index: number;
  self_rating?: SelfRatingLevel;
  is_correct?: boolean;
}

const SELF_RATING_CIRCLE: Record<SelfRatingLevel, string> = {
  overall: 'bg-green-200',
  understand: 'bg-green-400',
  confidence: 'bg-green-600',
};

const SELF_RATING_LABEL: Record<SelfRatingLevel, string> = {
  overall: 'Overall (50%)',
  understand: 'Understand (75%)',
  confidence: 'Confidence (100%)',
};

export function ratingIndicatorTitle(evaluation: QuestionEvalBrief | undefined): string | undefined {
  if (!evaluation) return undefined;
  if (evaluation.self_rating) return SELF_RATING_LABEL[evaluation.self_rating];
  if (evaluation.is_correct === true) return 'Correct';
  if (evaluation.is_correct === false) return 'Incorrect';
  if (evaluation.progress_index > 0) return `${evaluation.progress_index}%`;
  return undefined;
}

export function ratingCircleClass(evaluation: QuestionEvalBrief | undefined): string | null {
  if (!evaluation) return null;
  if (evaluation.self_rating) return SELF_RATING_CIRCLE[evaluation.self_rating];
  if (evaluation.is_correct === true) return SELF_RATING_CIRCLE.confidence;
  if (evaluation.is_correct === false) return 'bg-green-200';
  if (evaluation.progress_index > 0) return SELF_RATING_CIRCLE.confidence;
  return null;
}

export function collectPaperQuestionIds(questions: PaperQuestionRow[]): string[] {
  const ids = new Set<string>();
  for (const pq of questions) {
    if (pq.from_question_bank && pq.question_id) ids.add(pq.question_id);
    for (const part of pq.parts) ids.add(part.question_id);
  }
  return [...ids];
}
