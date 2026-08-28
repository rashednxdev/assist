import { apiFetch } from './api';

export interface AdminUserRow {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  user_type: string;
  status: string;
  is_super_admin?: boolean;
  /** Admin-only. */
  amount_received?: number;
  client_app_version?: string | null;
  client_platform?: 'mobile' | 'web' | null;
  client_app_version_at?: string | null;
}

export interface AdminUserDetail extends AdminUserRow {
  is_verified?: boolean;
  allow_multi_device?: boolean;
  bound_device_id?: string | null;
  bound_device_at?: string | null;
  bound_device_label?: string | null;
  workflow_roles?: Array<{ role_code: string; is_active: boolean; role_id: string }>;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
  exam_subjects?: Array<{ id: string; name: string; name_bn?: string }>;
}

export interface ExamSubjectOption {
  id: string;
  name: string;
  name_bn?: string;
  label: string;
  exam_name?: string;
}

export interface ModuleCatalogItem {
  _id?: string;
  id?: string;
  code: string;
  name_en: string;
}

export function catalogModuleId(mod: ModuleCatalogItem): string {
  return String(mod._id ?? mod.id ?? '');
}

export interface UserModuleAccessRow {
  id: string;
  module_id: string;
  module_code: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_grade: boolean;
  can_publish: boolean;
  bypass_stop?: boolean;
}

/** Modules shown in mobile Users → Module access (learning + Users admin). */
export const MOBILE_MODULE_CODES = [
  'BOOKS',
  'QUESTIONS',
  'EXAM',
  'PAPER',
  'PENSION',
  'QOTD',
  'EXAM_ROUTINE',
  'EXAM_WEEK',
  'USER_QUESTIONS',
  'ANSWER_PDF',
  'QUESTION_EDIT',
  'LIVE_STREAM',
  'USER',
] as const;

/** Users is never shown to applicants. Admins always; others need an active USER grant. */
export function canManageUsers(user: {
  is_super_admin?: boolean;
  user_type?: string;
  module_access?: Array<{ module_code: string; can_create?: boolean; can_update?: boolean; can_read?: boolean }>;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.user_type === 'applicant') return false;
  if (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin') {
    return true;
  }
  return (user.module_access ?? []).some(
    (g) => g.module_code === 'USER' && (g.can_create === true || g.can_update === true || g.can_read === true),
  );
}

export async function fetchAdminUsers(params?: {
  q?: string;
  page?: number;
  limit?: number;
  sort?: 'paid' | 'unpaid';
}) {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('limit', String(params?.limit ?? 100));
  if (params?.sort) search.set('sort', params.sort);
  if (params?.q?.trim()) search.set('q', params.q.trim());
  return apiFetch<{ data: AdminUserRow[]; meta: { total: number; page?: number; limit?: number } }>(
    `/users?${search.toString()}`,
  );
}

export async function fetchAdminUser(id: string) {
  const res = await apiFetch<{ data: AdminUserDetail }>(`/users/${id}`);
  return res.data;
}

export async function createAdminUser(body: {
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  password: string;
  user_type: string;
}) {
  return apiFetch<{ data: AdminUserDetail }>('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateAdminUser(
  id: string,
  body: Partial<{
    full_name_en: string;
    full_name_bn: string;
    email: string;
    phone: string;
    user_type: string;
    status: string;
    is_super_admin: boolean;
    allow_multi_device: boolean;
    clear_bound_device: boolean;
    force_logout: boolean;
    amount_received: number;
    all_exam_subjects: boolean;
    exam_subject_ids: string[];
  }>,
) {
  return apiFetch<{ data: AdminUserDetail }>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchExamSubjectOptions() {
  const res = await apiFetch<{ data: ExamSubjectOption[] }>('/users/exam-subject-options');
  return res.data;
}

export async function fetchSetupModules() {
  const res = await apiFetch<{ data: ModuleCatalogItem[] }>('/setup/modules?all=true');
  return res.data;
}

export async function fetchUserModuleAccess(userId: string) {
  const res = await apiFetch<{ data: UserModuleAccessRow[] }>(`/users/${userId}/module-access`);
  return res.data;
}

export async function upsertUserModuleAccess(
  userId: string,
  body: {
    module_id: string;
    can_read: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_grade: boolean;
    can_publish: boolean;
    bypass_stop: boolean;
  },
) {
  return apiFetch<{ data: UserModuleAccessRow }>(`/users/${userId}/module-access`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function revokeUserModuleAccess(userId: string, moduleId: string) {
  return apiFetch(`/users/${userId}/module-access/${moduleId}`, { method: 'DELETE' });
}

export async function sendNotificationToUser(userId: string, title: string, message: string) {
  return apiFetch('/admin-notifications', {
    method: 'POST',
    body: JSON.stringify({
      title,
      message,
      target_type: 'specific',
      target_user_ids: [userId],
    }),
  });
}
