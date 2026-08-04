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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const columns = (table?.columns ?? []).map((c) => String(c ?? '').trim()).filter(Boolean);
  const rows = table?.rows ?? [];

  if (!table || columns.length < 2 || rows.length === 0) return null;

  const featureHeader = table.feature_header?.trim() || 'Feature';
  const valueColWidth = Math.max(
    VALUE_COL_MIN_WIDTH,
    Math.floor((Math.max(windowWidth, 480) - FEATURE_COL_WIDTH - 48) / columns.length),
  );
  const tableWidth = FEATURE_COL_WIDTH + valueColWidth * columns.length;
  // Only the row body scrolls vertically; the title/column header above it stay fixed in place.
  // Bounded so it fits comfortably within a full-screen landscape modal as well as an inline page.
  const bodyMaxHeight = Math.max(160, Math.min(480, windowHeight - 220));

  return (
    <View style={styles.wrap}>
      {/* Single horizontal scroll drives the title, header, and rows together so columns stay
          aligned — the header row sits outside the inner vertical ScrollView below, so scrolling
          through rows never moves it. */}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        bounces={false}
        style={styles.hScroll}
        contentContainerStyle={styles.hScrollContent}
      >
        <View style={[styles.table, { width: tableWidth }]}>
          {table.title?.trim() ? (
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>{table.title.trim()}</Text>
            </View>
          ) : null}

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

          <ScrollView
            style={{ maxHeight: bodyMaxHeight }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
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
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
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
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    backgroundColor: '#eef4f8',
  },
  titleRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: '#e2ecf2',
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
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
