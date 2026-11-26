/**
 * Version line = first two numeric segments (major.minor).
 * e.g. ProAssist.1.0.3.8 → "1.0"; 2.1.0.0 → "2.1".
 * When latest_line is greater than installed_line, prior lines are absolute (must update).
 */

export function parseAppVersionParts(version?: string | null): number[] {
  if (!version?.trim()) return [];
  const cleaned = version.replace(/^ProAssist\./i, '').trim();
  if (!cleaned) return [];
  return cleaned.split('.').map((part) => {
    const n = Number.parseInt(part.replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  });
}

export function getAppVersionLine(version?: string | null): string {
  const parts = parseAppVersionParts(version);
  if (parts.length === 0) return '0.0';
  return `${parts[0] ?? 0}.${parts[1] ?? 0}`;
}

export function compareAppVersionLines(a?: string | null, b?: string | null): number {
  const ap = parseAppVersionParts(a);
  const bp = parseAppVersionParts(b);
  const a0 = ap[0] ?? 0;
  const a1 = ap[1] ?? 0;
  const b0 = bp[0] ?? 0;
  const b1 = bp[1] ?? 0;
  if (a0 !== b0) return a0 < b0 ? -1 : 1;
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  return 0;
}

/** Force when remote latest line is newer than the installed app line. */
export function isMobileForceUpdateRequired(
  installedVersion?: string | null,
  latestVersion?: string | null,
): boolean {
  if (!latestVersion?.trim()) return false;
  if (!installedVersion?.trim()) return true;
  return compareAppVersionLines(installedVersion, latestVersion) < 0;
}
