import * as SecureStore from 'expo-secure-store';

export type SavedShortcutKind = 'book' | 'question' | 'marathon';

export interface SavedShortcut {
  id: string;
  kind: SavedShortcutKind;
  title: string;
  subtitle?: string;
  book_id?: string;
  chapter_id?: string;
  number?: number;
  saved_at: string;
}

const KEY = 'saved_shortcuts_v1';

let memory: SavedShortcut[] | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function parse(raw: string | null): SavedShortcut[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedShortcut[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        row &&
        typeof row.id === 'string' &&
        (row.kind === 'book' || row.kind === 'question' || row.kind === 'marathon') &&
        typeof row.title === 'string',
    );
  } catch {
    return [];
  }
}

export function subscribeSavedShortcuts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadSavedShortcuts(): Promise<SavedShortcut[]> {
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

async function persist(items: SavedShortcut[]) {
  memory = items;
  await SecureStore.setItemAsync(KEY, JSON.stringify(items));
  notify();
}

export function savedKey(id: string, kind: SavedShortcutKind) {
  return `${kind}:${id}`;
}

export function isShortcutSaved(items: SavedShortcut[], id: string, kind: SavedShortcutKind) {
  return items.some((row) => row.id === id && row.kind === kind);
}

export async function toggleSavedShortcut(
  entry: Omit<SavedShortcut, 'saved_at'>,
): Promise<boolean> {
  const items = await loadSavedShortcuts();
  const idx = items.findIndex((row) => row.id === entry.id && row.kind === entry.kind);
  if (idx >= 0) {
    const next = [...items];
    next.splice(idx, 1);
    await persist(next);
    return false;
  }
  // MCQs saved from Question Bank use marathon kind — drop any legacy question-kind copy.
  let next = items;
  if (entry.kind === 'marathon') {
    next = items.filter((row) => !(row.id === entry.id && row.kind === 'question'));
  }
  next = [
    {
      ...entry,
      saved_at: new Date().toISOString(),
    },
    ...next,
  ];
  await persist(next);
  return true;
}

export async function removeSavedShortcut(id: string, kind: SavedShortcutKind) {
  const items = await loadSavedShortcuts();
  const next = items.filter((row) => !(row.id === id && row.kind === kind));
  if (next.length === items.length) return;
  await persist(next);
}

export function groupSavedShortcuts(items: SavedShortcut[]) {
  return {
    books: items.filter((row) => row.kind === 'book'),
    questions: items.filter((row) => row.kind === 'question'),
    marathon: items.filter((row) => row.kind === 'marathon'),
  };
}
