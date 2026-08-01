import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchExamWeeks, type ExamWeekSummary } from '@/lib/exam-week-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { examWeekColors } from '@/lib/exam-week-theme';
import { colors, spacing } from '@/theme';

function weekLabel(week: ExamWeekSummary): string {
  return `${formatDdMmYyyy(week.week_start)} – ${formatDdMmYyyy(week.week_end)}`;
}

export default function ExamWeeksScreen() {
  const router = useRouter();
  const [weeks, setWeeks] = useState<ExamWeekSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetchExamWeeks();
      setWeeks(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weeks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (weeks.length === 0) {
    return (
      <BookEmpty
        title="No Exams of the Week yet"
        subtitle="Check back once an admin publishes a featured exam paper."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      {weeks.map((w) => (
        <Pressable
          key={w.week_start}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(`/(app)/exam-week/${w.week_start}` as Href)}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="trophy-outline" size={22} color={examWeekColors.accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.title}>{weekLabel(w)}</Text>
            <Text style={styles.sub}>
              {w.paper_count} paper{w.paper_count === 1 ? '' : 's'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={examWeekColors.accent} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: examWeekColors.accentBorder,
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: examWeekColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
