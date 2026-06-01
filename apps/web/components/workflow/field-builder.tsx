'use client';

import { useState } from 'react';
import { WORKFLOW_FIELD_TYPES } from '@ibas/shared-constants';
import type { WorkflowField } from '@ibas/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { X } from 'lucide-react';

export type FieldDraft = WorkflowField;

function slugify(label: string) {
  return label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export function FieldBuilder({
  fields,
  onChange,
}: {
  fields: FieldDraft[];
  onChange: (fields: FieldDraft[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<(typeof WORKFLOW_FIELD_TYPES)[number]>('text');
  const [options, setOptions] = useState('');

  function addField() {
    if (!label.trim()) return;
    const name = slugify(label) || `field_${fields.length + 1}`;
    const base = {
      name,
      label: label.trim(),
      required: true,
      sort_order: fields.length + 1,
    };
    let field: FieldDraft;
    if (type === 'select') {
      const opts = options.split(',').map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) return;
      field = { ...base, type: 'select', options: opts };
    } else {
      field = { ...base, type };
    }
    onChange([...fields, field]);
    setLabel('');
    setOptions('');
    setType('text');
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, sort_order: i + 1 })));
  }

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <ul className="space-y-2">
          {fields.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{f.label}</span>
                <span className="ml-2 text-xs text-muted">({f.type})</span>
              </span>
              <button type="button" onClick={() => removeField(i)} className="text-muted hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Field label">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Fiscal year" />
        </FormField>
        <FormField label="Type">
          <select className="ibas-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {WORKFLOW_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>
        {type === 'select' ? (
          <FormField label="Options (comma-separated)">
            <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Jan,Feb,Mar" />
          </FormField>
        ) : (
          <div className="flex items-end">
            <Button type="button" size="sm" variant="outline" onClick={addField} disabled={!label.trim()}>
              Add field
            </Button>
          </div>
        )}
      </div>
      {type === 'select' && (
        <Button type="button" size="sm" variant="outline" onClick={addField} disabled={!label.trim() || !options.trim()}>
          Add field
        </Button>
      )}
    </div>
  );
}
