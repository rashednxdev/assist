import type { QuestionEvalBrief, SelfRatingLevel } from '@/lib/evaluation-api';
import type { PaperQuestionRow } from '@/types/papers';

export type { QuestionEvalBrief };

export const RATING_CIRCLE_COLORS: Record<SelfRatingLevel, string> = {
  overall: '#fdba74',
  understand: '#86efac',
  confidence: '#16a34a',
};

const SELF_RATING_LABEL: Record<SelfRatingLevel, string> = {
  overall: 'Overall',
  understand: 'Understand',
  confidence: 'Confidence',
};

export function ratingIndicatorTitle(evaluation: QuestionEvalBrief | undefined): string | undefined {
  if (!evaluation) return undefined;
  if (evaluation.self_rating) return SELF_RATING_LABEL[evaluation.self_rating];
  if (evaluation.is_correct === true) return 'Correct';
  if (evaluation.is_correct === false) return 'Incorrect';
  if (evaluation.progress_index > 0) return `${evaluation.progress_index}%`;
  return undefined;
}

export function ratingCircleColor(evaluation: QuestionEvalBrief | undefined): string | null {
  if (!evaluation) return null;
  if (evaluation.self_rating) return RATING_CIRCLE_COLORS[evaluation.self_rating];
  if (evaluation.is_correct === true) return RATING_CIRCLE_COLORS.confidence;
  if (evaluation.is_correct === false) return RATING_CIRCLE_COLORS.overall;
  if (evaluation.progress_index > 0) return RATING_CIRCLE_COLORS.confidence;
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

export function formatEvaluationStatusLabel(
  evaluation: QuestionEvalBrief | null | undefined,
  hasOptions?: boolean,
): string {
  if (!evaluation || evaluation.progress_index <= 0) {
    return 'Learn and Evaluate';
  }
  if (hasOptions && evaluation.is_correct !== undefined) {
    return evaluation.is_correct ? 'Correct' : 'Incorrect';
  }
  if (evaluation.self_rating) {
    return SELF_RATING_LABEL[evaluation.self_rating];
  }
  return 'Evaluated';
}
