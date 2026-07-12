import type { ComparisonTable } from '@ibas/shared-types';
import { hasComparisonTableContent } from '@ibas/shared-types';

export function ComparisonTableView({ table }: { table?: ComparisonTable | null }) {
  if (!hasComparisonTableContent(table) || !table) return null;

  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-primary-muted/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Model answer</div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-foreground">
                {table.feature_header || 'Feature'}
              </th>
              {table.columns.map((col, i) => (
                <th
                  key={i}
                  className="border-b border-l border-border px-3 py-2.5 text-left font-semibold text-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="align-top">
                <td className="border-b border-border px-3 py-2.5 font-medium text-foreground">
                  {row.feature}
                </td>
                {table.columns.map((_, ci) => (
                  <td
                    key={ci}
                    className="border-b border-l border-border px-3 py-2.5 whitespace-pre-wrap text-foreground"
                  >
                    {row.values[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
