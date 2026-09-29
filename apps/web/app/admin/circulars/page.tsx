'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardCheck, ExternalLink, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import type { CircularRecord, CircularTagCount } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { confirmDelete } from '@/lib/confirm-action';
import { formatDdMmYyyy } from '@/lib/date-display';
import { docTypeLabel } from '@/lib/policy-labels';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  CircularForm,
  EMPTY_CIRCULAR_FORM,
  circularToForm,
  type CircularFormState,
} from '@/components/circulars/circular-form';
import { circularIssuedBy } from '@/components/circulars/circular-browser';

function TagManager({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const [tags, setTags] = useState<CircularTagCount[] | null>(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const r = await apiFetch<{ data: CircularTagCount[] }>('/circulars/tags?limit=500');
      setTags(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tags');
    }
  }

  useEffect(() => {
    void load();
  }, [refreshKey]);

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (tags ?? []).filter((t) => !term || t.tag.toLowerCase().includes(term));
  }, [tags, filter]);

  async function rename() {
    if (!editing || !editing.to.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/circulars/tags/rename', { method: 'POST', body: JSON.stringify(editing) });
      setEditing(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename tag');
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: CircularTagCount) {
    if (!confirmDelete(`tag “${t.tag}” from ${t.count} circular(s)`)) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/circulars/tags?tag=${encodeURIComponent(t.tag)}`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete tag');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4" /> Tags <span className="font-normal text-muted">({tags?.length ?? 0})</span>
        </CardTitle>
        <p className="text-xs text-muted">
          One tag can be used on many circulars. Rename to fix spelling; renaming to an existing tag merges the two.
        </p>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tags…" />
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <Alert variant="error">{error}</Alert>}
        {tags === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted">{tags.length === 0 ? 'No tags yet. Add tags while saving a circular.' : 'No match.'}</p>
        ) : (
          <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
            {shown.map((t) =>
              editing?.from === t.tag ? (
                <form
                  key={t.tag}
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename();
                  }}
                >
                  <Input autoFocus value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} className="h-8" />
                  <Button type="submit" size="sm" variant="ghost" disabled={busy} aria-label="Save">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel">
                    <X className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <div key={t.tag} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                  <Link href={`/circulars?tag=${encodeURIComponent(t.tag)}`} target="_blank" className="min-w-0 flex-1 truncate hover:underline">
                    #{t.tag}
                  </Link>
                  <span className="text-xs text-muted">{t.count}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing({ from: t.tag, to: t.tag })} aria-label="Rename">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" disabled={busy} onClick={() => void remove(t)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CircularsAdminPage() {
  const [items, setItems] = useState<CircularRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; form: CircularFormState } | null>(null);
  const [tagsKey, setTagsKey] = useState(0);

  async function load(term = q) {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: CircularRecord[]; meta: { total: number } }>(
        `/circulars?include_unpublished=true&limit=100${term.trim() ? `&q=${encodeURIComponent(term.trim())}` : ''}`,
      );
      setItems(r.data);
      setTotal(r.meta.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEdit(id: string) {
    setError('');
    try {
      const r = await apiFetch<{ data: CircularRecord }>(`/circulars/${id}`);
      setEditing({ id, form: circularToForm(r.data) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load circular');
    }
  }

  async function remove(c: CircularRecord) {
    if (!confirmDelete(c.circular_no)) return;
    try {
      await apiFetch(`/circulars/${c.id}`, { method: 'DELETE' });
      if (editing?.id === c.id) setEditing(null);
      await load();
      setTagsKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const drafts = useMemo(() => items.filter((c) => !c.is_published).length, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Circular Archive admin"
        description="Add government circulars, orders, SROs and gazettes. Enter order details exactly as issued; tag them so users can find every circular on a topic."
        action={
          !editing && (
            <Button onClick={() => setEditing({ id: null, form: EMPTY_CIRCULAR_FORM })}>
              <Plus className="h-4 w-4" /> New circular
            </Button>
          )
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {editing && (
        <CircularForm
          editingId={editing.id}
          initial={editing.form}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            setTagsKey((k) => k + 1);
            void load();
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">
              Circulars <span className="font-normal text-muted">({total}{drafts ? `, ${drafts} draft` : ''})</span>
            </CardTitle>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void load();
              }}
            >
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by number, title, ministry, tag…" />
              <Button type="submit" variant="outline">Search</Button>
            </form>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted">No circulars yet. Use “New circular” to add the first one.</p>
            ) : (
              <div className="space-y-2">
                {items.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="font-mono font-medium text-foreground">{c.circular_no}</span>
                        <span>{formatDdMmYyyy(c.issue_date)}</span>
                        <Badge variant="outline">{docTypeLabel(c.doc_type)}</Badge>
                        {c.is_published ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Draft</Badge>}
                        {c.superseded_by.length > 0 && <Badge variant="destructive">Superseded</Badge>}
                        {c.checklist_count > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <ClipboardCheck className="h-3 w-3" /> {c.checklist_count}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-medium">{c.title}</p>
                      <p className="text-xs text-muted">{circularIssuedBy(c)}</p>
                      {c.tags.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1 text-xs text-primary">
                          {c.tags.map((t) => (
                            <span key={t}>#{t}</span>
                          ))}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/circulars/${c.id}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void startEdit(c.id)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(c)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <TagManager refreshKey={tagsKey} onChanged={() => void load()} />
      </div>
    </div>
  );
}
