'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Pencil, Plus, Trash2, Video } from 'lucide-react';
import type { AccessPackageKind } from '@ibas/shared-constants';
import {
  formatBdt,
  type AccessPackageRecord,
  type BulkSubjectPackagesResult,
  type ExamPrepPartOption,
  type ExamPrepPartsResponse,
  type LiveClassBrief,
} from '@ibas/shared-types';
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

function partTitle(p: ExamPrepPartOption): string {
  return p.name && p.name !== p.label ? `${p.label} — ${p.name}` : p.label;
}

interface FormState {
  name: string;
  name_bn: string;
  description: string;
  exam_part_id: string;
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
    exam_part_id: p?.exam_part_id ?? '',
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
  parts,
  defaultPartId,
  onSaved,
  onCancel,
}: {
  kind: AccessPackageKind;
  initial?: AccessPackageRecord;
  parts: ExamPrepPartOption[];
  defaultPartId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(() => {
    const form = toForm(initial);
    if (!initial && kind === 'exam_prep') form.exam_part_id = defaultPartId ?? parts[0]?.id ?? '';
    return form;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const isLegacy = initial?.scope === 'legacy';
  const part = parts.find((p) => p.id === f.exam_part_id);

  async function save() {
    if (kind === 'exam_prep' && !f.exam_part_id && !isLegacy) {
      setError('Pick the exam part this package is for');
      return;
    }
    setBusy(true);
    setError('');
    const body = {
      kind,
      name: f.name,
      name_bn: f.name_bn,
      description: f.description,
      exam_part_id: kind === 'exam_prep' ? f.exam_part_id || null : null,
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
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pk-part">Exam part</Label>
                <select
                  id="pk-part"
                  className={SELECT}
                  value={f.exam_part_id}
                  onChange={(e) => setF((prev) => ({ ...prev, exam_part_id: e.target.value, exam_subject_id: '' }))}
                >
                  {isLegacy && <option value="">All of Part 1 (older package)</option>}
                  {!isLegacy && !f.exam_part_id && <option value="">Pick a part…</option>}
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {partTitle(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pk-subject">Covers</Label>
                <select
                  id="pk-subject"
                  className={SELECT}
                  value={f.exam_subject_id}
                  disabled={!part}
                  onChange={(e) => set('exam_subject_id', e.target.value)}
                >
                  <option value="">{part ? `Whole ${part.label} — every subject` : '—'}</option>
                  {(part?.subjects ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_bn?.trim() ? `${s.name} (${s.name_bn})` : s.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                A subject package opens that subject in Question Bank, Marathon review and Exam Papers. A whole-part package opens every
                subject of the part. Users can tick several subjects and pay once.
              </p>
            </>
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

/** Prices every subject of a part in one go (one subject package each). */
function BulkSubjectPricing({
  parts,
  defaultPartId,
  onDone,
  onCancel,
}: {
  parts: ExamPrepPartOption[];
  defaultPartId?: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [partId, setPartId] = useState(defaultPartId ?? parts[0]?.id ?? '');
  const [days, setDays] = useState('90');
  const [price, setPrice] = useState('');
  const [was, setWas] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const part = parts.find((p) => p.id === partId);

  async function run() {
    if (!partId) return setError('Pick an exam part');
    if (price === '') return setError('Enter the price per subject');
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch<{ data: BulkSubjectPackagesResult }>('/billing/admin/packages/bulk-subjects', {
        method: 'POST',
        body: JSON.stringify({
          exam_part_id: partId,
          duration_days: Number(days),
          price: Number(price),
          compare_at_price: was ? Number(was) : null,
          update_existing: updateExisting,
        }),
      });
      const { created, updated, skipped } = r.data;
      onDone(
        `${part?.label ?? 'Part'}: ${created} subject package${created === 1 ? '' : 's'} created` +
          (updated ? `, ${updated} updated` : '') +
          (skipped ? `, ${skipped} already priced (left as they were)` : '') +
          '.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create packages');
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Price every subject of a part</CardTitle>
        <p className="text-sm text-muted">
          Creates one package per subject with the same price and duration. Edit any of them afterwards to fine-tune.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-part">Exam part</Label>
            <select id="bulk-part" className={SELECT} value={partId} onChange={(e) => setPartId(e.target.value)}>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {partTitle(p)} · {p.subjects.length} subject{p.subjects.length === 1 ? '' : 's'}
                </option>
              ))}
            </select>
            {part && part.subjects.length === 0 && (
              <p className="text-xs text-destructive">This part has no subjects yet. Add them in Exam setup first.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-days">Duration (days)</Label>
            <Input id="bulk-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(String(d))}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-muted hover:bg-slate-100"
                >
                  {durationLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-price">Price per subject (৳)</Label>
            <Input id="bulk-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-was">“Was” price (optional)</Label>
            <Input id="bulk-was" type="number" min={0} value={was} onChange={(e) => setWas(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
          Also change the price of subjects that already have a package with this duration
        </label>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button onClick={run} disabled={busy || !part || part.subjects.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create subject packages
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
  const [parts, setParts] = useState<ExamPrepPartOption[]>([]);
  const [partFilter, setPartFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<AccessPackageRecord | 'new' | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [classesFor, setClassesFor] = useState<AccessPackageRecord | null>(null);

  const shown = useMemo(() => {
    if (!items || kind !== 'exam_prep' || !partFilter) return items;
    const primaryId = parts.find((p) => p.is_primary)?.id;
    return items.filter((p) => (p.exam_part_id ?? (p.scope === 'legacy' ? primaryId : undefined)) === partFilter);
  }, [items, kind, partFilter, parts]);

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
    setBulkOpen(false);
    setClassesFor(null);
    setMessage('');
    void load();
    if (kind === 'exam_prep') {
      apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/parts')
        .then((r) => setParts(r.data.parts))
        .catch(() => setParts([]));
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
            ? 'Price each subject of a part (or a whole part) by duration. A buyer opens only the subjects they bought; they can tick several and pay once.'
            : kind === 'basic'
              ? 'Plans by month and amount. Users choose one; Schedule and Salary stay free.'
              : 'Create a package, then assign its classes. Buyers join every class in the package until it expires.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {kind === 'exam_prep' && (
            <Button
              variant="outline"
              disabled={parts.length === 0}
              onClick={() => {
                setEditing(null);
                setClassesFor(null);
                setBulkOpen(true);
              }}
            >
              <Layers className="h-4 w-4" />
              Price all subjects of a part
            </Button>
          )}
          <Button
            onClick={() => {
              setClassesFor(null);
              setBulkOpen(false);
              setEditing('new');
            }}
          >
            <Plus className="h-4 w-4" />
            New package
          </Button>
        </div>
      </div>

      {kind === 'exam_prep' && parts.length > 1 && (
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-background p-1" role="tablist">
          {[{ id: '', label: 'All parts' }, ...parts.map((p) => ({ id: p.id, label: p.label }))].map((t) => (
            <button
              key={t.id || 'all'}
              type="button"
              role="tab"
              aria-selected={partFilter === t.id}
              onClick={() => setPartFilter(t.id)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                partFilter === t.id ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      {bulkOpen && (
        <BulkSubjectPricing
          parts={parts}
          defaultPartId={partFilter || undefined}
          onCancel={() => setBulkOpen(false)}
          onDone={(msg) => {
            setBulkOpen(false);
            setMessage(msg);
            void load();
          }}
        />
      )}

      {editing && (
        <PackageForm
          key={editing === 'new' ? 'new' : editing.id}
          kind={kind}
          initial={editing === 'new' ? undefined : editing}
          parts={parts}
          defaultPartId={partFilter || undefined}
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

      {!items || !shown ? (
        <Skeleton className="h-40 w-full" />
      ) : shown.length === 0 ? (
        <EmptyState title="No packages yet" description="Create the first package for this section." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Package</th>
                {kind === 'exam_prep' && <th className="px-3 py-2">Part</th>}
                {kind === 'exam_prep' && <th className="px-3 py-2">Covers</th>}
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Price</th>
                {kind === 'live' && <th className="px-3 py-2">Classes</th>}
                <th className="px-3 py-2">Sold</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{p.name}</p>
                    {p.is_featured && <Badge className="mt-0.5">Popular</Badge>}
                  </td>
                  {kind === 'exam_prep' && <td className="px-3 py-2">{p.exam_part_name ?? '—'}</td>}
                  {kind === 'exam_prep' && (
                    <td className="px-3 py-2">
                      {p.exam_subject_name ?? (
                        <Badge variant="secondary">{p.scope === 'legacy' ? 'All subjects (older package)' : 'Whole part'}</Badge>
                      )}
                    </td>
                  )}
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
                          setBulkOpen(false);
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
