/** Browser confirm for soft-delete to trash. */
export function confirmDelete(label: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(`Move "${label}" to trash? It will be hidden from lists.`);
}

/** Browser confirm for permanent hard-delete. */
export function confirmPermanentDelete(label: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(
    `Permanently delete "${label}"? This removes the question and related answer/options/links from the database and cannot be undone.`,
  );
}

export function confirmBatchTrash(count: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(
    `Move ${count} selected question${count === 1 ? '' : 's'} to trash? They will be inactive, unpublished, and hidden from the bank.`,
  );
}

export function confirmBatchPermanentDelete(count: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(
    `Permanently delete ${count} selected question${count === 1 ? '' : 's'}? Related options, answers, details, book links, and evaluations will be removed from the database. This cannot be undone.`,
  );
}

export function confirmBatchRestore(count: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(
    `Restore ${count} selected question${count === 1 ? '' : 's'} to the question bank?`,
  );
}
