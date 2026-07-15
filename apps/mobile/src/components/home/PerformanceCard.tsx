import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing } from '@/theme';

interface PerformanceCardProps {
  profilePercent: number;
  verified: boolean;
  planName?: string | null;
  savedCount: number;
  activity: {
    books: number;
    questions: number;
    exams: number;
    papers: number;
  };
  onSavedPress: () => void;
}

export function PerformanceCard({
  profilePercent,
  verified,
  planName,
  savedCount,
  activity,
  onSavedPress,
}: PerformanceCardProps) {
  const stats = [
    { label: 'Books', value: activity.books },
    { label: 'Questions', value: activity.questions },
    { label: 'Exams', value: activity.exams },
    { label: 'Papers', value: activity.papers },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Your activity</Text>
          <Text style={styles.sub}>
            {verified ? 'Account verified' : 'Complete verification to unlock full access'}
          </Text>
          <Text style={styles.profileHint}>Profile {profilePercent}% complete</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.ring, pressed && styles.ringPressed]}
          onPress={onSavedPress}
          accessibilityRole="button"
          accessibilityLabel="Open saved books and questions"
        >
          <Text style={styles.ringValue}>{savedCount}</Text>
          <Text style={styles.ringLabel}>Saved</Text>
        </Pressable>
      </View>

      {planName ? (
        <View style={styles.planBadge}>
          <Text style={styles.planText}>Plan: {planName}</Text>
        </View>
      ) : null}

      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCell}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    maxWidth: 220,
  },
  profileHint: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 6,
    fontWeight: '600',
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f2fa',
  },
  ringPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  ringValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  ringLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCell: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
