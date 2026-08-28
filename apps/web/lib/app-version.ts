/** Format mobile app version for admin user lists (web does not report its own version). */
export function formatMobileAppVersion(
  version?: string | null,
  platform?: 'mobile' | 'web' | null,
): string {
  if (platform !== 'mobile' || !version?.trim()) return '—';
  return version.replace(/^ProAssist\./i, '');
}
