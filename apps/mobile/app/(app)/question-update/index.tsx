import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QUESTION_DIFFICULTIES, QUESTION_REVIEW_STATUSES, QUESTION_SORT_OPTIONS } from '@ibas/shared-constants';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { ReviewStatusBadge } from '@/components/questions/ReviewStatusBadge';
import { fetchQuestionTypes } from '@/lib/questions-api';
import { fetchQuestionsForEdit } from '@/lib/question-edit-api';
import type { QuestionListItem, ReviewStatus } from '@/types/questions';
import type { QuestionType } from '@/types/questions';
import { colors, spacing } from '@/theme';

const PAGE_SIZE = 20;

const SORT_LABEL: Record<(typeof QUESTION_SORT_OPTIONS)[number], string> = {
  updated_desc: 'Recently updated',
  updated_asc: 'Oldest updated',
  created_desc: 'Recently created',
  created_asc: 'Oldest created',
  marks_desc: 'Marks: high-low',
  marks_asc: 'Marks: low-high',
  body_en_asc: 'Text A-Z',
  body_en_desc: 'Text Z-A',
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  quality_check: 'Quality check',
  published: 'Published',
};

export default function QuestionUpdateListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | ''>('');
  const [sort, setSort] = useState<(typeof QUESTION_SORT_OPTIONS)[number]>('updated_desc');

  const requestId = useRef(0);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      const thisRequest = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const res = await fetchQuestionsForEdit({
          q: appliedQuery || undefined,
          question_type_code: typeCode || undefined,
          difficulty: difficulty || undefined,
          review_status: reviewStatus || undefined,
          sort,
          limit: PAGE_SIZE,
          offset,
        });
        if (thisRequest !== requestId.current) return;
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        setHasMore(res.hasMore);
      } catch (err) {
        if (thisRequest !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load questions');
        if (!append) setItems([]);
      } finally {
        if (thisRequest !== requestId.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [appliedQuery, typeCode, difficulty, reviewStatus, sort],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  useEffect(() => {
    fetchQuestionTypes()
      .then(setTypes)
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Refresh on return from the edit screen so status/content changes are visible.
      void load(0, false);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only refresh on focus, not every dep change
    }, []),
  );

  function submitSearch() {
    setAppliedQuery(query.trim());
  }

  function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    void load(items.length, true);
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
            onSubmitEditing={submitSearch}
          />
          {query ? (
            <Pressable onPress={() => { setQuery(''); setAppliedQuery(''); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.searchBtn} onPress={submitSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <Text style={styles.metaText}>
        {loading ? 'Loading…' : `${total} question${total === 1 ? '' : 's'}`}
      </Text>

      {error && items.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.filters}>
        <FlatList
          horizontal
          data={[{ id: '', label: 'All types' }, ...types.map((t) => ({ id: t.code, label: t.name }))]}
          keyExtractor={(item) => `type-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, typeCode === item.id && styles.chipActive]}
              onPress={() => setTypeCode(item.id)}
            >
              <Text style={[styles.chipText, typeCode === item.id && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
        <FlatList
          horizontal
          data={[{ id: '', label: 'All difficulty' }, ...QUESTION_DIFFICULTIES.map((d) => ({ id: d, label: d }))]}
          keyExtractor={(item) => `difficulty-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, difficulty === item.id && styles.chipActive]}
              onPress={() => setDifficulty(item.id)}
            >
              <Text style={[styles.chipText, difficulty === item.id && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
        <FlatList
          horizontal
          data={[
            { id: '' as const, label: 'All statuses' },
            ...QUESTION_REVIEW_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] })),
          ]}
          keyExtractor={(item) => `status-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, reviewStatus === item.id && styles.chipActive]}
              onPress={() => setReviewStatus(item.id)}
            >
              <Text style={[styles.chipText, reviewStatus === item.id && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
        <FlatList
          horizontal
          data={QUESTION_SORT_OPTIONS.map((s) => ({ id: s, label: SORT_LABEL[s] }))}
          keyExtractor={(item) => `sort-${item.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, styles.sortChip, sort === item.id && styles.chipActive]}
              onPress={() => setSort(item.id)}
            >
              <Ionicons
                name="swap-vertical"
                size={12}
                color={sort === item.id ? colors.white : colors.textMuted}
              />
              <Text style={[styles.chipText, sort === item.id && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
      </View>

      {loading && items.length === 0 ? (
        <BookLoading />
      ) : error && items.length === 0 ? (
        <BookError message={error} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <BookEmpty title="No questions found" subtitle="Try a different search or filter." />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(`/(app)/question-update/${item.id}` as never)}
            >
              <View style={styles.cardIcon}>
                <Ionicons name="create-outline" size={20} color="#7c3aed" />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardText} numberOfLines={3}>
                  {item.body_en}
                </Text>
                <View style={styles.badges}>
                  <BookBadge
                    label={item.question_type_name ?? item.question_type_code}
                    variant="muted"
                  />
                  <BookBadge label={item.difficulty} variant="muted" />
                  <BookBadge label={`${item.marks} marks`} variant="muted" />
                  <ReviewStatusBadge status={item.review_status ?? 'draft'} />
                </View>
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
  metaText: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: '#fde8e8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f5b5b5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBannerText: {
    color: '#b42318',
    fontSize: 12,
    fontWeight: '600',
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
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    paddingBottom: spacing.xl,
  },
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
