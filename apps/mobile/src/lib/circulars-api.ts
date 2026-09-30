import * as SecureStore from 'expo-secure-store';
import { CIRCULAR_DOC_TYPES, CIRCULAR_ISSUERS, POLICY_COLLECTIONS } from '@ibas/shared-constants';
import type { CircularFacets, CircularRecord, CircularTagCount } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';

export const CIRCULAR_MODULE_CODES = ['CIRCULARS', 'BOOKS'];

const issuerLabels = new Map<string, string>(CIRCULAR_ISSUERS.map((i) => [i.code, i.label]));
const docTypeLabels = new Map<string, string>(CIRCULAR_DOC_TYPES.map((d) => [d.code, d.label]));
const collectionNames = new Map<string, string>(POLICY_COLLECTIONS.map((c) => [c.code, c.name_en]));

export const issuerLabel = (code: string) => issuerLabels.get(code) ?? code;
export const docTypeLabel = (code: string) => docTypeLabels.get(code) ?? code;
export const collectionName = (code: string) => collectionNames.get(code) ?? code;

/** Who issued it, most specific first: "Finance Division · Budget-1 Wing". */
export function circularIssuedBy(c: Pick<CircularRecord, 'issuer' | 'ministry' | 'department' | 'issuer_detail'>): string {
  const parts = [c.ministry, c.department, c.issuer_detail].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : issuerLabel(c.issuer);
}

export interface CircularFilters {
  q: string;
  issuer: string;
  doc_type: string;
  collection: string;
  area: string;
  year: string;
  tag: string;
}

export const EMPTY_CIRCULAR_FILTERS: CircularFilters = { q: '', issuer: '', doc_type: '', collection: '', area: '', year: '', tag: '' };

export type CircularSort = 'newest' | 'oldest';

export async function fetchCirculars(
  filters: CircularFilters,
  sort: CircularSort,
  offset: number,
  limit = 20,
): Promise<{ items: CircularRecord[]; total: number }> {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset), sort });
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const r = await apiFetch<{ data: CircularRecord[]; meta: { total: number } }>(`/circulars?${qs.toString()}`);
  return { items: r.data, total: r.meta.total };
}

export async function fetchCircularFacets(): Promise<CircularFacets> {
  const r = await apiFetch<{ data: CircularFacets }>('/circulars/facets');
  return r.data;
}

export async function fetchCircularTags(limit = 500): Promise<CircularTagCount[]> {
  const r = await apiFetch<{ data: CircularTagCount[] }>(`/circulars/tags?limit=${limit}`);
  return r.data;
}

export async function fetchCircular(id: string): Promise<CircularRecord> {
  const r = await apiFetch<{ data: CircularRecord }>(`/circulars/${id}`);
  return r.data;
}

/* Checklist ticks are kept on this device only (SecureStore keys allow only [A-Za-z0-9._-]). */
const checklistKey = (id: string) => `circular_checklist_${id.replace(/[^\w.-]/g, '')}`;

export async function loadChecklistTicks(id: string): Promise<Record<string, boolean>> {
  try {
    const raw = await SecureStore.getItemAsync(checklistKey(id));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export async function saveChecklistTicks(id: string, ticks: Record<string, boolean>): Promise<void> {
  const key = checklistKey(id);
  if (Object.values(ticks).some(Boolean)) await SecureStore.setItemAsync(key, JSON.stringify(ticks));
  else await SecureStore.deleteItemAsync(key);
}
