import type { ModuleAccessGrant } from '@ibas/shared-types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const API_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? 90_000);

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', onAbort);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };

    if (!res.ok) {
      throw new ApiError(json.error?.message ?? `Request failed (${res.status})`);
    }

    return json;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. The server may be waking up — please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener('abort', onAbort);
  }
}

export const LEARNING_MODULE_CODES = ['BOOKS', 'QUESTIONS', 'EXAM', 'PAPER', 'OCR'] as const;

export type LearningModuleCode = (typeof LEARNING_MODULE_CODES)[number];

export function hasLearningModule(grants: ModuleAccessGrant[], code: LearningModuleCode): boolean {
  return grants.some((g) => g.module_code === code && g.can_read);
}

export function learningGrants(grants: ModuleAccessGrant[]): ModuleAccessGrant[] {
  return grants.filter((g) => LEARNING_MODULE_CODES.includes(g.module_code as LearningModuleCode) && g.can_read);
}
