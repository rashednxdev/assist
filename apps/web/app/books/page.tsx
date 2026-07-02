'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Search, Plus } from 'lucide-react';
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
}

export default function BooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  function load(search?: string) {
    setLoading(true);
    const params = search ? `?q=${encodeURIComponent(search)}` : '';
    apiFetch<{ data: BookItem[] }>(`/books${params}`)
      .then((r) => setBooks(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Books & regulations"
        description="Browse GFR and other government financial rules."
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button asChild size="sm">
                <Link href="/books/admin">
                  <Plus className="h-4 w-4" />
                  Add book
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

      <Card className={`${bookTheme.panel} border-amber-900/15 bg-[#fffef8]`}>
        <CardHeader className={`border-b pb-4 ${bookTheme.divider}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Library</CardTitle>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                load(q);
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
                  ? 'Add a book from Book admin, or run pnpm seed for sample GFR data.'
                  : 'No publications are available yet.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {books.map((b) => (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  className={`group block p-4 ${bookTheme.linkCard}`}
                >
                  <div className="flex items-start gap-3">
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
                      </div>
                      {b.description?.trim() && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {b.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
