import { apiFetch } from './api';
import type { QuestionOption } from '@/types/questions';

export type SelfRatingLevel = 'overall' | 'understand' | 'confidence';

export interface ProgressSummary {
  total_questions: number;
  rated_questions: number;
  progress_percent: number;
}

export interface PaperScopeProgress extends ProgressSummary {
  id: string;
  name: string;
  type: 'paper' | 'group' | 'question';
  question_number?: number;
  display_question_number?: string;
  children?: PaperScopeProgress[];
}

export interface PaperEvaluationData {
  paper: {
    id: string;
    name: string;
    total_marks: number;
    pass_marks: number;
  };
  overall: PaperScopeProgress;
}

export interface QuestionPracticeStem {
  id: string;
  body_en: string;
  body_bn?: string;
  question_type_code: string;
  has_options: boolean;
  options: QuestionOption[];
}

export interface QuestionEvaluationRecord {
  question_id: string;
  progress_index: number;
  is_correct?: boolean;
  self_rating?: SelfRatingLevel;
  selected_option_id?: string;
}

export async function fetchQuestionPracticeStem(questionId: string) {
  const res = await apiFetch<{ data: QuestionPracticeStem }>(`/evaluation/questions/${questionId}/practice`);
  return res.data;
}

export async function fetchQuestionEvaluation(questionId: string) {
  const res = await apiFetch<{ data: QuestionEvaluationRecord }>(`/evaluation/questions/${questionId}`);
  return res.data;
}

export async function upsertQuestionEvaluation(
  questionId: string,
  payload: { selected_option_id?: string; self_rating?: SelfRatingLevel },
) {
  const res = await apiFetch<{ data: QuestionEvaluationRecord }>(`/evaluation/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchPaperEvaluation(paperId: string) {
  const res = await apiFetch<{ data: PaperEvaluationData }>(`/evaluation/papers/${paperId}`);
  return res.data;
}

export function buildPaperQuestionProgressMap(overall: PaperScopeProgress): Map<string, number> {
  const map = new Map<string, number>();

  function walk(node: PaperScopeProgress) {
    if (node.type === 'question') {
      map.set(node.id, node.progress_percent);
    }
    node.children?.forEach(walk);
  }

  walk(overall);
  return map;
}
