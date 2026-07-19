import { apiFetch } from './api';
import type { QuestionDetail, QuestionType } from '@/types/questions';

export async function fetchQuestionTypes() {
  const res = await apiFetch<{ data: QuestionType[] }>('/questions/types');
  return res.data;
}

export async function fetchQuestionDetail(id: string) {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}`);
  return res.data;
}
