import type { QuestionSortOption } from '@ibas/shared-constants';
import { apiFetch } from './api';
import type { ExplanationSection, QuestionDetail, QuestionListItem, ReviewStatus } from '@/types/questions';
import type { SubjectCatalogItem } from './questions-api';

export type { SubjectCatalogItem };

export interface BookCatalogItem {
  id: string;
  name: string;
  label: string;
}

export async function fetchQuestionBookCatalog() {
  const res = await apiFetch<{ data: BookCatalogItem[] }>('/questions/book-catalog');
  return res.data;
}

export async function addQuestionSubjectTag(questionId: string, examSubjectId: string) {
  const res = await apiFetch<{
    data: { exam_subject_id: string; name: string; name_bn?: string };
  }>(`/questions/${questionId}/subject-links`, {
    method: 'POST',
    body: JSON.stringify({ exam_subject_id: examSubjectId }),
  });
  return res.data;
}

export async function removeQuestionSubjectTag(questionId: string, examSubjectId: string) {
  await apiFetch(`/questions/${questionId}/subject-links/${examSubjectId}`, { method: 'DELETE' });
}

export async function addQuestionBookFirstChapterTag(questionId: string, bookInfoId: string) {
  const res = await apiFetch<{
    data: { id: string; name: string; chapter_id: string };
  }>(`/questions/${questionId}/book-first-chapter-links`, {
    method: 'POST',
    body: JSON.stringify({ book_info_id: bookInfoId }),
  });
  return res.data;
}

export async function removeQuestionBookFirstChapterTag(questionId: string, bookInfoId: string) {
  await apiFetch(`/questions/${questionId}/book-first-chapter-links/${bookInfoId}`, { method: 'DELETE' });
}

export interface QuestionEditListParams {
  q?: string;
  question_type_code?: string;
  review_status?: ReviewStatus;
  book_info_id?: string;
  sort?: QuestionSortOption;
  limit?: number;
  offset?: number;
}

export interface QuestionEditListResult {
  items: QuestionListItem[];
  total: number;
  hasMore: boolean;
}

/** Live (non-cached) question list for the Question Update module — always current-state, unlike the offline Question Bank sync cache. */
export async function fetchQuestionsForEdit(params: QuestionEditListParams): Promise<QuestionEditListResult> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.question_type_code) query.set('question_type_code', params.question_type_code);
  if (params.review_status) query.set('review_status', params.review_status);
  if (params.book_info_id) query.set('book_info_id', params.book_info_id);
  if (params.sort) query.set('sort', params.sort);
  query.set('limit', String(params.limit ?? 20));
  query.set('offset', String(params.offset ?? 0));

  const res = await apiFetch<{
    data: QuestionListItem[];
    meta: { total: number; limit: number; offset: number; has_more: boolean };
  }>(`/questions?${query.toString()}`);
  return { items: res.data, total: res.meta.total, hasMore: res.meta.has_more };
}

export async function fetchQuestionForEdit(id: string): Promise<QuestionDetail> {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}`);
  return res.data;
}

export interface QuestionUpdatePayload {
  body_en: string;
  body_bn?: string;
  options?: Array<{ option_key: string; option_text_en: string; option_text_bn?: string }>;
  correct_option_key?: string;
  correct_true_false?: 'true' | 'false';
  explanation_sections?: ExplanationSection[];
  model_answer_sections?: ExplanationSection[];
}

export async function updateQuestionContent(id: string, payload: QuestionUpdatePayload): Promise<QuestionDetail> {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export type ReviewTransition = 'submit-for-quality-check' | 'return-to-draft' | 'publish' | 'unpublish';

export async function transitionQuestionReviewStatus(
  id: string,
  action: ReviewTransition,
): Promise<{ review_status: ReviewStatus; is_published: boolean; status_by_name?: string }> {
  const res = await apiFetch<{
    data: { review_status: ReviewStatus; is_published: boolean; status_by_name?: string };
  }>(`/questions/${id}/${action}`, { method: 'POST' });
  return res.data;
}

export async function setMotherQuestion(id: string, motherQuestionId: string): Promise<QuestionDetail> {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}/mother-question`, {
    method: 'POST',
    body: JSON.stringify({ mother_question_id: motherQuestionId }),
  });
  return res.data;
}

export async function removeMotherQuestion(id: string): Promise<QuestionDetail> {
  const res = await apiFetch<{ data: QuestionDetail }>(`/questions/${id}/mother-question`, {
    method: 'DELETE',
  });
  return res.data;
}

/** Move a question to trash (soft delete) — reversible from the web admin's trash bin. */
export async function trashQuestion(id: string): Promise<void> {
  await apiFetch(`/questions/${id}`, { method: 'DELETE' });
}
