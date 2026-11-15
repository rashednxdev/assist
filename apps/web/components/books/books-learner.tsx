'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, MoreVertical, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
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
      setError(err instanceof Error ? err.message : 'Failed to load books');
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Books & Tools</h1>
        <p className="mt-1 text-sm text-muted">Your allowed subjects, with the last book you opened kept at the top.</p>
      </div>

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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or tag..."
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
        <Button
          type="button"
          variant={menuOpen ? 'default' : 'outline'}
          size="sm"
          className="h-10 w-10 px-0"
          aria-label="Books and tools list"
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
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              !subjectId ? 'border-[#0f5c8c] bg-[#0f5c8c] text-white' : 'border-[#e2e8f0] bg-white text-[#64748b]'
            }`}
          >
            All subjects
          </button>
          {catalog.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectId(s.id)}
              className={`max-w-[220px] shrink-0 truncate rounded-full border px-3 py-1.5 text-xs font-semibold ${
                subjectId === s.id ? 'border-[#0f5c8c] bg-[#0f5c8c] text-white' : 'border-[#e2e8f0] bg-white text-[#64748b]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {menuOpen ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-3">
          <p className="text-sm font-semibold">Books & Tools</p>
          <p className="pb-1 text-xs text-muted">
            {selectedSubject ? `Sorted for ${selectedSubject}` : 'Ordered by subject · your allowed subjects only'}
          </p>
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
              !selectedBookId ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-slate-50'
            }`}
            onClick={() => {
              setSelectedBookId(null);
              setMenuOpen(false);
            }}
          >
            All books <span className="text-xs text-muted">{books.length}</span>
          </button>
          {ordered.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${
                selectedBookId === b.id ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-slate-50'
              }`}
              onClick={() => {
                setSelectedBookId(b.id);
                setMenuOpen(false);
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      ) : null}

      {selectedName || selectedSubject ? (
        <div className="flex flex-wrap gap-2">
          {selectedSubject ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#e8f3fa] px-3 py-1 text-sm font-semibold text-[#0f5c8c]"
              onClick={() => setSubjectId('')}
            >
              {selectedSubject} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {selectedName ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-[#e8f3fa] px-3 py-1 text-sm font-semibold text-[#0f5c8c]"
              onClick={() => setSelectedBookId(null)}
            >
              {selectedName} <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && books.length === 0 ? <p className="text-sm text-muted">Loading books…</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="text-sm text-muted">
          {selectedBookId ? 'Pick another book from the menu.' : 'No books are available for your allowed subjects yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((b) => (
            <Link
              key={b.id}
              href={`/books/${b.id}`}
              onClick={() => openBook(b.id)}
              className={`block rounded-2xl border p-4 ${
                b.id === lastReadId
                  ? 'border-[#a8d5b5] bg-[#eaf7ee]'
                  : 'border-[#e2e8f0] bg-white hover:border-[#0f5c8c]/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    b.id === lastReadId ? 'bg-[#d4eedc] text-[#2f7d4a]' : 'bg-[#e8f2fa] text-[#0f5c8c]'
                  }`}
                >
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#0f172a]">{b.name}</span>
                    {b.id === lastReadId ? (
                      <span className="rounded-full bg-[#c8e6d0] px-2 py-0.5 text-[11px] font-bold text-[#2f7d4a]">
                        Last read
                      </span>
                    ) : null}
                  </div>
                  {b.name_bn ? <p className="text-sm text-muted">{b.name_bn}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
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

      <Button asChild variant="outline" size="sm">
        <Link href="/books/regulations">Search regulations</Link>
      </Button>
    </div>
  );
}
