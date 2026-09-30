import { useCallback, useEffect, useState } from 'react';
import type {
  BloodDonationRecord,
  BloodDonorRecord,
  BloodGroup,
  BloodMe,
  BloodRequestRecord,
  BloodStats,
  BloodUrgency,
} from '@ibas/shared-types';
import { apiFetch } from './api';
import type { Page } from './contacts-api';

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export interface BloodProfileBody {
  blood_group: BloodGroup;
  is_donor: boolean;
  available: boolean;
  district_id: string;
  thana_id: string;
  area: string;
  show_phone: boolean;
  note: string;
}

export async function saveBloodProfile(body: BloodProfileBody): Promise<BloodMe> {
  const r = await apiFetch<{ data: BloodMe }>('/blood-bank/me', { method: 'PUT', body: JSON.stringify(body) });
  publishBloodMe(r.data);
  return r.data;
}

/** Current donor settings with `available` flipped. */
export function toggleAvailability(me: BloodMe): Promise<BloodMe> {
  const d = me.donor;
  return saveBloodProfile({
    blood_group: me.blood_group!,
    is_donor: d.is_donor,
    available: !d.available,
    district_id: d.district?.id ?? '',
    thana_id: d.thana?.id ?? '',
    area: d.area ?? '',
    show_phone: d.show_phone,
    note: d.note ?? '',
  });
}

export async function fetchBloodStats(): Promise<BloodStats> {
  const r = await apiFetch<{ data: BloodStats }>('/blood-bank/stats');
  return r.data;
}

export interface DonorQuery {
  group?: BloodGroup;
  compatible_with?: BloodGroup;
  district_id?: string;
  thana_id?: string;
  eligible?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}

export function fetchDonors(params: DonorQuery) {
  return apiFetch<Page<BloodDonorRecord>>(`/blood-bank/donors${qs({ ...params })}`);
}

export async function fetchDonations(): Promise<BloodDonationRecord[]> {
  const r = await apiFetch<{ data: BloodDonationRecord[] }>('/blood-bank/donations');
  return r.data;
}

export async function addDonation(body: { donated_on: string; next_eligible_on: string; place: string; note: string; request_id?: string }) {
  const r = await apiFetch<{ data: { donation: BloodDonationRecord; me: BloodMe } }>('/blood-bank/donations', {
    method: 'POST',
    body: JSON.stringify({ ...body, request_id: body.request_id ?? '' }),
  });
  publishBloodMe(r.data.me);
  return r.data;
}

export async function deleteDonation(id: string): Promise<BloodMe> {
  const r = await apiFetch<{ data: BloodMe }>(`/blood-bank/donations/${id}`, { method: 'DELETE' });
  publishBloodMe(r.data);
  return r.data;
}

export type RequestScope = 'open' | 'can_help' | 'mine' | 'responded' | 'closed';

export function fetchRequests(params: { scope: RequestScope; district_id?: string; page?: number; limit?: number }) {
  const { scope, ...rest } = params;
  return apiFetch<Page<BloodRequestRecord>>(
    `/blood-bank/requests${qs({ ...rest, scope: scope === 'can_help' ? 'open' : scope, can_help: scope === 'can_help' ? 'true' : undefined })}`,
  );
}

export async function fetchRequest(id: string): Promise<BloodRequestRecord> {
  const r = await apiFetch<{ data: BloodRequestRecord }>(`/blood-bank/requests/${id}`);
  return r.data;
}

export interface BloodRequestBody {
  blood_group: BloodGroup;
  units: number;
  urgency: BloodUrgency;
  hospital: string;
  district_id: string;
  thana_id: string;
  address: string;
  needed_on: string;
  patient_name: string;
  contact_name: string;
  contact_phone: string;
  note: string;
}

export async function createRequest(body: BloodRequestBody): Promise<BloodRequestRecord> {
  const r = await apiFetch<{ data: BloodRequestRecord }>('/blood-bank/requests', { method: 'POST', body: JSON.stringify(body) });
  return r.data;
}

export async function toggleRespond(id: string): Promise<BloodRequestRecord> {
  const r = await apiFetch<{ data: BloodRequestRecord }>(`/blood-bank/requests/${id}/respond`, { method: 'POST', body: '{}' });
  return r.data;
}

export async function setRequestStatus(id: string, status: 'open' | 'fulfilled' | 'cancelled'): Promise<BloodRequestRecord> {
  const r = await apiFetch<{ data: BloodRequestRecord }>(`/blood-bank/requests/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return r.data;
}

export async function deleteRequest(id: string): Promise<void> {
  await apiFetch(`/blood-bank/requests/${id}`, { method: 'DELETE' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "3 months ago", "12 days ago", "today". */
export function sinceLabel(iso: string | null | undefined): string {
  if (!iso) return 'Never donated here';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Donated today';
  if (days < 45) return `Donated ${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30.4);
  if (months < 24) return `Donated ${months} month${months === 1 ? '' : 's'} ago`;
  return `Donated ${Math.floor(months / 12)} years ago`;
}

/* ---------------------------- shared blood me state --------------------------- */

let cached: BloodMe | null = null;
let inflight: Promise<BloodMe> | null = null;
const listeners = new Set<(m: BloodMe) => void>();

function fetchMe(force = false): Promise<BloodMe> {
  if (cached && !force) return Promise.resolve(cached);
  if (!inflight) {
    inflight = apiFetch<{ data: BloodMe }>('/blood-bank/me')
      .then((r) => {
        publishBloodMe(r.data);
        return r.data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function publishBloodMe(m: BloodMe): void {
  cached = m;
  listeners.forEach((fn) => fn(m));
}

export function resetBloodMe(): void {
  cached = null;
}

/** The signed-in user's blood group and donor status, shared across screens. */
export function useBloodMe() {
  const [me, setMe] = useState<BloodMe | null>(cached);
  const [error, setError] = useState('');

  useEffect(() => {
    listeners.add(setMe);
    fetchMe().catch((e) => setError(e instanceof Error ? e.message : 'Could not load the blood bank'));
    return () => {
      listeners.delete(setMe);
    };
  }, []);

  const refresh = useCallback(() => {
    setError('');
    return fetchMe(true).catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not load the blood bank');
      return null;
    });
  }, []);

  return { me, error, refresh };
}
