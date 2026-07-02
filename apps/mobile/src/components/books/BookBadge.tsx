import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

interface BookBadgeProps {
  label: string;
  variant?: 'default' | 'warning' | 'muted';
}

export function BookBadge({ label, variant = 'default' }: BookBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        variant === 'warning' && styles.warning,
        variant === 'muted' && styles.muted,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'warning' && styles.warningText,
          variant === 'muted' && styles.mutedText,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f2fa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  warning: {
    backgroundColor: '#fef3c7',
  },
  muted: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  warningText: {
    color: colors.warning,
  },
  mutedText: {
    color: colors.textMuted,
  },
});
