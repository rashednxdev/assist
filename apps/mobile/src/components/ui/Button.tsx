import { Pressable, StyleSheet, Text, ActivityIndicator, type PressableProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/theme';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'premium';
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isPremium = variant === 'premium';
  const isGhost = variant === 'ghost';

  const content = loading ? (
    <ActivityIndicator color={isPrimary || isPremium ? colors.white : colors.primary} />
  ) : (
    <Text
      style={[
        styles.label,
        isPrimary && styles.labelPrimary,
        isPremium && styles.labelPremium,
        isGhost && styles.labelGhost,
      ]}
    >
      {title}
    </Text>
  );

  if (isPremium) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.premiumWrap,
          (disabled || loading) && styles.disabled,
          pressed && !disabled && !loading && styles.pressed,
          style,
        ]}
        disabled={disabled || loading}
        {...rest}
      >
        <LinearGradient
          colors={[colors.goldLight, colors.gold, colors.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumGradient}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

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
      {content}
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
  labelPremium: {
    color: '#1a1200',
    fontWeight: '800',
  },
  labelGhost: {
    color: colors.primary,
  },
  premiumWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  premiumGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
