'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, BookOpen } from 'lucide-react';
import { BOOK_LANGUAGES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface BookType {
  id: string;
  name: string;
  name_bn: string;
  code: string;
}

interface BookItem {
  id: string;
  name: string;
  name_bn: string;
  short_name: string;
  book_type_name?: string;
}

function slugShortName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 12) || 'BOOK';
}

export default function BooksAdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [types, setTypes] = useState<BookType[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    book_type_id: '',
    name: '',
    name_bn: '',
    short_name: '',
    description: '',
    edition: '',
    published_by: '',
    language: 'both' as (typeof BOOK_LANGUAGES)[number],
    is_part: false,
    tags: '',
  });

  const loadBooks = useCallback(() => {
    return apiFetch<{ data: BookItem[] }>('/books').then((r) => setBooks(r.data));
  }, []);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setAllowed(admin);
        if (!admin) {
          router.replace('/books');
          return;
        }
        return Promise.all([
          apiFetch<{ data: BookType[] }>('/books/types').then((r) => {
            setTypes(r.data);
            if (r.data[0]) setForm((f) => ({ ...f, book_type_id: r.data[0]!.id }));
          }),
          loadBooks(),
        ]);
      })
      .catch(() => router.replace('/login'));
  }, [router, loadBooks]);

  async function createBook(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!form.name.trim() || !form.name_bn.trim()) {
      setError('English and Bengali titles are required');
      return;
    }
    if (!form.book_type_id) {
      setError('Select a book type');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required');
      return;
    }

    const shortName = (form.short_name || slugShortName(form.name)).toUpperCase();
    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setBusy(true);
    try {
      const res = await apiFetch<{ data: { id: string } }>('/books', {
        method: 'POST',
        body: JSON.stringify({
          book_type_id: form.book_type_id,
          name: form.name.trim(),
          name_bn: form.name_bn.trim(),
          short_name: shortName,
          description: form.description.trim().startsWith('<')
            ? form.description.trim()
            : `<p>${form.description.trim()}</p>`,
          edition: form.edition.trim() || undefined,
          published_by: form.published_by.trim() || undefined,
          language: form.language,
          is_part: form.is_part,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      setMessage('Book created — add chapters and rules in the book editor');
      await loadBooks();
      setForm((f) => ({
        ...f,
        name: '',
        name_bn: '',
        short_name: '',
        description: '',
        edition: '',
        published_by: '',
        tags: '',
      }));
      router.push(`/books/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create book');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book admin"
        description="Add publications to the library. Then open a book to add chapters and rules."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/books">Back to library</Link>
          </Button>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {types.length === 0 && (
        <Alert variant="warning">
          No book types found. Run <code className="text-xs">pnpm seed</code> first.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Add book
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={createBook} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Book type *</Label>
                  <select
                    className="ibas-select"
                    required
                    disabled={busy}
                    value={form.book_type_id}
                    onChange={(e) => setForm({ ...form, book_type_id: e.target.value })}
                  >
                    <option value="">Select type...</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Language</Label>
                  <select
                    className="ibas-select"
                    disabled={busy}
                    value={form.language}
                    onChange={(e) =>
                      setForm({ ...form, language: e.target.value as (typeof BOOK_LANGUAGES)[number] })
                    }
                  >
                    {BOOK_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Title (English) *</Label>
                  <Input
                    required
                    disabled={busy}
                    value={form.name}
                    placeholder="General Financial Rules 2005"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                        short_name: form.short_name || slugShortName(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Title (Bengali) *</Label>
                  <Input
                    required
                    disabled={busy}
                    value={form.name_bn}
                    placeholder="সাধারণ আর্থিক বিধিমালা ২০০৫"
                    onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Short code *</Label>
                  <Input
                    required
                    disabled={busy}
                    value={form.short_name}
                    placeholder="GFR"
                    onChange={(e) =>
                      setForm({ ...form, short_name: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Edition</Label>
                  <Input
                    disabled={busy}
                    value={form.edition}
                    placeholder="2005"
                    onChange={(e) => setForm({ ...form, edition: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Published by</Label>
                <Input
                  disabled={busy}
                  value={form.published_by}
                  placeholder="Ministry of Finance"
                  onChange={(e) => setForm({ ...form, published_by: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label>Description *</Label>
                <textarea
                  className="ibas-textarea min-h-[100px]"
                  required
                  disabled={busy}
                  value={form.description}
                  placeholder="Overview of this publication..."
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                <p className="text-xs text-muted">Plain text is wrapped as HTML. You can paste HTML directly.</p>
              </div>

              <div className="space-y-1">
                <Label>Tags (comma-separated)</Label>
                <Input
                  disabled={busy}
                  value={form.tags}
                  placeholder="gfr, finance, budget"
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={form.is_part}
                  onChange={(e) => setForm({ ...form, is_part: e.target.checked })}
                />
                Book has major parts (volumes)
              </label>

              <Button type="submit" disabled={busy || types.length === 0}>
                Create book
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Existing books</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {books.length === 0 ? (
              <p className="text-sm text-muted">No books yet.</p>
            ) : (
              books.map((b) => (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.name}</div>
                    <Badge variant="outline" className="mt-1">
                      {b.short_name}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
