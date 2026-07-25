import type { QuestionSortOption } from '@ibas/shared-constants';
import { apiFetch } from './api';
import type { ExplanationSection, QuestionDetail, QuestionListItem, ReviewStatus } from '@/types/questions';

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
): Promise<{ review_status: ReviewStatus; is_published: boolean }> {
  const res = await apiFetch<{ data: { review_status: ReviewStatus; is_published: boolean } }>(
    `/questions/${id}/${action}`,
    { method: 'POST' },
  );
  return res.data;
}
