import type { PolicyCollectionSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';

export const POLICY_MODULE_CODES = ['BOOKS', 'CIRCULARS'];

export async function fetchPolicyCollections(): Promise<PolicyCollectionSummary[]> {
  const r = await apiFetch<{ data: PolicyCollectionSummary[] }>('/policy/collections');
  return r.data;
}
