'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ListPlus, Plus, Trash2 } from 'lucide-react';
import {
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_RESERVED_KEYS,
  renderToolkitTemplate,
  templatePlaceholders,
  type TemplateField,
  type TemplateFieldType,
  type ToolkitAttachment,
} from '@ibas/shared-types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { RefPicker, type EditorRef } from './ref-picker';
import { AttachmentsEditor } from './attachments-editor';
import { TEMPLATE_PREVIEW_CLASS } from './template-filler';

export interface EditorChecklistItem {
  id: string;
  section: string;
  text: string;
  help: string;
  required: boolean;
  refs: EditorRef[];
  attachments: ToolkitAttachment[];
}

export interface EditorSection {
  id: string;
  heading: string;
  body: string;
  refs: EditorRef[];
}

export const newId = () => Math.random().toString(36).slice(2, 10);

const textareaClass = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function move<T>(list: T[], idx: number, dir: -1 | 1): T[] {
  const j = idx + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[idx], next[j]] = [next[j]!, next[idx]!];
  return next;
}

function RowControls({
  idx,
  length,
  onMove,
  onRemove,
}: {
  idx: number;
  length: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <Button type="button" size="sm" variant="ghost" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="Move up">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={idx === length - 1} onClick={() => onMove(1)} aria-label="Move down">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onRemove} aria-label="Remove">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ---------------------------------- checklist ---------------------------------- */

export function ChecklistEditor({ items, onChange }: { items: EditorChecklistItem[]; onChange: (items: EditorChecklistItem[]) => void }) {
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(items.length === 0);
  const [openHelp, setOpenHelp] = useState<Set<string>>(new Set());

  const update = (idx: number, patch: Partial<EditorChecklistItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  function addBulk() {
    let section = items[items.length - 1]?.section ?? '';
    const added: EditorChecklistItem[] = [];
    for (const raw of bulk.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#')) {
        section = line.replace(/^#+\s*/, '');
        continue;
      }
      const optional = /\(optional\)\s*$/i.test(line);
      added.push({
        id: newId(),
        section,
        text: line.replace(/^[-*•\d.)\s]+/, '').replace(/\(optional\)\s*$/i, '').trim(),
        help: '',
        required: !optional,
        refs: [],
        attachments: [],
      });
    }
    if (added.length) onChange([...items, ...added]);
    setBulk('');
    setShowBulk(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Checklist items ({items.length})</CardTitle>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setShowBulk((v) => !v)}>
            <ListPlus className="h-4 w-4" /> Paste many
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onChange([
                ...items,
                { id: newId(), section: items[items.length - 1]?.section ?? '', text: '', help: '', required: true, refs: [], attachments: [] },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Item
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showBulk && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted">
              One item per line. Start a line with <code>#</code> to begin a new section (e.g. <code># Sanction &amp; budget</code>). End a line
              with <code>(optional)</code> for non-required items.
            </p>
            <textarea rows={6} className={textareaClass} value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <Button type="button" size="sm" onClick={addBulk} disabled={!bulk.trim()}>
              Add items
            </Button>
          </div>
        )}
        {items.map((it, idx) => (
          <div key={it.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-start gap-2">
              <span className="pt-2 text-xs font-medium text-muted">{idx + 1}.</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={it.section}
                    onChange={(e) => update(idx, { section: e.target.value })}
                    placeholder="Section (optional)"
                    className="h-8 max-w-[220px] text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={it.required} onChange={(e) => update(idx, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
                <textarea
                  rows={2}
                  className={textareaClass}
                  value={it.text}
                  onChange={(e) => update(idx, { text: e.target.value })}
                  placeholder="What must be checked?"
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  onClick={() =>
                    setOpenHelp((s) => {
                      const n = new Set(s);
                      if (n.has(it.id)) n.delete(it.id);
                      else n.add(it.id);
                      return n;
                    })
                  }
                >
                  <ChevronDown className={cn('h-3 w-3', openHelp.has(it.id) && 'rotate-180')} />
                  {it.help ? 'Edit guidance' : 'Add “how to check” guidance'}
                </button>
                {openHelp.has(it.id) && (
                  <textarea rows={3} className={textareaClass} value={it.help} onChange={(e) => update(idx, { help: e.target.value })} />
                )}
                <RefPicker compact max={5} value={it.refs} onChange={(refs) => update(idx, { refs })} />
                <AttachmentsEditor
                  compact
                  max={10}
                  value={it.attachments}
                  onChange={(attachments) => update(idx, { attachments })}
                />
              </div>
              <RowControls
                idx={idx}
                length={items.length}
                onMove={(d) => onChange(move(items, idx, d))}
                onRemove={() => onChange(items.filter((_, i) => i !== idx))}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------- template ---------------------------------- */

function slugKey(label: string) {
  const k = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'f_$1')
    .slice(0, 40);
  return k || '';
}

function FieldsEditor({
  title,
  fields,
  onChange,
  onInsert,
}: {
  title: string;
  fields: TemplateField[];
  onChange: (f: TemplateField[]) => void;
  onInsert?: (key: string) => void;
}) {
  const update = (idx: number, patch: Partial<TemplateField>) => onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...fields, { key: '', label: '', type: 'text', required: false }])}
        >
          <Plus className="h-4 w-4" /> Field
        </Button>
      </div>
      {fields.length === 0 && <p className="text-xs text-muted">No fields.</p>}
      {fields.map((f, idx) => (
        <div key={idx} className="flex flex-wrap items-start gap-2 rounded-md border border-border p-2">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-4">
            <Input
              value={f.label}
              onChange={(e) => {
                const label = e.target.value;
                const autoKey = !f.key || f.key === slugKey(f.label);
                update(idx, { label, ...(autoKey ? { key: slugKey(label) } : {}) });
              }}
              placeholder="Label (e.g. Para no.)"
              className="h-8 text-xs sm:col-span-2"
            />
            <Input
              value={f.key}
              onChange={(e) => update(idx, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="key"
              className="h-8 font-mono text-xs"
            />
            <select
              value={f.type}
              onChange={(e) => update(idx, { type: e.target.value as TemplateFieldType })}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {TEMPLATE_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'textarea' ? 'long text' : t}</option>
              ))}
            </select>
            <Input
              value={f.placeholder ?? ''}
              onChange={(e) => update(idx, { placeholder: e.target.value })}
              placeholder="Hint inside the box (optional)"
              className="h-8 text-xs sm:col-span-2"
            />
            <Input
              value={f.help ?? ''}
              onChange={(e) => update(idx, { help: e.target.value })}
              placeholder="Help under the box (optional)"
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={f.required} onChange={(e) => update(idx, { required: e.target.checked })} />
                Required
              </label>
              {onInsert && f.key && (
                <button type="button" className="font-mono text-xs text-primary hover:underline" onClick={() => onInsert(f.key)}>
                  {`{{${f.key}}}`}
                </button>
              )}
            </div>
          </div>
          <RowControls
            idx={idx}
            length={fields.length}
            onMove={(d) => onChange(move(fields, idx, d))}
            onRemove={() => onChange(fields.filter((_, i) => i !== idx))}
          />
        </div>
      ))}
    </div>
  );
}

export interface TemplateEditorValue {
  fields: TemplateField[];
  row_label: string;
  row_fields: TemplateField[];
  row_template: string;
  body: string;
}

const BROADSHEET_LAYOUT: TemplateEditorValue = {
  fields: [
    { key: 'office_name', label: 'Office name', type: 'text', required: true },
    { key: 'audit_year', label: 'Audit year', type: 'text', required: true },
    { key: 'memo_no', label: 'Memo no.', type: 'text', required: false },
    { key: 'memo_date', label: 'Memo date', type: 'date', required: false },
  ],
  row_label: 'Para',
  row_fields: [
    { key: 'para_no', label: 'Para no.', type: 'text', required: true },
    { key: 'objection', label: 'Objection (summary)', type: 'textarea', required: true },
    { key: 'reply', label: 'Reply', type: 'textarea', required: true },
    { key: 'documents', label: 'Supporting documents', type: 'textarea', required: false },
  ],
  row_template: '<tr>\n  <td>{{row_no}}</td>\n  <td>{{para_no}}</td>\n  <td>{{objection}}</td>\n  <td>{{reply}}</td>\n  <td>{{documents}}</td>\n</tr>',
  body:
    '<p style="text-align:center"><strong>{{office_name}}</strong></p>\n<p>Memo no: {{memo_no}} &nbsp;&nbsp; Date: {{memo_date}}</p>\n<p><strong>Broadsheet reply — Audit year {{audit_year}}</strong></p>\n<table>\n  <tr><th>Sl.</th><th>Para no.</th><th>Objection</th><th>Reply</th><th>Documents</th></tr>\n  {{rows}}\n</table>',
};

export function TemplateEditor({
  value,
  onChange,
  category,
}: {
  value: TemplateEditorValue;
  onChange: (v: TemplateEditorValue) => void;
  category: string;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocus, setLastFocus] = useState<'body' | 'row'>('body');

  function insert(key: string) {
    const target = lastFocus === 'row' && value.row_fields.length > 0 ? 'row' : 'body';
    const el = target === 'row' ? rowRef.current : bodyRef.current;
    const token = `{{${key}}}`;
    const current = target === 'row' ? value.row_template : value.body;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    onChange(target === 'row' ? { ...value, row_template: next } : { ...value, body: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const known = new Set([...value.fields.map((f) => f.key), ...TEMPLATE_RESERVED_KEYS]);
  const rowKnown = new Set([...known, ...value.row_fields.map((f) => f.key)]);
  const unknownBody = templatePlaceholders(value.body).filter((k) => !known.has(k));
  const unknownRow = templatePlaceholders(value.row_template).filter((k) => !rowKnown.has(k));
  const rowsMissing = value.row_fields.length > 0 && !templatePlaceholders(value.body).includes('rows');

  const preview = useMemo(
    () =>
      renderToolkitTemplate({
        body: value.body,
        row_template: value.row_template,
        fields: value.fields,
        row_fields: value.row_fields,
        values: {},
        rows: value.row_fields.length ? [{}, {}] : [],
        missing: 'mark',
      }),
    [value],
  );

  const empty = !value.body.trim() && value.fields.length === 0 && value.row_fields.length === 0;

  return (
    <div className="space-y-4">
      {empty && category === 'broadsheet_reply' && (
        <Alert variant="info">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Start from a blank broadsheet layout (header fields + one table row per audit para). You can change everything.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => onChange(BROADSHEET_LAYOUT)}>
              Use layout
            </Button>
          </div>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fields users fill in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FieldsEditor title="Single fields (appear once)" fields={value.fields} onChange={(fields) => onChange({ ...value, fields })} onInsert={insert} />
          <div className="space-y-3 rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="row-label" className="text-xs">Repeating row name</Label>
                <Input
                  id="row-label"
                  value={value.row_label}
                  onChange={(e) => onChange({ ...value, row_label: e.target.value })}
                  placeholder="e.g. Para, Bill, Item"
                  className="h-8 w-48 text-xs"
                />
              </div>
              <p className="text-xs text-muted">
                Optional. Users can add as many rows as needed (e.g. one per audit para). Put <code>{'{{rows}}'}</code> in the body where rows go.
              </p>
            </div>
            <FieldsEditor
              title="Row fields (repeat per row)"
              fields={value.row_fields}
              onChange={(row_fields) => onChange({ ...value, row_fields })}
              onInsert={insert}
            />
            {value.row_fields.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="row-tpl" className="text-xs">
                  Row template (HTML for one row — <code>{'{{row_no}}'}</code> gives 1, 2, 3…)
                </Label>
                <textarea
                  id="row-tpl"
                  ref={rowRef}
                  rows={5}
                  onFocus={() => setLastFocus('row')}
                  className={`${textareaClass} font-mono text-xs`}
                  value={value.row_template}
                  onChange={(e) => onChange({ ...value, row_template: e.target.value })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document body</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {[...value.fields.map((f) => f.key).filter(Boolean), ...(value.row_fields.length ? ['rows', 'row_count'] : []), 'today'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => insert(k)}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary-muted"
                >
                  {`{{${k}}}`}
                </button>
              ))}
            </div>
            <textarea
              ref={bodyRef}
              rows={16}
              onFocus={() => setLastFocus('body')}
              className={`${textareaClass} font-mono text-xs`}
              value={value.body}
              onChange={(e) => onChange({ ...value, body: e.target.value })}
              placeholder="HTML or plain text. Click a chip above to insert a placeholder at the cursor."
            />
            {(unknownBody.length > 0 || unknownRow.length > 0) && (
              <p className="text-xs text-amber-700">
                Unknown placeholders: {[...unknownBody, ...unknownRow].map((k) => `{{${k}}}`).join(', ')} — they will show as blanks.
              </p>
            )}
            {rowsMissing && <p className="text-xs text-amber-700">Row fields are defined but the body has no {'{{rows}}'} placeholder.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview (2 sample rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`${TEMPLATE_PREVIEW_CLASS} min-h-[200px] rounded-md border border-border bg-white p-4`} dangerouslySetInnerHTML={{ __html: preview }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------- guide ---------------------------------- */

export function GuideEditor({ sections, onChange }: { sections: EditorSection[]; onChange: (s: EditorSection[]) => void }) {
  const update = (idx: number, patch: Partial<EditorSection>) => onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Sections ({sections.length})</CardTitle>
        <Button type="button" size="sm" onClick={() => onChange([...sections, { id: newId(), heading: '', body: '', refs: [] }])}>
          <Plus className="h-4 w-4" /> Section
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((s, idx) => (
          <div key={s.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-white">{idx + 1}</span>
            <div className="min-w-0 flex-1 space-y-2">
              <Input value={s.heading} onChange={(e) => update(idx, { heading: e.target.value })} placeholder="Step / section heading" />
              <textarea
                rows={8}
                className={`${textareaClass} font-mono text-xs`}
                value={s.body}
                onChange={(e) => update(idx, { body: e.target.value })}
                placeholder="Explanation (plain text or HTML — tables, lists and bold text are supported)"
              />
              <RefPicker compact max={10} value={s.refs} onChange={(refs) => update(idx, { refs })} />
            </div>
            <RowControls
              idx={idx}
              length={sections.length}
              onMove={(d) => onChange(move(sections, idx, d))}
              onRemove={() => onChange(sections.filter((_, i) => i !== idx))}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
