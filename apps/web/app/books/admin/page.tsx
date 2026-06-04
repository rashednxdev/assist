'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, BookOpen, Layers } from 'lucide-react';
import { RowActions } from '@/components/shared/row-actions';
import { confirmDelete } from '@/lib/confirm-action';
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
  description?: string;
  sort_order?: number;
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

function slugTypeCode(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase()
      .slice(0, 40) || 'BOOK_TYPE'
  );
}

export default function BooksAdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [types, setTypes] = useState<BookType[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [typeBusy, setTypeBusy] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [typeMessage, setTypeMessage] = useState('');
  const [error, setError] = useState('');
  const [typeError, setTypeError] = useState('');

  const [typeForm, setTypeForm] = useState({
    name: '',
    name_bn: '',
    code: '',
    description: '',
    sort_order: '',
  });

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

  const loadTypes = useCallback(() => {
    return apiFetch<{ data: BookType[] }>('/books/types').then((r) => {
      setTypes(r.data);
      return r.data;
    });
  }, []);

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
          loadTypes().then((list) => {
            if (list[0] && !form.book_type_id) {
              setForm((f) => ({ ...f, book_type_id: list[0]!.id }));
            }
          }),
          loadBooks(),
        ]);
      })
      .catch(() => router.replace('/login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [router, loadBooks, loadTypes]);

  async function createBookType(e: React.FormEvent) {
    e.preventDefault();
    setTypeError('');
    setTypeMessage('');

    if (!typeForm.name.trim() || !typeForm.name_bn.trim()) {
      setTypeError('English and Bengali names are required');
      return;
    }

    const code = (typeForm.code || slugTypeCode(typeForm.name)).toUpperCase();
    if (!/^[A-Z0-9_]+$/.test(code)) {
      setTypeError('Code must use only A–Z, 0–9, and underscores');
      return;
    }

    const payload = {
      name: typeForm.name.trim(),
      name_bn: typeForm.name_bn.trim(),
      code,
      description: typeForm.description.trim() || undefined,
      sort_order: typeForm.sort_order ? Number(typeForm.sort_order) : undefined,
    };

    setTypeBusy(true);
    try {
      const res = editingTypeId
        ? await apiFetch<{ data: BookType }>(`/books/types/${editingTypeId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ data: BookType }>('/books/types', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setTypeMessage(editingTypeId ? `Book type "${res.data.name}" updated` : `Book type "${res.data.name}" created`);
      await loadTypes();
      setForm((f) => ({ ...f, book_type_id: res.data.id }));
      setTypeForm({ name: '', name_bn: '', code: '', description: '', sort_order: '' });
      setEditingTypeId(null);
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : 'Failed to save book type');
    } finally {
      setTypeBusy(false);
    }
  }

  function startEditType(t: BookType) {
    setEditingTypeId(t.id);
    setTypeForm({
      name: t.name,
      name_bn: t.name_bn,
      code: t.code,
      description: t.description ?? '',
      sort_order: t.sort_order != null ? String(t.sort_order) : '',
    });
    setTypeError('');
    setTypeMessage('');
  }

  async function removeType(t: BookType) {
    if (!confirmDelete(t.name)) return;
    setTypeBusy(true);
    setTypeError('');
    try {
      await apiFetch(`/books/types/${t.id}`, { method: 'DELETE' });
      setTypeMessage('Book type removed');
      if (editingTypeId === t.id) {
        setEditingTypeId(null);
        setTypeForm({ name: '', name_bn: '', code: '', description: '', sort_order: '' });
      }
      await loadTypes();
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : 'Failed to remove book type');
    } finally {
      setTypeBusy(false);
    }
  }

  async function removeBook(b: BookItem) {
    if (!confirmDelete(b.name)) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/books/${b.id}`, { method: 'DELETE' });
      setMessage('Book removed');
      await loadBooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove book');
    } finally {
      setBusy(false);
    }
  }

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
        description="Define book types, then add publications to the library."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/books">Back to library</Link>
          </Button>
        }
      />

      {typeMessage && <Alert variant="success">{typeMessage}</Alert>}
      {typeError && <Alert variant="error">{typeError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5 text-primary" />
              Book type
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={createBookType} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Name (English) *</Label>
                  <Input
                    required
                    disabled={typeBusy}
                    value={typeForm.name}
                    placeholder="Government Financial Rules"
                    onChange={(e) =>
                      setTypeForm({
                        ...typeForm,
                        name: e.target.value,
                        code: typeForm.code || slugTypeCode(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Name (Bengali) *</Label>
                  <Input
                    required
                    disabled={typeBusy}
                    value={typeForm.name_bn}
                    placeholder="সরকারি আর্থিক বিধি"
                    onChange={(e) => setTypeForm({ ...typeForm, name_bn: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Code *</Label>
                  <Input
                    required
                    disabled={typeBusy}
                    value={typeForm.code}
                    placeholder="GOVT_RULES"
                    onChange={(e) =>
                      setTypeForm({
                        ...typeForm,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
                      })
                    }
                  />
                  <p className="text-xs text-muted">Uppercase letters, numbers, underscores only</p>
                </div>
                <div className="space-y-1">
                  <Label>Sort order</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={typeBusy}
                    value={typeForm.sort_order}
                    placeholder="Auto"
                    onChange={(e) => setTypeForm({ ...typeForm, sort_order: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  disabled={typeBusy}
                  value={typeForm.description}
                  placeholder="Official government financial and accounting rules"
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={typeBusy}>
                  {editingTypeId ? 'Save book type' : 'Add book type'}
                </Button>
                {editingTypeId && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={typeBusy}
                    onClick={() => {
                      setEditingTypeId(null);
                      setTypeForm({ name: '', name_bn: '', code: '', description: '', sort_order: '' });
                    }}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Book types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {types.length === 0 ? (
              <p className="text-sm text-muted">No types yet. Add one to classify books.</p>
            ) : (
              types.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted">{t.name_bn}</div>
                    <Badge variant="outline" className="mt-1">
                      {t.code}
                    </Badge>
                  </div>
                  <RowActions onEdit={() => startEditType(t)} onDelete={() => removeType(t)} busy={typeBusy} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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
                  {types.length === 0 && (
                    <p className="text-xs text-amber-700">Create a book type above first.</p>
                  )}
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
                <div
                  key={b.id}
                  className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Link href={`/books/${b.id}`} className="flex min-w-0 flex-1 items-start gap-2 hover:opacity-80">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.name}</div>
                      <Badge variant="outline" className="mt-1">
                        {b.short_name}
                      </Badge>
                    </div>
                  </Link>
                  <RowActions onDelete={() => removeBook(b)} busy={busy} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
