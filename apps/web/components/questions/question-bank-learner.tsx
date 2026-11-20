'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MoreVertical, Search, X } from 'lucide-react';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface BankItem {
  id: string;
  body_en: string;
  difficulty: string;
  question_type_name?: string;
  question_type_code: string;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  subjects?: Array<{ id: string; name: string; name_bn?: string }>;
  book_tags?: Array<{ book_id?: string; book_name?: string; chapter_name?: string; chapter_number?: string }>;
}

interface TypeRow {
  code: string;
  name: string;
}

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function bookOf(item: BankItem): { id: string; name: string } | null {
  if (item.book_id && item.book_name) return { id: item.book_id, name: item.book_name };
  const tag = item.book_tags?.[0];
  if (tag?.book_id && tag.book_name) return { id: tag.book_id, name: tag.book_name };
  return null;
}

export function QuestionBankLearner() {
  const [items, setItems] = useState<BankItem[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [bookId, setBookId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupByBooks, setGroupByBooks] = useState(true);

  useEffect(() => {
    void Promise.all([
      apiFetch<{ data: TypeRow[] }>('/questions/types'),
      apiFetch<{ data: Array<{ id: string; label: string }> }>('/questions/subject-catalog').catch(() => ({
        data: [] as Array<{ id: string; label: string }>,
      })),
    ]).then(([typeRes, subjectRes]) => {
      setTypes(typeRes.data);
      setSubjects(subjectRes.data);
    });
  }, []);

  function listParams(offset: number) {
    const params = new URLSearchParams();
    params.set('limit', '30');
    params.set('offset', String(offset));
    if (applied.trim()) params.set('q', applied.trim());
    if (typeCode) params.set('question_type_code', typeCode);
    if (difficulty) params.set('difficulty', difficulty);
    if (subjectId) params.set('exam_subject_id', subjectId);
    if (bookId) params.set('book_info_id', bookId);
    return params;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    apiFetch<{ data: BankItem[]; meta?: { has_more?: boolean } }>(`/questions?${listParams(0).toString()}`)
      .then((list) => {
        if (cancelled) return;
        setItems(list.data);
        setHasMore(Boolean(list.meta?.has_more));
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'প্রশ্ন লোড করা যায়নি');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, typeCode, difficulty, subjectId, bookId]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setLoadingMore(true);
      apiFetch<{ data: BankItem[]; meta?: { has_more?: boolean } }>(`/questions?${listParams(items.length).toString()}`)
        .then((list) => {
          setItems((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...list.data.filter((item) => !seen.has(item.id))];
          });
          setHasMore(Boolean(list.meta?.has_more));
        })
        .catch(() => setHasMore(false))
        .finally(() => setLoadingMore(false));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, items.length, applied, typeCode, difficulty, subjectId, bookId]);

  const books = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      const book = bookOf(item);
      if (book) map.set(book.id, book.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    const rows = items.filter((item) => {
      if (bookId && bookOf(item)?.id !== bookId) return false;
      return true;
    });
    if (!groupByBooks) return rows;
    return [...rows].sort((a, b) => {
      const an = bookOf(a)?.name ?? 'zzz';
      const bnName = bookOf(b)?.name ?? 'zzz';
      const bookCmp = an.localeCompare(bnName);
      if (bookCmp !== 0) return bookCmp;
      return (a.chapter_number ?? '').localeCompare(b.chapter_number ?? '', undefined, { numeric: true });
    });
  }, [items, bookId, groupByBooks]);

  const selectedBook = books.find((b) => b.id === bookId)?.name;
  const selectedSubject = subjects.find((s) => s.id === subjectId)?.label;

  let lastBook = '';
  let lastChapter = '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">অনুশীলন ও প্রশ্নব্যাংক</h1>
          <p className="mt-1 text-sm text-slate-600">
            আপনার এনরোল করা বিষয়ের সকল লিখিত ও নৈর্ব্যক্তিক প্রশ্ন বই ও অধ্যায় অনুসারে দেখুন।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/exam-prep"
            className="rounded-xl bg-[#1566b8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
          >
            বিষয়ভিত্তিক প্রস্তুতি
          </Link>
          <Link
            href="/papers"
            className="rounded-xl border border-[#d7e4ee] bg-white px-3.5 py-2 text-xs font-semibold text-[#0a2f5b] hover:bg-[#eaf3fc]"
          >
            মডেল টেস্ট
          </Link>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(query);
            setMenuOpen(false);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="প্রশ্ন খুঁজুন..."
              className="border-[#d7e4ee] bg-[#f4f9fd] pl-9 focus:bg-white"
            />
          </div>
          <Button type="submit" className="bg-[#1566b8] hover:bg-[#0f5294]">খুঁজুন</Button>
          <Button
            type="button"
            variant={menuOpen ? 'default' : 'outline'}
            size="sm"
            className="h-10 w-10 px-0"
            aria-label="বই ও ফিল্টার"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </form>

        {subjects.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSubjectId('')}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !subjectId ? 'bg-[#1566b8] text-white' : 'bg-[#f4f9fd] text-[#0a2f5b] hover:bg-[#e5f0fb]'
              }`}
            >
              সব বিষয়
            </button>
            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSubjectId(s.id)}
                className={`max-w-[240px] shrink-0 truncate rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  subjectId === s.id ? 'bg-[#1566b8] text-white' : 'bg-[#f4f9fd] text-[#0a2f5b] hover:bg-[#e5f0fb]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-xs font-semibold text-[#0a2f5b]"
            value={typeCode}
            onChange={(e) => setTypeCode(e.target.value)}
            aria-label="প্রশ্নের ধরন"
          >
            <option value="">সব ধরন</option>
            {types.map((t) => (
              <option key={t.code} value={t.code}>{t.name}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-xl border border-[#d7e4ee] bg-[#f4f9fd] px-3 text-xs font-semibold text-[#0a2f5b]"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            aria-label="কঠিনতার স্তর"
          >
            <option value="">সব স্তর</option>
            {QUESTION_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0a2f5b]">
            <input
              type="checkbox"
              className="accent-[#1566b8]"
              checked={groupByBooks}
              onChange={(e) => setGroupByBooks(e.target.checked)}
            />
            বই ও অধ্যায় অনুসারে সাজান
          </label>
        </div>
      </div>

      {menuOpen ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-[#d7e4ee] bg-white p-3 shadow-xs">
          <p className="px-2 py-1 text-xs font-bold text-[#0a2f5b]">বই নির্বাচন করুন</p>
          <button
            type="button"
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
              !bookId ? 'bg-[#eaf3fc] font-bold text-[#1566b8]' : 'text-slate-700'
            }`}
            onClick={() => {
              setBookId(null);
              setMenuOpen(false);
            }}
          >
            সব বই
          </button>
          {books.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                bookId === b.id ? 'bg-[#eaf3fc] font-bold text-[#1566b8]' : 'text-slate-700'
              }`}
              onClick={() => {
                setBookId(b.id);
                setMenuOpen(false);
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      ) : null}

      {selectedBook || selectedSubject ? (
        <div className="flex flex-wrap gap-2">
          {selectedSubject ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#eaf3fc] px-3 py-1 text-xs font-semibold text-[#1566b8]"
              onClick={() => setSubjectId('')}
            >
              {selectedSubject} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {selectedBook ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#eaf3fc] px-3 py-1 text-xs font-semibold text-[#1566b8]"
              onClick={() => setBookId(null)}
            >
              {selectedBook} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">প্রশ্নব্যাংক লোড হচ্ছে…</p> : null}
      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center text-sm text-slate-500">
          এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি।
        </div>
      ) : null}

      <div className="space-y-2.5">
        {filtered.map((item) => {
          const book = bookOf(item);
          const chapter = [item.chapter_number, item.chapter_name].filter(Boolean).join(': ');
          const showBook = groupByBooks && book && book.name !== lastBook;
          const showChapter = groupByBooks && chapter && chapter !== lastChapter;
          if (groupByBooks && book) lastBook = book.name;
          if (groupByBooks) lastChapter = chapter;
          return (
            <div key={item.id}>
              {showBook ? <p className="pt-3 pb-1 text-base font-bold text-[#0a2f5b]">{book?.name}</p> : null}
              {showChapter ? <p className="pb-1 text-xs font-semibold text-[#1566b8]">{chapter}</p> : null}
              <Link
                href={`/questions/${item.id}`}
                className="block rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-2xs transition hover:border-[#1566b8]"
              >
                <p className="line-clamp-3 text-sm leading-relaxed text-[#0a2f5b]">{plain(item.body_en)}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.question_type_name ? <Badge variant="secondary">{item.question_type_name}</Badge> : null}
                  <Badge variant="outline">{item.difficulty}</Badge>
                  {!groupByBooks && book ? <Badge variant="outline">{book.name}</Badge> : null}
                </div>
              </Link>
            </div>
          );
        })}
        <div ref={sentinel} className="h-6" />
        {loadingMore ? <p className="text-center text-xs text-slate-500">আরও প্রশ্ন লোড হচ্ছে…</p> : null}
      </div>
    </div>
  );
}
