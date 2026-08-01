import { apiFetch } from './api';
import type { TermsRecord } from '@ibas/shared-types';

export type { TermsRecord };

export async function fetchTerms() {
  return apiFetch<{ data: TermsRecord }>('/terms');
}
