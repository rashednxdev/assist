import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

export type BookContentsViewMode = 'short' | 'full';

const OPTIONS: { value: BookContentsViewMode; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'full', label: 'Full view' },
];

export function BookViewModeToggle({
  value,
  onChange,
  compact,
}: {
  value: BookContentsViewMode;
  onChange: (mode: BookContentsViewMode) => void;
  compact?: boolean;
}) {
  return (
    <View
      style={[styles.group, compact && styles.groupCompact]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Book contents view"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.option, compact && styles.optionCompact, selected && styles.optionSelected]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 3,
    gap: 2,
  },
  groupCompact: {
    alignSelf: 'center',
    flexShrink: 0,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
  },
  optionCompact: {
    flex: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionTextSelected: {
    color: colors.white,
  },
});
