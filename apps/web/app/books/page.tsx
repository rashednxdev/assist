'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, FileText, Search, Plus } from 'lucide-react';
import { CircularBrowser } from '@/components/circulars/circular-browser';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { bookTheme } from '@/lib/book-theme';
import {
  BookSubjectTags,
  type BookSubjectTag,
  type SubjectCatalogItem,
} from '@/components/books/book-subject-tags';
import { BookArchiveTag } from '@/components/books/book-archive-tag';

interface BookItem {
  id: string;
  name: string;
  name_bn: string;
  short_name: string;
  description: string;
  book_type_name?: string;
  edition?: string;
  language: string;
  tags: string[];
  subjects?: BookSubjectTag[];
  subject_sort_order?: number;
  archive_book?: boolean;
}

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectCatalogItem[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [tab, setTab] = useState<'books' | 'circulars'>('books');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'circulars') setTab('circulars');
  }, []);

  function switchTab(next: 'books' | 'circulars') {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'circulars') url.searchParams.set('tab', 'circulars');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url.toString());
  }

  const load = useCallback((search?: string, examSubjectId?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search?.trim()) params.set('q', search.trim());
    if (examSubjectId) params.set('exam_subject_id', examSubjectId);
    const qs = params.toString();
    apiFetch<{ data: BookItem[] }>(`/books${qs ? `?${qs}` : ''}`)
      .then((r) => setBooks(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetchMe()
      .then((res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setIsAdmin(admin);
        return apiFetch<{ data: SubjectCatalogItem[] }>('/books/subject-catalog').then((r) =>
          setSubjectCatalog(r.data),
        );
      })
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    load(q, filterSubjectId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search is applied explicitly via form
  }, [filterSubjectId, load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Books & regulations"
        description="Browse GFR, government financial rules, circulars and orders."
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button asChild size="sm">
                <Link href={tab === 'circulars' ? '/books/admin?mode=circular' : '/books/admin'}>
                  <Plus className="h-4 w-4" />
                  {tab === 'circulars' ? 'Add circular / order' : 'Add book'}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/books/regulations">
                <Search className="h-4 w-4" />
                Search regulations
              </Link>
            </Button>
          </div>
        }
      />

      <div className="inline-flex rounded-lg border border-border bg-background p-1" role="tablist">
        {(
          [
            { key: 'books', label: 'Books', icon: BookOpen },
            { key: 'circulars', label: 'Circulars & orders', icon: FileText },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'circulars' ? (
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <CircularBrowser />
        </Suspense>
      ) : (
      <Card className={`${bookTheme.panel} border-amber-900/15 bg-[#fffef8]`}>
        <CardHeader className={`border-b pb-4 ${bookTheme.divider}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Library</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm sm:w-56"
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                aria-label="Filter by subject"
              >
                <option value="">All subjects</option>
                {subjectCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  load(q, filterSubjectId || undefined);
                }}
              >
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by title or tag..."
                  className="w-full sm:w-64"
                />
                <Button type="submit" size="sm" variant="outline">
                  Search
                </Button>
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : books.length === 0 ? (
            <EmptyState
              title="No books found"
              description={
                isAdmin
                  ? 'Add a book from Book admin, link subjects, or run pnpm seed for sample GFR data.'
                  : 'No publications are available for your allowed subjects yet.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {books.map((b) => (
                <div key={b.id} className={`group block p-4 ${bookTheme.linkCard}`}>
                  <Link href={`/books/${b.id}`} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-900/10 bg-amber-50 text-amber-900">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground group-hover:text-primary">{b.name}</div>
                      <div className="text-sm text-muted">{b.name_bn}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.short_name && <Badge variant="outline">{b.short_name}</Badge>}
                        {b.book_type_name && <Badge variant="secondary">{b.book_type_name}</Badge>}
                        {b.edition && <Badge variant="outline">{b.edition}</Badge>}
                        {filterSubjectId && b.subject_sort_order != null && b.subject_sort_order < 1e12 ? (
                          <Badge variant="outline">Sort #{b.subject_sort_order}</Badge>
                        ) : null}
                      </div>
                      {b.description?.trim() && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {b.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}
                        </p>
                      )}
                    </div>
                  </Link>
                  {isAdmin ? (
                    <>
                      <BookSubjectTags
                        bookId={b.id}
                        subjects={b.subjects ?? []}
                        catalog={subjectCatalog}
                        onChange={(subjects) =>
                          setBooks((prev) => prev.map((row) => (row.id === b.id ? { ...row, subjects } : row)))
                        }
                      />
                      <BookArchiveTag
                        bookId={b.id}
                        archived={b.archive_book ?? false}
                        onChange={(archive_book) =>
                          setBooks((prev) => prev.map((row) => (row.id === b.id ? { ...row, archive_book } : row)))
                        }
                      />
                    </>
                  ) : (b.subjects ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(b.subjects ?? []).map((s) => (
                        <Badge key={s.id} variant="outline">
                          {s.name_bn?.trim() || s.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
