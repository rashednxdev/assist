import { useCallback, useEffect, useState } from 'react';
import {
  isShortcutSaved,
  loadSavedShortcuts,
  subscribeSavedShortcuts,
  toggleSavedShortcut,
  type SavedShortcut,
  type SavedShortcutKind,
} from '@/lib/saved-shortcuts';

export function useSavedShortcuts() {
  const [items, setItems] = useState<SavedShortcut[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await loadSavedShortcuts();
    setItems(rows);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeSavedShortcuts(() => {
      void refresh();
    });
  }, [refresh]);

  const isSaved = useCallback(
    (id: string, kind: SavedShortcutKind) => isShortcutSaved(items, id, kind),
    [items],
  );

  const toggle = useCallback(
    async (entry: Omit<SavedShortcut, 'saved_at'>) => toggleSavedShortcut(entry),
    [],
  );

  return { items, ready, isSaved, toggle, refresh };
}
