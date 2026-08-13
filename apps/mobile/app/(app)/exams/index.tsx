import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchExamPrograms } from '@/lib/exams-api';
import { examDetailHref } from '@/lib/exam-routes';
import { stripHtml } from '@/lib/book-display';
import type { ExamProgramItem } from '@/types/exams';
import { colors, spacing } from '@/theme';

export default function ExamsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ExamProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await fetchExamPrograms();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam programs');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.root}>
      {loading && items.length === 0 ? (
        <BookLoading />
      ) : error ? (
        <BookError message={error} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BookEmpty
              title="No exam programs found"
              subtitle="Exam programs are not configured yet."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(examDetailHref(item.id))}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="school-outline" size={22} color="#059669" />
              </View>
              <View style={styles.bodyWrap}>
                <Text style={styles.title}>{item.name}</Text>
                <View style={styles.badges}>
                  <BookBadge label={item.short_name} variant="muted" />
                  {item.authority_name ? <BookBadge label={item.authority_name} variant="muted" /> : null}
                </View>
                {item.goal?.trim() ? (
                  <Text style={styles.body}>{stripHtml(item.goal).slice(0, 150)}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bodyWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  body: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.9,
  },
});
