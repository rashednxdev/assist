'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';

export interface ReaderBook {
  id: string;
  name: string;
  name_bn: string;
  short_name: string;
  description: string;
  edition?: string;
  published_by?: string;
  language: string;
  tags: string[];
  book_type_name?: string;
}

export interface ReaderChapterTopic {
  id: string;
  rule_number: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  sort_order: number;
}

export interface ReaderChapter {
  id: string;
  chapter_number: string;
  name: string;
  sub_name?: string;
  description?: string;
  sort_order: number;
  topics: ReaderChapterTopic[];
}

export interface ReaderRuleNav {
  id: string;
  rule_number: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  chapter_id: string;
  chapter_number: string;
  chapter_name: string;
}

export interface BookReaderOutline {
  book: ReaderBook;
  chapters: ReaderChapter[];
  rules: ReaderRuleNav[];
}

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

export function BookReaderProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const bookId = params.id as string;
  const [outline, setOutline] = useState<BookReaderOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: BookReaderOutline }>(`/books/${bookId}/reader-outline`);
      setOutline(res.data);
    } catch (err) {
      setOutline(null);
      setError(err instanceof Error ? err.message : 'Failed to load book');
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    reload();
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

export function BookReaderGate({ children }: { children: React.ReactNode }) {
  const { loading, error } = useBookReader();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return children;
}
