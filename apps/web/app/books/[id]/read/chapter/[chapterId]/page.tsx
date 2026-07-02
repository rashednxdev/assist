'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookReaderGate, useBookReader } from '@/components/books/book-reader-context';
import { BookDetailsBlock } from '@/components/books/book-details-block';
import { ChapterTaggedQuestions } from '@/components/books/chapter-tagged-questions';
import { chapterHeading, ruleHeading } from '@/lib/book-display';
import { bookTheme } from '@/lib/book-theme';

export default function BookChapterReadPage() {
  const params = useParams();
  const bookId = params.id as string;
  const chapterId = params.chapterId as string;
  const { outline, getChapter } = useBookReader();
  const chapter = getChapter(chapterId);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  return (
    <BookReaderGate>
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/books/${bookId}`}>
            <ArrowLeft className="h-4 w-4" />
            {outline?.book.short_name || outline?.book.name || 'Book'}
          </Link>
        </Button>

        {!chapter ? (
          <p className="text-muted">Chapter not found.</p>
        ) : (
          <div className={`grid gap-6 ${questionsOpen ? 'lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]' : ''}`}>
            <div className="space-y-6">
              <article className={bookTheme.panelPadded}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-semibold">{chapterHeading(chapter)}</h1>
                    {chapter.sub_name?.trim() && (
                      <p className="mt-1 text-sm text-muted">{chapter.sub_name}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={questionsOpen ? 'default' : 'outline'}
                    onClick={() => setQuestionsOpen((v) => !v)}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Tag questions
                  </Button>
                </div>
                <div className="mt-4">
                  <BookDetailsBlock html={chapter.description} />
                </div>
              </article>

              {chapter.topics.length > 0 && (
                <section className={`p-5 ${bookTheme.panel}`}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                    Rules
                  </h2>
                  <ul className="space-y-2">
                    {chapter.topics.map((topic) => (
                      <li key={topic.id}>
                        <Link
                          href={`/books/${bookId}/read/rule/${topic.id}`}
                          className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${bookTheme.listItem}`}
                        >
                          <span className="font-medium">{ruleHeading(topic)}</span>
                          {topic.is_amended && <Badge variant="warning">Amended</Badge>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <ChapterTaggedQuestions
              chapterId={chapterId}
              open={questionsOpen}
              onOpenChange={setQuestionsOpen}
            />
          </div>
        )}
      </div>
    </BookReaderGate>
  );
}
