'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardCheck, ListPlus, Plus, Search, StickyNote, Trash2, X } from 'lucide-react';
import {
  CIRCULAR_DOC_TYPES,
  CIRCULAR_ISSUERS,
  POLICY_COLLECTIONS,
  type CircularDocType,
  type CircularIssuerCode,
  type PolicyCollectionCode,
} from '@ibas/shared-constants';
import type {
  CircularChecklistItem,
  CircularFieldSuggestions,
  CircularRecord,
  ToolkitItemSummary,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { AreaCheckboxes } from '@/components/ibas/area-checkboxes';
import { TagInput } from './tag-input';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const textareaClass = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

type Ref = { id: string; circular_no: string; title: string };
type KitRef = { id: string; title: string };

export interface CircularFormState {
  doc_type: CircularDocType;
  circular_no: string;
  issue_date: string;
  effective_date: string;
  issuer: CircularIssuerCode;
  ministry: string;
  department: string;
  issuer_detail: string;
  order_by: string;
  order_by_designation: string;
  title: string;
  title_bn: string;
  summary: string;
  full_text: string;
  collections: PolicyCollectionCode[];
  areas: string[];
  tags: string[];
  attachment_url: string;
  source_url: string;
  supersedes: Ref[];
  checklist: CircularChecklistItem[];
  note: string;
  toolkit: KitRef[];
  is_published: boolean;
}

export const EMPTY_CIRCULAR_FORM: CircularFormState = {
  doc_type: 'circular',
  circular_no: '',
  issue_date: '',
  effective_date: '',
  issuer: 'FINANCE_DIVISION',
  ministry: '',
  department: '',
  issuer_detail: '',
  order_by: '',
  order_by_designation: '',
  title: '',
  title_bn: '',
  summary: '',
  full_text: '',
  collections: [],
  areas: [],
  tags: [],
  attachment_url: '',
  source_url: '',
  supersedes: [],
  checklist: [],
  note: '',
  toolkit: [],
  is_published: false,
};

export function circularToForm(c: CircularRecord): CircularFormState {
  return {
    doc_type: c.doc_type,
    circular_no: c.circular_no,
    issue_date: c.issue_date,
    effective_date: c.effective_date ?? '',
    issuer: c.issuer,
    ministry: c.ministry ?? '',
    department: c.department ?? '',
    issuer_detail: c.issuer_detail ?? '',
    order_by: c.order_by ?? '',
    order_by_designation: c.order_by_designation ?? '',
    title: c.title,
    title_bn: c.title_bn ?? '',
    summary: c.summary ?? '',
    full_text: c.full_text ?? '',
    collections: c.collections,
    areas: c.areas,
    tags: c.tags,
    attachment_url: c.attachment_url ?? '',
    source_url: c.source_url ?? '',
    supersedes: c.supersedes,
    checklist: c.checklist ?? [],
    note: c.note ?? '',
    toolkit: (c.toolkit ?? []).map((k) => ({ id: k.id, title: k.title })),
    is_published: c.is_published,
  };
}

const newId = () => Math.random().toString(36).slice(2, 10);

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function SuggestInput({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <>
      <Input id={id} list={`${id}-list`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} />
      <datalist id={`${id}-list`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

function ChecklistEditor({ items, onChange }: { items: CircularChecklistItem[]; onChange: (next: CircularChecklistItem[]) => void }) {
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const update = (idx: number, patch: Partial<CircularChecklistItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    onChange(next);
  };

  function addBulk() {
    const added = bulk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const optional = /\(optional\)\s*$/i.test(line);
        return {
          id: newId(),
          text: line.replace(/^[-*•\d.)\s]+/, '').replace(/\(optional\)\s*$/i, '').trim(),
          required: !optional,
        };
      })
      .filter((i) => i.text);
    if (added.length) onChange([...items, ...added].slice(0, 60));
    setBulk('');
    setShowBulk(false);
  }

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={it.id} className="flex items-start gap-2">
          <span className="pt-2 text-xs font-medium text-muted">{idx + 1}.</span>
          <div className="min-w-0 flex-1 space-y-1">
            <Input value={it.text} onChange={(e) => update(idx, { text: e.target.value })} placeholder="What must be done or checked?" />
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={it.required} onChange={(e) => update(idx, { required: e.target.checked })} />
              Required
            </label>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <Button type="button" size="sm" variant="ghost" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Move up">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={idx === items.length - 1} onClick={() => move(idx, 1)} aria-label="Move down">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      {showBulk && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-2">
          <p className="text-xs text-muted">One item per line. End a line with (optional) for non-required items.</p>
          <textarea rows={5} className={textareaClass} value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <Button type="button" size="sm" onClick={addBulk} disabled={!bulk.trim()}>
            Add items
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={items.length >= 60}
          onClick={() => onChange([...items, { id: newId(), text: '', required: true }])}
        >
          <Plus className="h-4 w-4" /> Item
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowBulk((v) => !v)}>
          <ListPlus className="h-4 w-4" /> Paste many
        </Button>
      </div>
    </div>
  );
}

function ToolkitPicker({ value, onChange }: { value: KitRef[]; onChange: (next: KitRef[]) => void }) {
  const [all, setAll] = useState<ToolkitItemSummary[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    apiFetch<{ data: ToolkitItemSummary[] }>('/toolkit?include_unpublished=true&kind=checklist')
      .then((r) => setAll(r.data))
      .catch(() => setAll([]));
  }, []);

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!all || term.length < 1) return [];
    return all
      .filter((k) => !value.some((v) => v.id === k.id))
      .filter((k) => [k.title, k.title_bn, ...k.tags].some((t) => t?.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [all, q, value]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((k) => (
            <span key={k.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
              <ClipboardCheck className="h-3 w-3" /> {k.title}
              <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((x) => x.id !== k.id))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={all && all.length === 0 ? 'No Toolkit checklists yet' : 'Find a Toolkit checklist by title or tag…'}
          className="pl-9"
          disabled={value.length >= 10}
        />
      </div>
      {hits.length > 0 && (
        <div className="space-y-1">
          {hits.map((k) => (
            <button
              key={k.id}
              type="button"
              className="block w-full rounded-md border border-border px-3 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                onChange([...value, { id: k.id, title: k.title }]);
                setQ('');
              }}
            >
              {k.title}
              {!k.is_published && <span className="ml-1 text-xs text-muted">(draft)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Create / edit a circular or government order. Used by Book admin and Circular Archive admin. */
export function CircularForm({
  editingId,
  initial,
  onDone,
  onCancel,
  title,
}: {
  editingId: string | null;
  initial: CircularFormState;
  onDone: (saved: CircularRecord) => void;
  onCancel: () => void;
  title?: string;
}) {
  const [f, setF] = useState<CircularFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickQ, setPickQ] = useState('');
  const [pickHits, setPickHits] = useState<CircularRecord[]>([]);
  const [suggest, setSuggest] = useState<CircularFieldSuggestions | null>(null);
  const [showChecklist, setShowChecklist] = useState(initial.checklist.length > 0 || initial.toolkit.length > 0);
  const [showNote, setShowNote] = useState(!!initial.note);

  useEffect(() => {
    setF(initial);
    setShowChecklist(initial.checklist.length > 0 || initial.toolkit.length > 0);
    setShowNote(!!initial.note);
  }, [initial]);

  useEffect(() => {
    apiFetch<{ data: CircularFieldSuggestions }>('/circulars/field-suggestions')
      .then((r) => setSuggest(r.data))
      .catch(() => setSuggest(null));
  }, []);

  useEffect(() => {
    const term = pickQ.trim();
    if (term.length < 2) {
      setPickHits([]);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<{ data: CircularRecord[] }>(`/circulars?include_unpublished=true&limit=8&q=${encodeURIComponent(term)}`)
        .then((r) => setPickHits(r.data.filter((c) => c.id !== editingId && !f.supersedes.some((s) => s.id === c.id))))
        .catch(() => setPickHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [pickQ, editingId, f.supersedes]);

  const set = <K extends keyof CircularFormState>(key: K, value: CircularFormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setError('');
    if (!f.circular_no.trim() || !f.title.trim() || !f.issue_date) {
      setError('Order / memo no., title and date are required.');
      return;
    }
    const body = {
      doc_type: f.doc_type,
      circular_no: f.circular_no.trim(),
      issue_date: f.issue_date,
      effective_date: f.effective_date,
      issuer: f.issuer,
      ministry: f.ministry.trim(),
      department: f.department.trim(),
      issuer_detail: f.issuer_detail.trim(),
      order_by: f.order_by.trim(),
      order_by_designation: f.order_by_designation.trim(),
      title: f.title.trim(),
      title_bn: f.title_bn.trim(),
      summary: f.summary,
      full_text: f.full_text,
      collections: f.collections,
      areas: f.areas,
      tags: f.tags,
      attachment_url: f.attachment_url.trim(),
      source_url: f.source_url.trim(),
      supersedes_ids: f.supersedes.map((s) => s.id),
      checklist: f.checklist.filter((c) => c.text.trim()).map((c) => ({ ...c, text: c.text.trim() })),
      note: f.note,
      toolkit_ids: f.toolkit.map((k) => k.id),
      is_published: f.is_published,
    };
    setSaving(true);
    try {
      const r = await apiFetch<{ data: CircularRecord }>(editingId ? `/circulars/${editingId}` : '/circulars', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onDone(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title ?? (editingId ? 'Edit circular / order' : 'New circular / order')}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" /> Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Order details</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-type">Document type *</Label>
              <select id="c-type" className={selectClass} value={f.doc_type} onChange={(e) => set('doc_type', e.target.value as CircularDocType)}>
                {CIRCULAR_DOC_TYPES.map((d) => (
                  <option key={d.code} value={d.code}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-no">Order / memo no. *</Label>
              <Input id="c-no" value={f.circular_no} onChange={(e) => set('circular_no', e.target.value)} placeholder="e.g. 07.00.0000.111.22.001.25-45" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-issue">Order date *</Label>
              <Input id="c-issue" type="date" value={f.issue_date} onChange={(e) => set('issue_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-eff">Effective from</Label>
              <Input id="c-eff" type="date" value={f.effective_date} onChange={(e) => set('effective_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-issuer">Issued by (category) *</Label>
              <select id="c-issuer" className={selectClass} value={f.issuer} onChange={(e) => set('issuer', e.target.value as CircularIssuerCode)}>
                {CIRCULAR_ISSUERS.map((i) => (
                  <option key={i.code} value={i.code}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 lg:col-span-3">
              <Label htmlFor="c-ministry">Ministry / division</Label>
              <SuggestInput
                id="c-ministry"
                value={f.ministry}
                onChange={(v) => set('ministry', v)}
                options={suggest?.ministry ?? []}
                placeholder="e.g. Ministry of Finance, Finance Division"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-dept">Publishing department / office</Label>
              <SuggestInput
                id="c-dept"
                value={f.department}
                onChange={(v) => set('department', v)}
                options={suggest?.department ?? []}
                placeholder="e.g. Office of the Controller General of Accounts"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-wing">Wing / branch / section</Label>
              <SuggestInput
                id="c-wing"
                value={f.issuer_detail}
                onChange={(v) => set('issuer_detail', v)}
                options={suggest?.issuer_detail ?? []}
                placeholder="e.g. Budget-1 Branch"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-by">Order by (signed by)</Label>
              <SuggestInput
                id="c-by"
                value={f.order_by}
                onChange={(v) => set('order_by', v)}
                options={suggest?.order_by ?? []}
                placeholder="Name of the signing officer"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-by-desig">Designation</Label>
              <SuggestInput
                id="c-by-desig"
                value={f.order_by_designation}
                onChange={(v) => set('order_by_designation', v)}
                options={suggest?.order_by_designation ?? []}
                placeholder="e.g. Deputy Secretary"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Subject &amp; text</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-title">Subject / title (English) *</Label>
              <Input id="c-title" value={f.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-title-bn">Subject / title (Bangla)</Label>
              <Input id="c-title-bn" value={f.title_bn} onChange={(e) => set('title_bn', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-att">Document link (PDF)</Label>
              <Input id="c-att" value={f.attachment_url} onChange={(e) => set('attachment_url', e.target.value)} placeholder="https://… or /files/…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-src">Official source page</Label>
              <Input id="c-src" value={f.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://mof.gov.bd/…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-summary">Summary</Label>
            <textarea id="c-summary" rows={3} className={textareaClass} value={f.summary} onChange={(e) => set('summary', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-full">Full text (plain text or HTML)</Label>
            <textarea id="c-full" rows={8} className={`${textareaClass} font-mono`} value={f.full_text} onChange={(e) => set('full_text', e.target.value)} />
          </div>
        </section>

        <section className="space-y-1.5">
          <Label>Tags</Label>
          <TagInput value={f.tags} onChange={(tags) => set('tags', tags)} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">iBAS++ areas (shows in the area drawer)</legend>
            <AreaCheckboxes value={f.areas} onChange={(next) => set('areas', next)} />
          </fieldset>
          <fieldset className="space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">Policy collections</legend>
            {POLICY_COLLECTIONS.map((c) => (
              <label key={c.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.collections.includes(c.code)} onChange={() => set('collections', toggle(f.collections, c.code))} />
                {c.name_en}
              </label>
            ))}
          </fieldset>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">This order replaces (supersedes)</p>
          {f.supersedes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {f.supersedes.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                  <span className="font-mono">{s.circular_no}</span>
                  <button type="button" aria-label="Remove" onClick={() => set('supersedes', f.supersedes.filter((x) => x.id !== s.id))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Find an older circular by number or title…" className="pl-9" />
          </div>
          {pickHits.length > 0 && (
            <div className="space-y-1">
              {pickHits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="block w-full rounded-md border border-border px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    set('supersedes', [...f.supersedes, { id: c.id, circular_no: c.circular_no, title: c.title }]);
                    setPickQ('');
                  }}
                >
                  <span className="font-mono text-xs text-muted">{c.circular_no}</span> {c.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Optional extras</p>
            <div className="flex flex-wrap gap-2">
              {!showChecklist && (
                <Button type="button" size="sm" variant="outline" onClick={() => setShowChecklist(true)}>
                  <ClipboardCheck className="h-4 w-4" /> Add checklist
                </Button>
              )}
              {!showNote && (
                <Button type="button" size="sm" variant="outline" onClick={() => setShowNote(true)}>
                  <StickyNote className="h-4 w-4" /> Add note
                </Button>
              )}
            </div>
          </div>
          {!showChecklist && !showNote && (
            <p className="text-xs text-muted">Add a compliance checklist or an explanatory note for users acting on this order.</p>
          )}
          {showChecklist && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Checklist ({f.checklist.length})</p>
                {f.checklist.length === 0 && f.toolkit.length === 0 && (
                  <button type="button" className="text-xs text-muted hover:underline" onClick={() => setShowChecklist(false)}>
                    Remove
                  </button>
                )}
              </div>
              <ChecklistEditor items={f.checklist} onChange={(checklist) => set('checklist', checklist)} />
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Related Toolkit checklists</p>
                <ToolkitPicker value={f.toolkit} onChange={(toolkit) => set('toolkit', toolkit)} />
              </div>
            </div>
          )}
          {showNote && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="c-note">Note</Label>
                {!f.note.trim() && (
                  <button type="button" className="text-xs text-muted hover:underline" onClick={() => setShowNote(false)}>
                    Remove
                  </button>
                )}
              </div>
              <textarea
                id="c-note"
                rows={4}
                className={textareaClass}
                value={f.note}
                onChange={(e) => set('note', e.target.value)}
                placeholder="How to apply this order, common mistakes, related practice…"
              />
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={f.is_published} onChange={(e) => set('is_published', e.target.checked)} />
            Published (visible to users)
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save circular'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
