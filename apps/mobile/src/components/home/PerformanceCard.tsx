import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ProgressDashboardData } from '@/lib/evaluation-api';
import { colors, spacing } from '@/theme';

interface PerformanceCardProps {
  progress: ProgressDashboardData | null;
  savedCount: number;
  onSavedPress: () => void;
  onProgressPress: () => void;
}

function MiniBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

export function PerformanceCard({
  progress,
  savedCount,
  onSavedPress,
  onProgressPress,
}: PerformanceCardProps) {
  const { height } = useWindowDimensions();
  const cardMaxHeight = Math.round(height * 0.5);

  const mcq = progress?.mcq ?? { submitted: 0, correct: 0, incorrect: 0, accuracy_percent: 0 };
  const papers = progress?.papers ?? {
    attempted: 0,
    rated_questions: 0,
    total_questions: 0,
    average_progress_percent: 0,
  };

  return (
    <View style={[styles.card, { maxHeight: cardMaxHeight }]}>
      <View style={styles.topRow}>
        <Pressable
          style={({ pressed }) => [styles.titleBlock, pressed && styles.pressed]}
          onPress={onProgressPress}
          accessibilityRole="button"
          accessibilityLabel="Open progress dashboard"
        >
          <View style={styles.titleText}>
            <Text style={styles.heading}>Progress summary</Text>
            <Text style={styles.sub}>Tap for full dashboard</Text>
          </View>
        </Pressable>

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
            <Ionicons name="bookmark" size={14} color={colors.white} />
            <Text style={styles.savedCount}>{savedCount}</Text>
            <Text style={styles.savedLabel}>Saved</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.metricsRow, pressed && styles.pressed]}
        onPress={onProgressPress}
      >
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Evaluate MCQ</Text>
          <Text style={styles.metricValue}>{mcq.accuracy_percent}%</Text>
          <Text style={styles.metricMeta}>
            <Text style={{ color: colors.success, fontWeight: '700' }}>{mcq.correct}✓</Text>
            {' · '}
            <Text style={{ color: colors.error, fontWeight: '700' }}>{mcq.incorrect}✗</Text>
            {' · '}
            {mcq.submitted} done
          </Text>
          <MiniBar
            percent={mcq.accuracy_percent}
            color={mcq.accuracy_percent >= 70 ? colors.success : '#7c3aed'}
          />
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Exam papers</Text>
          <Text style={styles.metricValue}>{papers.average_progress_percent}%</Text>
          <Text style={styles.metricMeta}>
            {papers.attempted} started · {papers.rated_questions}/{papers.total_questions || 0}
          </Text>
          <MiniBar percent={papers.average_progress_percent} color="#d97706" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    flex: 1,
    gap: 1,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.92,
  },
  savedPress: {
    borderRadius: 12,
  },
  savedPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  savedTile: {
    width: 58,
    height: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    overflow: 'hidden',
  },
  savedCount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 18,
  },
  savedLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 3,
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  metricMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  barTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  barFill: {
    height: 5,
    borderRadius: 999,
  },
});
