import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchQuestions, fetchQuestionTypes } from '@/lib/questions-api';
import { questionDetailHref } from '@/lib/question-routes';
import { useAuth } from '@/lib/auth-context';
import type { QuestionListItem, QuestionType } from '@/types/questions';
import { colors, spacing } from '@/theme';

export default function QuestionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin =
    user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin';

  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('');

  const typeNameMap = useMemo(() => new Map(types.map((t) => [t.code, t.name])), [types]);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [rows, typeRows] = await Promise.all([
        fetchQuestions({
          q: query,
          question_type_code: typeCode,
          difficulty,
          is_published: status as 'true' | 'false' | '',
        }),
        fetchQuestionTypes(),
      ]);
      setItems(rows);
      setTypes(typeRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [difficulty, query, status, typeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  function linkBadge(item: QuestionListItem) {
    if ((item.book_link_count ?? 0) > 1) return `${item.book_link_count} links`;
    if (item.book_sub_topic_id) return 'Sub-rule';
    if (item.book_topic_id) return 'Rule';
    if (item.book_chapter_id) return 'Chapter';
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search question text..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => void load()}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={() => void load()}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          data={[
            { id: '', label: 'All Types' },
            ...types.map((t) => ({ id: t.code, label: t.name })),
          ]}
          keyExtractor={(item) => `type-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, typeCode === item.id && styles.chipActive]}
              onPress={() => setTypeCode(item.id)}
            >
              <Text style={[styles.chipText, typeCode === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
        <FlatList
          horizontal
          data={[{ id: '', label: 'All Difficulty' }, ...QUESTION_DIFFICULTIES.map((d) => ({ id: d, label: d }))]}
          keyExtractor={(item) => `difficulty-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, difficulty === item.id && styles.chipActive]}
              onPress={() => setDifficulty(item.id)}
            >
              <Text style={[styles.chipText, difficulty === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
        <FlatList
          horizontal
          data={[
            { id: '', label: 'All Status' },
            { id: 'true', label: 'Published' },
            { id: 'false', label: 'Draft' },
          ]}
          keyExtractor={(item) => `status-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, status === item.id && styles.chipActive]}
              onPress={() => setStatus(item.id)}
            >
              <Text style={[styles.chipText, status === item.id && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

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
            <BookEmpty title="No questions found" subtitle="Try different filter options." />
          }
          renderItem={({ item }) => {
            const link = linkBadge(item);
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => router.push(questionDetailHref(item.id))}
              >
                <View style={styles.cardIcon}>
                  <Ionicons name="help-circle-outline" size={20} color="#7c3aed" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardText}>{item.body_en}</Text>
                  <View style={styles.badges}>
                    <BookBadge
                      label={item.question_type_name ?? typeNameMap.get(item.question_type_code) ?? item.question_type_code}
                      variant="muted"
                    />
                    {link ? <BookBadge label={link} variant="muted" /> : null}
                    {isAdmin ? <BookBadge label={item.difficulty} variant="muted" /> : null}
                    {isAdmin ? <BookBadge label={`${item.marks} marks`} variant="muted" /> : null}
                    {isAdmin ? (
                      <BookBadge label={item.is_published ? 'Published' : 'Draft'} variant="muted" />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
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
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  filters: {
    gap: 6,
    paddingBottom: spacing.sm,
  },
  chips: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.white,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 8,
  },
  cardText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pressed: {
    opacity: 0.9,
  },
});
