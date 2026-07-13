import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

export type BookContentsViewMode = 'short' | 'full';

const OPTIONS: { value: BookContentsViewMode; label: string }[] = [
  { value: 'short', label: 'Short View' },
  { value: 'full', label: 'Full Mode' },
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
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.optionText, selected && styles.optionTextSelected]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
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
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 3,
    gap: 2,
  },
  groupCompact: {
    // Keep intrinsic height; stretch only horizontally via width 100%
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    minHeight: 36,
  },
  optionCompact: {
    paddingHorizontal: 8,
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
