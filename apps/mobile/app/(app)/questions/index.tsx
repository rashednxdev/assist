import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError } from '@/components/books/BookStates';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { fetchQuestionEvaluationsBatchChunked, type QuestionEvalBrief } from '@/lib/evaluation-api';
import { fetchQuestionTypes } from '@/lib/questions-api';
import { getCachedQuestionListItems } from '@/lib/questions-db';
import { subscribeQuestionsSync, syncQuestions } from '@/lib/questions-sync';
import { searchQuestionsByText } from '@/lib/question-search';
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
import { BlockingLoader } from '@/components/ui/BlockingLoader';
import { cleanBookLabel, stripHtml } from '@/lib/book-display';
import type { QuestionListItem, QuestionType } from '@/types/questions';
import { colors, spacing } from '@/theme';

const UNLINKED_BOOK_KEY = '__unlinked__';

type BankRow =
  | { kind: 'book'; key: string; book_name: string }
  | { kind: 'chapter'; key: string; label: string }
  | { kind: 'question'; key: string; item: QuestionListItem; match?: number };

/**
 * Flattens the already book/chapter-sorted list into book/chapter header rows interleaved with
 * question rows — same grouped presentation as Marathon Review, but kept as one FlatList data
 * array so search/scrollToIndex/resume-to-last-read keep working unchanged.
 */
function buildBankRows(items: QuestionListItem[]): BankRow[] {
  const rows: BankRow[] = [];
  let lastBookKey: string | null = null;
  let lastChapterKey: string | null = null;

  for (const item of items) {
    const bookKey = item.book_id ?? UNLINKED_BOOK_KEY;
    if (bookKey !== lastBookKey) {
      rows.push({
        kind: 'book',
        key: `book-${bookKey}`,
        book_name: item.book_id ? item.book_name || 'Untitled book' : 'Not linked to a book',
      });
      lastBookKey = bookKey;
      lastChapterKey = null;
    }

    const chapterKey = item.book_chapter_id ?? `${bookKey}:__general__`;
    if (chapterKey !== lastChapterKey) {
      const no = cleanBookLabel(item.chapter_number);
      const name = cleanBookLabel(item.chapter_name) || item.chapter_name || '';
      const label = item.book_chapter_id ? (no ? `${no}: ${name}` : name || 'Chapter') : 'General';
      rows.push({ kind: 'chapter', key: `chapter-${chapterKey}`, label });
      lastChapterKey = chapterKey;
    }

    rows.push({ kind: 'question', key: item.id, item });
  }

  return rows;
}

export default function QuestionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin =
    user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin';
  const { isSaved, toggle } = useSavedShortcuts();

  const [items, setItems] = useState<QuestionListItem[]>([]);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [resumeTarget, setResumeTarget] = useState<QuestionBankLastQuestion | null>(null);
  const [resumeReady, setResumeReady] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());

  const listRef = useRef<FlatList<BankRow>>(null);
  const scrollYRef = useRef(0);
  const didResume = useRef(false);
  const itemsRef = useRef<QuestionListItem[]>([]);
  const bankRowsRef = useRef<BankRow[]>([]);
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

  /** Chip-filtered items (book/type/difficulty) — search scoring happens separately below. */
  const chipFilteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedBookId && item.book_id !== selectedBookId) return false;
      if (typeCode && item.question_type_code !== typeCode) return false;
      if (difficulty && item.difficulty !== difficulty) return false;
      return true;
    });
  }, [items, selectedBookId, typeCode, difficulty]);

  /**
   * Smart search: word-match scoring (any query word matching anywhere counts), 50%+ match,
   * best match first — same standard as the web admin's link-search. Entirely local since the
   * whole bank is already synced; no network round-trip per keystroke.
   */
  const searchResults = useMemo(
    () =>
      searchQuestionsByText(appliedQuery, chipFilteredItems, (item) => ({
        bodyEn: item.body_en,
        bodyBn: item.body_bn,
      })),
    [chipFilteredItems, appliedQuery],
  );

  const visibleItems = useMemo(() => searchResults.map((r) => r.item), [searchResults]);
  const isSearching = Boolean(appliedQuery.trim());

  useEffect(() => {
    const ids = visibleItems.map((i) => i.id);
    if (ids.length === 0) {
      setEvalMap(new Map());
      return;
    }
    let cancelled = false;
    fetchQuestionEvaluationsBatchChunked(ids)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, QuestionEvalBrief>();
        for (const row of rows) {
          if (row.progress_index > 0 || row.self_rating || row.is_correct !== undefined) {
            map.set(row.question_id, row);
          }
        }
        setEvalMap(map);
      })
      .catch(() => {
        if (!cancelled) setEvalMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [visibleItems]);

  /**
   * Grouped-by-book/chapter rows when browsing (no search); a flat, best-match-first list with
   * match% badges when searching — relevance order wouldn't make sense interleaved with headers.
   */
  const bankRows = useMemo(() => {
    if (isSearching) {
      return searchResults.map(
        (r): BankRow => ({ kind: 'question', key: r.item.id, item: r.item, match: Math.round(r.score * 100) }),
      );
    }
    return buildBankRows(visibleItems);
  }, [isSearching, searchResults, visibleItems]);

  itemsRef.current = items;
  bankRowsRef.current = bankRows;
  setQuestionBankSessionOrder(items.map((row) => row.id));

  function scrollToQuestionId(id: string, animated = false) {
    const data = bankRowsRef.current;
    const index = data.findIndex((row) => row.kind === 'question' && row.item.id === id);
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
      else setResuming(false);
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

  const refreshFromCache = useCallback(() => {
    setItems(getCachedQuestionListItems());
  }, []);

  // Local read is instant; the network sync just refreshes what's already on screen.
  useEffect(() => {
    setError('');
    try {
      refreshFromCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }

    fetchQuestionTypes()
      .then(setTypes)
      .catch(() => {
        // Non-fatal — type chips just fall back to the raw type code.
      });

    return subscribeQuestionsSync(refreshFromCache);
  }, [refreshFromCache]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncQuestions();
    } catch (err) {
      if (itemsRef.current.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to sync questions');
      }
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void runSync();
  }, [runSync]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync();
    } finally {
      setRefreshing(false);
    }
  }, [runSync]);

  // After the full bank has loaded, jump to the last-read question by index — same shape as
  // Marathon Review's resume effect: wait while the cache is still empty rather than bailing out
  // on a not-yet-synced item, then always attempt the scroll once there's something to scroll.
  useEffect(() => {
    if (!resumeReady || didResume.current || !resumeTarget || items.length === 0) return;
    if (loading) return;
    if (hasActiveFilter) {
      didResume.current = true;
      setResuming(false);
      return;
    }

    setHighlightId(resumeTarget.id);
    const t = setTimeout(() => {
      const ok = scrollToQuestionId(resumeTarget.id, false);
      didResume.current = true;
      setResuming(false);
      if (!ok && typeof resumeTarget.index === 'number') {
        listRef.current?.scrollToIndex({
          index: Math.min(resumeTarget.index, Math.max(0, bankRowsRef.current.length - 1)),
          animated: false,
          viewPosition: 0.08,
        });
      }
    }, 120);

    return () => clearTimeout(t);
  }, [resumeReady, resumeTarget, items, loading, hasActiveFilter]);

  // Safety net: an empty bank (or one where resume never resolves) shouldn't loop the loader
  // forever — matches Marathon Review's fallback.
  useEffect(() => {
    if (!loading && resumeReady && items.length === 0) setResuming(false);
  }, [loading, resumeReady, items]);

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
      {resuming || (loading && items.length === 0) ? (
        <BlockingLoader label="Loading Question Bank…" />
      ) : null}
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
                {loading ? 'Loading books from questions…' : 'No book-linked questions yet.'}
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
          {hasActiveFilter
            ? `Showing ${visibleItems.length} of ${items.length} loaded`
            : `Showing ${items.length} questions${syncing ? ' · syncing…' : ''}`}
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
            ...types.filter((t) => t.code !== 'MCQ').map((t) => ({ id: t.code, label: t.name })),
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

      {loading && items.length === 0 ? null : error && items.length === 0 ? (
        <BookError message={error} />
      ) : (
        <FlatList
          ref={listRef}
          data={bankRows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
              {items.length > 0 && !hasActiveFilter ? (
                <Text style={styles.footerHint}>{items.length} questions loaded</Text>
              ) : hasActiveFilter && visibleItems.length > 0 ? (
                <Text style={styles.footerHint}>
                  Filtered · {visibleItems.length} of {items.length}
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item: row }) => {
            if (row.kind === 'book') {
              return <Text style={styles.bookHeader}>{row.book_name}</Text>;
            }
            if (row.kind === 'chapter') {
              return <Text style={styles.chapterHeader}>{row.label}</Text>;
            }

            const item = row.item;
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
                    <RatingIndicator evaluation={evalMap.get(item.id)} />
                    <BookBadge
                      label={
                        item.question_type_name ??
                        typeNameMap.get(item.question_type_code) ??
                        item.question_type_code
                      }
                      variant="muted"
                    />
                    {isAdmin ? <BookBadge label={item.difficulty} variant="muted" /> : null}
                    {isAdmin ? <BookBadge label={`${item.marks} marks`} variant="muted" /> : null}
                    {typeof row.match === 'number' ? (
                      <BookBadge label={`${row.match}% match`} variant="muted" />
                    ) : null}
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
  bookHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  chapterHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
