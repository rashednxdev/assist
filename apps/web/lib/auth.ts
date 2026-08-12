import type { AuthUser, ModuleAccessGrant } from '@ibas/shared-types';
import { parseJsonResponse } from './parse-json-response';

const TOKEN_KEY = 'ibas_access_token';
const DEVICE_ID_KEY = 'ibas_device_id';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Browser-scoped device id for one-device login policy. */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder-device';
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 8) return existing;
  const id = randomId();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export interface LoginResponse {
  data: {
    accessToken: string;
    expiresIn: number;
    user: AuthUser & {
      status?: string;
      phone?: string;
      email_verified?: boolean;
      phone_verified?: boolean;
    };
  };
}

export interface RegisterResponse {
  data: {
    tokens: { accessToken: string; expiresIn: number };
    user: AuthUser & {
      status: string;
      phone: string;
      email_verified: boolean;
      phone_verified: boolean;
    };
    demo: { emailOtp: string; phoneOtp: string; expiresInMinutes: number };
  };
}

export type MeUser = AuthUser & {
  status: string;
  phone: string;
  is_verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  module_access: ModuleAccessGrant[];
  has_paid?: boolean;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
};

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const device_id = getOrCreateDeviceId();
  const res = await fetch('/api/proxy/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email,
      password,
      device_id,
      device_label: 'web:browser',
    }),
  });

  const json = await parseJsonResponse<LoginResponse & { error?: { message?: string } }>(res);
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Login failed');
  }
  return json;
}

export async function registerRequest(body: Record<string, unknown>): Promise<RegisterResponse> {
  const device_id = getOrCreateDeviceId();
  const res = await fetch('/api/proxy/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      device_id,
      device_label: 'web:browser',
    }),
  });
  const json = await parseJsonResponse<RegisterResponse & { error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'Registration failed');
  return json;
}

export async function fetchMe(): Promise<{ data: MeUser }> {
  const token = getAccessToken();
  const res = await fetch('/api/proxy/v1/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  const json = await parseJsonResponse<{ data: MeUser; error?: { message?: string } }>(res);
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Unauthorized');
  }
  return json;
}

export async function logoutRequest(): Promise<void> {
  await fetch('/api/proxy/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  clearAccessToken();
}
