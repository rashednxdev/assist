import type { ModuleAccessGrant } from '@ibas/shared-types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };

  if (!res.ok) {
    throw new ApiError(json.error?.message ?? `Request failed (${res.status})`);
  }

  return json;
}

export const LEARNING_MODULE_CODES = ['BOOKS', 'QUESTIONS', 'EXAM', 'PAPER', 'OCR'] as const;

export type LearningModuleCode = (typeof LEARNING_MODULE_CODES)[number];

export function hasLearningModule(grants: ModuleAccessGrant[], code: LearningModuleCode): boolean {
  return grants.some((g) => g.module_code === code && g.can_read);
}

export function learningGrants(grants: ModuleAccessGrant[]): ModuleAccessGrant[] {
  return grants.filter((g) => LEARNING_MODULE_CODES.includes(g.module_code as LearningModuleCode) && g.can_read);
}
