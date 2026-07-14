import { useWindowDimensions, ScrollView, View, Text, StyleSheet } from 'react-native';
import { BookRichText } from '@/components/books/BookRichText';
import type { ComparisonTable } from '@/types/questions';
import { colors, spacing } from '@/theme';

const FEATURE_COL_WIDTH = 112;
const VALUE_COL_MIN_WIDTH = 140;

export function ComparisonTableAnswer({
  table,
}: {
  table?: ComparisonTable | null;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const columns = (table?.columns ?? []).map((c) => String(c ?? '').trim()).filter(Boolean);
  const rows = table?.rows ?? [];

  if (!table || columns.length < 2 || rows.length === 0) return null;

  const featureHeader = table.feature_header?.trim() || 'Feature';
  const valueColWidth = Math.max(
    VALUE_COL_MIN_WIDTH,
    Math.floor((Math.max(windowWidth, 480) - FEATURE_COL_WIDTH - 48) / columns.length),
  );
  const tableWidth = FEATURE_COL_WIDTH + valueColWidth * columns.length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Scroll sideways to compare columns</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        bounces={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hScrollContent}
      >
        <View style={[styles.table, { width: tableWidth }]}>
          <View style={[styles.row, styles.headerRow]}>
            <View style={[styles.cell, { width: FEATURE_COL_WIDTH }, styles.headerCell]}>
              <Text style={styles.headerText}>{featureHeader}</Text>
            </View>
            {columns.map((col, i) => (
              <View
                key={`h-${i}`}
                style={[styles.cell, { width: valueColWidth }, styles.headerCell]}
              >
                <Text style={styles.headerText}>{col}</Text>
              </View>
            ))}
          </View>
          {rows.map((row, ri) => (
            <View key={`r-${ri}`} style={[styles.row, ri % 2 === 1 && styles.altRow]}>
              <View style={[styles.cell, { width: FEATURE_COL_WIDTH }]}>
                <BookRichText html={row.feature || '—'} style={styles.featureText} />
              </View>
              {columns.map((_, ci) => (
                <View key={`c-${ri}-${ci}`} style={[styles.cell, { width: valueColWidth }]}>
                  <BookRichText html={row.values?.[ci] ?? ''} style={styles.valueText} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  hScroll: {
    flexGrow: 0,
  },
  hScrollContent: {
    paddingBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    backgroundColor: '#eef4f8',
  },
  altRow: {
    backgroundColor: '#fafbfc',
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    justifyContent: 'flex-start',
  },
  headerCell: {
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  valueText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
});
