'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Plus, Save, Settings2, Trash2, Workflow, X } from 'lucide-react';
import {
  DEDUCTION_AMOUNT_MODES,
  DEDUCTION_AMOUNT_MODE_LABELS,
  formatDeductionAmount,
  type DeductionAmountMode,
  type DeductionEntryDetail,
  type DeductionSetupItem,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RefPicker, type EditorRef } from '@/components/toolkit/ref-picker';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const textareaClass = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

interface LineState {
  key: string;
  deduction_type_id: string;
  mode: DeductionAmountMode;
  value: string;
  text: string;
  note: string;
}

interface EditorState {
  economic_code_id: string;
  bill_type_id: string;
  title: string;
  details: string;
  deductions: LineState[];
  highlights: string[];
  source: string;
  processes: Array<{ id: string; name_en: string; missing?: boolean }>;
  circulars: EditorRef[];
  is_published: boolean;
}

interface TaskItem {
  id: string;
  name_en: string;
  is_published?: boolean;
}

let lineSeq = 0;
const newLine = (): LineState => ({ key: `l${++lineSeq}`, deduction_type_id: '', mode: 'percent', value: '', text: '', note: '' });

const blank = (): EditorState => ({
  economic_code_id: '',
  bill_type_id: '',
  title: '',
  details: '',
  deductions: [newLine()],
  highlights: [],
  source: '',
  processes: [],
  circulars: [],
  is_published: false,
});

function fromDetail(d: DeductionEntryDetail): EditorState {
  return {
    economic_code_id: d.economic_code.id,
    bill_type_id: d.bill_type.id,
    title: d.title ?? '',
    details: d.details ?? '',
    deductions: d.deductions.map((l) => ({
      key: `l${++lineSeq}`,
      deduction_type_id: l.deduction_type.id,
      mode: l.mode,
      value: l.value === undefined ? '' : String(l.value),
      text: l.text ?? '',
      note: l.note ?? '',
    })),
    highlights: d.highlights,
    source: d.source ?? '',
    processes: d.processes.map((p) => ({ id: p.id, name_en: p.name_en, missing: p.missing })),
    circulars: d.circulars.map((c) => ({ target_type: 'circular', target_id: c.id, title: c.missing ? c.title : `${c.circular_no} — ${c.title}`, missing: c.missing })),
    is_published: d.is_published,
  };
}

function toPayload(s: EditorState) {
  return {
    economic_code_id: s.economic_code_id,
    bill_type_id: s.bill_type_id,
    title: s.title,
    details: s.details,
    deductions: s.deductions
      .filter((l) => l.deduction_type_id)
      .map((l) => ({
        deduction_type_id: l.deduction_type_id,
        mode: l.mode,
        value: l.mode === 'text' || l.value.trim() === '' ? undefined : Number(l.value),
        text: l.mode === 'text' ? l.text : undefined,
        note: l.note,
      })),
    highlights: s.highlights.map((h) => h.trim()).filter(Boolean),
    source: s.source,
    process_ids: s.processes.map((p) => p.id),
    circular_ids: s.circulars.map((c) => c.target_id),
    is_published: s.is_published,
  };
}

function ProcessPicker({ value, onChange }: { value: EditorState['processes']; onChange: (v: EditorState['processes']) => void }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    apiFetch<{ data: TaskItem[] }>('/workflow/tasks')
      .then((r) => setTasks(r.data))
      .catch(() => setTasks([]));
  }, []);

  const term = q.trim().toLowerCase();
  const hits = term.length < 1 ? [] : tasks.filter((t) => t.name_en.toLowerCase().includes(term)).slice(0, 12);
  const full = value.length >= 5;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span
              key={p.id}
              className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs ${p.missing ? 'bg-red-50 text-red-700' : 'bg-slate-100'}`}
            >
              <Workflow className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.name_en}</span>
              <button type="button" aria-label="Remove process" onClick={() => onChange(value.filter((x) => x.id !== p.id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1.5 rounded-md border border-dashed border-border p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} disabled={full} placeholder={full ? 'Maximum 5 processes' : 'Search processes…'} className="h-8 text-xs" />
        {hits.length > 0 && (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {hits.map((t) => {
              const has = value.some((p) => p.id === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={has || full}
                  onClick={() => {
                    onChange([...value, { id: t.id, name_en: t.name_en, missing: t.is_published === false }]);
                    setQ('');
                  }}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="font-medium">{t.name_en}</span>
                  {t.is_published === false && <span className="ml-1 text-amber-700">(not published)</span>}
                  {has && <span className="ml-1 text-emerald-700">(tagged)</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeductionEntryEditorPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const [state, setState] = useState<EditorState | null>(isNew ? blank() : null);
  const [setup, setSetup] = useState<DeductionSetupItem[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [newHighlight, setNewHighlight] = useState('');

  useEffect(() => {
    apiFetch<{ data: DeductionSetupItem[] }>('/deductions/setup?all=true')
      .then((r) => setSetup(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load setup'));
    if (isNew) return;
    apiFetch<{ data: DeductionEntryDetail }>(`/deductions/${id}`)
      .then((r) => setState(fromDetail(r.data)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [id, isNew]);

  const options = useMemo(() => {
    const pick = (kind: DeductionSetupItem['kind'], current: string[]) =>
      setup.filter((s) => s.kind === kind && (s.is_active || current.includes(s.id)));
    return {
      eco: pick('economic_code', state ? [state.economic_code_id] : []),
      bill: pick('bill_type', state ? [state.bill_type_id] : []),
      ded: pick('deduction_type', state ? state.deductions.map((l) => l.deduction_type_id) : []),
    };
  }, [setup, state]);

  if (!state) return error ? <Alert variant="error">{error}</Alert> : <Skeleton className="h-64 w-full" />;

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) => setState((s) => (s ? { ...s, [key]: value } : s));
  const setLine = (key: string, patch: Partial<LineState>) => set('deductions', state.deductions.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const moveHighlight = (i: number, dir: -1 | 1) => {
    const next = [...state.highlights];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set('highlights', next);
  };
  const addHighlight = () => {
    const t = newHighlight.trim();
    if (!t || state.highlights.length >= 12) return;
    set('highlights', [...state.highlights, t]);
    setNewHighlight('');
  };
  const label = (s: DeductionSetupItem) => `${s.code ? `${s.code} · ` : ''}${s.name_en}${s.is_active ? '' : ' (inactive)'}`;

  async function save(publish?: boolean) {
    if (!state) return;
    setError('');
    setSaved('');
    setSaving(true);
    try {
      const payload = toPayload(publish === undefined ? state : { ...state, is_published: publish });
      const r = await apiFetch<{ data: DeductionEntryDetail }>(isNew ? '/deductions' : `/deductions/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      setState(fromDetail(r.data));
      setSaved(r.data.is_published ? 'Saved and published.' : 'Saved as draft.');
      if (isNew) router.replace(`/admin/deductions/${r.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={isNew ? 'New deduction entry' : 'Edit deduction entry'}
        description="Deductions applied to a bill under an economic code."
        backHref="/admin/deductions"
        backLabel="Deduction entries"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/deductions/setup">
              <Settings2 className="h-4 w-4" /> Setup
            </Link>
          </Button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">{saved}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Economic code & bill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="de-eco">Economic code *</Label>
              <select id="de-eco" className={selectClass} value={state.economic_code_id} onChange={(e) => set('economic_code_id', e.target.value)}>
                <option value="">Select economic code</option>
                {options.eco.map((s) => (
                  <option key={s.id} value={s.id}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="de-bill">Type of bill *</Label>
              <select id="de-bill" className={selectClass} value={state.bill_type_id} onChange={(e) => set('bill_type_id', e.target.value)}>
                <option value="">Select type of bill</option>
                {options.bill.map((s) => (
                  <option key={s.id} value={s.id}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="de-title">Title (optional)</Label>
            <Input id="de-title" value={state.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Supply of goods above Tk 2 lakh" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="de-details">Details (optional)</Label>
            <textarea id="de-details" rows={5} className={textareaClass} value={state.details} onChange={(e) => set('details', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deductions *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.deductions.map((l, idx) => (
            <div key={l.key} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-4">
                <Label className="text-xs">Deduction type</Label>
                <select className={selectClass} value={l.deduction_type_id} onChange={(e) => setLine(l.key, { deduction_type_id: e.target.value })}>
                  <option value="">Select type</option>
                  {options.ded.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id !== l.deduction_type_id && state.deductions.some((x) => x.deduction_type_id === s.id)}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">Amount as</Label>
                <select className={selectClass} value={l.mode} onChange={(e) => setLine(l.key, { mode: e.target.value as DeductionAmountMode })}>
                  {DEDUCTION_AMOUNT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {DEDUCTION_AMOUNT_MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-4">
                <Label className="text-xs">{l.mode === 'percent' ? 'Rate (%)' : l.mode === 'fixed' ? 'Amount (Tk)' : 'Deduction text'}</Label>
                {l.mode === 'text' ? (
                  <Input value={l.text} onChange={(e) => setLine(l.key, { text: e.target.value })} placeholder="e.g. 3% up to 5 lakh, 5% above" />
                ) : (
                  <Input type="number" min={0} step="any" value={l.value} onChange={(e) => setLine(l.key, { value: e.target.value })} />
                )}
              </div>
              <div className="flex items-end justify-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={state.deductions.length === 1}
                  onClick={() => set('deductions', state.deductions.filter((x) => x.key !== l.key))}
                  aria-label={`Remove deduction ${idx + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1 md:col-span-12">
                <Input value={l.note} onChange={(e) => setLine(l.key, { note: e.target.value })} placeholder="Note / condition (optional), e.g. on total bill excluding VAT" className="text-xs" />
              </div>
              {(l.mode === 'text' ? l.text : l.value) ? <p className="text-xs text-muted md:col-span-12">Shown to users as: {formatDeductionAmount({ mode: l.mode, value: Number(l.value), text: l.text })}</p> : null}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={state.deductions.length >= 20} onClick={() => set('deductions', [...state.deductions, newLine()])}>
            <Plus className="h-4 w-4" /> Add deduction
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Highlights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted">Short key points shown with a tick, like the features on a pricing plan. Up to 12.</p>
          {state.highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <Input value={h} onChange={(e) => set('highlights', state.highlights.map((x, j) => (j === i ? e.target.value : x)))} className="h-9" />
              <Button type="button" variant="ghost" size="sm" onClick={() => moveHighlight(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => moveHighlight(i, 1)} disabled={i === state.highlights.length - 1} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => set('highlights', state.highlights.filter((_, j) => j !== i))} aria-label="Remove">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newHighlight}
              onChange={(e) => setNewHighlight(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addHighlight();
                }
              }}
              disabled={state.highlights.length >= 12}
              placeholder="e.g. VAT is deducted at source before payment"
              className="h-9"
            />
            <Button type="button" variant="outline" size="sm" onClick={addHighlight} disabled={!newHighlight.trim() || state.highlights.length >= 12}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source, process & circulars</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="de-source">Source</Label>
            <Input id="de-source" value={state.source} onChange={(e) => set('source', e.target.value)} placeholder="e.g. VAT & SD Act 2012, Finance Act 2025, Income Tax Act 2023 s.89" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Tag a process</p>
            <ProcessPicker value={state.processes} onChange={(processes) => set('processes', processes)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Link circulars</p>
            <RefPicker max={10} types={['circular']} value={state.circulars} onChange={(circulars) => set('circulars', circulars)} />
          </div>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:pl-72">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-sm text-muted">{state.is_published ? 'Currently published' : 'Draft — hidden from users'}</span>
          <Button variant="outline" disabled={saving} onClick={() => void save()}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          {state.is_published ? (
            <Button variant="outline" disabled={saving} onClick={() => void save(false)}>
              Unpublish
            </Button>
          ) : (
            <Button disabled={saving} onClick={() => void save(true)}>
              Save & publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
