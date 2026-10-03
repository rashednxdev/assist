import { useCallback, useEffect, useState } from 'react';
import type {
  DesignationRecord,
  OfficeOption,
  ServiceInfo,
  ServiceInfoInput,
  WorkIdentity,
} from '@ibas/shared-types';
import { apiFetch } from './api';

export function designationLabel(d: { name: string; short_name?: string; grade: number | null }): string {
  const bits = [
    d.short_name && d.short_name !== d.name ? d.short_name : '',
    d.grade ? `Grade ${d.grade}` : '',
  ].filter(Boolean);
  return bits.length ? `${d.name} (${bits.join(', ')})` : d.name;
}

export function officeLabel(o: Pick<OfficeOption, 'name' | 'short_name'>): string {
  return o.short_name && o.short_name !== o.name ? `${o.name} (${o.short_name})` : o.name;
}

export async function fetchDesignations(): Promise<DesignationRecord[]> {
  const r = await apiFetch<{ data: DesignationRecord[] }>('/org/designations');
  return r.data;
}

export async function searchOffices(q: string, scope?: { departmentId?: string; topLevel?: boolean }): Promise<OfficeOption[]> {
  const extra = `${scope?.departmentId ? `&department_id=${scope.departmentId}` : ''}${scope?.topLevel ? '&top_level=true' : ''}`;
  const r = await apiFetch<{ data: OfficeOption[] }>(`/org/offices/options?limit=40&q=${encodeURIComponent(q)}${extra}`);
  return r.data;
}

export async function saveWorkIdentity(
  officeId: string,
  designationId: string,
  posting?: { section: string; telephone: string; pabx: string },
): Promise<WorkIdentity> {
  const r = await apiFetch<{ data: WorkIdentity }>('/org/me', {
    method: 'PUT',
    body: JSON.stringify({ office_id: officeId, designation_id: designationId, ...posting }),
  });
  publishWorkIdentity(r.data);
  return r.data;
}

export async function fetchServiceInfo(): Promise<ServiceInfo> {
  const r = await apiFetch<{ data: ServiceInfo }>('/org/me/service');
  return r.data;
}

export async function saveServiceInfo(body: ServiceInfoInput): Promise<ServiceInfo> {
  const r = await apiFetch<{ data: ServiceInfo }>('/org/me/service', { method: 'PUT', body: JSON.stringify(body) });
  return r.data;
}

/* ------------------------- shared work identity state ------------------------ */

let cached: WorkIdentity | null = null;
let inflight: Promise<WorkIdentity> | null = null;
const listeners = new Set<(w: WorkIdentity) => void>();

function fetchIdentity(force = false): Promise<WorkIdentity> {
  if (cached && !force) return Promise.resolve(cached);
  if (!inflight || force) {
    inflight = apiFetch<{ data: WorkIdentity }>('/org/me')
      .then((r) => {
        publishWorkIdentity(r.data);
        return r.data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function publishWorkIdentity(w: WorkIdentity): void {
  cached = w;
  listeners.forEach((fn) => fn(w));
}

/** Forget the signed-in user's identity (e.g. on sign out). */
export function resetWorkIdentity(): void {
  cached = null;
}

export function isWorkIdentityComplete(w: WorkIdentity | null | undefined): boolean {
  return !!w?.office && !!w.designation;
}

/** The signed-in user's office and designation, shared across screens. */
export function useWorkIdentity() {
  const [identity, setIdentity] = useState<WorkIdentity | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    listeners.add(setIdentity);
    fetchIdentity()
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => {
      listeners.delete(setIdentity);
    };
  }, []);

  const refresh = useCallback(() => fetchIdentity(true), []);

  return { identity, loading, complete: isWorkIdentityComplete(identity), refresh };
}
