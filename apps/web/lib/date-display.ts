const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Format a YYYY-MM-DD date string (or ISO timestamp) as DD-MM-YYYY for display. */
export function formatDdMmYyyy(value: string): string {
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
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
