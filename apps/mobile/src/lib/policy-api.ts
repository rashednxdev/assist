import type { ArchiveOverview, KnowQuestionItem, PolicyCollectionSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';
import type { BookReaderOutline, ReaderChapterFull } from '@/types/books';

export type ArchiveBookData = Omit<BookReaderOutline, 'chapters'> & { chapters: ReaderChapterFull[] };

export async function fetchArchiveOverview(): Promise<ArchiveOverview> {
  const r = await apiFetch<{ data: ArchiveOverview }>('/policy/archive');
  return r.data;
}

export async function fetchArchiveBook(id: string): Promise<ArchiveBookData> {
  const r = await apiFetch<{ data: ArchiveBookData }>(`/policy/archive/books/${id}`);
  return r.data;
}

export async function fetchKnowQuestions(area: string): Promise<KnowQuestionItem[]> {
  const r = await apiFetch<{ data: KnowQuestionItem[] }>(`/policy/archive/know?area=${encodeURIComponent(area)}`);
  return r.data;
}

export const POLICY_MODULE_CODES = ['BOOKS', 'CIRCULARS'];

export async function fetchPolicyCollections(): Promise<PolicyCollectionSummary[]> {
  const r = await apiFetch<{ data: PolicyCollectionSummary[] }>('/policy/collections');
  return r.data;
}
