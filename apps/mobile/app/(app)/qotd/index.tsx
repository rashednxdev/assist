import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchQotdDates, type QotdDateSummary } from '@/lib/qotd-api';
import { formatDayName, parseIsoDate, toIsoDate } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

type DateBucket = 'today' | 'yesterday' | 'week' | 'earlier';

const BUCKET_ORDER: DateBucket[] = ['today', 'yesterday', 'week', 'earlier'];
const BUCKET_LABEL: Record<DateBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
};

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function bucketFor(iso: string): DateBucket {
  const today = toIsoDate(new Date());
  if (iso === today) return 'today';
  if (iso === toIsoDate(addLocalDays(new Date(), -1))) return 'yesterday';
  const date = parseIsoDate(iso);
  if (!date) return 'earlier';
  const weekStart = addLocalDays(new Date(), -6);
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart ? 'week' : 'earlier';
}

function dayAndMonth(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return { day: iso.slice(-2), month: '' };
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function shortDate(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function QotdDatesScreen() {
  const router = useRouter();
  const [dates, setDates] = useState<QotdDateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetchQotdDates();
      setDates(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dates');
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

  const groups = useMemo(() => {
    const buckets = new Map<DateBucket, QotdDateSummary[]>();
    for (const row of dates) {
      const key = bucketFor(row.date);
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }
    return BUCKET_ORDER.flatMap((key) => {
      const items = buckets.get(key);
      if (!items?.length) return [];
      return [{ key, label: BUCKET_LABEL[key], items }];
    });
  }, [dates]);

  if (loading) return <BookLoading />;

  if (error) return <BookError message={error} />;

  if (dates.length === 0) {
    return (
      <BookEmpty
        title="No Questions of the Day yet"
        subtitle="Check back once an admin publishes daily questions."
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
      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          {group.key !== 'today' || groups.length > 1 ? (
            <Text style={styles.groupLabel}>{group.label}</Text>
          ) : null}
          {group.items.map((d) => {
            const stamp = dayAndMonth(d.date);
            const isToday = group.key === 'today';
            return (
              <Pressable
                key={d.date}
                style={({ pressed }) => [
                  styles.card,
                  isToday && styles.cardToday,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => router.push(`/(app)/qotd/${d.date}` as Href)}
              >
                <View style={styles.dateStamp}>
                  <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{stamp.day}</Text>
                  <Text style={styles.month}>{stamp.month}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.title}>
                    {isToday ? 'Today' : formatDayName(d.date) || shortDate(d.date)}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {isToday ? `${formatDayName(d.date)}, ${shortDate(d.date)}` : shortDate(d.date)}
                  </Text>
                  <Text style={styles.meta}>
                    {d.subject_count} subject{d.subject_count === 1 ? '' : 's'} · {d.question_count}{' '}
                    question{d.question_count === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  cardToday: {
    borderColor: colors.border,
  },
  cardPressed: {
    opacity: 0.92,
  },
  dateStamp: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 26,
  },
  dayNumToday: {
    color: colors.primary,
  },
  month: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
});
