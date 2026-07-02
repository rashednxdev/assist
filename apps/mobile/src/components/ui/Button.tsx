import { Pressable, StyleSheet, Text, ActivityIndicator, type PressableProps, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      style={({ pressed }) => {
        const baseStyles = [
          styles.base,
          isPrimary && styles.primary,
          variant === 'secondary' && styles.secondary,
          isGhost && styles.ghost,
          (disabled || loading) && styles.disabled,
          pressed && !disabled && !loading && styles.pressed,
        ];
        return style ? [...baseStyles, style] : baseStyles;
      }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.label, isPrimary && styles.labelPrimary, isGhost && styles.labelGhost]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  labelPrimary: {
    color: colors.white,
  },
  labelGhost: {
    color: colors.primary,
  },
});
