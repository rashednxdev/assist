import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadAnswerHistory,
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
    void refresh();
    return subscribeAnswerHistory(() => {
      void refresh();
    });
  }, [refresh]);

  const readCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of items) {
      map.set(row.id, row.read_count);
    }
    return map;
  }, [items]);

  return { items, ready, refresh, readCountById };
}
