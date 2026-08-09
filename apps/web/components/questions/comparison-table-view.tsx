import type { ComparisonTable } from '@ibas/shared-types';
import { visibleComparisonTable } from '@ibas/shared-types';

export function ComparisonTableView({
  table,
  label = 'Model answer',
}: {
  table?: ComparisonTable | null;
  /** Pass "" to omit the label — e.g. when nested under a section that already shows its own title. */
  label?: string;
}) {
  // Hide compare-columns with no cell data (e.g. unused "Item B") and blank headers.
  const visible = visibleComparisonTable(table);
  if (!visible) return null;

  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-primary-muted/20 p-4">
      {label ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            {visible.title?.trim() && (
              <tr className="bg-slate-100">
                <th
                  colSpan={visible.columns.length + 1}
                  className="border-b border-border px-3 py-2.5 text-center font-semibold text-foreground"
                >
                  {visible.title}
                </th>
              </tr>
            )}
            <tr className="bg-slate-50">
              <th className="border-b border-border px-3 py-2.5 text-left font-semibold text-foreground">
                {visible.feature_header || 'Feature'}
              </th>
              {visible.columns.map((col, i) => (
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
            {visible.rows.map((row, ri) => (
              <tr key={ri} className="align-top">
                <td className="border-b border-border px-3 py-2.5 font-medium text-foreground">
                  {row.feature}
                </td>
                {visible.columns.map((_, ci) => (
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
