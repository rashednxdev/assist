import type { CircularRecord, DeductionEntryDetail, DeductionEntrySummary, DeductionSetupItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';

export const DED = '#b45309';
export const DED_DARK = '#78350f';
/** Route segment used when a tagged process opens in the shared process screen. */
export const DED_PROCESS_AREA = 'deductions';

export async function fetchDeductionSetup(): Promise<DeductionSetupItem[]> {
  const r = await apiFetch<{ data: DeductionSetupItem[] }>('/deductions/setup');
  return r.data;
}

export async function fetchDeductions(filters: { economic_code?: string; bill_type?: string; deduction_type?: string }): Promise<DeductionEntrySummary[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const query = qs.toString();
  const r = await apiFetch<{ data: DeductionEntrySummary[] }>(`/deductions${query ? `?${query}` : ''}`);
  return r.data;
}

export async function fetchDeduction(id: string): Promise<DeductionEntryDetail> {
  const r = await apiFetch<{ data: DeductionEntryDetail }>(`/deductions/${id}`);
  return r.data;
}

export async function fetchDeductionCircular(id: string): Promise<CircularRecord> {
  const r = await apiFetch<{ data: CircularRecord }>(`/deductions/circulars/${id}`);
  return r.data;
}
