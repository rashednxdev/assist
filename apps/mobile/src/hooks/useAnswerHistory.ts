import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  loadAnswerHistory,
  mergeServerReads,
  subscribeAnswerHistory,
  type AnswerHistoryEntry,
} from '@/lib/answer-history';

export function useAnswerHistory() {
  const [items, setItems] = useState<AnswerHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await loadAnswerHistory();
    setItems(rows);
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await loadAnswerHistory();
      if (cancelled) return;
      setItems(rows);
      setReady(true);
      try {
        const res = await apiFetch<{
          data: Array<{ question_id: string; title?: string; read_count?: number; last_read_at?: string }>;
        }>('/evaluation/history?limit=100');
        if (!cancelled) await mergeServerReads(res.data);
      } catch {
        /* Keep the copy already on this device when the server is unreachable. */
      }
    })();
    const unsubscribe = subscribeAnswerHistory(() => {
      if (cancelled) return;
      void loadAnswerHistory().then((rows) => {
        if (!cancelled) setItems(rows);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const readCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of items) {
      map.set(row.id, row.read_count);
    }
    return map;
  }, [items]);

  return { items, ready, refresh, readCountById };
}
