'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, EyeOff, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  COMMUNITY_REPORT_REASON_LABELS,
  type CommunityCategoryRecord,
  type CommunityReportRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { timeAgo } from '@/lib/community';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

export function CommunityReportsAdmin() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [items, setItems] = useState<CommunityReportRecord[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setItems(null);
    apiFetch<{ data: { items: CommunityReportRecord[]; open_count: number } }>(`/community/admin/reports?status=${status}`)
      .then((r) => setItems(r.data.items))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load reports');
        setItems([]);
      });
  }, [status]);

  useEffect(load, [load]);

  async function resolve(id: string, action: 'dismiss' | 'hide') {
    setBusy(`${id}:${action}`);
    setError('');
    try {
      await apiFetch(`/community/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-surface p-1">
        {(['open', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium capitalize', status === s ? 'bg-primary-muted text-primary-dark' : 'text-muted hover:text-foreground')}
          >
            {s}
          </button>
        ))}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {items === null ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState title={status === 'open' ? 'No open reports' : 'No resolved reports yet'} description={status === 'open' ? 'The community is behaving. Nice.' : undefined} />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="destructive">{COMMUNITY_REPORT_REASON_LABELS[r.reason]}</Badge>
                <Badge variant="outline">{r.target_type === 'thread' ? 'Discussion' : 'Answer'}</Badge>
                {r.report_count > 1 && <Badge variant="warning">{r.report_count} reports</Badge>}
                {r.target_hidden && <Badge variant="secondary">Already hidden</Badge>}
                {r.status === 'resolved' && <Badge variant={r.resolution === 'hidden' ? 'secondary' : 'success'}>{r.resolution === 'hidden' ? 'Hidden' : 'Dismissed'}</Badge>}
                <span className="text-muted">
                  by {r.reporter.name} · {timeAgo(r.created_at)}
                </span>
              </div>
              <Link
                href={`/community/${r.thread_id}${r.target_type === 'answer' ? `#answer-${r.target_id}` : ''}`}
                className="mt-2 inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
              >
                {r.thread_title} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              {r.excerpt && <p className="mt-1 line-clamp-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">{r.excerpt}</p>}
              {r.note && <p className="mt-2 text-sm italic text-muted">“{r.note}”</p>}
              {r.status === 'open' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => resolve(r.id, 'hide')}>
                    {busy === `${r.id}:hide` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                    Hide {r.target_type === 'thread' ? 'discussion' : 'answer'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!!busy} onClick={() => resolve(r.id, 'dismiss')}>
                    {busy === `${r.id}:dismiss` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CategoryDraft {
  id?: string;
  name: string;
  name_bn: string;
  description: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_DRAFT: CategoryDraft = { name: '', name_bn: '', description: '', color: '#0f766e', sort_order: 0, is_active: true };

export function CommunityCategoriesAdmin() {
  const [items, setItems] = useState<CommunityCategoryRecord[] | null>(null);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<{ data: CommunityCategoryRecord[] }>('/community/categories?all=true')
      .then((r) => setItems(r.data))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load categories');
        setItems([]);
      });
  }, []);

  useEffect(load, [load]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError('');
    const { id, ...body } = draft;
    try {
      await apiFetch(id ? `/community/admin/categories/${id}` : '/community/admin/categories', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setDraft(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CommunityCategoryRecord) {
    if (!window.confirm(`Delete category “${c.name}”?`)) return;
    setError('');
    try {
      await apiFetch(`/community/admin/categories/${c.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  async function toggleActive(c: CommunityCategoryRecord) {
    setError('');
    try {
      await apiFetch(`/community/admin/categories/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: c.name, name_bn: c.name_bn ?? '', description: c.description ?? '', color: c.color, sort_order: c.sort_order, is_active: !c.is_active }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Categories group discussions. Turn one off to stop new posts in it without losing old ones.</p>
        <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT, sort_order: (items?.length ?? 0) + 1 })}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      {draft && (
        <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Procurement" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-bn">Name (Bangla)</Label>
              <Input id="cat-bn" value={draft.name_bn} onChange={(e) => setDraft({ ...draft, name_bn: e.target.value })} placeholder="ঐচ্ছিক" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Input id="cat-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Shown when someone picks this category" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-color">Colour</Label>
              <div className="flex items-center gap-2">
                <input id="cat-color" type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface p-1" />
                <Input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-order">Order</Label>
              <Input id="cat-order" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
            Active (users can post in it)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving || draft.name.trim().length < 2}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {draft.id ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {items === null ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {items.map((c) => (
            <div key={c.id} className={cn('flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0', !c.is_active && 'opacity-60')}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.name}
                  {c.name_bn && <span className="ml-2 text-sm font-normal text-muted">{c.name_bn}</span>}
                </p>
                {c.description && <p className="truncate text-xs text-muted">{c.description}</p>}
              </div>
              <span className="text-xs text-muted">{c.thread_count} discussions</span>
              <button type="button" onClick={() => toggleActive(c)}>
                <Badge variant={c.is_active ? 'success' : 'secondary'}>{c.is_active ? 'Active' : 'Off'}</Badge>
              </button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft({ id: c.id, name: c.name, name_bn: c.name_bn ?? '', description: c.description ?? '', color: c.color, sort_order: c.sort_order, is_active: c.is_active })
                }
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(c)} disabled={c.thread_count > 0} title={c.thread_count > 0 ? 'In use — turn it off instead' : 'Delete'}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
