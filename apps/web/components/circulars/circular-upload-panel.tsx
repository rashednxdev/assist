'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Pencil, Search } from 'lucide-react';
import type { CircularRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDdMmYyyy } from '@/lib/date-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { CircularForm, EMPTY_CIRCULAR_FORM, circularToForm, type CircularFormState } from './circular-form';

/** Circular / order upload used inside Book admin: form on the left, recent uploads on the right. */
export function CircularUploadPanel() {
  const [editing, setEditing] = useState<{ id: string | null; form: CircularFormState }>({ id: null, form: { ...EMPTY_CIRCULAR_FORM } });
  const [recent, setRecent] = useState<CircularRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState<CircularRecord | null>(null);
  const [error, setError] = useState('');

  const loadRecent = useCallback(async (term: string) => {
    try {
      const r = await apiFetch<{ data: CircularRecord[]; meta: { total: number } }>(
        `/circulars?include_unpublished=true&limit=15${term.trim() ? `&q=${encodeURIComponent(term.trim())}` : ''}`,
      );
      setRecent(r.data);
      setTotal(r.meta.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load circulars');
    }
  }, []);

  useEffect(() => {
    void loadRecent('');
  }, [loadRecent]);

  async function startEdit(id: string) {
    setError('');
    setSaved(null);
    try {
      const r = await apiFetch<{ data: CircularRecord }>(`/circulars/${id}`);
      setEditing({ id, form: circularToForm(r.data) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load circular');
    }
  }

  const resetForm = () => setEditing({ id: null, form: { ...EMPTY_CIRCULAR_FORM } });

  return (
    <div className="space-y-4">
      {saved && (
        <Alert variant="success">
          Saved <span className="font-mono">{saved.circular_no}</span>
          {saved.is_published ? '' : ' as draft'}.{' '}
          <Link href={`/circulars/${saved.id}`} className="font-medium underline" target="_blank">
            View
          </Link>
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <CircularForm
          editingId={editing.id}
          initial={editing.form}
          title={editing.id ? 'Edit circular / order' : 'Add circular / order'}
          onCancel={resetForm}
          onDone={(rec) => {
            setSaved(rec);
            resetForm();
            void loadRecent(q);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <Card className="h-fit">
          <CardHeader className="space-y-2 pb-2">
            <CardTitle className="text-sm">
              Circulars &amp; orders <span className="font-normal text-muted">({total})</span>
            </CardTitle>
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                void loadRecent(q);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search & press Enter" className="pl-9" />
            </form>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No circulars yet.</p>
            ) : (
              recent.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${editing.id === c.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs text-muted">{c.circular_no}</div>
                      <div className="line-clamp-2 font-medium">{c.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span>{formatDdMmYyyy(c.issue_date)}</span>
                        {!c.is_published && <Badge variant="warning">Draft</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                      <Link href={`/circulars/${c.id}`} target="_blank" aria-label="Open">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void startEdit(c.id)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/admin/circulars">Manage all &amp; tags</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
