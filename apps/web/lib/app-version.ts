/** Must match `APP_VERSION_LABEL` in apps/mobile/src/lib/app-version.ts */
export const LATEST_MOBILE_APP_VERSION = 'ProAssist.2.0.0.6';

/** Format mobile app version for admin user lists (web does not report its own version). */
export function formatMobileAppVersion(
  version?: string | null,
  platform?: 'mobile' | 'web' | null,
): string {
  if (platform !== 'mobile' || !version?.trim()) return '—';
  return version.replace(/^ProAssist\./i, '');
}

/** @deprecated Use formatMobileAppVersion */
export const formatMobileAppVersionForDisplay = formatMobileAppVersion;

export function isLatestMobileAppVersion(
  version?: string | null,
  platform?: 'mobile' | 'web' | null,
): boolean {
  return platform === 'mobile' && version?.trim() === LATEST_MOBILE_APP_VERSION;
}
