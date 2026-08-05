import * as SecureStore from 'expo-secure-store';
import type { AuthUser, ModuleAccessGrant, RegisterDto } from '@ibas/shared-types';
import { apiFetch, setApiAccessToken } from './api';
import { getDeviceLabel, getOrCreateDeviceId } from './device-id';

const TOKEN_KEY = 'ibas_access_token';

export type MeUser = AuthUser & {
  status: string;
  phone?: string;
  is_verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  module_access: ModuleAccessGrant[];
};

export interface AccountSummary {
  profile_complete_percent: number;
  address_count: number;
  subscription: { plan: { name: string } | null; expires_at?: string } | null;
  learning?: LearningActivity;
}

export interface LearningActivity {
  books: number;
  questions: number;
  exams: number;
  papers: number;
}

export async function loadStoredToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  setApiAccessToken(token);
  return token;
}

export async function persistToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  setApiAccessToken(token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  setApiAccessToken(null);
}

export async function login(email: string, password: string) {
  const device_id = await getOrCreateDeviceId();
  const res = await apiFetch<{
    data: { accessToken: string; expiresIn: number; user: MeUser };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      device_id,
      device_label: getDeviceLabel(),
    }),
  });
  await persistToken(res.data.accessToken);
  return res.data;
}

export async function register(body: Omit<RegisterDto, 'device_id' | 'device_label'>) {
  const device_id = await getOrCreateDeviceId();
  const res = await apiFetch<{
    data: {
      tokens: { accessToken: string; expiresIn: number };
      user: MeUser;
      demo?: { emailOtp: string; phoneOtp: string };
    };
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      user_type: 'applicant',
      device_id,
      device_label: getDeviceLabel(),
    }),
  });
  await persistToken(res.data.tokens.accessToken);
  return res.data;
}

/** Step 1 of "forgot password" — emails a reset code to the address on file for this phone number. */
export async function forgotPassword(phone: string) {
  const res = await apiFetch<{ data: { sent: true; email_hint: string } }>('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  return res.data;
}

/** Step 2 — the emailed code plus a new password. No auth token required (that's the point). */
export async function resetPassword(params: {
  phone: string;
  code: string;
  new_password: string;
  confirm_password: string;
}) {
  const res = await apiFetch<{ data: { success: true } }>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.data;
}

export async function fetchMe() {
  const res = await apiFetch<{ data: MeUser }>('/auth/me');
  return res.data;
}

export async function fetchAccountSummary() {
  const res = await apiFetch<{ data: AccountSummary }>('/account/summary');
  return res.data;
}

export async function fetchLearningActivity(): Promise<LearningActivity> {
  const summary = await fetchAccountSummary().catch(() => null);
  if (summary?.learning) {
    return summary.learning;
  }

  // Fallback: questions list is paginated — use meta.total when available.
  const [books, questions, exams, papers] = await Promise.all([
    apiFetch<{ data: unknown[] }>('/books').catch(() => ({ data: [] as unknown[] })),
    apiFetch<{ data: unknown[]; meta?: { total?: number } }>('/questions?is_published=true&limit=1').catch(
      () => ({ data: [] as unknown[], meta: { total: 0 } }),
    ),
    apiFetch<{ data: unknown[] }>('/exams/names').catch(() => ({ data: [] as unknown[] })),
    apiFetch<{ data: unknown[] }>('/papers').catch(() => ({ data: [] as unknown[] })),
  ]);
  return {
    books: books.data.length,
    questions: questions.meta?.total ?? questions.data.length,
    exams: exams.data.length,
    papers: papers.data.length,
  };
}

export async function logout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // ignore network errors on logout
  }
  await clearToken();
}
