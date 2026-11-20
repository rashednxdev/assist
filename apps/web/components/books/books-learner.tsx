'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, MoreVertical, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SubjectCatalogItem } from '@/components/books/book-subject-tags';

interface BookItem {
  id: string;
  name: string;
  name_bn: string;
  short_name: string;
  description: string;
  book_type_name?: string;
  edition?: string;
  subjects?: Array<{ id: string; name: string; name_bn?: string }>;
}

const LAST_READ_KEY = 'proassist.lastBook';

export function BooksLearner() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [catalog, setCatalog] = useState<SubjectCatalogItem[]>([]);
  const [lastReadId, setLastReadId] = useState<string | null>(null);

  const load = useCallback(async (search?: string, examSubjectId?: string) => {
    setError('');
    const params = new URLSearchParams();
    if (search?.trim()) params.set('q', search.trim());
    if (examSubjectId) params.set('exam_subject_id', examSubjectId);
    const qs = params.toString();
    try {
      const res = await apiFetch<{ data: BookItem[] }>(`/books${qs ? `?${qs}` : ''}`);
      setBooks(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'বই লোড করা যায়নি');
    }
  }, []);

  useEffect(() => {
    setLastReadId(window.localStorage.getItem(LAST_READ_KEY));
    setLoading(true);
    void Promise.all([
      load(undefined, subjectId || undefined),
      apiFetch<{ data: SubjectCatalogItem[] }>('/books/subject-catalog')
        .then((r) => setCatalog(r.data))
        .catch(() => setCatalog([])),
    ]).finally(() => setLoading(false));
  }, [load, subjectId]);

  const ordered = useMemo(() => {
    if (!lastReadId) return books;
    const hit = books.find((b) => b.id === lastReadId);
    if (!hit) return books;
    return [hit, ...books.filter((b) => b.id !== lastReadId)];
  }, [books, lastReadId]);

  const visible = selectedBookId ? ordered.filter((b) => b.id === selectedBookId) : ordered;
  const selectedName = ordered.find((b) => b.id === selectedBookId)?.name;
  const selectedSubject = catalog.find((s) => s.id === subjectId)?.label;

  function openBook(id: string) {
    window.localStorage.setItem(LAST_READ_KEY, id);
    setLastReadId(id);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">বই ও নিয়মকানুন লাইব্রেরি</h1>
          <p className="mt-1 text-sm text-slate-600">
            আপনার অনুমোদিত বিষয়ের রেফারেন্স বইসমূহ। সর্বশেষ পড়া বইটি সবার উপরে থাকবে।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/books/regulations"
            className="rounded-xl bg-[#1566b8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
          >
            বিধি ও ধারা অনুসন্ধান
          </Link>
          <Link
            href="/books?tab=circulars"
            className="rounded-xl border border-[#d7e4ee] bg-white px-3.5 py-2 text-xs font-semibold text-[#0a2f5b] hover:bg-[#eaf3fc]"
          >
            পরিপত্র সংকলন
          </Link>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs">
        <div className="flex gap-2">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setLoading(true);
              void load(query, subjectId || undefined).finally(() => setLoading(false));
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="বইয়ের নাম বা ট্যাগ লিখে খুঁজুন..."
                className="border-[#d7e4ee] bg-[#f4f9fd] pl-9 focus:bg-white"
              />
            </div>
            <Button type="submit" className="bg-[#1566b8] hover:bg-[#0f5294]">খুঁজুন</Button>
          </form>
          <Button
            type="button"
            variant={menuOpen ? 'default' : 'outline'}
            size="sm"
            className="h-10 w-10 px-0"
            aria-label="বইয়ের তালিকা"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {catalog.length > 0 ? (
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
            {catalog.map((s) => (
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
      </div>

      {menuOpen ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-[#d7e4ee] bg-white p-3 shadow-xs">
          <p className="px-2 py-1 text-xs font-bold text-[#0a2f5b]">বই নির্বাচন করুন</p>
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
              !selectedBookId ? 'bg-[#eaf3fc] font-bold text-[#1566b8]' : 'hover:bg-slate-50'
            }`}
            onClick={() => {
              setSelectedBookId(null);
              setMenuOpen(false);
            }}
          >
            সব বই <span className="text-xs text-slate-500">{toBanglaDigits(String(books.length))}</span>
          </button>
          {ordered.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs ${
                selectedBookId === b.id ? 'bg-[#eaf3fc] font-bold text-[#1566b8]' : 'hover:bg-slate-50'
              }`}
              onClick={() => {
                setSelectedBookId(b.id);
                setMenuOpen(false);
              }}
            >
              {b.name_bn || b.name}
            </button>
          ))}
        </div>
      ) : null}

      {selectedName || selectedSubject ? (
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
          {selectedName ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#eaf3fc] px-3 py-1 text-xs font-semibold text-[#1566b8]"
              onClick={() => setSelectedBookId(null)}
            >
              {selectedName} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && books.length === 0 ? <p className="text-sm text-slate-500">বই লোড হচ্ছে…</p> : null}
      {!loading && visible.length === 0 ? (
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 text-center text-sm text-slate-500">
          {selectedBookId
            ? 'তালিকা থেকে অন্য বই নির্বাচন করুন।'
            : 'আপনার এনরোল করা বিষয়ের জন্য এখনো কোনো বই যুক্ত হয়নি।'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((b) => (
            <Link
              key={b.id}
              href={`/books/${b.id}`}
              onClick={() => openBook(b.id)}
              className={`block rounded-2xl border p-4 shadow-xs transition ${
                b.id === lastReadId
                  ? 'border-[#bde5d4] bg-[#f1fbf6] hover:border-[#1f9d68]'
                  : 'border-[#d7e4ee] bg-white hover:border-[#1566b8]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    b.id === lastReadId ? 'bg-[#dcf3e6] text-[#156f4d]' : 'bg-[#eaf3fc] text-[#1566b8]'
                  }`}
                >
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0a2f5b]">{b.name_bn || b.name}</span>
                    {b.id === lastReadId ? (
                      <span className="rounded-full bg-[#dcf3e6] px-2 py-0.5 text-[11px] font-bold text-[#156f4d]">
                        সর্বশেষ পঠিত
                      </span>
                    ) : null}
                  </div>
                  {b.name_bn && b.name !== b.name_bn ? <p className="text-xs text-slate-500">{b.name}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.short_name ? <Badge variant="outline">{b.short_name}</Badge> : null}
                    {b.book_type_name ? <Badge variant="secondary">{b.book_type_name}</Badge> : null}
                    {b.edition ? <Badge variant="outline">{b.edition}</Badge> : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
