import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchQuestionsPage, fetchQuestionTypes } from '@/lib/questions-api';
import { questionDetailHref } from '@/lib/question-routes';
import {
  loadQuestionBankLastQuestion,
  saveQuestionBankLastQuestion,
  type QuestionBankLastQuestion,
} from '@/lib/question-bank-progress';
import { setQuestionBankSessionOrder } from '@/lib/question-bank-order';
import { useAuth } from '@/lib/auth-context';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { SaveButton } from '@/components/ui/SaveButton';
import { stripHtml } from '@/lib/book-display';
import type { QuestionListItem, QuestionType } from '@/types/questions';
import { colors, spacing } from '@/theme';

const PAGE_SIZE = 100;

export default function QuestionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin =
    user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin';
  const { isSaved, toggle } = useSavedShortcuts();

  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [resumeTarget, setResumeTarget] = useState<QuestionBankLastQuestion | null>(null);
  const [resumeReady, setResumeReady] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const listRef = useRef<FlatList<QuestionListItem>>(null);
  const scrollYRef = useRef(0);
  const didResume = useRef(false);
  const itemsRef = useRef<QuestionListItem[]>([]);
  const visibleItemsRef = useRef<QuestionListItem[]>([]);
  const skipNextFocusScroll = useRef(true);

  const typeNameMap = useMemo(() => new Map(types.map((t) => [t.code, t.name])), [types]);

  /** Books present in the already-loaded list (local filter only). */
  const bookOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const item of items) {
      if (!item.book_id || !item.book_name) continue;
      const existing = map.get(item.book_id);
      if (existing) existing.count += 1;
      else map.set(item.book_id, { id: item.book_id, name: item.book_name, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const selectedBookName = selectedBookId
    ? bookOptions.find((b) => b.id === selectedBookId)?.name
    : null;

  const hasActiveFilter = Boolean(
    appliedQuery.trim() || typeCode || difficulty || selectedBookId,
  );

  /** Client-side filter — no API call when search / book / chips change. */
  const visibleItems = useMemo(() => {
    const q = appliedQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedBookId && item.book_id !== selectedBookId) return false;
      if (typeCode && item.question_type_code !== typeCode) return false;
      if (difficulty && item.difficulty !== difficulty) return false;
      if (q) {
        const en = (item.body_en ?? '').toLowerCase();
        const bn = (item.body_bn ?? '').toLowerCase();
        if (!en.includes(q) && !bn.includes(q)) return false;
      }
      return true;
    });
  }, [items, selectedBookId, typeCode, difficulty, appliedQuery]);

  itemsRef.current = items;
  visibleItemsRef.current = visibleItems;
  setQuestionBankSessionOrder(items.map((row) => row.id));

  function scrollToQuestionId(id: string, animated = false) {
    const data = visibleItemsRef.current;
    const index = data.findIndex((row) => row.id === id);
    if (index < 0) return false;

    const run = () => {
      listRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: 0.08,
      });
      scrollYRef.current = 0;
    };

    // FlatList may not be ready on the first frame after data settles
    requestAnimationFrame(() => {
      try {
        run();
      } catch {
        setTimeout(run, 80);
      }
    });
    return true;
  }

  useEffect(() => {
    void loadQuestionBankLastQuestion().then((pos) => {
      setResumeTarget(pos);
      if (pos) setHighlightId(pos.id);
      setResumeReady(true);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadQuestionBankLastQuestion().then((pos) => {
        if (cancelled || !pos) return;
        setResumeTarget(pos);
        setHighlightId(pos.id);

        // Skip first focus (cold open) — that resume runs after the full list loads.
        if (skipNextFocusScroll.current) {
          skipNextFocusScroll.current = false;
          return;
        }
        // Returning from a question detail: put last-read back in view.
        if (!hasActiveFilter) {
          setTimeout(() => {
            if (!cancelled) scrollToQuestionId(pos.id, true);
          }, 50);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [hasActiveFilter]),
  );

  // Load full bank once; filters only slice this list locally.
  useEffect(() => {
    let cancelled = false;

    async function loadAllSequential() {
      setError('');
      setLoading(true);
      setLoadingMore(false);
      didResume.current = false;

      try {
        const [first, typeRows] = await Promise.all([
          fetchQuestionsPage({ limit: PAGE_SIZE, offset: 0, is_published: 'true' }),
          fetchQuestionTypes(),
        ]);
        if (cancelled) return;

        let all = first.items;
        setItems(all);
        setTypes(typeRows);
        const knownTotal = first.meta.total > 0 ? first.meta.total : all.length;
        setTotal(knownTotal);
        setLoading(false);

        let offset = all.length;
        let more =
          first.meta.has_more === true ||
          first.meta.total > all.length ||
          first.items.length >= PAGE_SIZE;

        setLoadingMore(more);

        while (more && !cancelled) {
          const page = await fetchQuestionsPage({
            limit: PAGE_SIZE,
            offset,
            is_published: 'true',
          });
          if (cancelled) return;

          if (page.meta.offset != null && page.meta.offset !== offset && page.items.length > 0) {
            const overlap = all.some((row) => row.id === page.items[0]?.id);
            if (overlap && page.meta.offset === 0) {
              setError(
                'API did not apply pagination (offset ignored). Restart Expo against the local API.',
              );
              break;
            }
          }

          const seen = new Set(all.map((i) => i.id));
          const newRows = page.items.filter((row) => !seen.has(row.id));
          if (newRows.length === 0) {
            if (page.items.length > 0 && all.length < (page.meta.total || knownTotal)) {
              setError(
                'Could not load more questions — server returned duplicates. Use local API with latest code.',
              );
            }
            break;
          }

          all = [...all, ...newRows];
          offset = all.length;
          setItems(all);
          if (typeof page.meta.total === 'number' && page.meta.total > 0) {
            setTotal(page.meta.total);
          } else {
            setTotal(all.length);
          }

          more =
            page.meta.has_more === true ||
            page.meta.total > all.length ||
            page.items.length >= PAGE_SIZE;
        }
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    void loadAllSequential();
    return () => {
      cancelled = true;
    };
  }, []);

  // After the full bank has loaded, jump to the last-read question by index.
  useEffect(() => {
    if (!resumeReady || didResume.current || !resumeTarget) return;
    if (hasActiveFilter) return;
    if (loading || loadingMore) return;

    const index = items.findIndex((i) => i.id === resumeTarget.id);
    if (index < 0) {
      didResume.current = true;
      return;
    }

    setHighlightId(resumeTarget.id);
    const t = setTimeout(() => {
      const ok = scrollToQuestionId(resumeTarget.id, false);
      didResume.current = true;
      if (!ok && typeof resumeTarget.index === 'number') {
        listRef.current?.scrollToIndex({
          index: Math.min(resumeTarget.index, Math.max(0, items.length - 1)),
          animated: false,
          viewPosition: 0.08,
        });
      }
    }, 120);

    return () => clearTimeout(t);
  }, [resumeReady, resumeTarget, items, loading, loadingMore, hasActiveFilter]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }

  function submitSearch() {
    setAppliedQuery(query.trim());
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function clearSearch() {
    setQuery('');
    setAppliedQuery('');
  }

  function clearAllFilters() {
    setQuery('');
    setAppliedQuery('');
    setTypeCode('');
    setDifficulty('');
    setSelectedBookId(null);
    setBookMenuOpen(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function toggleBookMenu() {
    setBookMenuOpen((v) => !v);
  }

  function selectBook(bookId: string | null) {
    setSelectedBookId(bookId);
    setBookMenuOpen(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function openQuestion(item: QuestionListItem) {
    const list = itemsRef.current;
    const index = list.findIndex((row) => row.id === item.id);
    const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;
    const pos: QuestionBankLastQuestion = {
      id: item.id,
      index: index >= 0 ? index : undefined,
      nextId: next?.id,
    };
    setHighlightId(item.id);
    setResumeTarget(pos);
    void saveQuestionBankLastQuestion(pos);
    router.push(questionDetailHref(item.id));
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
          {query || appliedQuery ? (
            <Pressable onPress={clearSearch} hitSlop={8} accessibilityLabel="Clear search">
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
          accessibilityLabel="Books with questions"
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
          <Text style={styles.bookMenuSub}>Filter this list locally — no reload</Text>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} contentContainerStyle={styles.bookMenuList}>
            <Pressable
              style={[styles.bookMenuItem, !selectedBookId && styles.bookMenuItemActive]}
              onPress={() => selectBook(null)}
            >
              <Text
                style={[styles.bookMenuItemText, !selectedBookId && styles.bookMenuItemTextActive]}
              >
                All books
              </Text>
              <Text style={styles.bookMenuCount}>{items.length}</Text>
            </Pressable>
            {bookOptions.length === 0 ? (
              <Text style={styles.bookMenuEmpty}>
                {loadingMore || loading ? 'Loading books from questions…' : 'No book-linked questions yet.'}
              </Text>
            ) : (
              bookOptions.map((book) => {
                const active = selectedBookId === book.id;
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
                      {book.name}
                    </Text>
                    <Text style={styles.bookMenuCount}>{book.count}</Text>
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
            <Pressable onPress={() => selectBook(null)} hitSlop={8} accessibilityLabel="Clear book filter">
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {loadingMore
            ? `Loading… ${items.length}${total > items.length ? ` of ${total}` : ''} questions`
            : hasActiveFilter
              ? `Showing ${visibleItems.length} of ${items.length} loaded`
              : `Showing ${items.length}${total > 0 && total !== items.length ? ` of ${total}` : ''} questions`}
        </Text>
        {hasActiveFilter ? (
          <Pressable onPress={clearAllFilters} hitSlop={8}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      {error && items.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

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
      </View>

      {loading && items.length === 0 ? (
        <BookLoading />
      ) : error && items.length === 0 ? (
        <BookError message={error} />
      ) : (
        <FlatList
          ref={listRef}
          data={visibleItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollToIndexFailed={(info) => {
            const approx = Math.max(0, info.averageItemLength || 120);
            listRef.current?.scrollToOffset({
              offset: approx * info.index,
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0.08,
              });
            }, 120);
          }}
          ListEmptyComponent={
            <BookEmpty
              title={hasActiveFilter ? 'No matches in loaded questions' : 'No questions found'}
              subtitle={
                hasActiveFilter
                  ? 'Clear filters to restore the full list.'
                  : 'Try again later or pull after questions are published.'
              }
            />
          }
          ListFooterComponent={
            <View style={styles.footerWrap}>
              {loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.footerLoadingText}>
                    Loading more… {items.length}
                    {total > items.length ? ` / ${total}` : ''}
                  </Text>
                </View>
              ) : items.length > 0 && !hasActiveFilter ? (
                <Text style={styles.footerHint}>All questions loaded · {total || items.length}</Text>
              ) : hasActiveFilter && visibleItems.length > 0 ? (
                <Text style={styles.footerHint}>
                  Filtered · {visibleItems.length} of {items.length}
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            const isLast = highlightId === item.id;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  isLast && styles.cardLastRead,
                  pressed && styles.pressed,
                ]}
                onPress={() => openQuestion(item)}
              >
                <View style={[styles.cardIcon, isLast && styles.cardIconLastRead]}>
                  <Ionicons
                    name="help-circle-outline"
                    size={20}
                    color={isLast ? '#2f7d4a' : '#7c3aed'}
                  />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardText} numberOfLines={4}>
                      {item.body_en}
                    </Text>
                    {isLast ? (
                      <View style={styles.lastReadChip}>
                        <Text style={styles.lastReadChipText}>Last read</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.badges}>
                    <BookBadge
                      label={
                        item.question_type_name ??
                        typeNameMap.get(item.question_type_code) ??
                        item.question_type_code
                      }
                      variant="muted"
                    />
                    {item.book_name ? <BookBadge label={item.book_name} variant="muted" /> : null}
                    {isAdmin ? <BookBadge label={item.difficulty} variant="muted" /> : null}
                    {isAdmin ? <BookBadge label={`${item.marks} marks`} variant="muted" /> : null}
                  </View>
                </View>
                <SaveButton
                  saved={
                    item.question_type_code === 'MCQ'
                      ? isSaved(item.id, 'marathon')
                      : isSaved(item.id, 'question')
                  }
                  onPress={() => {
                    const isMcq = item.question_type_code === 'MCQ';
                    const title = stripHtml(
                      isMcq
                        ? item.body_bn?.trim() || item.body_en || ''
                        : item.body_en || item.body_bn || '',
                    ).slice(0, 120);
                    void toggle(
                      isMcq
                        ? {
                            id: item.id,
                            kind: 'marathon',
                            title,
                            subtitle: item.book_name ?? 'Marathon Review',
                            book_id: item.book_id,
                            chapter_id: item.book_chapter_id,
                          }
                        : {
                            id: item.id,
                            kind: 'question',
                            title,
                            subtitle: item.book_name,
                            book_id: item.book_id,
                          },
                    );
                  }}
                />
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
  bookMenuCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
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
  metaRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
  footerWrap: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  footerLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  footerLoadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footerHint: {
    textAlign: 'center',
    paddingVertical: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
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
  cardLastRead: {
    backgroundColor: '#eaf7ee',
    borderColor: '#a8d5b5',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconLastRead: {
    backgroundColor: '#d4eedc',
  },
  cardBody: {
    flex: 1,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  lastReadChip: {
    backgroundColor: '#c8e6d0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lastReadChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2f7d4a',
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
