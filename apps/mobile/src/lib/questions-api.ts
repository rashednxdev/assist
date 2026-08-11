import { apiFetch } from './api';
import type { QuestionDetail, QuestionListItem, QuestionType } from '@/types/questions';

export async function fetchQuestionTypes() {
  const res = await apiFetch<{ data: QuestionType[] }>('/questions/types');
  return res.data;
}

export async function fetchQuestionDetail(id: string) {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}`);
  return res.data;
}

export interface SubjectCatalogItem {
  id: string;
  name: string;
  name_bn?: string;
  label: string;
}

export async function fetchQuestionSubjectCatalog() {
  const res = await apiFetch<{ data: SubjectCatalogItem[] }>('/questions/subject-catalog');
  return res.data;
}

/** Live list filtered by exam subject — used to keep offline subject filter accurate. */
export async function fetchQuestionsBySubject(examSubjectId: string, limit = 100) {
  const search = new URLSearchParams();
  search.set('exam_subject_id', examSubjectId);
  search.set('is_published', 'true');
  search.set('limit', String(limit));
  search.set('offset', '0');
  const res = await apiFetch<{
    data: Array<Pick<QuestionListItem, 'id' | 'subjects'>>;
  }>(`/questions?${search.toString()}`);
  return res.data;
}
