import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchQotdDateDetail, type QotdDateDetail } from '@/lib/qotd-api';
import { formatDayName, parseIsoDate, toIsoDate } from '@/lib/date-format';
import { questionDetailHref } from '@/lib/question-routes';
import { ReadCountBadge, ReadFilterChips, matchesReadFilter, type ReadFilter } from '@/components/questions/ReadCountBadge';
import { useAnswerHistory } from '@/hooks/useAnswerHistory';
import { colors, spacing } from '@/theme';

function truncate(text: string, len = 140) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

function headingFor(iso: string) {
  const today = toIsoDate(new Date());
  const date = parseIsoDate(iso);
  const long = date
    ? date.toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : iso;
  if (iso === today) return { kicker: 'Today', title: long };
  return { kicker: formatDayName(iso), title: long };
}

export default function QotdDateDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<QotdDateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { readCountById } = useAnswerHistory();

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchQotdDateDetail(date)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [date]);

  const visibleGroups = useMemo(() => {
    if (!detail) return [];
    return detail.groups
      .map((group) => ({
        ...group,
        questions: group.questions.filter((q) => matchesReadFilter(readCountById.get(q.id), readFilter)),
      }))
      .filter((group) => group.questions.length > 0);
  }, [detail, readFilter, readCountById]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!detail || detail.groups.length === 0) return <BookEmpty title="No questions for this date" />;

  const heading = headingFor(detail.date);
  const totalQuestions = visibleGroups.reduce((sum, g) => sum + g.questions.length, 0);
  const allQuestions = detail.groups.reduce((sum, g) => sum + g.questions.length, 0);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.header}>
        {heading.kicker ? <Text style={styles.kicker}>{heading.kicker}</Text> : null}
        <Text style={styles.dateLabel}>{heading.title}</Text>
        <Text style={styles.summary}>
          {visibleGroups.length} subject{visibleGroups.length === 1 ? '' : 's'} · {totalQuestions}{' '}
          question{totalQuestions === 1 ? '' : 's'}
          {readFilter !== 'all' ? ` of ${allQuestions}` : ''}
        </Text>
      </View>

      <ReadFilterChips value={readFilter} onChange={setReadFilter} />

      {visibleGroups.length === 0 ? (
        <BookEmpty title={readFilter === 'read' ? 'No read questions' : 'No unread questions'} />
      ) : null}

      {visibleGroups.map((group) => (
        <View key={group.entry_id} style={styles.subjectBlock}>
          <View style={styles.subjectHead}>
            <Text style={styles.subjectName}>{group.subject_name}</Text>
            <Text style={styles.subjectCount}>
              {group.questions.length} {group.questions.length === 1 ? 'question' : 'questions'}
            </Text>
          </View>
          {group.questions.map((q, i) => (
            <Pressable
              key={q.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(questionDetailHref(q.id))}
            >
              <Text style={styles.index}>{i + 1}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={3}>
                  {truncate(q.body_en || q.body_bn || '')}
                </Text>
                <ReadCountBadge questionId={q.id} count={readCountById.get(q.id)} />
                <Text style={styles.sub}>
                  {q.question_type_code}
                  {q.marks ? ` · ${q.marks}m` : ''}
                  {q.book_name ? ` · ${q.book_name}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
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
  header: {
    gap: 4,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dateLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  summary: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subjectBlock: {
    gap: spacing.sm,
  },
  subjectHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  subjectName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  subjectCount: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  index: {
    width: 20,
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: 1,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19,
  },
  sub: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
