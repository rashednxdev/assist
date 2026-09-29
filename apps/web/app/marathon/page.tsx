'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { RichTextView } from '@/components/books/rich-text-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ExplanationSection {
  title?: string;
  details?: string;
  note?: string;
  subsections?: Array<{ subtitle?: string; details?: string; note?: string }>;
}

interface MarathonItem {
  id: string;
  number: number;
  body_en: string;
  body_bn?: string;
  book_id: string;
  book_name: string;
  chapter_id: string;
  chapter_number: string;
  chapter_name: string;
  explanation_sections?: ExplanationSection[];
}

interface MarathonResponse {
  data: MarathonItem[];
  meta: { total: number; limit: number; offset: number; has_more: boolean };
}

const PAGE_SIZE = 50;

function isGenericTitle(title?: string) {
  const t = title?.trim().toLowerCase() ?? '';
  return !t || t === 'explanation' || t === 'explanations' || t === 'answer' || t === 'answers';
}

function AnswerBlocks({ sections }: { sections: ExplanationSection[] }) {
  if (sections.length === 0) return <p className="text-sm text-muted">No answer added yet.</p>;
  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => (
        <div key={idx} className="border-l-2 border-sky-400 pl-3">
          {!isGenericTitle(sec.title) && <p className="font-semibold">{sec.title}</p>}
          <RichTextView html={sec.details} />
          {sec.note?.trim() ? <RichTextView html={sec.note} className="text-muted" /> : null}
          {(sec.subsections ?? []).map((sub, si) => (
            <div key={si} className="mt-2 pl-2">
              {!isGenericTitle(sub.subtitle) && <p className="text-sm font-semibold">{sub.subtitle}</p>}
              <RichTextView html={sub.details} />
              {sub.note?.trim() ? <RichTextView html={sub.note} className="text-muted" /> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function MarathonReviewPage() {
  const [items, setItems] = useState<MarathonItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [bookId, setBookId] = useState('');

  const fetchPage = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (query) params.set('q', query);
      return apiFetch<MarathonResponse>(`/questions/marathon-review?${params.toString()}`);
    },
    [query],
  );

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchPage(0)
      .then((res) => {
        setItems(res.data);
        setTotal(res.meta.total);
        setHasMore(res.meta.has_more);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetchPage(items.length);
      setItems((cur) => [...cur, ...res.data]);
      setHasMore(res.meta.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(id: string) {
    setRevealed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const books = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of items) map.set(it.book_id, it.book_name);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const grouped = useMemo(() => {
    const out: Array<{ key: string; book: string; chapter: string; items: MarathonItem[] }> = [];
    for (const it of items) {
      if (bookId && it.book_id !== bookId) continue;
      const key = `${it.book_id}:${it.chapter_id}`;
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = {
          key,
          book: it.book_name,
          chapter: it.chapter_number ? `${it.chapter_number}: ${it.chapter_name}` : it.chapter_name,
          items: [],
        };
        out.push(g);
      }
      g.items.push(it);
    }
    return out;
  }, [items, bookId]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Marathon Review"
        description="Short questions & answers from Books & Tools — reveal each answer or show them all."
        backHref="/dashboard"
        action={
          <Button size="sm" variant={showAll ? 'default' : 'outline'} onClick={() => setShowAll((v) => !v)}>
            {showAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showAll ? 'Hide answers' : 'Show all answers'}
          </Button>
        }
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(draft.trim());
        }}
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search questions…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        {books.length > 1 && (
          <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm shadow-sm"
          >
            <option value="">All books</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        !error && <EmptyState title={query ? 'No matching questions' : 'No questions available'} />
      ) : (
        <>
          <p className="text-sm text-muted">
            Showing {items.length} of {total}
          </p>
          {grouped.map((g) => (
            <section key={g.key} className="space-y-2">
              <div className="border-b border-border pb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.book}</p>
                <h2 className="font-semibold text-sky-800">{g.chapter}</h2>
              </div>
              {g.items.map((it) => {
                const open = showAll || revealed.has(it.id);
                return (
                  <div key={it.id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                    <button type="button" onClick={() => toggle(it.id)} className="flex w-full items-start gap-3 text-left">
                      <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 px-1.5 text-xs font-bold text-sky-800">
                        {it.number}
                      </span>
                      <span className="flex-1 text-sm font-medium leading-relaxed">
                        {it.body_bn?.trim() || it.body_en}
                      </span>
                      <span className={cn('text-xs font-semibold', open ? 'text-muted' : 'text-primary')}>
                        {open ? 'Hide' : 'Answer'}
                      </span>
                    </button>
                    {open && (
                      <div className="mt-3 border-t border-border pt-3">
                        <AnswerBlocks sections={it.explanation_sections ?? []} />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
