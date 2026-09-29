'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, CopyPlus, FileDown, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { renderToolkitTemplate, type TemplateField, type ToolkitItemDetail } from '@ibas/shared-types';
import { copyRichText, downloadWordDocument, printHtml } from '@/lib/toolkit-export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface Draft {
  values: Record<string, string>;
  rows: Array<Record<string, string>>;
}

export const TEMPLATE_PREVIEW_CLASS =
  'text-sm leading-relaxed text-foreground [&_p]:mb-2 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-400 [&_td]:p-1.5 [&_td]:align-top [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-50 [&_th]:p-1.5 [&_th]:text-left [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5';

export function FieldInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
  idPrefix: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {field.type === 'textarea' ? (
        <textarea
          id={id}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      ) : (
        <Input
          id={id}
          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}
      {field.help && <p className="text-xs text-muted">{field.help}</p>}
    </div>
  );
}

export function TemplateFiller({ item }: { item: ToolkitItemDetail }) {
  const fields = useMemo(() => item.fields ?? [], [item.fields]);
  const rowFields = useMemo(() => item.row_fields ?? [], [item.row_fields]);
  const hasRows = rowFields.length > 0;
  const rowLabel = item.row_label || 'Row';
  const storageKey = `toolkit:template:${item.id}`;
  const blankDraft = useMemo<Draft>(() => ({ values: {}, rows: hasRows ? [{}] : [] }), [hasRows]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [loaded, setLoaded] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDraft({ ...blankDraft, ...(JSON.parse(raw) as Draft) });
    } catch {
      /* ignore corrupt local data */
    }
    setLoaded(true);
  }, [storageKey, blankDraft]);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, loaded, storageKey]);

  const render = (missing: 'mark' | 'blank') =>
    renderToolkitTemplate({
      body: item.body ?? '',
      row_template: item.row_template,
      fields,
      row_fields: rowFields,
      values: draft.values,
      rows: draft.rows,
      missing,
    });
  const preview = render('mark');

  const missingRequired = [
    ...fields.filter((f) => f.required && !draft.values[f.key]?.trim()).map((f) => f.label),
    ...draft.rows.flatMap((row, i) =>
      rowFields.filter((f) => f.required && !row[f.key]?.trim()).map((f) => `${rowLabel} ${i + 1}: ${f.label}`),
    ),
  ];

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  }

  function updateRow(idx: number, key: string, value: string) {
    setDraft((d) => ({ ...d, rows: d.rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)) }));
  }

  function moveRow(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const rows = [...d.rows];
      const j = idx + dir;
      if (j < 0 || j >= rows.length) return d;
      [rows[idx], rows[j]] = [rows[j]!, rows[idx]!];
      return { ...d, rows };
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4">
        {fields.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                  <FieldInput
                    field={f}
                    idPrefix="tf"
                    value={draft.values[f.key] ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, values: { ...d.values, [f.key]: v } }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hasRows && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">
                {rowLabel}s ({draft.rows.length})
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, rows: [...d.rows, {}] }))}>
                <Plus className="h-4 w-4" /> Add {rowLabel.toLowerCase()}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.rows.length === 0 && <p className="text-sm text-muted">No {rowLabel.toLowerCase()}s yet.</p>}
              {draft.rows.map((row, idx) => (
                <div key={idx} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {rowLabel} {idx + 1}
                    </p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" disabled={idx === 0} onClick={() => moveRow(idx, -1)} aria-label="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={idx === draft.rows.length - 1}
                        onClick={() => moveRow(idx, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDraft((d) => ({ ...d, rows: [...d.rows.slice(0, idx + 1), { ...row }, ...d.rows.slice(idx + 1)] }))}
                        aria-label="Duplicate"
                      >
                        <CopyPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDraft((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== idx) }))}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {rowFields.map((f) => (
                      <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
                        <FieldInput field={f} idPrefix={`row${idx}`} value={row[f.key] ?? ''} onChange={(v) => updateRow(idx, f.key, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              downloadWordDocument(item.title, render('blank'));
              notify('Word file downloaded.');
            }}
          >
            <FileDown className="h-4 w-4" /> Download Word
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void copyRichText(render('blank'))
                .then(() => notify('Copied — paste into Word or your e-Nothi draft.'))
                .catch(() => notify('Copy failed — use Download Word instead.'))
            }
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!printHtml(item.title, render('blank'))) notify('Allow pop-ups to print.');
            }}
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Clear everything you typed in this template?')) setDraft(blankDraft);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
        {flash && <Alert variant="success">{flash}</Alert>}
        {missingRequired.length > 0 && (
          <p className="text-xs text-amber-700">Still empty: {missingRequired.slice(0, 6).join(', ')}{missingRequired.length > 6 ? '…' : ''}</p>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`${TEMPLATE_PREVIEW_CLASS} max-h-[75vh] overflow-auto rounded-md border border-border bg-white p-5`} dangerouslySetInnerHTML={{ __html: preview }} />
            <p className="mt-2 text-xs text-muted">Highlighted brackets are blanks you haven&apos;t filled. Your entries are saved on this device only.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
