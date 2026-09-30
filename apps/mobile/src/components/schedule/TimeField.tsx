import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { formatTime12 } from '@/lib/schedule-api';
import { colors, spacing } from '@/theme';

function toDate(value: string): Date {
  const [h, m] = (value || '10:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 10, m ?? 0, 0, 0);
  return d;
}

function toHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Time picker storing Bangladesh wall-clock time as `HH:mm` (empty string = not set). */
export function TimeField({
  label,
  value,
  onChange,
  clearable,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function handle(event: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'dismissed') return;
    }
    if (d) onChange(toHHmm(d));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={[styles.value, !value && styles.placeholder]}>{value ? formatTime12(value) : 'Not set'}</Text>
        {clearable && value ? (
          <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="time-outline" size={20} color={colors.primary} />
        )}
      </Pressable>

      {Platform.OS === 'android' && open ? <DateTimePicker value={toDate(value)} mode="time" display="default" onChange={handle} /> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker value={toDate(value)} mode="time" display="spinner" onChange={handle} style={styles.iosPicker} />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  value: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  done: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  iosPicker: {
    alignSelf: 'stretch',
  },
});
