import type { MobileAppVersionPolicy } from '@ibas/shared-types';
import { apiFetch } from './api';
import { APP_VERSION_LABEL } from './app-version';

export async function fetchMobileVersionPolicy(
  currentVersion: string = APP_VERSION_LABEL,
): Promise<MobileAppVersionPolicy> {
  const q = encodeURIComponent(currentVersion);
  const res = await apiFetch<{ data: MobileAppVersionPolicy }>(
    `/app-settings/mobile-version?current=${q}`,
    { method: 'GET' },
  );
  return res.data;
}
