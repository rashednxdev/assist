import * as SecureStore from 'expo-secure-store';
import type { AuthUser, ModuleAccessGrant, RegisterDto } from '@ibas/shared-types';
import { apiFetch, setApiAccessToken } from './api';

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
  const res = await apiFetch<{
    data: { accessToken: string; expiresIn: number; user: MeUser };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await persistToken(res.data.accessToken);
  return res.data;
}

export async function register(body: RegisterDto) {
  const res = await apiFetch<{
    data: {
      tokens: { accessToken: string; expiresIn: number };
      user: MeUser;
      demo?: { emailOtp: string; phoneOtp: string };
    };
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...body, user_type: 'applicant' }),
  });
  await persistToken(res.data.tokens.accessToken);
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
  const [books, questions, exams, papers] = await Promise.all([
    apiFetch<{ data: unknown[] }>('/books').catch(() => ({ data: [] })),
    apiFetch<{ data: unknown[] }>('/questions?is_published=true').catch(() => ({ data: [] })),
    apiFetch<{ data: unknown[] }>('/exams/names').catch(() => ({ data: [] })),
    apiFetch<{ data: unknown[] }>('/papers').catch(() => ({ data: [] })),
  ]);
  return {
    books: books.data.length,
    questions: questions.data.length,
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
