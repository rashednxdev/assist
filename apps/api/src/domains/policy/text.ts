export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" regex for a user query (already trimmed). */
export function containsRegex(q: string): RegExp {
  return new RegExp(escapeRegex(q), 'i');
}

export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plain-text excerpt, centred on the first match of `q` when present. */
export function snippet(text: string, q?: string, len = 180): string {
  if (!text) return '';
  if (text.length <= len) return text;
  const idx = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (idx < 0) return `${text.slice(0, len)}…`;
  const start = Math.max(0, idx - Math.floor(len / 3));
  const out = text.slice(start, start + len);
  return `${start > 0 ? '…' : ''}${out}${start + len < text.length ? '…' : ''}`;
}
