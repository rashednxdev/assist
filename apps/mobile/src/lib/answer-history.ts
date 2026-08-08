import * as SecureStore from 'expo-secure-store';

export interface AnswerHistoryEntry {
  id: string;
  title: string;
  subtitle?: string;
  viewed_at: string;
}

const KEY = 'answer_history_v1';
const MAX_ENTRIES = 100;

let memory: AnswerHistoryEntry[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function parse(raw: string | null): AnswerHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AnswerHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row && typeof row.id === 'string' && typeof row.title === 'string' && typeof row.viewed_at === 'string',
    );
  } catch {
    return [];
  }
}

export function subscribeAnswerHistory(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadAnswerHistory(): Promise<AnswerHistoryEntry[]> {
  if (memory) return memory;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    memory = parse(raw);
    return memory;
  } catch {
    memory = [];
    return [];
  }
}

async function persist(items: AnswerHistoryEntry[]) {
  memory = items;
  await SecureStore.setItemAsync(KEY, JSON.stringify(items));
  notify();
}

/** Upsert: re-viewing a question bumps it to the top with a fresh timestamp rather than duplicating. */
export async function recordAnswerHistory(entry: Omit<AnswerHistoryEntry, 'viewed_at'>) {
  const items = await loadAnswerHistory();
  const next = [
    { ...entry, viewed_at: new Date().toISOString() },
    ...items.filter((row) => row.id !== entry.id),
  ].slice(0, MAX_ENTRIES);
  await persist(next);
}

export async function clearAnswerHistory() {
  await persist([]);
}

export async function removeAnswerHistoryEntry(id: string) {
  const items = await loadAnswerHistory();
  const next = items.filter((row) => row.id !== id);
  if (next.length === items.length) return;
  await persist(next);
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
