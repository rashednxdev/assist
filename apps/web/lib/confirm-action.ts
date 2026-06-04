/** Browser confirm for destructive actions (soft-delete on API). */
export function confirmDelete(label: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(`Remove "${label}"? It will be hidden from lists (soft delete).`);
}
