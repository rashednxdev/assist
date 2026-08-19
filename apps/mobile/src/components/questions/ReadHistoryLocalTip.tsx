import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { hasSeenReadHistoryTip, markReadHistoryTipSeen } from '@/lib/read-history-tip';
import { colors, spacing } from '@/theme';

/**
 * One-time tip the first time the user views a question answer.
 * Explains that read times / history live on this device only.
 */
export function ReadHistoryLocalTip({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void hasSeenReadHistoryTip().then((seen) => {
        if (!cancelled && !seen) setVisible(true);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);

  async function dismiss() {
    setVisible(false);
    await markReadHistoryTipSeen();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient
            colors={['#ecfdf5', '#d1fae5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Ionicons name="phone-portrait-outline" size={26} color="#047857" />
          </LinearGradient>

          <Text style={styles.kicker}>Tip</Text>
          <Text style={styles.title}>Read history stays on this phone</Text>
          <Text style={styles.body}>
            How many times you read an answer, and your answer reading history, are saved only on
            this device — not in your account.
          </Text>

          <View style={styles.points}>
            <View style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.pointText}>Stored on this mobile only</Text>
            </View>
            <View style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name="swap-horizontal-outline" size={16} color="#b45309" />
              </View>
              <Text style={styles.pointText}>Lost if you uninstall or change phones</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            onPress={() => void dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.ctaText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#047857',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  points: {
    width: '100%',
    gap: 8,
    marginBottom: spacing.lg,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pointIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  cta: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
