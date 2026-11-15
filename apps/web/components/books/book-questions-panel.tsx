'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { useBookReader } from '@/components/books/book-reader-context';
import type { QuestionEvalBrief } from '@/lib/evaluation-display';

interface QuestionBrief {
  id: string;
  question_type_code: string;
  body_en: string;
  marks: number;
}

interface PageMeta {
  total: number;
  has_more: boolean;
}

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function BookQuestionsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f5c8c] text-sm font-semibold text-white hover:bg-[#0a3d5c]"
    >
      Questions
    </button>
  );
}

export function BookQuestionsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bookId, outline } = useBookReader();
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [items, setItems] = useState<QuestionBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());
  const sentinel = useRef<HTMLDivElement>(null);
  const requestKey = `${bookId}|${chapterId}|${topicId}`;

  const chapters = outline?.chapters ?? [];
  const topics = chapters.find((chapter) => chapter.id === chapterId)?.topics ?? [];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setItems([]);
    const params = new URLSearchParams({ limit: '20', offset: '0' });
    if (chapterId) params.set('chapter_id', chapterId);
    if (topicId) params.set('topic_id', topicId);
    apiFetch<{ data: QuestionBrief[]; meta: PageMeta }>(`/books/${bookId}/questions?${params.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        setItems(res.data);
        setTotal(res.meta.total);
        setHasMore(res.meta.has_more);
        if (res.data.length === 0) return;
        const evalRes = await apiFetch<{ data: QuestionEvalBrief[] }>(
          `/evaluation/questions/batch?ids=${res.data.map((q) => q.id).join(',')}`,
        );
        if (cancelled) return;
        setEvalMap((prev) => {
          const next = new Map(prev);
          for (const row of evalRes.data) next.set(row.question_id, row);
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load questions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookId, chapterId, topicId]);

  useEffect(() => {
    if (!open || !hasMore || loading || loadingMore) return;
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setLoadingMore(true);
      const params = new URLSearchParams({ limit: '20', offset: String(items.length) });
      if (chapterId) params.set('chapter_id', chapterId);
      if (topicId) params.set('topic_id', topicId);
      const key = requestKey;
      apiFetch<{ data: QuestionBrief[]; meta: PageMeta }>(`/books/${bookId}/questions?${params.toString()}`)
        .then(async (res) => {
          if (`${bookId}|${chapterId}|${topicId}` !== key) return;
          setItems((prev) => {
            const seen = new Set(prev.map((q) => q.id));
            return [...prev, ...res.data.filter((q) => !seen.has(q.id))];
          });
          setHasMore(res.meta.has_more);
          setTotal(res.meta.total);
          if (res.data.length === 0) return;
          const evalRes = await apiFetch<{ data: QuestionEvalBrief[] }>(
            `/evaluation/questions/batch?ids=${res.data.map((q) => q.id).join(',')}`,
          );
          setEvalMap((prev) => {
            const next = new Map(prev);
            for (const row of evalRes.data) next.set(row.question_id, row);
            return next;
          });
        })
        .catch(() => setHasMore(false))
        .finally(() => setLoadingMore(false));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, hasMore, loading, loadingMore, items.length, bookId, chapterId, topicId, requestKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label="Book questions">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl bg-[#f4f7fb] shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">Questions</h2>
            <p className="text-xs text-[#64748b]">{loading ? 'Loading…' : `${total} in this selection`}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-[#64748b] hover:bg-[#e8f3fa]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-[#e2e8f0] bg-white px-4 py-2">
          <FilterChip
            active={!chapterId}
            label="All"
            onClick={() => {
              setChapterId('');
              setTopicId('');
            }}
          />
          {chapters.map((chapter) => (
            <FilterChip
              key={chapter.id}
              active={chapterId === chapter.id}
              label={chapter.chapter_number?.trim() || chapter.name}
              onClick={() => {
                setChapterId(chapter.id);
                setTopicId('');
              }}
            />
          ))}
        </div>
        {topics.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-[#e2e8f0] bg-white px-4 py-2">
            <FilterChip active={!topicId} label="All topics" onClick={() => setTopicId('')} />
            {topics.map((topic) => (
              <FilterChip
                key={topic.id}
                active={topicId === topic.id}
                label={topic.rule_number?.trim() || topic.name || 'Topic'}
                onClick={() => setTopicId(topic.id)}
              />
            ))}
          </div>
        ) : null}
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && items.length === 0 ? <p className="text-sm text-[#64748b]">No published questions here yet.</p> : null}
          {items.map((q) => {
            const evaluation = evalMap.get(q.id);
            const reads = evaluation?.read_count ?? 0;
            return (
              <Link
                key={q.id}
                href={`/questions/${q.id}`}
                className="block rounded-[14px] border border-[#e2e8f0] bg-white p-4 hover:border-[#0f5c8c]/40"
              >
                <p className="line-clamp-3 text-sm leading-5 text-[#0f172a]">{plain(q.body_en)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Badge variant="outline">{q.question_type_code}</Badge>
                  <span className="text-xs text-[#64748b]">{q.marks} marks</span>
                  {reads > 0 ? <span className="text-xs font-semibold text-[#2f7d4a]">Read {reads}</span> : null}
                </div>
              </Link>
            );
          })}
          <div ref={sentinel} className="h-6" />
          {loadingMore ? <p className="text-center text-xs text-[#64748b]">Loading more…</p> : null}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? 'border-[#0f5c8c] bg-[#0f5c8c] text-white' : 'border-[#e2e8f0] bg-white text-[#64748b]'
      }`}
    >
      {label}
    </button>
  );
}
