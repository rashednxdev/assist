import { apiFetch } from './api';
import type { QotdSubjectSummary, QotdEntrySummary, QotdEntryDetail } from '@ibas/shared-types';

export type { QotdSubjectSummary, QotdEntrySummary, QotdEntryDetail };

export async function fetchQotdSubjects() {
  return apiFetch<{ data: QotdSubjectSummary[] }>('/qotd/subjects');
}

export async function fetchQotdDates(subjectId: string) {
  return apiFetch<{ data: QotdEntrySummary[] }>(`/qotd/subjects/${subjectId}/dates`);
}

export async function fetchQotdEntryDetail(entryId: string) {
  return apiFetch<{ data: QotdEntryDetail }>(`/qotd/entries/${entryId}`);
}
