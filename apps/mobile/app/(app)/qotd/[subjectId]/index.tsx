import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchQotdDates, type QotdEntrySummary } from '@/lib/qotd-api';
import { formatDateWithDay } from '@/lib/date-format';
import { qotdColors } from '@/lib/qotd-theme';
import { colors, spacing } from '@/theme';

export default function QotdDatesScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<QotdEntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!subjectId) return;
    try {
      const res = await fetchQotdDates(subjectId);
      setEntries(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (entries.length === 0) {
    return <BookEmpty title="No entries for this subject yet" />;
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
      <Text style={styles.subjectName}>{entries[0]?.subject_name}</Text>
      {entries.map((e) => (
        <Pressable
          key={e.id}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(`/(app)/qotd/${subjectId}/${e.id}` as Href)}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="today-outline" size={20} color={qotdColors.accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.title}>{formatDateWithDay(e.date)}</Text>
            <Text style={styles.sub}>
              {e.question_count} question{e.question_count === 1 ? '' : 's'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={qotdColors.accent} />
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
  subjectName: {
    fontSize: 18,
    fontWeight: '800',
    color: qotdColors.accentDark,
    marginBottom: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: qotdColors.accentBorder,
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: qotdColors.accentLight,
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
