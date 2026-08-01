import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchExamWeekPapers, type ExamWeekPaper } from '@/lib/exam-week-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { paperDetailHref } from '@/lib/paper-routes';
import { examWeekColors } from '@/lib/exam-week-theme';
import { colors, spacing } from '@/theme';

export default function ExamWeekPapersScreen() {
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>();
  const router = useRouter();
  const [papers, setPapers] = useState<ExamWeekPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!weekStart) return;
    setLoading(true);
    fetchExamWeekPapers(weekStart)
      .then((res) => setPapers(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [weekStart]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (papers.length === 0) return <BookEmpty title="No papers for this week" />;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.weekLabel}>Week of {weekStart ? formatDdMmYyyy(weekStart) : ''}</Text>

      {papers.map((p) => (
        <Pressable
          key={p.id}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(paperDetailHref(p.id))}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="document-text-outline" size={20} color={examWeekColors.accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.title} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.sub}>
              {p.exam_subject_name ?? p.exam_short_name ?? ''}
              {p.paper_type_name ? ` · ${p.paper_type_name}` : ''}
            </Text>
            <Text style={styles.meta}>
              {p.total_marks} marks · {p.duration_minutes} min · {p.question_count} question
              {p.question_count === 1 ? '' : 's'}
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
  weekLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: examWeekColors.accentDark,
    marginBottom: spacing.xs,
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
