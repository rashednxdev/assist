/** Display version shown in the home menu. */
export const APP_VERSION_LABEL = 'ProAssist.1.0.0.14';

export const APP_UPDATE_URL = 'https://sites.google.com/view/ourproassist/home';

export function formatMobileAppVersionForDisplay(
  version?: string | null,
  platform?: 'mobile' | 'web' | null,
): string {
  if (platform !== 'mobile' || !version?.trim()) return '—';
  return version.replace(/^ProAssist\./i, '');
}

export function isLatestMobileAppVersion(
  version?: string | null,
  platform?: 'mobile' | 'web' | null,
): boolean {
  return platform === 'mobile' && version?.trim() === APP_VERSION_LABEL;
}
