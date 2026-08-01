import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import { fetchQotdDateDetail, type QotdDateDetail } from '@/lib/qotd-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { questionDetailHref } from '@/lib/question-routes';
import { qotdColors } from '@/lib/qotd-theme';
import { colors, spacing } from '@/theme';

function truncate(text: string, len = 140) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export default function QotdDateDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<QotdDateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchQotdDateDetail(date)
      .then((res) => setDetail(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [date]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!detail || detail.groups.length === 0) return <BookEmpty title="No questions for this date" />;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.dateLabel}>{formatDdMmYyyy(detail.date)}</Text>

      {detail.groups.map((group) => (
        <View key={group.entry_id} style={styles.subjectBlock}>
          <Text style={styles.subjectName}>{group.subject_name}</Text>
          {group.questions.map((q, i) => (
            <Pressable
              key={q.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(questionDetailHref(q.id))}
            >
              <View style={styles.numberWrap}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={3}>
                  {truncate(q.body_en || q.body_bn || '')}
                </Text>
                <Text style={styles.sub}>
                  {q.question_type_code} · {q.marks}m{q.book_name ? ` · ${q.book_name}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={qotdColors.accent} />
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
  dateLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: qotdColors.accentDark,
  },
  subjectBlock: {
    gap: spacing.sm,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  numberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: qotdColors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  numberText: {
    fontSize: 12,
    fontWeight: '800',
    color: qotdColors.accentDark,
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
