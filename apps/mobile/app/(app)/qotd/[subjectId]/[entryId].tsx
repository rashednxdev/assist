import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookError } from '@/components/books/BookStates';
import { fetchQotdEntryDetail, type QotdEntryDetail } from '@/lib/qotd-api';
import { formatDateWithDay } from '@/lib/date-format';
import { questionDetailHref } from '@/lib/question-routes';
import { qotdColors } from '@/lib/qotd-theme';
import { colors, spacing } from '@/theme';

function truncate(text: string, len = 140) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export default function QotdEntryDetailScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<QotdEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entryId) return;
    setLoading(true);
    fetchQotdEntryDetail(entryId)
      .then((res) => setEntry(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [entryId]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!entry) return <BookError message="Entry not found" />;

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.subjectName}>{entry.subject_name}</Text>
      <Text style={styles.dateLabel}>{formatDateWithDay(entry.date)}</Text>
      {entry.questions.map((q, i) => (
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
  },
  dateLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.xs,
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
