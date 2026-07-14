import { apiFetch } from './api';
import type { MarathonReviewItem } from '@/types/marathon';
import type { QuestionDetail, QuestionListItem, QuestionType } from '@/types/questions';

export type QuestionsListMeta = {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

export type QuestionsPage = {
  items: QuestionListItem[];
  meta: QuestionsListMeta;
};

export async function fetchQuestionTypes() {
  const res = await apiFetch<{ data: QuestionType[] }>('/questions/types');
  return res.data;
}

export async function fetchQuestionsPage(params?: {
  q?: string;
  question_type_code?: string;
  difficulty?: string;
  is_published?: 'true' | 'false' | '';
  book_info_id?: string;
  limit?: number;
  offset?: number;
}): Promise<QuestionsPage> {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  if (params?.question_type_code) search.set('question_type_code', params.question_type_code);
  if (params?.difficulty) search.set('difficulty', params.difficulty);
  if (params?.is_published === 'true' || params?.is_published === 'false') {
    search.set('is_published', params.is_published);
  }
  if (params?.book_info_id) search.set('book_info_id', params.book_info_id);
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.offset != null) search.set('offset', String(params.offset));
  const qs = search.toString();
  const res = await apiFetch<{ data: QuestionListItem[]; meta?: QuestionsListMeta }>(
    `/questions${qs ? `?${qs}` : ''}`,
  );
  const items = res.data ?? [];
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const meta: QuestionsListMeta = {
    total: res.meta?.total ?? offset + items.length + (items.length >= limit ? 1 : 0),
    limit: res.meta?.limit ?? limit,
    offset: res.meta?.offset ?? offset,
    has_more:
      res.meta?.has_more ??
      (typeof res.meta?.total === 'number'
        ? offset + items.length < res.meta.total
        : items.length >= limit),
  };
  return { items, meta };
}

/** @deprecated Prefer fetchQuestionsPage for pagination. */
export async function fetchQuestions(params?: {
  q?: string;
  question_type_code?: string;
  difficulty?: string;
  is_published?: 'true' | 'false' | '';
  limit?: number;
  offset?: number;
  book_info_id?: string;
}) {
  const page = await fetchQuestionsPage(params);
  return page.items;
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
