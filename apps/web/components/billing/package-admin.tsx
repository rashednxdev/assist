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
  type LiveProgramRecord,
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
  exam_subject_ids: string[];
  class_limit: string;
  live_program_id: string;
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
    exam_subject_ids: p?.exam_subject_ids?.length ? p.exam_subject_ids : p?.exam_subject_id ? [p.exam_subject_id] : [],
    class_limit: p?.class_limit ? String(p.class_limit) : p?.class_count ? String(p.class_count) : '1',
    live_program_id: p?.live_program_id ?? '',
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
  programs,
  defaultPartId,
  defaultProgramId,
  onSaved,
  onCancel,
}: {
  kind: AccessPackageKind;
  initial?: AccessPackageRecord;
  parts: ExamPrepPartOption[];
  programs: LiveProgramRecord[];
  defaultPartId?: string;
  defaultProgramId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(() => {
    const form = toForm(initial);
    if (!initial && kind === 'exam_prep') form.exam_part_id = defaultPartId ?? parts[0]?.id ?? '';
    if (!initial && kind === 'live' && defaultProgramId) form.live_program_id = defaultProgramId;
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
    if (kind === 'live' && !f.live_program_id) {
      setError('Create the package first, then add a subject under it');
      return;
    }
    if (kind === 'live' && f.exam_subject_ids.length !== 1) {
      setError('Choose one subject');
      return;
    }
    setBusy(true);
    setError('');
    const body = {
      kind,
      name: kind === 'live' ? '' : f.name,
      name_bn: f.name_bn,
      description: f.description,
      exam_part_id: kind === 'exam_prep' ? f.exam_part_id || null : null,
      exam_subject_id: null,
      exam_subject_ids: kind === 'basic' ? [] : f.exam_subject_ids,
      class_limit: kind === 'live' ? Number(f.class_limit || 1) : null,
      live_program_id: kind === 'live' ? f.live_program_id || null : null,
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
        <CardTitle className="text-base">
          {kind === 'live' ? (initial ? `Edit “${initial.exam_subject_name || initial.name}”` : 'Add subject') : initial ? `Edit “${initial.name}”` : 'New package'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {kind !== 'live' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pk-name">Name</Label>
                <Input id="pk-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. SAS Part 1 — 3 months" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pk-name-bn">Name (Bangla, optional)</Label>
                <Input id="pk-name-bn" value={f.name_bn} onChange={(e) => set('name_bn', e.target.value)} />
              </div>
            </>
          )}
          {kind === 'exam_prep' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pk-part">Exam part</Label>
                <select
                  id="pk-part"
                  className={SELECT}
                  value={f.exam_part_id}
                  onChange={(e) => setF((prev) => ({ ...prev, exam_part_id: e.target.value, exam_subject_id: '', exam_subject_ids: [] }))}
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Subjects in this package</Label>
                <div className="grid gap-1.5 rounded-lg border border-border p-3 sm:grid-cols-2">
                  {(part?.subjects ?? []).map((s) => {
                    const on = f.exam_subject_ids.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            set(
                              'exam_subject_ids',
                              on ? f.exam_subject_ids.filter((id) => id !== s.id) : [...f.exam_subject_ids, s.id],
                            )
                          }
                        />
                        {s.name_bn?.trim() ? `${s.name} (${s.name_bn})` : s.name}
                      </label>
                    );
                  })}
                  {(part?.subjects ?? []).length === 0 && <p className="text-xs text-muted">This part has no subjects yet.</p>}
                </div>
                <p className="text-xs text-muted">
                  Tick one or more subjects. The same subject can also be in another package. A learner who already has a subject cannot
                  select a package that includes it. Leave every box empty to cover the whole part. This opens Books, Question Bank, Exam
                  Papers and the other learning modules except Live class.
                </p>
              </div>
            </>
          )}
          {kind === 'live' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pk-program">Under package</Label>
                <select
                  id="pk-program"
                  className={SELECT}
                  value={f.live_program_id}
                  onChange={(e) => setF((prev) => ({ ...prev, live_program_id: e.target.value, exam_subject_ids: [] }))}
                >
                  <option value="">Choose a package…</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pk-classes">Number of classes</Label>
                <Input id="pk-classes" type="number" min={1} value={f.class_limit} onChange={(e) => set('class_limit', e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Subject</Label>
                <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
                  {parts.flatMap((p) =>
                    p.subjects.map((s) => {
                      const on = f.exam_subject_ids[0] === s.id;
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="live-subject" checked={on} onChange={() => set('exam_subject_ids', [s.id])} />
                          {s.name}
                        </label>
                      );
                    }),
                  )}
                </div>
                <p className="text-xs text-muted">
                  Add one subject. The learner who enrolls it, once you approve the payment, joins only the classes of that subject.
                  Several subjects of this same package can be enrolled together. Another package is a separate purchase.
                </p>
              </div>
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Schedule this subject’s allowed classes, one date at a time. */
function SubjectSchedule({ pkg, onDone }: { pkg: AccessPackageRecord; onDone: () => void }) {
  const limit = pkg.class_limit ?? 0;
  const subject = pkg.exam_subject_name || pkg.exam_subject_names?.find(Boolean) || pkg.name;
  const [rows, setRows] = useState<LiveClassBrief[] | null>(null);
  const [hosts, setHosts] = useState<Array<{ user_id: string; display_name: string }>>([]);
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [when, setWhen] = useState('');
  const [hostUserId, setHostUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const r = await apiFetch<{ data: LiveClassBrief[] }>(`/billing/admin/packages/${pkg.id}/classes`);
    setRows([...r.data].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load classes'));
    apiFetch<{ data: Array<{ user_id: string; display_name: string }> }>('/live-streams/admin/host-options')
      .then((r) => setHosts(r.data))
      .catch(() => setHosts([]));
  }, [pkg.id]);

  const scheduled = rows?.length ?? 0;
  const full = limit > 0 && scheduled >= limit;

  function resetForm() {
    setTopic('');
    setDetails('');
    setWhen('');
    setHostUserId('');
    setEditingId(null);
  }

  async function save() {
    if (!topic.trim() || !when) {
      setError('Topic and date are required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await apiFetch(`/live-streams/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            topic: topic.trim(),
            details: details.trim(),
            scheduled_at: new Date(when).toISOString(),
            ...(hostUserId ? { host_user_id: hostUserId } : {}),
          }),
        });
      } else {
        await apiFetch(`/live-streams/admin/packages/${pkg.id}/classes`, {
          method: 'POST',
          body: JSON.stringify({
            topic: topic.trim(),
            details: details.trim(),
            scheduled_at: new Date(when).toISOString(),
            ...(hostUserId ? { host_user_id: hostUserId } : {}),
          }),
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this class');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(id: string) {
    if (!rows || !window.confirm('Remove this class from the subject?')) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/billing/admin/packages/${pkg.id}/classes`, {
        method: 'PUT',
        body: JSON.stringify({ class_ids: rows.filter((r) => r.id !== id).map((r) => r.id) }),
      });
      if (editingId === id) resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the class');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">
          {subject} · {scheduled} of {limit || '—'} classes
        </CardTitle>
        <p className="text-sm text-muted">
          Schedule each class on its own date, with the details for this subject. Enrolled learners join only these classes after you approve payment.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows === null ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No class dates yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map((row, index) => (
              <li key={row.id} className="space-y-1 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p>
                    <span className="font-medium">Class {index + 1}.</span> {row.topic}
                    <span className="block text-xs text-muted">{accessDateTime(row.scheduled_at)} · {row.status}</span>
                  </p>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(row.id);
                        setTopic(row.topic);
                        setDetails(row.details ?? '');
                        setWhen(toLocalInput(row.scheduled_at));
                      }}
                    >
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void unlink(row.id)}>
                      Remove
                    </Button>
                  </span>
                </div>
                {row.details ? <p className="whitespace-pre-line text-muted">{row.details}</p> : null}
              </li>
            ))}
          </ul>
        )}

        {!full || editingId ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cls-topic">{editingId ? 'Update topic' : 'Topic'}</Label>
              <Input id="cls-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What this class covers" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cls-when">Date and time</Label>
              <Input id="cls-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cls-host">Host</Label>
              <select id="cls-host" className={SELECT} value={hostUserId} onChange={(e) => setHostUserId(e.target.value)}>
                <option value="">You (the admin scheduling this)</option>
                {hosts.map((h) => (
                  <option key={h.user_id} value={h.user_id}>
                    {h.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cls-details">Details</Label>
              <textarea
                id="cls-details"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What learners should know about this date"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">All {limit} classes for this subject are scheduled. Raise the class amount to add another date.</p>
        )}

        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          {(!full || editingId) && (
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save class' : 'Add this date'}
            </Button>
          )}
          {editingId && (
            <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>
              Cancel edit
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveProgramsPanel({ onAddSubject }: { onAddSubject: (programId: string) => void }) {
  const [rows, setRows] = useState<LiveProgramRecord[] | null>(null);
  const [name, setName] = useState('');
  const [waiver2, setWaiver2] = useState('10');
  const [waiver3, setWaiver3] = useState('0');
  const [waiver4, setWaiver4] = useState('0');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    const r = await apiFetch<{ data: LiveProgramRecord[] }>('/billing/admin/live-programs');
    setRows(r.data);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load packages'));
  }, []);

  async function save() {
    setError('');
    const body = {
      name,
      waiver_2: Number(waiver2 || 0),
      waiver_3: Number(waiver3 || 0),
      waiver_4: Number(waiver4 || 0),
      is_active: true,
      sort_order: 100,
    };
    try {
      await apiFetch(editing ? `/billing/admin/live-programs/${editing}` : '/billing/admin/live-programs', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      setName('');
      setWaiver2('10');
      setWaiver3('0');
      setWaiver4('0');
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function remove(row: LiveProgramRecord) {
    if (!window.confirm(`Delete package "${row.name}"? Subject classes must be removed first.`)) return;
    try {
      await apiFetch(`/billing/admin/live-programs/${row.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Package names</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">
          Add a package such as Flex or Quick Review. Then add one subject class under it. The waiver applies when a learner enrolls more
          than one subject of that package in the same payment. One subject is never reduced.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-2 sm:grid-cols-5">
          <Input placeholder="Package name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" min={0} max={90} value={waiver2} onChange={(e) => setWaiver2(e.target.value)} aria-label="2 subjects waiver %" />
          <Input type="number" min={0} max={90} value={waiver3} onChange={(e) => setWaiver3(e.target.value)} aria-label="3 subjects waiver %" />
          <Input type="number" min={0} max={90} value={waiver4} onChange={(e) => setWaiver4(e.target.value)} aria-label="4 subjects waiver %" />
          <Button type="button" onClick={() => void save()} disabled={!name.trim()}>
            {editing ? 'Update package' : 'Add package'}
          </Button>
        </div>
        <p className="text-xs text-muted">Waiver percents: 2 subjects, 3 subjects, 4 subjects.</p>
        <ul className="space-y-1 text-sm">
          {(rows ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span>
                <span className="font-medium">{row.name}</span>
                <span className="text-muted">
                  {' '}
                  · 2 subjects {row.waiver_2}% · 3 subjects {row.waiver_3}% · 4 subjects {row.waiver_4}%
                </span>
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" onClick={() => onAddSubject(row.id)}>
                  Add subject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(row.id);
                    setName(row.name);
                    setWaiver2(String(row.waiver_2));
                    setWaiver3(String(row.waiver_3));
                    setWaiver4(String(row.waiver_4));
                  }}
                >
                  Edit
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void remove(row)}>
                  Delete
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function PackageAdmin({ kind }: { kind: AccessPackageKind }) {
  const [items, setItems] = useState<AccessPackageRecord[] | null>(null);
  const [parts, setParts] = useState<ExamPrepPartOption[]>([]);
  const [programs, setPrograms] = useState<LiveProgramRecord[]>([]);
  const [partFilter, setPartFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<AccessPackageRecord | 'new' | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [classesFor, setClassesFor] = useState<AccessPackageRecord | null>(null);
  const [subjectProgramId, setSubjectProgramId] = useState('');

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
    if (kind === 'exam_prep' || kind === 'live') {
      apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/parts')
        .then((r) => setParts(r.data.parts))
        .catch(() => setParts([]));
    }
    if (kind === 'live') {
      apiFetch<{ data: LiveProgramRecord[] }>('/billing/admin/live-programs')
        .then((r) => setPrograms(r.data))
        .catch(() => setPrograms([]));
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
              : 'Create the package first. Then add subjects one by one and assign each subject’s classes. Learners enroll one or more subjects of that package. Another package is a separate purchase. After you approve the payment, they join only the classes of the subjects they enrolled.'}
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
          {kind !== 'live' && (
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
          )}
        </div>
      </div>

      {kind === 'live' && (
        <LiveProgramsPanel
          onAddSubject={(programId) => {
            setClassesFor(null);
            setSubjectProgramId(programId);
            setEditing('new');
          }}
        />
      )}

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
          key={editing === 'new' ? `new-${subjectProgramId}` : editing.id}
          kind={kind}
          initial={editing === 'new' ? undefined : editing}
          parts={parts}
          programs={programs}
          defaultPartId={partFilter || undefined}
          defaultProgramId={subjectProgramId}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {classesFor && (
        <SubjectSchedule
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
                <th className="px-3 py-2">{kind === 'live' ? 'Subject class' : 'Package'}</th>
                {kind === 'live' && <th className="px-3 py-2">Package</th>}
                {kind === 'exam_prep' && <th className="px-3 py-2">Part</th>}
                {kind === 'exam_prep' && <th className="px-3 py-2">Covers</th>}
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Price</th>
                {kind === 'live' && <th className="px-3 py-2">Scheduled</th>}
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
                    {kind === 'live' && p.exam_subject_names?.[0] && (
                      <p className="text-xs text-muted">{p.exam_subject_names.filter(Boolean).join(', ')}</p>
                    )}
                  </td>
                  {kind === 'live' && <td className="px-3 py-2">{p.live_program_name ?? '—'}</td>}
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
                  {kind === 'live' && (
                    <td className="px-3 py-2">
                      {p.class_count ?? 0} / {p.class_limit ?? 0}
                    </td>
                  )}
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
                          Schedule
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
