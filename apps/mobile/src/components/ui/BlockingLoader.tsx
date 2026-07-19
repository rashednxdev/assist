import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';
import { LineLoader } from './LineLoader';

/**
 * Full-screen loading overlay — sits on top of the screen and intercepts touches, so it's
 * unmistakable that something is loading and scroll/tap underneath is blocked until it clears.
 */
export function BlockingLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.lineWrap}>
          <LineLoader />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 247, 251, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 50,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  lineWrap: {
    width: 160,
    marginTop: spacing.xs,
  },
});
