'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Video } from 'lucide-react';
import type { AccessPackageKind } from '@ibas/shared-constants';
import { formatBdt, type AccessPackageRecord, type LiveClassBrief } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { accessDateTime, durationLabel } from '@/lib/billing-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

const SELECT = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const DURATION_PRESETS = [30, 90, 180, 365];

interface SubjectOption {
  id: string;
  name: string;
  group: string;
}

interface FormState {
  name: string;
  name_bn: string;
  description: string;
  exam_subject_id: string;
  duration_days: string;
  price: string;
  compare_at_price: string;
  features: string;
  is_featured: boolean;
  sort_order: string;
  is_active: boolean;
}

function toForm(p?: AccessPackageRecord): FormState {
  return {
    name: p?.name ?? '',
    name_bn: p?.name_bn ?? '',
    description: p?.description ?? '',
    exam_subject_id: p?.exam_subject_id ?? '',
    duration_days: String(p?.duration_days ?? 30),
    price: p ? String(p.price) : '',
    compare_at_price: p?.compare_at_price ? String(p.compare_at_price) : '',
    features: (p?.features ?? []).join('\n'),
    is_featured: p?.is_featured ?? false,
    sort_order: String(p?.sort_order ?? 100),
    is_active: p?.is_active ?? true,
  };
}

function PackageForm({
  kind,
  initial,
  subjects,
  onSaved,
  onCancel,
}: {
  kind: AccessPackageKind;
  initial?: AccessPackageRecord;
  subjects: SubjectOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(() => toForm(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  async function save() {
    setBusy(true);
    setError('');
    const body = {
      kind,
      name: f.name,
      name_bn: f.name_bn,
      description: f.description,
      exam_subject_id: kind === 'exam_prep' ? f.exam_subject_id || null : null,
      duration_days: Number(f.duration_days),
      price: Number(f.price || 0),
      compare_at_price: f.compare_at_price ? Number(f.compare_at_price) : null,
      features: f.features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      is_featured: f.is_featured,
      sort_order: Number(f.sort_order || 100),
      is_active: f.is_active,
    };
    try {
      await apiFetch(initial ? `/billing/admin/packages/${initial.id}` : '/billing/admin/packages', {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">{initial ? `Edit “${initial.name}”` : 'New package'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pk-name">Name</Label>
            <Input id="pk-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. SAS Part 1 — 3 months" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pk-name-bn">Name (Bangla, optional)</Label>
            <Input id="pk-name-bn" value={f.name_bn} onChange={(e) => set('name_bn', e.target.value)} />
          </div>
          {kind === 'exam_prep' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pk-subject">Exam subject</Label>
              <select id="pk-subject" className={SELECT} value={f.exam_subject_id} onChange={(e) => set('exam_subject_id', e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.group ? ` — ${s.group}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                Users pick their subject when buying. Any Exam Preparation package opens every exam-prep module for its period.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pk-days">{kind === 'live' ? 'Validity (days)' : 'Duration (days)'}</Label>
            <Input id="pk-days" type="number" min={1} value={f.duration_days} onChange={(e) => set('duration_days', e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('duration_days', String(d))}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-muted hover:bg-slate-100"
                >
                  {durationLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pk-price">Price (৳)</Label>
              <Input id="pk-price" type="number" min={0} value={f.price} onChange={(e) => set('price', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pk-was">“Was” price (optional)</Label>
              <Input id="pk-was" type="number" min={0} value={f.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pk-desc">Description</Label>
            <textarea
              id="pk-desc"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pk-features">Highlights (one per line, up to 12)</Label>
            <textarea
              id="pk-features"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={f.features}
              onChange={(e) => set('features', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pk-sort">Sort order</Label>
            <Input id="pk-sort" type="number" min={0} value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />
              Available for purchase
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
              Highlight as popular
            </label>
          </div>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ClassOption = LiveClassBrief & { package_ids: string[] };

function ClassPicker({ pkg, onDone }: { pkg: AccessPackageRecord; onDone: () => void }) {
  const [options, setOptions] = useState<ClassOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: ClassOption[] }>('/billing/admin/live-class-options'),
      apiFetch<{ data: LiveClassBrief[] }>(`/billing/admin/packages/${pkg.id}/classes`),
    ])
      .then(([opts, current]) => {
        const byId = new Map(opts.data.map((o) => [o.id, o]));
        for (const c of current.data) if (!byId.has(c.id)) byId.set(c.id, { ...c, package_ids: [pkg.id] });
        setOptions([...byId.values()].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
        setSelected(new Set(current.data.map((c) => c.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load classes'));
  }, [pkg.id]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (options ?? []).filter((o) => !term || o.topic.toLowerCase().includes(term));
  }, [options, q]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/billing/admin/packages/${pkg.id}/classes`, {
        method: 'PUT',
        body: JSON.stringify({ class_ids: [...selected] }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Classes in “{pkg.name}”</CardTitle>
        <p className="text-sm text-muted">
          Buyers of this package can join every selected class. A class can belong to more than one package. Shows upcoming classes and
          those from the last 60 days.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Search classes…" value={q} onChange={(e) => setQ(e.target.value)} />
        {!options ? (
          <Skeleton className="h-40 w-full" />
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted">No classes found. Create classes in Live class admin first.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {visible.map((o) => {
              const others = o.package_ids.filter((id) => id !== pkg.id).length;
              return (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50">
                    <input type="checkbox" className="mt-1" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{o.topic}</span>
                      <span className="block text-xs text-muted">
                        {accessDateTime(o.scheduled_at)} · {o.status} · {o.video_platform}
                        {others > 0 ? ` · also in ${others} other package${others === 1 ? '' : 's'}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={busy || !options}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save ({selected.size} selected)
          </Button>
          <Button variant="outline" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PackageAdmin({ kind }: { kind: AccessPackageKind }) {
  const [items, setItems] = useState<AccessPackageRecord[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AccessPackageRecord | 'new' | null>(null);
  const [classesFor, setClassesFor] = useState<AccessPackageRecord | null>(null);

  async function load() {
    try {
      const r = await apiFetch<{ data: AccessPackageRecord[] }>(`/billing/admin/packages?kind=${kind}`);
      setItems(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packages');
    }
  }

  useEffect(() => {
    setItems(null);
    setEditing(null);
    setClassesFor(null);
    void load();
    if (kind === 'exam_prep') {
      apiFetch<{ data: SubjectOption[] }>('/billing/admin/subject-options')
        .then((r) => setSubjects(r.data))
        .catch(() => setSubjects([]));
    }
  }, [kind]);

  async function remove(p: AccessPackageRecord) {
    const msg = p.sold_count
      ? `"${p.name}" has ${p.sold_count} sale(s). It will be archived: hidden from users, while existing buyers keep their access. Continue?`
      : `Delete "${p.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await apiFetch(`/billing/admin/packages/${p.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {kind === 'exam_prep'
            ? 'Price each exam subject by duration. Buying any of them opens all exam-prep modules for that time.'
            : kind === 'basic'
              ? 'Plans by month and amount. Users choose one; Schedule and Salary stay free.'
              : 'Create a package, then assign its classes. Buyers join every class in the package until it expires.'}
        </p>
        <Button
          onClick={() => {
            setClassesFor(null);
            setEditing('new');
          }}
        >
          <Plus className="h-4 w-4" />
          New package
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {editing && (
        <PackageForm
          key={editing === 'new' ? 'new' : editing.id}
          kind={kind}
          initial={editing === 'new' ? undefined : editing}
          subjects={subjects}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {classesFor && (
        <ClassPicker
          key={classesFor.id}
          pkg={classesFor}
          onDone={() => {
            setClassesFor(null);
            void load();
          }}
        />
      )}

      {!items ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title="No packages yet" description="Create the first package for this section." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Package</th>
                {kind === 'exam_prep' && <th className="px-3 py-2">Subject</th>}
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Price</th>
                {kind === 'live' && <th className="px-3 py-2">Classes</th>}
                <th className="px-3 py-2">Sold</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.name}</p>
                    {p.is_featured && <Badge className="mt-0.5">Popular</Badge>}
                  </td>
                  {kind === 'exam_prep' && <td className="px-3 py-2">{p.exam_subject_name ?? 'All subjects'}</td>}
                  <td className="px-3 py-2">{durationLabel(p.duration_days)}</td>
                  <td className="px-3 py-2">
                    {formatBdt(p.price)}
                    {p.compare_at_price ? <span className="ml-1 text-xs text-muted line-through">{formatBdt(p.compare_at_price)}</span> : null}
                  </td>
                  {kind === 'live' && <td className="px-3 py-2">{p.class_count ?? 0}</td>}
                  <td className="px-3 py-2">{p.sold_count ?? 0}</td>
                  <td className="px-3 py-2">
                    <Badge variant={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'On sale' : 'Hidden'}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {kind === 'live' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(null);
                            setClassesFor(p);
                          }}
                        >
                          <Video className="h-4 w-4" />
                          Classes
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() => {
                          setClassesFor(null);
                          setEditing(p);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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
