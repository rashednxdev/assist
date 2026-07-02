import { apiFetch } from './api';
import type {
  BookListItem,
  BookReaderOutline,
  ChapterQuestionBrief,
  RegulationDetail,
  RegulationSearchRow,
  TopicDetail,
} from '@/types/books';

export async function fetchBooks(params?: { q?: string; book_type_id?: string }) {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  if (params?.book_type_id) search.set('book_type_id', params.book_type_id);
  const qs = search.toString();
  const res = await apiFetch<{ data: BookListItem[] }>(`/books${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function fetchBookReaderOutline(bookId: string) {
  const res = await apiFetch<{ data: BookReaderOutline }>(`/books/${bookId}/reader-outline`);
  return res.data;
}

export async function fetchTopicDetail(topicId: string) {
  const res = await apiFetch<{ data: TopicDetail }>(`/books/topics/${topicId}`);
  return res.data;
}

export async function fetchChapterQuestions(chapterId: string) {
  const res = await apiFetch<{ data: ChapterQuestionBrief[] }>(
    `/books/chapters/${chapterId}/questions`,
  );
  return res.data;
}

export async function searchRegulations(params?: { q?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const res = await apiFetch<{ data: RegulationSearchRow[] }>(
    `/books/regulations/search${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export async function fetchRegulationDetail(id: string) {
  const res = await apiFetch<{ data: RegulationDetail }>(`/books/regulations/${id}`);
  return res.data;
}
