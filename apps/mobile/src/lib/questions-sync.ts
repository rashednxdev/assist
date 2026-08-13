import type { QuestionSyncDeletion, QuestionSyncRow } from '@ibas/shared-types';
import { apiFetch } from './api';
import {
  applySyncBatch,
  clearQuestionCache,
  getCachedSubjectScopeKey,
  getLastSyncedAt,
  setCachedSubjectScopeKey,
  setLastSyncedAt,
} from './questions-db';

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
let syncGeneration = 0;

/**
 * Pulls every page changed since the last run and applies it to SQLite.
 * Pass `scopeKey` (user+allowlist) so an admin subject-access change triggers a full resync.
 * Concurrent callers share one run.
 */
export function syncQuestions(scopeKey?: string): Promise<void> {
  if (scopeKey !== undefined && getCachedSubjectScopeKey() !== scopeKey) {
    syncGeneration += 1;
    clearQuestionCache();
    setCachedSubjectScopeKey(scopeKey);
    notify();
    inFlight = null;
  }
  if (!inFlight) {
    const generation = syncGeneration;
    inFlight = runSync(generation).finally(() => {
      if (syncGeneration === generation) inFlight = null;
    });
  }
  return inFlight;
}

async function runSync(generation: number): Promise<void> {
  const since = getLastSyncedAt();
  let cursor: string | undefined;
  let latestSyncedAt: string | undefined;
  let appliedAny = false;

  for (;;) {
    if (generation !== syncGeneration) return;
    const search = new URLSearchParams();
    if (cursor) search.set('cursor', cursor);
    else if (since) search.set('since', since);
    search.set('limit', '200');

    const res = await apiFetch<{ data: SyncResponse }>(`/questions/sync?${search.toString()}`);
    if (generation !== syncGeneration) return;
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

  if (generation !== syncGeneration) return;
  if (latestSyncedAt) setLastSyncedAt(latestSyncedAt);
  if (appliedAny) notify();
}
