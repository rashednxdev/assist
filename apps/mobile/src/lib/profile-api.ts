import type { BloodGroup, GeoOption } from '@ibas/shared-types';
import { apiFetch } from './api';

export type Gender = 'male' | 'female' | 'other';

export interface PersonalProfile {
  id: string;
  email: string;
  phone: string;
  full_name_en: string;
  full_name_bn?: string;
  nid?: string;
  employee_id?: string;
  dob?: string | null;
  gender?: Gender | null;
  blood_group?: BloodGroup | null;
  father_name?: string;
  mother_name?: string;
  home_district_id?: string | null;
  alternate_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  bio?: string;
}

/** Fields accepted by PATCH /account/profile; '' clears optional values. */
export interface PersonalProfileUpdate {
  full_name_en?: string;
  full_name_bn?: string;
  phone?: string;
  nid?: string;
  employee_id?: string;
  dob?: string;
  gender?: Gender | '';
  blood_group?: BloodGroup | '';
  father_name?: string;
  mother_name?: string;
  home_district_id?: string;
  alternate_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  bio?: string;
}

export const GENDER_LABEL: Record<Gender, string> = { male: 'Male', female: 'Female', other: 'Other' };

export async function fetchPersonalProfile(): Promise<PersonalProfile> {
  const r = await apiFetch<{ data: PersonalProfile }>('/account/profile');
  return r.data;
}

export async function updatePersonalProfile(body: PersonalProfileUpdate): Promise<PersonalProfile> {
  const r = await apiFetch<{ data: PersonalProfile }>('/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return r.data;
}

let districtCache: GeoOption[] | null = null;

export async function fetchDistricts(): Promise<GeoOption[]> {
  if (districtCache) return districtCache;
  const r = await apiFetch<{ data: GeoOption[] }>('/blood-bank/places/districts');
  districtCache = r.data;
  return r.data;
}

export async function fetchThanas(districtId: string): Promise<GeoOption[]> {
  const r = await apiFetch<{ data: GeoOption[] }>(`/blood-bank/places/districts/${districtId}/thanas`);
  return r.data;
}

/** "3 Mar 2021" for an ISO date/time. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
