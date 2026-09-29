'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { SCHEDULE_REMINDER_OPTIONS, type ScheduleTypeInput, type ScheduleTypeRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { reminderLabel } from '@/lib/schedule-format';
import { refreshScheduleTypes } from '@/lib/use-schedule-types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const PALETTE = ['#1d4ed8', '#047857', '#b91c1c', '#7c3aed', '#c2410c', '#0e7490', '#0f766e', '#be185d', '#a16207', '#475569'];

type Draft = Required<Omit<ScheduleTypeInput, 'label_bn' | 'description'>> & { label_bn: string; description: string };

function emptyDraft(sort: number): Draft {
  return {
    code: '',
    label: '',
    label_bn: '',
    description: '',
    color: PALETTE[0]!,
    default_reminders: [1440],
    allow_personal: true,
    sort_order: sort,
    is_active: true,
  };
}

function toDraft(t: ScheduleTypeRecord): Draft {
  return {
    code: t.code,
    label: t.label,
    label_bn: t.label_bn ?? '',
    description: t.description ?? '',
    color: t.color,
    default_reminders: [...t.default_reminders],
    allow_personal: t.allow_personal,
    sort_order: t.sort_order,
    is_active: t.is_active,
  };
}

function slugify(label: string): string {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return /^[a-z]/.test(s) ? s : s ? `t_${s}`.slice(0, 40) : '';
}

/** Admin CRUD for schedule types (meeting, bill submission, …). Built-in system types can be renamed but not removed. */
export function ScheduleTypesAdmin() {
  const [types, setTypes] = useState<ScheduleTypeRecord[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft; system: boolean; codeTouched: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: ScheduleTypeRecord[] }>('/schedule/types?all=true');
      setTypes(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load types');
      setTypes([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditing((p) => (p ? { ...p, draft: { ...p.draft, [key]: value } } : p));

  async function save() {
    if (!editing) return;
    setError('');
    setMsg('');
    const d = editing.draft;
    if (!d.label.trim()) return setError('Name is required.');
    if (!editing.id && !d.code) return setError('Code is required.');
    setSaving(true);
    try {
      await apiFetch(editing.id ? `/schedule/types/${editing.id}` : '/schedule/types', {
        method: editing.id ? 'PUT' : 'POST',
        body: JSON.stringify({ ...d, sort_order: Number(d.sort_order) || 0 }),
      });
      setMsg(`Saved “${d.label.trim()}”.`);
      setEditing(null);
      refreshScheduleTypes();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: ScheduleTypeRecord) {
    if (!window.confirm(`Delete the type “${t.label}”?`)) return;
    setError('');
    setMsg('');
    try {
      await apiFetch(`/schedule/types/${t.id}`, { method: 'DELETE' });
      setMsg(`Deleted “${t.label}”.`);
      if (editing?.id === t.id) setEditing(null);
      refreshScheduleTypes();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const d = editing?.draft;

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}

      {editing && d && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{editing.id ? `Edit type: ${d.label || d.code}` : 'New schedule type'}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" /> Close
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-label">Name *</Label>
                <Input
                  id="t-label"
                  value={d.label}
                  maxLength={60}
                  onChange={(e) => {
                    const label = e.target.value;
                    setEditing((p) =>
                      p ? { ...p, draft: { ...p.draft, label, ...(!p.id && !p.codeTouched ? { code: slugify(label) } : {}) } } : p,
                    );
                  }}
                  placeholder="e.g. Audit inspection"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-bn">Name (Bangla)</Label>
                <Input id="t-bn" value={d.label_bn} maxLength={60} onChange={(e) => set('label_bn', e.target.value)} placeholder="যেমন অডিট পরিদর্শন" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-code">Code {editing.id ? '' : '*'}</Label>
                <Input
                  id="t-code"
                  value={d.code}
                  disabled={!!editing.id}
                  maxLength={40}
                  onChange={(e) => setEditing((p) => (p ? { ...p, codeTouched: true, draft: { ...p.draft, code: e.target.value.toLowerCase() } } : p))}
                  placeholder="audit_inspection"
                />
                <p className="text-xs text-muted">{editing.id ? 'The code cannot change after creation.' : 'Lowercase letters, digits, _'}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Description</Label>
              <Input id="t-desc" value={d.description} maxLength={300} onChange={(e) => set('description', e.target.value)} placeholder="When to use this type" />
            </div>

            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('color', c)}
                    className={cn('h-7 w-7 rounded-full ring-offset-2', d.color.toLowerCase() === c && 'ring-2 ring-foreground')}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
                <input type="color" value={d.color} onChange={(e) => set('color', e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-border" aria-label="Custom colour" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Default reminders (pre-selected for new schedules of this type)</Label>
              <div className="flex flex-wrap gap-1.5">
                {SCHEDULE_REMINDER_OPTIONS.map((o) => {
                  const on = d.default_reminders.includes(o.minutes);
                  return (
                    <button
                      key={o.minutes}
                      type="button"
                      disabled={!on && d.default_reminders.length >= 6}
                      onClick={() => set('default_reminders', on ? d.default_reminders.filter((m) => m !== o.minutes) : [...d.default_reminders, o.minutes])}
                      className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-sort">Sort order</Label>
                <Input id="t-sort" type="number" min={0} max={9999} value={d.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={d.allow_personal}
                  disabled={d.code === 'rest_recreation'}
                  onChange={(e) => set('allow_personal', e.target.checked)}
                />
                Users can pick it for personal schedules
              </label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={d.is_active} disabled={editing.system} onChange={(e) => set('is_active', e.target.checked)} />
                Active {editing.system && <span className="text-xs text-muted">(built-in)</span>}
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : editing.id ? 'Save type' : 'Create type'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Schedule types <span className="font-normal text-muted">({types?.length ?? 0})</span>
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setMsg('');
              const maxSort = Math.max(0, ...(types ?? []).map((t) => t.sort_order));
              setEditing({ id: null, draft: emptyDraft(maxSort + 10), system: false, codeTouched: false });
            }}
          >
            <Plus className="h-4 w-4" /> New type
          </Button>
        </CardHeader>
        <CardContent>
          {types === null ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {types.map((t) => (
                <div key={t.id} className={cn('flex flex-wrap items-center gap-3 p-3 text-sm', !t.is_active && 'bg-slate-50 text-muted')}>
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: t.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{t.label}</span>
                      {t.label_bn && <span className="text-muted">{t.label_bn}</span>}
                      <code className="rounded bg-slate-100 px-1.5 text-xs">{t.code}</code>
                      {t.is_system && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" /> Built-in
                        </Badge>
                      )}
                      {!t.is_active && <Badge variant="warning">Inactive</Badge>}
                      {t.allow_personal ? <Badge variant="outline">Personal OK</Badge> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {t.description ? `${t.description} · ` : ''}
                      {t.default_reminders.length ? t.default_reminders.map(reminderLabel).join(', ') : 'No default reminders'}
                      {' · '}
                      {t.usage_count ?? 0} schedule{t.usage_count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMsg('');
                        setEditing({ id: t.id, draft: toDraft(t), system: t.is_system, codeTouched: true });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={t.is_system || (t.usage_count ?? 0) > 0}
                      title={t.is_system ? 'Built-in types cannot be deleted' : (t.usage_count ?? 0) > 0 ? 'In use — make it inactive instead' : 'Delete'}
                      onClick={() => void remove(t)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            Types in use cannot be deleted — make them inactive to hide them from new schedules. Existing schedules keep their type.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
