import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchBookReaderFull,
  fetchBookReaderOutline,
  peekBookReaderFull,
  peekBookReaderOutline,
} from '@/lib/books-api';
import type { BookReaderOutline, ReaderChapter, ReaderChapterFull, ReaderRuleNav } from '@/types/books';

interface BookReaderContextValue {
  bookId: string;
  outline: BookReaderOutline | null;
  fullChapters: ReaderChapterFull[] | null;
  loading: boolean;
  fullLoading: boolean;
  error: string;
  fullError: string;
  reload: () => Promise<void>;
  getChapter: (chapterId: string) => ReaderChapter | undefined;
  getRuleNav: (topicId: string) => ReaderRuleNav | undefined;
  getAdjacentRules: (topicId: string) => { prev: ReaderRuleNav | null; next: ReaderRuleNav | null };
}

const BookReaderContext = createContext<BookReaderContextValue | null>(null);

export function BookReaderProvider({ bookId, children }: { bookId: string; children: ReactNode }) {
  const [outline, setOutline] = useState<BookReaderOutline | null>(() =>
    bookId ? peekBookReaderOutline(bookId) : null,
  );
  const [fullChapters, setFullChapters] = useState<ReaderChapterFull[] | null>(() =>
    bookId ? peekBookReaderFull(bookId) : null,
  );
  const [loading, setLoading] = useState(() => !peekBookReaderOutline(bookId));
  const [fullLoading, setFullLoading] = useState(
    () => Boolean(bookId) && !peekBookReaderFull(bookId),
  );
  const [error, setError] = useState('');
  const [fullError, setFullError] = useState('');

  const prefetchFull = useCallback(async (chapters: ReaderChapter[]) => {
    if (!bookId) return;
    // Paint instantly from cache if present, but always continue on to revalidate over the
    // network below — a stale short-circuit here is what caused edits (e.g. a saved comparison
    // table) to not show up after leaving and returning to a book screen within the cache TTL.
    const cachedFull = peekBookReaderFull(bookId);
    if (cachedFull) setFullChapters(cachedFull);
    else setFullLoading(true);
    setFullError('');
    try {
      const data = await fetchBookReaderFull(bookId, chapters);
      setFullChapters(data);
    } catch (err) {
      setFullError(err instanceof Error ? err.message : 'Failed to load full book');
      if (!cachedFull) setFullChapters(null);
    } finally {
      setFullLoading(false);
    }
  }, [bookId]);

  const reload = useCallback(async () => {
    if (!bookId) return;
    const hadOutline = Boolean(peekBookReaderOutline(bookId));
    if (!hadOutline) setLoading(true);
    setError('');
    try {
      const data = await fetchBookReaderOutline(bookId);
      setOutline(data);
      void prefetchFull(data.chapters);
    } catch (err) {
      // Now that this always revalidates over the network (see fetchBookReaderOutline), a
      // transient failure shouldn't blank out content that was already showing from cache.
      if (!hadOutline) setOutline(null);
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }, [bookId, prefetchFull]);

  useEffect(() => {
    if (!bookId) return;

    setOutline(peekBookReaderOutline(bookId));
    const cachedFull = peekBookReaderFull(bookId);
    setFullChapters(cachedFull);
    setLoading(!peekBookReaderOutline(bookId));
    setFullLoading(!cachedFull);
    setError('');
    setFullError('');

    void reload();
  }, [bookId, reload]);

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
      fullChapters,
      loading,
      fullLoading,
      error,
      fullError,
      reload,
      getChapter,
      getRuleNav,
      getAdjacentRules,
    }),
    [
      bookId,
      outline,
      fullChapters,
      loading,
      fullLoading,
      error,
      fullError,
      reload,
      getChapter,
      getRuleNav,
      getAdjacentRules,
    ],
  );

  return <BookReaderContext.Provider value={value}>{children}</BookReaderContext.Provider>;
}

export function useBookReader() {
  const ctx = useContext(BookReaderContext);
  if (!ctx) throw new Error('useBookReader must be used within BookReaderProvider');
  return ctx;
}
