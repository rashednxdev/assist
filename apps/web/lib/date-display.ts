const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Format a YYYY-MM-DD date string (or ISO timestamp) as DD-MM-YYYY for display. */
export function formatDdMmYyyy(value: string): string {
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Local-calendar YYYY-MM-DD (not UTC). */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date; null when malformed. */
export function parseLocalIsoDate(value: string): Date | null {
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days from today to a YYYY-MM-DD date (negative when in the past). */
export function daysFromToday(value: string): number {
  const target = parseLocalIsoDate(value);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** e.g. "Monday, 28 Sep 2026" */
export function formatLongDate(value: string): string {
  const d = parseLocalIsoDate(value);
  if (!d) return value;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format an ISO timestamp (e.g. created_at) as "DD-MM-YYYY, HH:MM" for display. */
export function formatDateTimeDdMmYyyy(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return isoTimestamp;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}, ${hours}:${minutes}`;
}
