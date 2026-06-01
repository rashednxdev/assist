import type { AuthUser } from '@ibas/shared-types';
import { parseJsonResponse } from './parse-json-response';

const TOKEN_KEY = 'ibas_access_token';

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
};

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch('/api/proxy/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const json = await parseJsonResponse<LoginResponse & { error?: { message?: string } }>(res);
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Login failed');
  }
  return json;
}

export async function registerRequest(body: Record<string, unknown>): Promise<RegisterResponse> {
  const res = await fetch('/api/proxy/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
