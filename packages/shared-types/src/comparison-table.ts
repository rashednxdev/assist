import { z } from 'zod';

export const comparisonTableRowSchema = z.object({
  feature: z.string(),
  values: z.array(z.string()).min(1),
});

export const comparisonTableSchema = z.object({
  /** Optional title spanning the full table width, shown centered above the column headers. */
  title: z.string().optional(),
  /** Left header cell, default "Feature". */
  feature_header: z.string().default('Feature'),
  /** Compared entities, e.g. ["Data", "Information"]. */
  columns: z.array(z.string()).min(2).max(6),
  rows: z.array(comparisonTableRowSchema).min(1),
});

export type ComparisonTableRow = z.infer<typeof comparisonTableRowSchema>;
export type ComparisonTable = z.infer<typeof comparisonTableSchema>;

export function emptyComparisonTable(columnCount = 2): ComparisonTable {
  const n = Math.max(2, Math.min(6, columnCount));
  return {
    feature_header: 'Feature',
    columns: Array.from({ length: n }, (_, i) => (i === 0 ? 'Item A' : i === 1 ? 'Item B' : `Item ${i + 1}`)),
    rows: [{ feature: '', values: Array.from({ length: n }, () => '') }],
  };
}

export function cleanComparisonTable(table: ComparisonTable | null | undefined): ComparisonTable | undefined {
  if (!table) return undefined;
  const title = (table.title ?? '').trim();
  const featureHeader = (table.feature_header ?? 'Feature').trim() || 'Feature';
  const columns = (table.columns ?? []).map((c) => c.trim()).filter(Boolean);
  if (columns.length < 2) return undefined;

  const rows = (table.rows ?? [])
    .map((row) => {
      const feature = (row.feature ?? '').trim();
      const values = columns.map((_, i) => (row.values?.[i] ?? '').trim());
      return { feature, values };
    })
    .filter((row) => row.feature || row.values.some((v) => v));

  if (rows.length === 0) return undefined;

  return {
    ...(title ? { title } : {}),
    feature_header: featureHeader,
    columns,
    rows: rows.map((row) => ({
      feature: row.feature,
      values: columns.map((_, i) => row.values[i] ?? ''),
    })),
  };
}

export function hasComparisonTableContent(table: ComparisonTable | null | undefined): boolean {
  return Boolean(cleanComparisonTable(table));
}

export function serializeComparisonTable(
  table: ComparisonTable | null | undefined,
): ComparisonTable | undefined {
  return cleanComparisonTable(table);
}
