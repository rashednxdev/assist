import * as SecureStore from 'expo-secure-store';

const KEY = 'books_last_read_v1';

export async function loadLastReadBookId(): Promise<string | null> {
  try {
    const id = await SecureStore.getItemAsync(KEY);
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export async function saveLastReadBookId(bookId: string): Promise<void> {
  try {
    const id = bookId.trim();
    if (!id) return;
    await SecureStore.setItemAsync(KEY, id);
  } catch {
    // ignore persistence failures
  }
}

/** Put the last-read book first; keep relative order of the rest. */
export function pinLastReadBook<T extends { id: string }>(items: T[], lastReadId: string | null): T[] {
  if (!lastReadId || items.length === 0) return items;
  const idx = items.findIndex((b) => b.id === lastReadId);
  if (idx <= 0) return items;
  const next = [...items];
  const [picked] = next.splice(idx, 1);
  if (picked) next.unshift(picked);
  return next;
}
