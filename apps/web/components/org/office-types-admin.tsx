'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { OfficeTypeRecord } from '@ibas/shared-types';
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
  serial_no: number;
  is_active: boolean;
}

export function OfficeTypesAdmin() {
  const [items, setItems] = useState<OfficeTypeRecord[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<{ data: OfficeTypeRecord[] }>('/org/office-types?all=true')
      .then((r) => setItems(r.data))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load office types');
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
      await apiFetch(id ? `/org/admin/office-types/${id}` : '/org/admin/office-types', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setDraft(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: OfficeTypeRecord) {
    if (!window.confirm(`Delete office type “${t.name}”?`)) return;
    setError('');
    try {
      await apiFetch(`/org/admin/office-types/${t.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Group offices by kind — e.g. Ministry, Directorate, District Accounts Office, Upazila Accounts Office.</p>
        <Button size="sm" onClick={() => setDraft({ name: '', name_bn: '', short_name: '', serial_no: (items?.length ?? 0) + 1, is_active: true })}>
          <Plus className="h-4 w-4" /> New office type
        </Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      {draft && (
        <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ot-name">Name</Label>
              <Input id="ot-name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. District Accounts Office" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ot-short">Short name</Label>
              <Input id="ot-short" value={draft.short_name} onChange={(e) => setDraft({ ...draft, short_name: e.target.value })} placeholder="e.g. DAO" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ot-serial">Serial no.</Label>
              <Input id="ot-serial" type="number" min={0} value={draft.serial_no} onChange={(e) => setDraft({ ...draft, serial_no: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ot-bn">Name (Bangla)</Label>
              <Input id="ot-bn" value={draft.name_bn} onChange={(e) => setDraft({ ...draft, name_bn: e.target.value })} placeholder="ঐচ্ছিক" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
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

      {items === null ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState title="No office types yet" description="Add at least one office type before adding offices." />
      ) : (
        <div className="ibas-table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Short</th>
                <th className="px-3 py-2">Offices</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className={cn('border-b border-border last:border-0', !t.is_active && 'opacity-60')}>
                  <td className="px-3 py-2 text-muted">{t.serial_no}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{t.name}</span>
                    {t.name_bn && <span className="ml-2 text-muted">{t.name_bn}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{t.short_name}</Badge>
                  </td>
                  <td className="px-3 py-2">{t.office_count}</td>
                  <td className="px-3 py-2">
                    <Badge variant={t.is_active ? 'success' : 'secondary'}>{t.is_active ? 'Active' : 'Off'}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraft({ id: t.id, name: t.name, name_bn: t.name_bn ?? '', short_name: t.short_name, serial_no: t.serial_no, is_active: t.is_active })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={t.office_count > 0}
                      title={t.office_count > 0 ? 'In use — turn it off instead' : 'Delete'}
                      onClick={() => remove(t)}
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
