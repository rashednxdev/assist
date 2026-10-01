'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ListChecks, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { DEDUCTION_SETUP_KINDS, DEDUCTION_SETUP_LABELS, type DeductionSetupItem, type DeductionSetupKind } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const HINTS: Record<DeductionSetupKind, { code: string; name: string }> = {
  economic_code: { code: 'e.g. 3211101', name: 'e.g. Allowance for staff' },
  bill_type: { code: 'Optional short code', name: 'e.g. Supply bill, Works bill, Service bill' },
  deduction_type: { code: 'e.g. VAT, IT', name: 'e.g. Value Added Tax, Income Tax (AIT)' },
};

const emptyForm = { code: '', name_en: '', name_bn: '', description: '', sort_order: 0 };

export default function DeductionSetupPage() {
  const [kind, setKind] = useState<DeductionSetupKind>('economic_code');
  const [rows, setRows] = useState<DeductionSetupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: DeductionSetupItem[] }>('/deductions/setup?all=true');
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

  const label = DEDUCTION_SETUP_LABELS[kind];
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => r.kind === kind && (!term || [r.code, r.name_en, r.name_bn].some((t) => t?.toLowerCase().includes(term))));
  }, [rows, kind, q]);

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function switchKind(k: DeductionSetupKind) {
    setKind(k);
    reset();
    setMessage('');
    setError('');
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    const payload = { ...form, kind, sort_order: Number(form.sort_order) || 0 };
    try {
      if (editingId) {
        const existing = rows.find((r) => r.id === editingId);
        await apiFetch(`/deductions/setup/${editingId}`, { method: 'PATCH', body: JSON.stringify({ ...payload, is_active: existing?.is_active ?? true }) });
        setMessage(`${label.label} updated.`);
      } else {
        await apiFetch('/deductions/setup', { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`${label.label} added.`);
      }
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: DeductionSetupItem, active: boolean) {
    setError('');
    try {
      if (active) {
        await apiFetch(`/deductions/setup/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ code: row.code, name_en: row.name_en, name_bn: row.name_bn, description: row.description, sort_order: row.sort_order, is_active: true }),
        });
      } else {
        if (!confirm(`Deactivate "${row.name_en}"? Existing entries keep showing it, but it can no longer be chosen.`)) return;
        await apiFetch(`/deductions/setup/${row.id}`, { method: 'DELETE' });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function startEdit(row: DeductionSetupItem) {
    setEditingId(row.id);
    setForm({ code: row.code ?? '', name_en: row.name_en, name_bn: row.name_bn ?? '', description: row.description ?? '', sort_order: row.sort_order });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const canSave = !!form.name_en.trim() && (kind !== 'economic_code' || !!form.code.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="VAT, IT, Tax & Deductions — setup"
        description="Lists used when entering deductions: economic codes, types of bill and deduction types."
        backHref="/admin/deductions"
        backLabel="Deduction entries"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/deductions">
              <ListChecks className="h-4 w-4" /> Deduction entries
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {DEDUCTION_SETUP_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => switchKind(k)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium',
              kind === k ? 'bg-primary text-white' : 'border border-border text-muted hover:bg-slate-50',
            )}
          >
            {DEDUCTION_SETUP_LABELS[k].plural} ({rows.filter((r) => r.kind === k && r.is_active).length})
          </button>
        ))}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? `Edit ${label.label.toLowerCase()}` : `Add ${label.label.toLowerCase()}`}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ds-code">{kind === 'economic_code' ? 'Economic code *' : 'Code'}</Label>
            <Input id="ds-code" value={form.code} placeholder={HINTS[kind].code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-sort">Sort order</Label>
            <Input id="ds-sort" type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-name">Name (English) *</Label>
            <Input id="ds-name" value={form.name_en} placeholder={HINTS[kind].name} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-name-bn">Name (Bangla)</Label>
            <Input id="ds-name-bn" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ds-desc">Description</Label>
            <Input id="ds-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={saving || !canSave} onClick={() => void save()}>
              {saving ? 'Saving…' : editingId ? 'Update' : `Add ${label.label.toLowerCase()}`}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {label.plural} ({visible.length})
          </CardTitle>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">Nothing added yet.</p>
          ) : (
            visible.map((row) => (
              <div
                key={row.id}
                className={cn('flex flex-wrap items-center gap-3 rounded-md border p-3', row.is_active ? 'border-border' : 'border-dashed opacity-60')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.code ? <Badge variant="outline">{row.code}</Badge> : null}
                    <span className="font-medium">{row.name_en}</span>
                    {!row.is_active ? <Badge variant="warning">Inactive</Badge> : null}
                  </div>
                  {row.name_bn ? <p className="text-sm text-muted">{row.name_bn}</p> : null}
                  {row.description ? <p className="text-xs text-muted">{row.description}</p> : null}
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
