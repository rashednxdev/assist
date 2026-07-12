'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ComparisonTable } from '@ibas/shared-types';
import { emptyComparisonTable } from '@ibas/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ComparisonTableEditor({
  value,
  onChange,
  disabled,
}: {
  value: ComparisonTable;
  onChange: (next: ComparisonTable) => void;
  disabled?: boolean;
}) {
  const table = value.columns.length >= 2 ? value : emptyComparisonTable(2);

  function patch(partial: Partial<ComparisonTable>) {
    onChange({ ...table, ...partial });
  }

  function setColumn(index: number, text: string) {
    const columns = table.columns.map((c, i) => (i === index ? text : c));
    patch({ columns });
  }

  function addColumn() {
    if (table.columns.length >= 6) return;
    const columns = [...table.columns, `Item ${table.columns.length + 1}`];
    const rows = table.rows.map((r) => ({ ...r, values: [...r.values, ''] }));
    patch({ columns, rows });
  }

  function removeColumn(index: number) {
    if (table.columns.length <= 2) return;
    const columns = table.columns.filter((_, i) => i !== index);
    const rows = table.rows.map((r) => ({
      ...r,
      values: r.values.filter((_, i) => i !== index),
    }));
    patch({ columns, rows });
  }

  function setRowFeature(rowIndex: number, feature: string) {
    const rows = table.rows.map((r, i) => (i === rowIndex ? { ...r, feature } : r));
    patch({ rows });
  }

  function setCell(rowIndex: number, colIndex: number, text: string) {
    const rows = table.rows.map((r, i) => {
      if (i !== rowIndex) return r;
      const values = table.columns.map((_, ci) => (ci === colIndex ? text : (r.values[ci] ?? '')));
      return { ...r, values };
    });
    patch({ rows });
  }

  function addRow() {
    patch({
      rows: [...table.rows, { feature: '', values: table.columns.map(() => '') }],
    });
  }

  function removeRow(rowIndex: number) {
    if (table.rows.length <= 1) return;
    patch({ rows: table.rows.filter((_, i) => i !== rowIndex) });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Feature column header</Label>
        <Input
          disabled={disabled}
          value={table.feature_header}
          onChange={(e) => patch({ feature_header: e.target.value })}
          placeholder="Feature"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-border px-2 py-2 text-left font-semibold">
                {table.feature_header || 'Feature'}
              </th>
              {table.columns.map((col, ci) => (
                <th key={ci} className="border-b border-l border-border px-2 py-2 text-left">
                  <div className="flex items-center gap-1">
                    <Input
                      disabled={disabled}
                      className="h-8 font-semibold"
                      value={col}
                      onChange={(e) => setColumn(ci, e.target.value)}
                      placeholder={`Column ${ci + 1}`}
                    />
                    {table.columns.length > 2 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 px-0 text-destructive"
                        disabled={disabled}
                        onClick={() => removeColumn(ci)}
                        title="Remove column"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="align-top">
                <td className="border-b border-border px-2 py-2">
                  <div className="flex gap-1">
                    <Input
                      disabled={disabled}
                      className="h-8 font-medium"
                      value={row.feature}
                      onChange={(e) => setRowFeature(ri, e.target.value)}
                      placeholder="Feature"
                    />
                    {table.rows.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 px-0 text-destructive"
                        disabled={disabled}
                        onClick={() => removeRow(ri)}
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
                {table.columns.map((_, ci) => (
                  <td key={ci} className="border-b border-l border-border px-2 py-2">
                    <textarea
                      disabled={disabled}
                      className="ibas-textarea min-h-[64px] text-sm"
                      value={row.values[ci] ?? ''}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      placeholder="…"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add feature row
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || table.columns.length >= 6}
          onClick={addColumn}
        >
          <Plus className="h-4 w-4" />
          Add compare column
        </Button>
      </div>
    </div>
  );
}
