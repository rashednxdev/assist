import type { AuthUser, ModuleAccessGrant, ModuleStop } from '@ibas/shared-types';
import { parseJsonResponse } from './parse-json-response';
import { resetArrearPrompt } from './arrear-prompt';

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
  clearMeCache();
  // A new sign-in starts a new browsing session for the Home arrear-bill prompt.
  resetArrearPrompt();
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

export interface LoginSessionData {
  otp_required?: false;
  accessToken: string;
  expiresIn: number;
  must_change_password?: boolean;
  user: AuthUser & {
    status?: string;
    phone?: string;
    email_verified?: boolean;
    phone_verified?: boolean;
  };
}

export interface LoginOtpData {
  otp_required: true;
  challenge: string;
  phone_hint: string;
  expires_in: number;
}

export type LoginResponse = { data: LoginSessionData | LoginOtpData };

export function isLoginOtp(data: LoginSessionData | LoginOtpData): data is LoginOtpData {
  return data.otp_required === true;
}

export interface RegisterResponse {
  data: {
    pending: true;
    phone_hint: string;
  };
}

export interface RegisterVerifyResponse {
  data: {
    tokens: { accessToken: string; expiresIn: number };
    user: AuthUser & { status: string; phone: string };
  };
}

export type MeUser = AuthUser & {
  status: string;
  phone: string;
  is_verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  module_access: ModuleAccessGrant[];
  module_stops?: ModuleStop[];
  /** Admin-marked paid, or any active package. */
  has_paid?: boolean;
  /** Admin-marked paid (legacy manual payment); manual grants only count when true. */
  legacy_paid?: boolean;
  unpaid_message?: string;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
  /** Signed in with an admin-issued temporary password; must set a new one first. */
  must_change_password?: boolean;
};

export const SET_PASSWORD_PATH = '/set-password';

export async function forgotPasswordRequest(phone: string): Promise<{ phone_hint: string }> {
  const res = await fetch('/api/proxy/v1/auth/password/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const json = await parseJsonResponse<{ data: { sent: true; phone_hint: string }; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'Could not send a reset code.');
  return json.data;
}

export async function verifyResetCode(phone: string, code: string): Promise<void> {
  const res = await fetch('/api/proxy/v1/auth/password/forgot/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const json = await parseJsonResponse<{ data: { verified: true }; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'That code is not correct.');
}

export async function resetPasswordRequest(body: {
  phone: string;
  code: string;
  new_password: string;
  confirm_password: string;
}): Promise<void> {
  const res = await fetch('/api/proxy/v1/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJsonResponse<{ data: { success: true }; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'Could not reset the password.');
}

export async function requestLoginCode(phone: string): Promise<{ data: LoginOtpData }> {
  const device_id = getOrCreateDeviceId();
  const res = await fetch('/api/proxy/v1/auth/login/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      phone,
      device_id,
      device_label: 'web:browser',
      client_platform: 'web',
    }),
  });
  const json = await parseJsonResponse<{ data: LoginOtpData; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'কোড পাঠানো যায়নি।');
  return json;
}

export async function verifyLoginOtp(challenge: string, code: string): Promise<{ data: LoginSessionData }> {
  const device_id = getOrCreateDeviceId();
  const res = await fetch('/api/proxy/v1/auth/login/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      challenge,
      code,
      device_id,
      device_label: 'web:browser',
      client_platform: 'web',
    }),
  });
  const json = await parseJsonResponse<{ data: LoginSessionData; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'That code is not correct.');
  return json;
}

export async function resendLoginOtp(challenge: string): Promise<{ data: LoginOtpData }> {
  const res = await fetch('/api/proxy/v1/auth/login/otp/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ challenge }),
  });
  const json = await parseJsonResponse<{ data: LoginOtpData; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'Could not send a new code.');
  return json;
}

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
      client_platform: 'web',
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

export async function verifyRegisterRequest(phone: string, code: string): Promise<RegisterVerifyResponse> {
  const device_id = getOrCreateDeviceId();
  const res = await fetch('/api/proxy/v1/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      phone,
      code,
      device_id,
      device_label: 'web:browser',
      client_platform: 'web',
    }),
  });
  const json = await parseJsonResponse<RegisterVerifyResponse & { error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'That code is not correct.');
  return json;
}

export async function resendRegisterRequest(phone: string): Promise<{ data: { sent: true; phone_hint: string } }> {
  const res = await fetch('/api/proxy/v1/auth/register/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const json = await parseJsonResponse<{ data: { sent: true; phone_hint: string }; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? 'Could not send a new code.');
  return json;
}

const ME_FRESH_MS = 30_000;
const ME_STALE_MS = 120_000;

let meCache: { token: string; data: MeUser; at: number } | null = null;
let meFlight: Promise<{ data: MeUser }> | null = null;

export function clearMeCache(): void {
  meCache = null;
  meFlight = null;
}

/** Last signed-in profile, if this browser already loaded it for the current token. */
export function peekMe(): MeUser | null {
  const token = getAccessToken();
  if (!meCache || !token || meCache.token !== token) return null;
  if (Date.now() - meCache.at > ME_STALE_MS) return null;
  return meCache.data;
}

async function requestMe(token: string | null): Promise<{ data: MeUser }> {
  const res = await fetch('/api/proxy/v1/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  const json = await parseJsonResponse<{ data: MeUser; error?: { message?: string } }>(res);
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Unauthorized');
  }
  if (token) meCache = { token, data: json.data, at: Date.now() };
  return json;
}

export async function fetchMe(): Promise<{ data: MeUser }> {
  const token = getAccessToken();
  const cached = token && meCache?.token === token ? meCache : null;
  if (cached && Date.now() - cached.at < ME_FRESH_MS) return { data: cached.data };
  if (cached && Date.now() - cached.at < ME_STALE_MS) {
    if (!meFlight) {
      meFlight = requestMe(token).finally(() => {
        meFlight = null;
      });
    }
    return { data: cached.data };
  }
  if (!meFlight) {
    meFlight = requestMe(token).finally(() => {
      meFlight = null;
    });
  }
  return meFlight;
}

export async function logoutRequest(): Promise<void> {
  await fetch('/api/proxy/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  clearAccessToken();
}
