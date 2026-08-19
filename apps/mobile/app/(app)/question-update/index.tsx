import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QUESTION_REVIEW_STATUSES, QUESTION_SORT_OPTIONS } from '@ibas/shared-constants';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { ReviewStatusBadge } from '@/components/questions/ReviewStatusBadge';
import { fetchQuestionForEdit, fetchQuestionsForEdit } from '@/lib/question-edit-api';
import { useAuth } from '@/lib/auth-context';
import { useQuestionUpdateCatalogs } from '@/lib/question-update-catalogs';
import { QuestionQuickTags } from '@/components/questions/QuestionQuickTags';
import { QuestionQuickType } from '@/components/questions/QuestionQuickType';
import type { QuestionListItem, ReviewStatus } from '@/types/questions';
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
  const { user, canUpdate } = useAuth();
  const canTag =
    canUpdate('QUESTION_EDIT') ||
    Boolean(user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin');
  const { types, subjectCatalog, bookCatalog, catalogsReady } = useQuestionUpdateCatalogs();
  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [bookId, setBookId] = useState('');
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
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
          book_info_id: bookId || undefined,
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
    [appliedQuery, typeCode, bookId, reviewStatus, sort],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  const lastOpenedIdRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Patch just the question we came back from editing — a full reload would drop it out
      // of the current filter (e.g. status just changed) or reshuffle sort order, breaking the
      // "work through this filtered batch one by one" flow.
      const openedId = lastOpenedIdRef.current;
      if (!openedId) return;
      lastOpenedIdRef.current = null;
      void fetchQuestionForEdit(openedId)
        .then((detail) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === openedId
                ? {
                    ...it,
                    body_en: detail.body_en,
                    body_bn: detail.body_bn,
                    difficulty: detail.difficulty,
                    marks: detail.marks,
                    is_published: detail.is_published,
                    review_status: detail.review_status,
                  }
                : it,
            ),
          );
        })
        .catch(() => {
          // Non-fatal — the row just keeps showing its last-known state until the next full reload.
        });
    }, []),
  );

  function openQuestion(id: string) {
    lastOpenedIdRef.current = id;
    router.push(`/(app)/question-update/${id}` as never);
  }

  const bookOptions = useMemo(
    () => [...bookCatalog].sort((a, b) => a.label.localeCompare(b.label)),
    [bookCatalog],
  );
  const selectedBookName = bookId
    ? bookOptions.find((b) => b.id === bookId)?.label ?? bookOptions.find((b) => b.id === bookId)?.name
    : null;

  function submitSearch() {
    setAppliedQuery(query.trim());
  }

  function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    void load(items.length, true);
  }

  function toggleBookMenu() {
    setBookMenuOpen((v) => !v);
  }

  function selectBook(id: string) {
    setBookId(id);
    setBookMenuOpen(false);
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
        <Pressable
          style={[styles.moreIconBtn, bookMenuOpen && styles.moreIconBtnActive]}
          onPress={toggleBookMenu}
          hitSlop={8}
          accessibilityLabel="Books and tools list"
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={bookMenuOpen ? colors.white : colors.primary}
          />
        </Pressable>
      </View>

      {bookMenuOpen ? (
        <View style={styles.bookMenu}>
          <Text style={styles.bookMenuTitle}>Books &amp; Tools</Text>
          <Text style={styles.bookMenuSub}>Filter questions by book</Text>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} contentContainerStyle={styles.bookMenuList}>
            <Pressable
              style={[styles.bookMenuItem, !bookId && styles.bookMenuItemActive]}
              onPress={() => selectBook('')}
            >
              <Text style={[styles.bookMenuItemText, !bookId && styles.bookMenuItemTextActive]}>
                All books &amp; tools
              </Text>
            </Pressable>
            {bookOptions.length === 0 ? (
              <Text style={styles.bookMenuEmpty}>
                {catalogsReady ? 'No books in catalog.' : 'Loading books…'}
              </Text>
            ) : (
              bookOptions.map((book) => {
                const active = bookId === book.id;
                return (
                  <Pressable
                    key={book.id}
                    style={[styles.bookMenuItem, active && styles.bookMenuItemActive]}
                    onPress={() => selectBook(book.id)}
                  >
                    <Text
                      style={[styles.bookMenuItemText, active && styles.bookMenuItemTextActive]}
                      numberOfLines={2}
                    >
                      {book.label}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}

      {selectedBookName ? (
        <View style={styles.filterChipRow}>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText} numberOfLines={1}>
              {selectedBookName}
            </Text>
            <Pressable onPress={() => selectBook('')} hitSlop={8} accessibilityLabel="Clear book filter">
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

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
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [styles.cardTop, pressed && styles.pressed]}
                onPress={() => openQuestion(item.id)}
              >
                <Text style={styles.cardText} numberOfLines={3}>
                  {item.body_en}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
              <View style={styles.badges}>
                <QuestionQuickType
                  questionId={item.id}
                  typeId={item.question_type_id}
                  typeCode={item.question_type_code}
                  typeName={item.question_type_name}
                  types={types}
                  disabled={!canTag}
                  onChanged={(next) =>
                    setItems((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? {
                              ...row,
                              question_type_id: next.id,
                              question_type_code: next.code,
                              question_type_name: next.name,
                            }
                          : row,
                      ),
                    )
                  }
                />
                <BookBadge label={item.difficulty} variant="muted" />
                <BookBadge label={`${item.marks} marks`} variant="muted" />
                <ReviewStatusBadge status={item.review_status ?? 'draft'} by={item.status_by_name} />
                {(item.used_in_papers ?? []).map((paper) => {
                  const session =
                    paper.session_label_en?.trim() ||
                    paper.session_year?.trim() ||
                    paper.session_label_bn?.trim() ||
                    '';
                  const label = session ? `${session} · ${paper.name}` : paper.name;
                  return <BookBadge key={paper.id} label={label} variant="muted" />;
                })}
              </View>
              {canTag || (item.subjects ?? []).length > 0 || (item.book_tags ?? []).length > 0 ? (
              <QuestionQuickTags
                questionId={item.id}
                subjects={item.subjects ?? []}
                books={item.book_tags ?? []}
                subjectCatalog={subjectCatalog}
                bookCatalog={bookCatalog}
                disabled={!canTag}
                onSubjectsChange={(subjects) =>
                  setItems((prev) =>
                    prev.map((row) => (row.id === item.id ? { ...row, subjects } : row)),
                  )
                }
                onBooksChange={(book_tags) =>
                  setItems((prev) =>
                    prev.map((row) => (row.id === item.id ? { ...row, book_tags } : row)),
                  )
                }
              />
              ) : null}
            </View>
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
  moreIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  moreIconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bookMenu: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    maxHeight: 280,
  },
  bookMenuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  bookMenuSub: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  bookMenuList: {
    gap: 2,
  },
  bookMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  bookMenuItemActive: {
    backgroundColor: '#e8f3fa',
  },
  bookMenuItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bookMenuItemTextActive: {
    color: colors.primary,
  },
  bookMenuEmpty: {
    padding: 12,
    fontSize: 13,
    color: colors.textMuted,
  },
  filterChipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8f3fa',
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
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
