import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

/** Math-style row: label on left, value on right (Earning → Deduction → Balance). */
export function MathRow({
  label,
  value,
  note,
  emphasize,
  operator,
}: {
  label: string;
  value: string;
  note?: string;
  emphasize?: boolean;
  /** Optional leading operator shown before the value, e.g. "−" or "=" */
  operator?: string;
}) {
  return (
    <View style={[styles.row, emphasize && styles.rowEmphasize]}>
      <View style={styles.left}>
        <Text style={[styles.label, emphasize && styles.labelEmphasize]}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Text style={[styles.value, emphasize && styles.valueEmphasize]}>
        {operator ? `${operator} ` : ''}
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowEmphasize: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    color: colors.text,
  },
  labelEmphasize: {
    fontWeight: '700',
    fontSize: 15,
  },
  note: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    maxWidth: '48%',
  },
  valueEmphasize: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
});
