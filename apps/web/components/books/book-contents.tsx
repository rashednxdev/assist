'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { chapterHeading, ruleHeading } from '@/lib/book-display';
import { bookTheme } from '@/lib/book-theme';
import { useBookReader } from '@/components/books/book-reader-context';

export function BookContents() {
  const { bookId, outline } = useBookReader();
  if (!outline) return null;

  const { book, chapters } = outline;

  return (
    <div className={bookTheme.panel}>
      <div className={bookTheme.panelHeader}>
        <h2 className="text-lg font-semibold text-foreground">{book.name}</h2>
        {book.name_bn && <p className="text-sm text-muted">{book.name_bn}</p>}
      </div>

      <div className="px-5 py-4">
        {chapters.length === 0 ? (
          <p className="text-sm text-muted">No chapters in this book yet.</p>
        ) : (
          <ol className="space-y-5">
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link
                  href={`/books/${bookId}/read/chapter/${chapter.id}`}
                  className={`group block rounded-lg px-2 py-1.5 ${bookTheme.hoverRow}`}
                >
                  <div className="flex items-start gap-2 text-base font-semibold text-foreground group-hover:text-primary">
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
                    <span>{chapterHeading(chapter)}</span>
                  </div>
                  {chapter.sub_name?.trim() && (
                    <p className="ml-6 mt-0.5 text-sm text-muted">{chapter.sub_name}</p>
                  )}
                </Link>

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
    </div>
  );
}
