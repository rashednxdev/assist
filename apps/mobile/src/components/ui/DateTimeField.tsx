import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

function display(d: Date): string {
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Date + time picker; Android asks for the date, then the time. */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  required,
  error,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  required?: boolean;
  error?: string;
}) {
  const [step, setStep] = useState<'date' | 'time' | null>(null);

  function onAndroid(event: DateTimePickerEvent, picked?: Date) {
    const current = step;
    setStep(null);
    if (event.type === 'dismissed' || !picked) return;
    if (current === 'date') {
      const next = new Date(value);
      next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
      onChange(next);
      setStep('time');
    } else {
      const next = new Date(value);
      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
      onChange(next);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <Pressable
        style={[styles.field, error ? styles.fieldError : null]}
        onPress={() => setStep('date')}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.value}>{display(value)}</Text>
        <Ionicons name="time-outline" size={20} color={colors.primary} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'android' && step ? (
        <DateTimePicker value={value} mode={step} display="default" onChange={onAndroid} minimumDate={step === 'date' ? minimumDate : undefined} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={!!step} transparent animationType="slide" onRequestClose={() => setStep(null)}>
          <Pressable style={styles.backdrop} onPress={() => setStep(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setStep(null)} hitSlop={8}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={value}
              mode="datetime"
              display="spinner"
              minimumDate={minimumDate}
              onChange={(_, d) => d && onChange(d)}
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  required: {
    color: colors.error,
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
  fieldError: {
    borderColor: colors.error,
  },
  value: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  error: {
    fontSize: 12,
    color: colors.error,
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
