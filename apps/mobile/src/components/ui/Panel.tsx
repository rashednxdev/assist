import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

/** White rounded card with an optional title row. */
export function Panel({
  title,
  subtitle,
  icon,
  right,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.head}>
          {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
          <View style={styles.headText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
