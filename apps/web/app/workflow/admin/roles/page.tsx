'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Pencil, RotateCcw, Trash2, Workflow } from 'lucide-react';
import type { WorkflowRoleAdminItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const emptyForm = {
  code: '',
  name_en: '',
  name_bn: '',
  description_en: '',
  color: '#1d4ed8',
  level: 1,
  can_submit: true,
  can_forward: false,
  can_approve: false,
};

const PERMISSIONS = [
  { key: 'can_submit', label: 'Can submit' },
  { key: 'can_forward', label: 'Can forward' },
  { key: 'can_approve', label: 'Can approve' },
] as const;

export default function WorkflowRolesPage() {
  const [rows, setRows] = useState<WorkflowRoleAdminItem[]>([]);
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
      const r = await apiFetch<{ data: WorkflowRoleAdminItem[] }>('/workflow/roles/all');
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

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => [r.code, r.name_en, r.name_bn].some((t) => t?.toLowerCase().includes(term)));
  }, [rows, q]);

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function payloadFor(row: WorkflowRoleAdminItem, is_active: boolean) {
    return {
      code: row.code,
      name_en: row.name_en,
      name_bn: row.name_bn ?? '',
      description_en: row.description_en,
      color: row.color,
      level: row.level,
      can_submit: row.can_submit,
      can_forward: row.can_forward,
      can_approve: row.can_approve,
      is_active,
    };
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    const payload = { ...form, code: form.code.trim().toUpperCase(), level: Number(form.level) || 1 };
    try {
      if (editingId) {
        const existing = rows.find((r) => r.id === editingId);
        await apiFetch(`/workflow/roles/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, is_active: existing?.is_active ?? true }),
        });
        setMessage(`Role ${payload.code} updated.`);
      } else {
        await apiFetch('/workflow/roles', { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`Role ${payload.code} added.`);
      }
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(row: WorkflowRoleAdminItem, active: boolean) {
    setError('');
    setMessage('');
    try {
      if (active) {
        await apiFetch(`/workflow/roles/${row.id}`, { method: 'PATCH', body: JSON.stringify(payloadFor(row, true)) });
      } else {
        if (!confirm(`Deactivate role "${row.code}"? It can no longer be chosen for steps or assigned to users.`)) return;
        await apiFetch(`/workflow/roles/${row.id}`, { method: 'DELETE' });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  function startEdit(row: WorkflowRoleAdminItem) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name_en: row.name_en,
      name_bn: row.name_bn ?? '',
      description_en: row.description_en,
      color: row.color,
      level: row.level,
      can_submit: row.can_submit,
      can_forward: row.can_forward,
      can_approve: row.can_approve,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const canSave = form.code.trim().length >= 2 && !!form.name_en.trim() && /^#[0-9a-fA-F]{6}$/.test(form.color);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow roles"
        description="Roles that process steps are assigned to and that users can hold."
        backHref="/workflow/admin"
        backLabel="Workflow admin"
        action={
          <Button asChild variant="outline">
            <Link href="/workflow/admin">
              <Workflow className="h-4 w-4" /> Workflow admin
            </Link>
          </Button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? `Edit role ${form.code}` : 'Add role'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wr-code">Code *</Label>
            <Input
              id="wr-code"
              value={form.code}
              disabled={!!editingId}
              placeholder="e.g. SDO, AC_LAND"
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
            />
            <p className="text-xs text-muted">{editingId ? 'The code cannot be changed after creation.' : 'Capital letters, digits and underscores.'}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wr-level">Level *</Label>
            <Input id="wr-level" type="number" min={1} max={99} value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })} />
            <p className="text-xs text-muted">Lower levels are listed first.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wr-name">Name (English) *</Label>
            <Input id="wr-name" value={form.name_en} placeholder="e.g. Sub-Divisional Officer" onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wr-name-bn">Name (Bangla)</Label>
            <Input id="wr-name-bn" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wr-desc">Description</Label>
            <Input id="wr-desc" value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wr-color">Colour *</Label>
            <div className="flex items-center gap-2">
              <input
                id="wr-color"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#1d4ed8'}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value.trim() })} className="max-w-[8rem]" />
              <span className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: form.color }}>
                {form.code || 'ROLE'}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="flex flex-wrap gap-4 pt-1">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form[p.key]} onChange={(e) => setForm({ ...form, [p.key]: e.target.checked })} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={saving || !canSave} onClick={() => void save()}>
              {saving ? 'Saving…' : editingId ? 'Update role' : 'Add role'}
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
          <CardTitle className="text-base">Roles ({visible.length})</CardTitle>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="max-w-xs" />
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">No roles yet.</p>
          ) : (
            visible.map((row) => (
              <div
                key={row.id}
                className={cn('flex flex-wrap items-center gap-3 rounded-md border p-3', row.is_active ? 'border-border' : 'border-dashed opacity-60')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: row.color }}>
                      {row.code}
                    </span>
                    <span className="font-medium">{row.name_en}</span>
                    <Badge variant="outline">Level {row.level}</Badge>
                    {row.is_system ? <Badge variant="secondary">System</Badge> : null}
                    {!row.is_active ? <Badge variant="warning">Inactive</Badge> : null}
                  </div>
                  {row.name_bn ? <p className="text-sm text-muted">{row.name_bn}</p> : null}
                  {row.description_en ? <p className="text-xs text-muted">{row.description_en}</p> : null}
                  <p className="mt-1 text-xs text-muted">
                    {[row.can_submit && 'Submit', row.can_forward && 'Forward', row.can_approve && 'Approve'].filter(Boolean).join(' · ') || 'No permissions'}
                    {' — '}
                    {row.step_count} step{row.step_count === 1 ? '' : 's'} · {row.user_count} user{row.user_count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(row)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  {row.is_active ? (
                    !row.is_system ? (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void setActive(row, false)} aria-label="Deactivate">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null
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
