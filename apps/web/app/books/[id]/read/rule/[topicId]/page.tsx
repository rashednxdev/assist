'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookReaderGate, useBookReader } from '@/components/books/book-reader-context';
import { BookDetailsBlock } from '@/components/books/book-details-block';
import { RichTextView } from '@/components/books/rich-text-view';
import { RuleContentLinkEmbed } from '@/components/books/rule-content-link-embed';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';
import { chapterHeading, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { bookTheme } from '@/lib/book-theme';
import type { ComparisonTable, ProcessStep } from '@ibas/shared-types';
import { hasComparisonTableContent } from '@ibas/shared-types';

interface TopicDetail {
  id: string;
  name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  content_link?: string;
  /** Optional comparison table for this rule/topic. */
  table?: ComparisonTable;
  /** Optional step-by-step processes documented for this rule/topic. */
  processes?: Array<{ id: string; title: string; details?: string; steps: ProcessStep[] }>;
  is_amended: boolean;
  chapter?: { id: string; name: string; chapter_number?: string } | null;
  details: Array<{ id: string; detail_text: string }>;
  sub_topics: Array<{ id: string; name?: string; rule_number?: string; description?: string; note?: string }>;
  regulations: Array<{ id: string; regulation_no: string; title: string }>;
}

export default function BookRuleReadPage() {
  const params = useParams();
  const bookId = params.id as string;
  const topicId = params.topicId as string;
  const { outline, getRuleNav, getAdjacentRules } = useBookReader();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: TopicDetail }>(`/books/topics/${topicId}`)
      .then((res) => setTopic(res.data))
      .catch(() => setTopic(null))
      .finally(() => setLoading(false));
  }, [topicId]);

  const ruleNav = getRuleNav(topicId);
  const { prev, next } = getAdjacentRules(topicId);
  const chapterId = ruleNav?.chapter_id ?? topic?.chapter?.id;

  return (
    <BookReaderGate>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/books/${bookId}`}>
              <ArrowLeft className="h-4 w-4" />
              {outline?.book.short_name || outline?.book.name || 'Book'}
            </Link>
          </Button>
          {chapterId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/books/${bookId}/read/chapter/${chapterId}`}>Chapter</Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !topic ? (
          <p className="text-muted">Rule not found.</p>
        ) : (
          <article className={bookTheme.panelPadded}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{ruleHeading(topic)}</h1>
              {topic.is_amended && <Badge variant="warning">Amended</Badge>}
            </div>
            {topic.chapter && (
              <p className="mb-4 text-sm text-muted">
                {chapterHeading({
                  chapter_number: topic.chapter.chapter_number,
                  name: topic.chapter.name,
                })}
              </p>
            )}
            <BookDetailsBlock html={topic.description} note={topic.note} />
            <RuleContentLinkEmbed
              contentLink={topic.content_link}
              title={ruleHeading(topic)}
              heightClassName="h-[min(80vh,720px)]"
            />
            {hasComparisonTableContent(topic.table) && (
              <div className="mt-6">
                <ComparisonTableView table={topic.table} label="Comparison table" />
              </div>
            )}
            {(topic.processes?.length ?? 0) > 0 && (
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold text-muted">Processes</h2>
                {topic.processes!.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-4">
                    <div className="font-semibold text-foreground">{p.title}</div>
                    {p.details?.trim() && <p className="mt-0.5 text-sm text-muted">{p.details}</p>}
                    <div className="mt-3">
                      <ProcessFlowPreview steps={p.steps} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {topic.details.length > 0 && (
              <div className="mt-6 space-y-3">
                {topic.details.map((d) => (
                  <RichTextView key={d.id} html={d.detail_text} />
                ))}
              </div>
            )}
            {topic.sub_topics.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-muted">Sub-rules</h2>
                <ul className="space-y-3">
                  {topic.sub_topics.map((st) => (
                    <li key={st.id} id={`sub-${st.id}`} className={`border p-3 ${bookTheme.listItem}`}>
                      <p className="font-medium">{subRuleHeading(st)}</p>
                      <BookDetailsBlock html={st.description} note={st.note} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topic.regulations.length > 0 && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-semibold text-muted">Linked regulations</h2>
                <ul className="space-y-1">
                  {topic.regulations.map((r) => (
                    <li key={r.id}>
                      <Link href={`/books/regulations/${r.id}`} className="text-sm text-primary hover:underline">
                        {r.regulation_no} — {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        )}

        <div className={`flex flex-wrap items-center justify-between gap-2 ${bookTheme.navFooter}`}>
          {prev ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/books/${bookId}/read/rule/${prev.id}`}>
                <ChevronLeft className="h-4 w-4" />
                {ruleHeading(prev)}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/books/${bookId}/read/rule/${next.id}`}>
                {ruleHeading(next)}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </BookReaderGate>
  );
}
