import { useCallback, useEffect, useState } from 'react';
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

  return { items, ready, refresh };
}
