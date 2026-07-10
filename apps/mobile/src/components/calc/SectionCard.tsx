import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing } from '@/theme';

export function SectionCard({
  title,
  subtitle,
  children,
  style,
  headerRight,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: ViewStyle;
  headerRight?: ReactNode;
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {headerRight}
      </View>
      <View style={styles.body}>{children}</View>
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
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  body: {
    gap: spacing.sm,
  },
});
