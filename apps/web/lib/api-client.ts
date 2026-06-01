import { getAccessToken } from './auth';
import { parseJsonResponse } from './parse-json-response';

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`/api/proxy/v1${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const json = await parseJsonResponse<{ error?: { message?: string; code?: string } } & T>(res);
  if (!res.ok) {
    throw new ApiError(json.error?.message ?? 'Request failed', json.error?.code);
  }
  return json as T;
}
