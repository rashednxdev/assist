'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { TOOLKIT_KINDS, type ToolkitKind } from '@ibas/shared-constants';
import type { ToolkitCategory } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { invalidateToolkitCategories } from '@/lib/use-toolkit-categories';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface FormState {
  code: string;
  label: string;
  kinds: ToolkitKind[];
  sort_order: number;
}

const emptyForm: FormState = { code: '', label: '', kinds: ['checklist'], sort_order: 0 };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

export default function ToolkitCategoriesPage() {
  const [rows, setRows] = useState<ToolkitCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [codeTouched, setCodeTouched] = useState(false);
  const [editing, setEditing] = useState<ToolkitCategory | null>(null);
  const [kindFilter, setKindFilter] = useState<ToolkitKind | ''>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: ToolkitCategory[] }>('/toolkit/categories?all=true');
      setRows(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setForm(emptyForm);
    setEditing(null);
    setCodeTouched(false);
  }

  function toggleKind(k: ToolkitKind) {
    setForm((f) => ({ ...f, kinds: f.kinds.includes(k) ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...form, sort_order: Number(form.sort_order) || 0 };
      if (editing) {
        await apiFetch(`/toolkit/categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ ...payload, is_active: editing.is_active }) });
        setMessage('Category updated.');
      } else {
        await apiFetch('/toolkit/categories', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Category added.');
      }
      invalidateToolkitCategories();
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: ToolkitCategory, active: boolean) {
    setError('');
    setMessage('');
    try {
      if (active) {
        await apiFetch(`/toolkit/categories/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ label: row.label, kinds: row.kinds, sort_order: row.sort_order, is_active: true }),
        });
      } else {
        const note = row.item_count ? ` ${row.item_count} item(s) keep it, but it can no longer be chosen.` : '';
        if (!confirm(`Deactivate “${row.label}”?${note}`)) return;
        await apiFetch(`/toolkit/categories/${row.id}`, { method: 'DELETE' });
      }
      invalidateToolkitCategories();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function startEdit(row: ToolkitCategory) {
    setEditing(row);
    setCodeTouched(true);
    setForm({ code: row.code, label: row.label, kinds: row.kinds, sort_order: row.sort_order });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const visible = rows.filter((r) => !kindFilter || r.kinds.includes(kindFilter));
  const canSave = !!form.label.trim() && form.code.length >= 2 && form.kinds.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Toolkit categories"
        description="Categories group checklists, templates and guides. Each category is offered only for the types ticked here."
        backHref="/admin/toolkit"
        backLabel="Toolkit admin"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/toolkit">
              <ClipboardCheck className="h-4 w-4" /> Toolkit items
            </Link>
          </Button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? `Edit “${editing.label}”` : 'Add category'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tc-label">Label *</Label>
            <Input
              id="tc-label"
              value={form.label}
              placeholder="e.g. Advance adjustment"
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, code: editing || codeTouched ? f.code : slug(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tc-code">Code *</Label>
            <Input
              id="tc-code"
              value={form.code}
              disabled={!!editing}
              placeholder="advance_adjustment"
              onChange={(e) => {
                setCodeTouched(true);
                setForm((f) => ({ ...f, code: slug(e.target.value) }));
              }}
            />
            <p className="text-xs text-muted">{editing ? 'The code cannot change once items use it.' : 'Lowercase letters, digits and underscores.'}</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Used for *</legend>
            <div className="flex flex-wrap gap-4">
              {TOOLKIT_KINDS.map((k) => (
                <label key={k.code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.kinds.includes(k.code)} onChange={() => toggleKind(k.code)} />
                  {k.label_plural}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="tc-sort">Sort order</Label>
            <Input id="tc-sort" type="number" min={0} value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={saving || !canSave} onClick={() => void save()}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Add category'}
            </Button>
            {editing ? (
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Categories ({visible.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            {[{ code: '' as const, label_plural: 'All' }, ...TOOLKIT_KINDS].map((k) => (
              <button
                key={k.code || 'all'}
                type="button"
                onClick={() => setKindFilter(k.code)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium',
                  kindFilter === k.code ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-slate-50',
                )}
              >
                {k.label_plural}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">No categories yet.</p>
          ) : (
            visible.map((row) => (
              <div key={row.id} className={cn('flex flex-wrap items-center gap-3 rounded-md border p-3', row.is_active ? 'border-border' : 'border-dashed opacity-60')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    <Badge variant="outline">{row.code}</Badge>
                    {!row.is_active ? <Badge variant="warning">Inactive</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {row.kinds.map((k) => TOOLKIT_KINDS.find((x) => x.code === k)?.label_plural ?? k).join(', ')} · {row.item_count ?? 0} item(s) · sort {row.sort_order}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  {row.is_active ? (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void setActive(row, false)} aria-label="Deactivate">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => void setActive(row, true)} aria-label="Restore">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
