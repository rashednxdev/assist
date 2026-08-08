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

export interface QuestionEvalBrief {
  question_id: string;
  progress_index: number;
  is_correct?: boolean;
  self_rating?: SelfRatingLevel;
}

export async function fetchQuestionEvaluationsBatch(questionIds: string[]) {
  const unique = [...new Set(questionIds.filter(Boolean))];
  if (unique.length === 0) return [] as QuestionEvalBrief[];
  const res = await apiFetch<{ data: QuestionEvalBrief[] }>(
    `/evaluation/questions/batch?ids=${unique.join(',')}`,
  );
  return res.data;
}

const BATCH_CHUNK_SIZE = 200;

/** Like fetchQuestionEvaluationsBatch, but splits large id lists into parallel chunked requests
 * so a full unfiltered question bank doesn't produce one oversized query string. */
export async function fetchQuestionEvaluationsBatchChunked(questionIds: string[]) {
  const unique = [...new Set(questionIds.filter(Boolean))];
  if (unique.length === 0) return [] as QuestionEvalBrief[];
  if (unique.length <= BATCH_CHUNK_SIZE) return fetchQuestionEvaluationsBatch(unique);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + BATCH_CHUNK_SIZE));
  }
  const results = await Promise.all(chunks.map((chunk) => fetchQuestionEvaluationsBatch(chunk)));
  return results.flat();
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

export interface PaperAttemptRecord {
  id: string;
  paper_id: string;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  total_marks: number;
  scored_marks: number;
  pass_marks: number;
  is_pass: boolean;
  duration_seconds?: number;
  submitted_at: string;
}

export async function submitPaperAttempt(
  paperId: string,
  payload: { answers: { question_id: string; selected_option_id: string }[]; duration_seconds?: number },
) {
  const res = await apiFetch<{ data: PaperAttemptRecord }>(`/evaluation/papers/${paperId}/attempts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function fetchPaperAttempts(paperId: string) {
  const res = await apiFetch<{ data: PaperAttemptRecord[] }>(`/evaluation/papers/${paperId}/attempts`);
  return res.data;
}

export interface ProgressDashboardData {
  mcq: {
    submitted: number;
    correct: number;
    incorrect: number;
    accuracy_percent: number;
  };
  papers: {
    attempted: number;
    rated_questions: number;
    total_questions: number;
    average_progress_percent: number;
    items: Array<{
      id: string;
      name: string;
      session_year?: string;
      total_marks: number;
      pass_marks: number;
      total_questions: number;
      rated_questions: number;
      progress_percent: number;
    }>;
  };
  exam_attempts: {
    total_attempts: number;
    papers_attempted: number;
    papers_passed: number;
    items: Array<{
      paper_id: string;
      paper_name: string;
      attempts_count: number;
      best_scored_marks: number;
      best_total_marks: number;
      best_percent: number;
      is_pass: boolean;
      last_submitted_at: string;
    }>;
  };
}

export async function fetchProgressDashboard() {
  const res = await apiFetch<{ data: ProgressDashboardData }>('/evaluation/dashboard');
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
