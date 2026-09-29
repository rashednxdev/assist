'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PAY_GRADE_MAX, PAY_GRADE_MIN, type DesignationRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

interface Draft {
  id?: string;
  name: string;
  name_bn: string;
  short_name: string;
  grade: string;
  serial_no: number;
  is_active: boolean;
}

const GRADES = Array.from({ length: PAY_GRADE_MAX - PAY_GRADE_MIN + 1 }, (_, i) => PAY_GRADE_MIN + i);

export function DesignationsAdmin() {
  const [items, setItems] = useState<DesignationRecord[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<{ data: DesignationRecord[] }>('/org/designations?all=true')
      .then((r) => setItems(r.data))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load designations');
        setItems([]);
      });
  }, []);

  useEffect(load, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!items || !term) return items;
    return items.filter((d) => `${d.name} ${d.name_bn ?? ''} ${d.short_name} ${d.grade ?? ''}`.toLowerCase().includes(term));
  }, [items, q]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError('');
    const { id, grade, ...rest } = draft;
    try {
      await apiFetch(id ? `/org/admin/designations/${id}` : '/org/admin/designations', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({ ...rest, grade: grade ? Number(grade) : null }),
      });
      setDraft(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: DesignationRecord) {
    if (!window.confirm(`Delete designation “${d.name}”?`)) return;
    setError('');
    try {
      await apiFetch(`/org/admin/designations/${d.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designations…" />
        </div>
        <Button
          size="sm"
          onClick={() => setDraft({ name: '', name_bn: '', short_name: '', grade: '', serial_no: (items?.length ?? 0) + 1, is_active: true })}
        >
          <Plus className="h-4 w-4" /> New designation
        </Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      {draft && (
        <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dg-name">Name</Label>
              <Input id="dg-name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Assistant Accounts Officer" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dg-short">Short name</Label>
              <Input id="dg-short" value={draft.short_name} onChange={(e) => setDraft({ ...draft, short_name: e.target.value })} placeholder="e.g. AAO" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dg-grade">Grade</Label>
              <select id="dg-grade" className="ibas-select" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })}>
                <option value="">No grade</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dg-bn">Name (Bangla)</Label>
              <Input id="dg-bn" value={draft.name_bn} onChange={(e) => setDraft({ ...draft, name_bn: e.target.value })} placeholder="ঐচ্ছিক" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dg-serial">Serial no.</Label>
              <Input id="dg-serial" type="number" min={0} value={draft.serial_no} onChange={(e) => setDraft({ ...draft, serial_no: Number(e.target.value) || 0 })} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving || draft.name.trim().length < 2 || !draft.short_name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {draft.id ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {shown === null ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : shown.length === 0 ? (
        <EmptyState title={q ? 'No designation matches' : 'No designations yet'} description={q ? undefined : 'Add the designations users can choose from.'} />
      ) : (
        <div className="ibas-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Serial</th>
                <th className="px-3 py-2">Designation</th>
                <th className="px-3 py-2">Short</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Users</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className={cn('border-b border-border last:border-0', !d.is_active && 'opacity-60')}>
                  <td className="px-3 py-2 text-muted">{d.serial_no}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{d.name}</span>
                    {d.name_bn && <span className="block text-xs text-muted">{d.name_bn}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{d.short_name}</Badge>
                  </td>
                  <td className="px-3 py-2">{d.grade ? `Grade ${d.grade}` : <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2">{d.user_count}</td>
                  <td className="px-3 py-2">
                    <Badge variant={d.is_active ? 'success' : 'secondary'}>{d.is_active ? 'Active' : 'Off'}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          id: d.id,
                          name: d.name,
                          name_bn: d.name_bn ?? '',
                          short_name: d.short_name,
                          grade: d.grade ? String(d.grade) : '',
                          serial_no: d.serial_no,
                          is_active: d.is_active,
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={d.user_count > 0}
                      title={d.user_count > 0 ? 'In use — turn it off instead' : 'Delete'}
                      onClick={() => remove(d)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
