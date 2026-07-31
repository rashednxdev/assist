/** API / calculator ISO date: YYYY-MM-DD */
export type IsoDate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

export function isIsoDate(value: string): boolean {
  return ISO_RE.test(value.trim());
}

/** Format YYYY-MM-DD → DD-MM-YYYY for display. */
export function formatDdMmYyyy(iso: string): string {
  const m = ISO_RE.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Parse YYYY-MM-DD to local Date at noon (avoids TZ day-shift). */
export function parseIsoDate(iso: string): Date | null {
  const m = ISO_RE.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Date → YYYY-MM-DD */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Accept DD-MM-YYYY or YYYY-MM-DD → YYYY-MM-DD */
export function normalizeToIsoDate(value: string): IsoDate | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isIsoDate(trimmed)) return trimmed;
  const m = DMY_RE.exec(trimmed);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** e.g. "Mon, 12 Aug 2026" — for a YYYY-MM-DD calendar date. */
export function formatDateWithDay(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** e.g. "Monday" — for a YYYY-MM-DD calendar date. */
export function formatDayName(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}
