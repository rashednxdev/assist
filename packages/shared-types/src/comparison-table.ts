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

/** Plain text from a rich/HTML table cell — used to decide if the cell has real content. */
export function comparisonTableCellText(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/[\u00a0\u200b\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keptColumnIndexes(
  columns: string[] | undefined,
  rows: ComparisonTableRow[] | undefined,
  opts: { requireCellData: boolean },
) {
  const rawRows = rows ?? [];
  return (columns ?? [])
    .map((c, i) => ({ label: String(c ?? '').trim(), index: i }))
    .filter((c) => c.label.length > 0)
    .filter(
      (c) =>
        !opts.requireCellData ||
        rawRows.some((r) => comparisonTableCellText(r.values?.[c.index]).length > 0),
    )
    .map((c) => c.index);
}

/**
 * Normalize a table for persistence: drop blank headers (keeping value indexes aligned),
 * drop fully empty rows. Keeps compare-columns that still have a header even if cells are
 * empty so an in-progress Item B column is not wiped on save.
 */
export function cleanComparisonTable(table: ComparisonTable | null | undefined): ComparisonTable | undefined {
  if (!table) return undefined;
  const title = (table.title ?? '').trim();
  const featureHeader = (table.feature_header ?? 'Feature').trim() || 'Feature';
  const keptIndexes = keptColumnIndexes(table.columns, table.rows, { requireCellData: false });
  if (keptIndexes.length < 2) return undefined;

  const columns = keptIndexes.map((i) => String(table.columns[i] ?? '').trim());
  const rows = (table.rows ?? [])
    .map((row) => {
      const feature = (row.feature ?? '').trim();
      const values = keptIndexes.map((i) => (row.values?.[i] ?? '').trim());
      return { feature, values };
    })
    .filter((row) => row.feature || row.values.some((v) => comparisonTableCellText(v)));

  if (rows.length === 0) return undefined;

  return {
    ...(title ? { title } : {}),
    feature_header: featureHeader,
    columns,
    rows,
  };
}

/**
 * Table shaped for display: also drops any compare-column whose cells are all empty
 * (e.g. an unused "Item B"), even when the header label is present. Allows a single
 * remaining compare-column so partial tables still render.
 */
export function visibleComparisonTable(table: ComparisonTable | null | undefined): ComparisonTable | undefined {
  if (!table) return undefined;
  const title = (table.title ?? '').trim();
  const featureHeader = (table.feature_header ?? 'Feature').trim() || 'Feature';
  const keptIndexes = keptColumnIndexes(table.columns, table.rows, { requireCellData: true });
  if (keptIndexes.length < 1) return undefined;

  const columns = keptIndexes.map((i) => String(table.columns[i] ?? '').trim());
  const rows = (table.rows ?? [])
    .map((row) => ({
      feature: row.feature ?? '',
      values: keptIndexes.map((i) => row.values?.[i] ?? ''),
    }))
    .filter(
      (row) =>
        comparisonTableCellText(row.feature).length > 0 ||
        row.values.some((v) => comparisonTableCellText(v).length > 0),
    );

  if (rows.length === 0) return undefined;

  return {
    ...(title ? { title } : {}),
    feature_header: featureHeader,
    columns,
    rows,
  };
}

export function hasComparisonTableContent(table: ComparisonTable | null | undefined): boolean {
  return Boolean(visibleComparisonTable(table));
}

export function serializeComparisonTable(
  table: ComparisonTable | null | undefined,
): ComparisonTable | undefined {
  return cleanComparisonTable(table);
}
