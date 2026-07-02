import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchBookReaderOutline } from '@/lib/books-api';
import type { BookReaderOutline, ReaderChapter, ReaderRuleNav } from '@/types/books';

interface BookReaderContextValue {
  bookId: string;
  outline: BookReaderOutline | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  getChapter: (chapterId: string) => ReaderChapter | undefined;
  getRuleNav: (topicId: string) => ReaderRuleNav | undefined;
  getAdjacentRules: (topicId: string) => { prev: ReaderRuleNav | null; next: ReaderRuleNav | null };
}

const BookReaderContext = createContext<BookReaderContextValue | null>(null);

export function BookReaderProvider({ bookId, children }: { bookId: string; children: ReactNode }) {
  const [outline, setOutline] = useState<BookReaderOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchBookReaderOutline(bookId);
      setOutline(data);
    } catch (err) {
      setOutline(null);
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const getChapter = useCallback(
    (chapterId: string) => outline?.chapters.find((c) => c.id === chapterId),
    [outline],
  );

  const getRuleNav = useCallback(
    (topicId: string) => outline?.rules.find((r) => r.id === topicId),
    [outline],
  );

  const getAdjacentRules = useCallback(
    (topicId: string) => {
      if (!outline) return { prev: null, next: null };
      const idx = outline.rules.findIndex((r) => r.id === topicId);
      if (idx < 0) return { prev: null, next: null };
      return {
        prev: idx > 0 ? outline.rules[idx - 1]! : null,
        next: idx < outline.rules.length - 1 ? outline.rules[idx + 1]! : null,
      };
    },
    [outline],
  );

  const value = useMemo(
    () => ({
      bookId,
      outline,
      loading,
      error,
      reload,
      getChapter,
      getRuleNav,
      getAdjacentRules,
    }),
    [bookId, outline, loading, error, reload, getChapter, getRuleNav, getAdjacentRules],
  );

  return <BookReaderContext.Provider value={value}>{children}</BookReaderContext.Provider>;
}

export function useBookReader() {
  const ctx = useContext(BookReaderContext);
  if (!ctx) throw new Error('useBookReader must be used within BookReaderProvider');
  return ctx;
}
