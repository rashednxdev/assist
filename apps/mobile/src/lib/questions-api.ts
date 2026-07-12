import { apiFetch } from './api';
import type { MarathonReviewItem } from '@/types/marathon';
import type { QuestionDetail, QuestionListItem, QuestionType } from '@/types/questions';

export async function fetchQuestionTypes() {
  const res = await apiFetch<{ data: QuestionType[] }>('/questions/types');
  return res.data;
}

export async function fetchQuestions(params?: {
  q?: string;
  question_type_code?: string;
  difficulty?: string;
  is_published?: 'true' | 'false' | '';
}) {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  if (params?.question_type_code) search.set('question_type_code', params.question_type_code);
  if (params?.difficulty) search.set('difficulty', params.difficulty);
  if (params?.is_published === 'true' || params?.is_published === 'false') {
    search.set('is_published', params.is_published);
  }
  const qs = search.toString();
  const res = await apiFetch<{ data: QuestionListItem[] }>(`/questions${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function fetchMarathonReview(params?: { q?: string }) {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  const qs = search.toString();
  const res = await apiFetch<{ data: MarathonReviewItem[] }>(
    `/questions/marathon-review${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export async function fetchQuestionDetail(id: string) {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}`);
  return res.data;
}
