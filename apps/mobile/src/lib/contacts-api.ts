import type {
  BatchDirectory,
  BatchMembers,
  ContactAccess,
  ContactDesignationCount,
  ContactEmployee,
  ContactFavorites,
  ContactOffice,
  ContactOfficeDetail,
  ContactOverview,
  ContactPrivacy,
  ContactVerificationCandidate,
  ContactVerificationInfo,
  ContactVerifiedRecord,
  MyAdditionalCharges,
  MyBatch,
} from '@ibas/shared-types';
import { apiFetch } from './api';

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function fetchContactAccess(): Promise<ContactAccess> {
  const r = await apiFetch<{ data: ContactAccess }>('/contacts/access');
  return r.data;
}

export async function saveContactPrivacy(p: ContactPrivacy): Promise<ContactPrivacy> {
  const r = await apiFetch<{ data: ContactPrivacy }>('/contacts/me/privacy', { method: 'PUT', body: JSON.stringify(p) });
  return r.data;
}

export async function fetchContactOverview(): Promise<ContactOverview> {
  const r = await apiFetch<{ data: ContactOverview }>('/contacts/overview');
  return r.data;
}

export function fetchOffices(params: { q?: string; type_id?: string; parent_id?: string; page?: number; limit?: number }) {
  return apiFetch<Page<ContactOffice>>(`/contacts/offices${qs(params)}`);
}

export async function fetchOffice(id: string): Promise<ContactOfficeDetail> {
  const r = await apiFetch<{ data: ContactOfficeDetail }>(`/contacts/offices/${id}`);
  return r.data;
}

export interface EmployeeQuery {
  q?: string;
  office_id?: string;
  include_sub?: boolean;
  designation_id?: string;
  page?: number;
  limit?: number;
}

export function fetchEmployees(params: EmployeeQuery) {
  return apiFetch<Page<ContactEmployee>>(`/contacts/employees${qs({ ...params, include_sub: params.office_id ? params.include_sub : undefined })}`);
}

export async function fetchDesignationCounts(params: Pick<EmployeeQuery, 'q' | 'office_id' | 'include_sub'>): Promise<ContactDesignationCount[]> {
  const r = await apiFetch<{ data: ContactDesignationCount[] }>(
    `/contacts/designations${qs({ ...params, include_sub: params.office_id ? params.include_sub : undefined })}`,
  );
  return r.data;
}

export async function fetchFavorites(): Promise<ContactFavorites> {
  const r = await apiFetch<{ data: ContactFavorites }>('/contacts/favorites');
  return r.data;
}

export async function toggleFavorite(target_type: 'office' | 'user', target_id: string): Promise<boolean> {
  const r = await apiFetch<{ data: { favorite: boolean } }>('/contacts/favorites', {
    method: 'POST',
    body: JSON.stringify({ target_type, target_id }),
  });
  return r.data.favorite;
}

export async function fetchMyBatch(): Promise<MyBatch> {
  const r = await apiFetch<{ data: MyBatch }>('/contacts/batchmates');
  return r.data;
}

export async function fetchBatches(): Promise<BatchDirectory> {
  const r = await apiFetch<{ data: BatchDirectory }>('/contacts/batches');
  return r.data;
}

export async function fetchBatchMembers(key: string): Promise<BatchMembers> {
  const r = await apiFetch<{ data: BatchMembers }>(`/contacts/batches/${encodeURIComponent(key)}/members`);
  return r.data;
}

export async function newVerificationCode(): Promise<ContactVerificationInfo> {
  const r = await apiFetch<{ data: ContactVerificationInfo }>('/contacts/verification/code', { method: 'POST' });
  return r.data;
}

export async function lookupVerificationCode(code: string): Promise<ContactVerificationCandidate> {
  const r = await apiFetch<{ data: ContactVerificationCandidate }>(`/contacts/verify/${encodeURIComponent(code)}`);
  return r.data;
}

export async function verifyColleague(code: string): Promise<ContactVerifiedRecord> {
  const r = await apiFetch<{ data: ContactVerifiedRecord }>('/contacts/verify', { method: 'POST', body: JSON.stringify({ code }) });
  return r.data;
}

export async function fetchVerifiedByMe(): Promise<ContactVerifiedRecord[]> {
  const r = await apiFetch<{ data: ContactVerifiedRecord[] }>('/contacts/verify/given');
  return r.data;
}

export async function fetchMyCharges(): Promise<MyAdditionalCharges> {
  const r = await apiFetch<{ data: MyAdditionalCharges }>('/contacts/me/charges');
  return r.data;
}

export async function addMyCharge(office_id: string, designation_id: string): Promise<MyAdditionalCharges> {
  const r = await apiFetch<{ data: MyAdditionalCharges }>('/contacts/me/charges', {
    method: 'POST',
    body: JSON.stringify({ office_id, designation_id }),
  });
  return r.data;
}

export async function removeMyCharge(id: string): Promise<MyAdditionalCharges> {
  const r = await apiFetch<{ data: MyAdditionalCharges }>(`/contacts/me/charges/${id}`, { method: 'DELETE' });
  return r.data;
}

export async function answerChargeHandover(id: string, handed_over: boolean): Promise<MyAdditionalCharges> {
  const r = await apiFetch<{ data: MyAdditionalCharges }>(`/contacts/me/charges/${id}/handover`, {
    method: 'POST',
    body: JSON.stringify({ handed_over }),
  });
  return r.data;
}

export function officeTitle(o: Pick<ContactOffice, 'name' | 'short_name'>): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

export function mapsUrl(o: Pick<ContactOffice, 'name' | 'address' | 'thana_name' | 'district_name'>): string {
  const q = [o.name, o.address, o.thana_name, o.district_name, 'Bangladesh'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function whatsappUrl(dial: string): string | null {
  const d = dial.replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(d)) return `https://wa.me/880${d.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(d)) return `https://wa.me/${d}`;
  return null;
}
