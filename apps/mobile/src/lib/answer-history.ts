import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

export interface AnswerHistoryEntry {
  id: string;
  title: string;
  subtitle?: string;
  viewed_at: string;
}

export type AnswerHistoryDateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'older';

export interface AnswerHistoryDateGroup {
  key: string;
  label: string;
  items: AnswerHistoryEntry[];
}

const LEGACY_KEY = 'answer_history_v1';
const DB_NAME = 'answer-history.db';

let db: SQLite.SQLiteDatabase | null = null;
let memory: AnswerHistoryEntry[] | null = null;
let migrated = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function getDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS answer_history (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      viewed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_answer_history_viewed_at ON answer_history(viewed_at);
  `);
  return db;
}

function parseLegacy(raw: string | null): AnswerHistoryEntry[] {
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

function readAllFromDb(): AnswerHistoryEntry[] {
  const rows = getDb().getAllSync<{
    id: string;
    title: string;
    subtitle: string | null;
    viewed_at: string;
  }>('SELECT id, title, subtitle, viewed_at FROM answer_history ORDER BY viewed_at DESC');
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || undefined,
    viewed_at: row.viewed_at,
  }));
}

async function migrateFromSecureStore() {
  if (migrated) return;
  migrated = true;
  try {
    const existing = getDb().getFirstSync<{ c: number }>('SELECT COUNT(*) as c FROM answer_history');
    if ((existing?.c ?? 0) > 0) {
      await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
      return;
    }
    const raw = await SecureStore.getItemAsync(LEGACY_KEY);
    const legacy = parseLegacy(raw);
    if (legacy.length === 0) return;
    const database = getDb();
    database.withTransactionSync(() => {
      for (const row of legacy) {
        database.runSync(
          `INSERT OR REPLACE INTO answer_history (id, title, subtitle, viewed_at) VALUES (?, ?, ?, ?)`,
          [row.id, row.title, row.subtitle ?? null, row.viewed_at],
        );
      }
    });
    await SecureStore.deleteItemAsync(LEGACY_KEY).catch(() => undefined);
  } catch {
    // Keep going with whatever SQLite already has.
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
  await migrateFromSecureStore();
  memory = readAllFromDb();
  return memory;
}

function persistFromDb() {
  memory = readAllFromDb();
  notify();
}

/** Upsert: re-viewing a question bumps it to the top with a fresh timestamp rather than duplicating. */
export async function recordAnswerHistory(entry: Omit<AnswerHistoryEntry, 'viewed_at'>) {
  await migrateFromSecureStore();
  getDb().runSync(
    `INSERT INTO answer_history (id, title, subtitle, viewed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, subtitle = excluded.subtitle, viewed_at = excluded.viewed_at`,
    [entry.id, entry.title, entry.subtitle ?? null, new Date().toISOString()],
  );
  persistFromDb();
}

export async function clearAnswerHistory() {
  await migrateFromSecureStore();
  getDb().execSync('DELETE FROM answer_history');
  persistFromDb();
}

export async function removeAnswerHistoryEntry(id: string) {
  await migrateFromSecureStore();
  getDb().runSync('DELETE FROM answer_history WHERE id = ?', [id]);
  persistFromDb();
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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function localDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function formatHistoryDateLabel(dateKey: string): string {
  const today = localDateKey(new Date());
  const yesterday = localDateKey(addLocalDays(new Date(), -1));
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function matchesDateFilter(viewedAt: string, filter: AnswerHistoryDateFilter): boolean {
  if (filter === 'all') return true;
  const viewed = new Date(viewedAt);
  if (Number.isNaN(viewed.getTime())) return false;
  const todayStart = startOfLocalDay();
  const yesterdayStart = addLocalDays(todayStart, -1);
  const weekStart = addLocalDays(todayStart, -6);
  if (filter === 'today') return viewed >= todayStart;
  if (filter === 'yesterday') return viewed >= yesterdayStart && viewed < todayStart;
  if (filter === 'week') return viewed >= weekStart;
  return viewed < weekStart;
}

export function groupAnswerHistoryByDate(items: AnswerHistoryEntry[]): AnswerHistoryDateGroup[] {
  const groups = new Map<string, AnswerHistoryEntry[]>();
  for (const item of items) {
    const key = localDateKey(item.viewed_at) || 'unknown';
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, groupItems]) => ({
      key,
      label: key === 'unknown' ? 'Unknown date' : formatHistoryDateLabel(key),
      items: groupItems,
    }));
}

export const HISTORY_DATE_FILTERS: Array<{ id: AnswerHistoryDateFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'older', label: 'Older' },
];
