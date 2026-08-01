import { apiFetch } from './api';
import type { QotdDateSummary, QotdDateDetail } from '@ibas/shared-types';

export type { QotdDateSummary, QotdDateDetail };

export async function fetchQotdDates() {
  return apiFetch<{ data: QotdDateSummary[] }>('/qotd/dates');
}

export async function fetchQotdDateDetail(date: string) {
  return apiFetch<{ data: QotdDateDetail }>(`/qotd/dates/${date}`);
}
