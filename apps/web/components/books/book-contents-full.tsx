'use client';

import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookDetailsBlock } from '@/components/books/book-details-block';
import { RichTextView } from '@/components/books/rich-text-view';
import type { ReaderChapter } from '@/components/books/book-reader-context';
import { chapterHeading, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { bookTheme } from '@/lib/book-theme';

export interface ReaderTopicFull {
  id: string;
  rule_number: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  sort_order: number;
  description?: string;
  note?: string;
  details: Array<{ id: string; detail_text: string }>;
  sub_topics: Array<{
    id: string;
    name?: string;
    rule_number?: string;
    description?: string;
    note?: string;
  }>;
}

export interface ReaderChapterFull extends Omit<ReaderChapter, 'topics'> {
  topics: ReaderTopicFull[];
}

export function BookContentsFull({
  bookId,
  chapters,
  loading,
  isAdmin,
  onManageQuestions,
}: {
  bookId: string;
  chapters: ReaderChapterFull[];
  loading: boolean;
  isAdmin: boolean;
  onManageQuestions: (chapter: ReaderChapter) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return <p className="text-sm text-muted">No chapters in this book yet.</p>;
  }

  return (
    <article className="space-y-10">
      {chapters.map((chapter) => (
        <section key={chapter.id} id={`chapter-${chapter.id}`} className="scroll-mt-6">
          <div className="flex items-start justify-between gap-2 border-b border-amber-900/10 pb-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">
                <Link
                  href={`/books/${bookId}/read/chapter/${chapter.id}`}
                  className="hover:text-primary"
                >
                  {chapterHeading(chapter)}
                </Link>
              </h3>
              {chapter.sub_name?.trim() && (
                <p className="mt-0.5 text-sm text-muted">{chapter.sub_name}</p>
              )}
            </div>
            {isAdmin && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                title="Manage chapter questions"
                onClick={() => onManageQuestions(chapter)}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Questions</span>
              </Button>
            )}
          </div>

          {chapter.description?.trim() && (
            <div className="mt-4">
              <BookDetailsBlock html={chapter.description} />
            </div>
          )}

          {chapter.topics.length > 0 && (
            <div className="mt-6 space-y-6">
              {chapter.topics.map((topic) => (
                <div
                  key={topic.id}
                  id={`rule-${topic.id}`}
                  className={`scroll-mt-6 rounded-lg border border-amber-900/10 bg-[#fffef8]/60 p-4 sm:p-5 ${bookTheme.listItem}`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-foreground">
                      <Link
                        href={`/books/${bookId}/read/rule/${topic.id}`}
                        className="hover:text-primary"
                      >
                        {ruleHeading(topic)}
                      </Link>
                    </h4>
                    {topic.is_amended && (
                      <Badge variant="warning" className="text-[10px]">
                        Amended
                      </Badge>
                    )}
                  </div>

                  {(topic.description?.trim() || topic.note?.trim()) && (
                    <BookDetailsBlock html={topic.description} note={topic.note} />
                  )}

                  {topic.details.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {topic.details.map((d) => (
                        <RichTextView key={d.id} html={d.detail_text} />
                      ))}
                    </div>
                  )}

                  {topic.sub_topics.length > 0 && (
                    <ul className="mt-5 space-y-4 border-t border-amber-900/10 pt-4">
                      {topic.sub_topics.map((sub) => (
                        <li key={sub.id} id={`sub-${sub.id}`} className="scroll-mt-6">
                          <p className="font-medium text-foreground">{subRuleHeading(sub)}</p>
                          <div className="mt-2">
                            <BookDetailsBlock html={sub.description} note={sub.note} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </article>
  );
}
