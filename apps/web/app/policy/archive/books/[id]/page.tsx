'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download } from 'lucide-react';
import type { ComparisonTable, ProcessStep } from '@ibas/shared-types';
import { hasComparisonTableContent } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { chapterHeading, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { PageHeader } from '@/components/shared/page-header';
import { MarkupText } from '@/components/shared/markup-text';
import { RichTextView } from '@/components/books/rich-text-view';
import { BookDetailsBlock } from '@/components/books/book-details-block';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ArchiveTopic {
  id: string;
  rule_number?: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  description?: string;
  note?: string;
  table?: ComparisonTable;
  processes?: Array<{ id: string; title: string; details?: string; steps: ProcessStep[] }>;
  details?: Array<{ id: string; detail_text: string }>;
  sub_topics?: Array<{ id: string; name?: string; rule_number?: string; description?: string; note?: string }>;
}

interface ArchiveChapter {
  id: string;
  chapter_number?: string;
  name?: string;
  sub_name?: string;
  description?: string;
  topics: ArchiveTopic[];
}

interface ArchiveBook {
  book: {
    id: string;
    name: string;
    name_bn: string;
    short_name?: string;
    description?: string;
    edition?: string;
    published_by?: string;
    language?: string;
    book_type_name?: string;
  };
  chapters: ArchiveChapter[];
}

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #archive-book, #archive-book * { visibility: visible !important; }
  #archive-book { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12mm; }
  #archive-book .no-print { display: none !important; }
  #archive-book section { break-inside: auto; }
}
`;

export default function ArchiveBookPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<ArchiveBook | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ArchiveBook }>(`/policy/archive/books/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the book'));
  }, [id]);

  const book = data?.book;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <style>{PRINT_CSS}</style>
      <PageHeader
        title={book?.name ?? 'Book'}
        description={book?.name_bn}
        backHref="/policy/archive"
        backLabel="Archive"
        action={
          data && data.chapters.length > 0 ? (
            <Button size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          ) : undefined
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {!data && !error ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : data ? (
        <article id="archive-book" className="space-y-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold">{data.book.name}</h1>
            {data.book.name_bn && <p className="text-muted">{data.book.name_bn}</p>}
            <div className="no-print flex flex-wrap gap-2">
              {data.book.short_name && <Badge variant="outline">{data.book.short_name}</Badge>}
              {data.book.edition && <Badge variant="secondary">Edition {data.book.edition}</Badge>}
              {data.book.published_by && <Badge variant="outline">{data.book.published_by}</Badge>}
              {data.book.book_type_name && <Badge variant="secondary">{data.book.book_type_name}</Badge>}
            </div>
            {data.book.description?.trim() && <RichTextView html={data.book.description} className="text-muted" />}
          </header>

          {data.chapters.length === 0 ? (
            <p className="text-sm text-muted">No chapters in this book yet.</p>
          ) : (
            data.chapters.map((chapter) => (
              <section key={chapter.id} className="space-y-5">
                <div className="border-b border-border pb-2">
                  {chapter.chapter_number?.trim() && (
                    <span className="block text-sm font-semibold text-primary">{chapter.chapter_number.trim()}</span>
                  )}
                  <h2 className="text-lg font-semibold">
                    {chapter.name?.trim() ? <MarkupText text={chapter.name} className="text-lg font-semibold" /> : chapterHeading(chapter)}
                  </h2>
                  {chapter.sub_name?.trim() && <p className="text-sm text-muted">{chapter.sub_name}</p>}
                </div>
                {chapter.description?.trim() && <RichTextView html={chapter.description} />}
                {chapter.topics.map((topic) => (
                  <div key={topic.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 flex-1 font-semibold">{ruleHeading(topic)}</h3>
                      {topic.is_amended && <Badge variant="warning">Amended</Badge>}
                    </div>
                    {topic.sub_name?.trim() && <p className="text-sm text-muted">{topic.sub_name}</p>}
                    {(topic.description?.trim() || topic.note?.trim()) && (
                      <BookDetailsBlock html={topic.description} note={topic.note} />
                    )}
                    {hasComparisonTableContent(topic.table) && <ComparisonTableView table={topic.table} label="" />}
                    {(topic.processes ?? []).map((p) => (
                      <div key={p.id} className="rounded-lg border border-border p-3">
                        {p.title?.trim() && <p className="font-semibold">{p.title}</p>}
                        {p.details?.trim() && <p className="mt-0.5 text-sm text-muted">{p.details}</p>}
                        <div className="mt-3">
                          <ProcessFlowPreview steps={p.steps} />
                        </div>
                      </div>
                    ))}
                    {(topic.details ?? []).map((d) => (
                      <RichTextView key={d.id} html={d.detail_text} />
                    ))}
                    {(topic.sub_topics ?? []).length > 0 && (
                      <ul className="space-y-3 border-t border-border pt-3">
                        {topic.sub_topics!.map((sub) => (
                          <li key={sub.id} className="space-y-1">
                            <p className="font-medium">{subRuleHeading(sub)}</p>
                            {(sub.description?.trim() || sub.note?.trim()) && (
                              <BookDetailsBlock html={sub.description} note={sub.note} />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            ))
          )}
        </article>
      ) : null}
    </div>
  );
}
