import { View, Text, StyleSheet } from 'react-native';
import type { ProgressSummary as ProgressSummaryData } from '@/lib/evaluation-api';
import { colors, spacing } from '@/theme';

interface ProgressSummaryProps {
  summary: Pick<ProgressSummaryData, 'progress_percent' | 'rated_questions' | 'total_questions'>;
  size?: 'sm' | 'md';
}

export function ProgressSummary({ summary, size = 'md' }: ProgressSummaryProps) {
  const percent = Math.min(100, Math.max(0, summary.progress_percent));
  const barHeight = size === 'sm' ? 6 : 10;

  return (
    <View style={styles.root}>
      <View style={styles.labels}>
        <Text style={[styles.percent, size === 'sm' && styles.percentSm]}>{percent}%</Text>
        <Text style={[styles.meta, size === 'sm' && styles.metaSm]}>
          {summary.rated_questions}/{summary.total_questions} rated
        </Text>
      </View>
      <View style={[styles.track, { height: barHeight }]}>
        <View style={[styles.fill, { width: `${percent}%`, height: barHeight }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  percent: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  percentSm: {
    fontSize: 12,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaSm: {
    fontSize: 11,
  },
  track: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});
