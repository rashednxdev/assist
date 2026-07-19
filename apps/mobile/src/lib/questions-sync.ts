import type { QuestionSyncDeletion, QuestionSyncRow } from '@ibas/shared-types';
import { apiFetch } from './api';
import { applySyncBatch, getLastSyncedAt, setLastSyncedAt } from './questions-db';

type SyncResponse = {
  data: QuestionSyncRow[];
  deletions: QuestionSyncDeletion[];
  has_more: boolean;
  next_cursor?: string;
  synced_at: string;
};

const listeners = new Set<() => void>();

/** Fires after a sync run applies at least one change to the local question cache. */
export function subscribeQuestionsSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((fn) => fn());
}

let inFlight: Promise<void> | null = null;

/** Pulls every page changed since the last run and applies it to SQLite. Concurrent callers share one run. */
export function syncQuestions(): Promise<void> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(): Promise<void> {
  const since = getLastSyncedAt();
  let cursor: string | undefined;
  let latestSyncedAt: string | undefined;
  let appliedAny = false;

  for (;;) {
    const search = new URLSearchParams();
    if (cursor) search.set('cursor', cursor);
    else if (since) search.set('since', since);
    search.set('limit', '200');

    const res = await apiFetch<{ data: SyncResponse }>(`/questions/sync?${search.toString()}`);
    const page = res.data;

    if (page.data.length > 0 || page.deletions.length > 0) {
      applySyncBatch(
        page.data,
        page.deletions.map((d) => d.question_id),
      );
      appliedAny = true;
    }

    latestSyncedAt = page.synced_at;
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }

  if (latestSyncedAt) setLastSyncedAt(latestSyncedAt);
  if (appliedAny) notify();
}
