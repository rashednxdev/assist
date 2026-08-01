import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchExamRoutineList, type ExamRoutineListItem } from '@/lib/exam-routine-api';
import { formatDdMmYyyy, parseIsoDate } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

function daysUntil(iso: string): number {
  const target = parseIsoDate(iso);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function countdownLabel(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (days === 0) return 'Today';
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
}

export default function ExamRoutineListScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState<ExamRoutineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetchExamRoutineList();
      setRoutines(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load routines');
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
  if (routines.length === 0) {
    return (
      <BookEmpty
        title="No exam routines published yet"
        subtitle="Check back once an admin publishes an exam schedule."
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
      {routines.map((r) => {
        const days = daysUntil(r.start_date);
        return (
          <Pressable
            key={r.exam_name_id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/(app)/exam-routine/${r.exam_name_id}` as Href)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="school-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.title}>{r.exam_name}</Text>
              <Text style={styles.sub}>{formatDdMmYyyy(r.start_date)}</Text>
            </View>
            <View style={styles.countdownWrap}>
              <Text style={styles.countdownText}>{countdownLabel(days)}</Text>
            </View>
          </Pressable>
        );
      })}
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
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e8f2fa',
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
  countdownWrap: {
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
});
