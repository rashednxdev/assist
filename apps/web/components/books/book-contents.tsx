'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { chapterHeading, ruleHeading } from '@/lib/book-display';
import { bookTheme } from '@/lib/book-theme';
import { apiFetch } from '@/lib/api-client';
import { useBookReader } from '@/components/books/book-reader-context';
import type { ReaderChapter } from '@/components/books/book-reader-context';
import { ChapterQuestionsManageModal } from '@/components/books/chapter-questions-manage-modal';
import { BookViewModeToggle, type BookContentsViewMode } from '@/components/books/book-view-mode-toggle';
import {
  BookContentsFull,
  type ReaderChapterFull,
} from '@/components/books/book-contents-full';

function viewModeStorageKey(bookId: string) {
  return `book-contents-view:${bookId}`;
}

export function BookContents({ isAdmin = false }: { isAdmin?: boolean }) {
  const { bookId, outline } = useBookReader();
  const [questionsChapter, setQuestionsChapter] = useState<ReaderChapter | null>(null);
  const [viewMode, setViewMode] = useState<BookContentsViewMode>('short');
  const [fullChapters, setFullChapters] = useState<ReaderChapterFull[] | null>(null);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullError, setFullError] = useState('');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(viewModeStorageKey(bookId));
      if (stored === 'short' || stored === 'full') setViewMode(stored);
    } catch {
      /* ignore */
    }
  }, [bookId]);

  useEffect(() => {
    setFullChapters(null);
    setFullError('');
  }, [bookId]);

  const loadFullContent = useCallback(async () => {
    setFullLoading(true);
    setFullError('');
    try {
      const res = await apiFetch<{ data: { chapters: ReaderChapterFull[] } }>(
        `/books/${bookId}/reader-full`,
      );
      setFullChapters(res.data.chapters);
    } catch (err) {
      setFullError(err instanceof Error ? err.message : 'Failed to load full book view');
      setFullChapters(null);
    } finally {
      setFullLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    if (viewMode !== 'full' || fullChapters) return;
    void loadFullContent();
  }, [viewMode, fullChapters, loadFullContent]);

  function handleViewModeChange(mode: BookContentsViewMode) {
    setViewMode(mode);
    try {
      sessionStorage.setItem(viewModeStorageKey(bookId), mode);
    } catch {
      /* ignore */
    }
  }

  if (!outline) return null;

  const { book, chapters } = outline;

  return (
    <div className={bookTheme.panel}>
      <div className="border-b border-amber-900/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground">{book.name}</h2>
            {book.name_bn && <p className="text-sm text-muted">{book.name_bn}</p>}
          </div>
          <BookViewModeToggle value={viewMode} onChange={handleViewModeChange} />
        </div>
      </div>

      <div className="px-5 py-4">
        {viewMode === 'full' ? (
          <>
            {fullError && <p className="mb-4 text-sm text-destructive">{fullError}</p>}
            <BookContentsFull
              bookId={bookId}
              chapters={fullChapters ?? []}
              loading={fullLoading && !fullChapters}
              isAdmin={isAdmin}
              onManageQuestions={setQuestionsChapter}
            />
          </>
        ) : chapters.length === 0 ? (
          <p className="text-sm text-muted">No chapters in this book yet.</p>
        ) : (
          <ol className="space-y-5">
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <div className="flex items-start gap-1">
                  <Link
                    href={`/books/${bookId}/read/chapter/${chapter.id}`}
                    className={`group min-w-0 flex-1 rounded-lg px-2 py-1.5 ${bookTheme.hoverRow}`}
                  >
                    <div className="flex items-start gap-2 text-base font-semibold text-foreground group-hover:text-primary">
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
                      <span>{chapterHeading(chapter)}</span>
                    </div>
                    {chapter.sub_name?.trim() && (
                      <p className="ml-6 mt-0.5 text-sm text-muted">{chapter.sub_name}</p>
                    )}
                  </Link>
                  {isAdmin && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-0.5 shrink-0"
                      title="Manage chapter questions"
                      onClick={() => setQuestionsChapter(chapter)}
                    >
                      <HelpCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Questions</span>
                    </Button>
                  )}
                </div>

                {chapter.topics.length > 0 && (
                  <ul className={`ml-6 mt-2 space-y-1 border-l pl-4 ${bookTheme.divider}`}>
                    {chapter.topics.map((topic) => (
                      <li key={topic.id}>
                        <Link
                          href={`/books/${bookId}/read/rule/${topic.id}`}
                          className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground ${bookTheme.hoverRow}`}
                        >
                          <span>{ruleHeading(topic)}</span>
                          {topic.is_amended && (
                            <Badge variant="warning" className="text-[10px]">
                              Amended
                            </Badge>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {questionsChapter && (
        <ChapterQuestionsManageModal
          open={!!questionsChapter}
          onOpenChange={(open) => {
            if (!open) setQuestionsChapter(null);
          }}
          bookId={bookId}
          chapter={questionsChapter}
        />
      )}
    </div>
  );
}
