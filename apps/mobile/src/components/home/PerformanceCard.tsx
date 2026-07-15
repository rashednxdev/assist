import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
        <View style={styles.headerText}>
          <Text style={styles.heading}>Your activity</Text>
          <Text style={styles.sub}>
            {verified ? 'Account verified' : 'Complete verification to unlock full access'}
          </Text>
          <Text style={styles.profileHint}>Profile {profilePercent}% complete</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.savedPress, pressed && styles.savedPressed]}
          onPress={onSavedPress}
          accessibilityRole="button"
          accessibilityLabel={`Open saved items, ${savedCount} saved`}
        >
          <LinearGradient
            colors={[colors.primaryDark, colors.primary, colors.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.savedTile}
          >
            <View style={styles.savedIconWrap}>
              <Ionicons name="bookmark" size={18} color={colors.white} />
            </View>
            <Text style={styles.savedCount}>{savedCount}</Text>
            <Text style={styles.savedLabel}>Saved</Text>
            <View style={styles.savedGlow} />
          </LinearGradient>
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
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.xs,
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
  },
  profileHint: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 6,
    fontWeight: '600',
  },
  savedPress: {
    borderRadius: 18,
  },
  savedPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  savedTile: {
    width: 84,
    minHeight: 96,
    borderRadius: 18,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  savedIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  savedCount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 30,
  },
  savedLabel: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.4,
  },
  savedGlow: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
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
