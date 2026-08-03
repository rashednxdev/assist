import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import type { ComparisonTable } from '@/types/questions';
import { colors, spacing } from '@/theme';

export function emptyComparisonTable(columnCount = 2): ComparisonTable {
  const n = Math.max(2, Math.min(6, columnCount));
  return {
    feature_header: 'Feature',
    columns: Array.from({ length: n }, (_, i) => (i === 0 ? 'Item A' : i === 1 ? 'Item B' : `Item ${i + 1}`)),
    rows: [{ feature: '', values: Array.from({ length: n }, () => '') }],
  };
}

interface ComparisonTableEditorProps {
  value: ComparisonTable;
  onChange: (next: ComparisonTable) => void;
  disabled?: boolean;
}

/** Mobile editor for a Differences-style comparison table — mirrors the web admin's editor, laid out vertically for phone screens. */
export function ComparisonTableEditor({ value, onChange, disabled }: ComparisonTableEditorProps) {
  const table = value.columns.length >= 2 ? value : emptyComparisonTable(2);

  function patch(partial: Partial<ComparisonTable>) {
    onChange({ ...table, ...partial });
  }

  function setColumn(index: number, text: string) {
    patch({ columns: table.columns.map((c, i) => (i === index ? text : c)) });
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
    const rows = table.rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== index) }));
    patch({ columns, rows });
  }

  function setRowFeature(rowIndex: number, feature: string) {
    patch({ rows: table.rows.map((r, i) => (i === rowIndex ? { ...r, feature } : r)) });
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
    patch({ rows: [...table.rows, { feature: '', values: table.columns.map(() => '') }] });
  }

  function removeRow(rowIndex: number) {
    if (table.rows.length <= 1) return;
    patch({ rows: table.rows.filter((_, i) => i !== rowIndex) });
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label="Table title (optional)"
        value={table.title ?? ''}
        onChangeText={(v) => patch({ title: v })}
        placeholder="Shown centered above the columns"
        editable={!disabled}
      />

      <TextField
        label="Feature column header"
        value={table.feature_header}
        onChangeText={(v) => patch({ feature_header: v })}
        placeholder="Feature"
        editable={!disabled}
      />

      <Text style={styles.groupLabel}>Compared columns</Text>
      {table.columns.map((col, ci) => (
        <View key={ci} style={styles.rowInline}>
          <View style={styles.flex1}>
            <TextField
              label=""
              value={col}
              onChangeText={(v) => setColumn(ci, v)}
              placeholder={`Column ${ci + 1}`}
              editable={!disabled}
            />
          </View>
          {table.columns.length > 2 ? (
            <Pressable onPress={() => removeColumn(ci)} hitSlop={8} disabled={disabled}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {table.columns.length < 6 ? (
        <Pressable style={styles.addBtn} onPress={addColumn} disabled={disabled}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addBtnText}>Add compare column</Text>
        </Pressable>
      ) : null}

      <Text style={styles.groupLabel}>Rows</Text>
      {table.rows.map((row, ri) => (
        <View key={ri} style={styles.rowBlock}>
          <View style={styles.rowBlockHeader}>
            <Text style={styles.rowBlockLabel}>Row {ri + 1}</Text>
            {table.rows.length > 1 ? (
              <Pressable onPress={() => removeRow(ri)} hitSlop={8} disabled={disabled}>
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              </Pressable>
            ) : null}
          </View>
          <TextField
            label=""
            value={row.feature}
            onChangeText={(v) => setRowFeature(ri, v)}
            placeholder="Feature"
            editable={!disabled}
          />
          {table.columns.map((col, ci) => (
            <TextField
              key={ci}
              label=""
              value={row.values[ci] ?? ''}
              onChangeText={(v) => setCell(ri, ci, v)}
              placeholder={col || `Column ${ci + 1}`}
              multiline
              numberOfLines={2}
              editable={!disabled}
            />
          ))}
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addRow} disabled={disabled}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.addBtnText}>Add row</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 4,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flex1: {
    flex: 1,
  },
  rowBlock: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  rowBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
