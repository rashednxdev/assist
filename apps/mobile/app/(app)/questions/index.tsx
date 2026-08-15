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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError } from '@/components/books/BookStates';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { fetchQuestionEvaluationsBatchChunked, type QuestionEvalBrief } from '@/lib/evaluation-api';
import { fetchQuestionTypes, fetchQuestionSubjectCatalog, fetchQuestionsBySubject } from '@/lib/questions-api';
import { getCachedQuestionListItems, mergeCachedQuestionSubjects } from '@/lib/questions-db';
import { subscribeQuestionsSync, syncQuestions } from '@/lib/questions-sync';
import { questionCacheScopeKey } from '@/lib/subject-scope';
import { searchQuestionsByText } from '@/lib/question-search';
import { questionDetailHref } from '@/lib/question-routes';
import { saveQuestionBankLastQuestion } from '@/lib/question-bank-progress';
import { setQuestionBankSessionOrder } from '@/lib/question-bank-order';
import { useAuth } from '@/lib/auth-context';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { SaveButton } from '@/components/ui/SaveButton';
import { BlockingLoader } from '@/components/ui/BlockingLoader';
import { AnswerPdfDownloadSheet } from '@/components/questions/AnswerPdfDownloadSheet';
import { cleanBookLabel, stripHtml } from '@/lib/book-display';
import type { QuestionListItem, QuestionType } from '@/types/questions';
import { colors, spacing } from '@/theme';

const UNLINKED_BOOK_KEY = '__unlinked__';
const PAGE_SIZE = 100;

type BankRow =
  | { kind: 'book'; key: string; book_name: string }
  | { kind: 'chapter'; key: string; label: string }
  | { kind: 'question'; key: string; item: QuestionListItem; match?: number };

/** Book/chapter grouping for optional “Group by Books & Tools” mode. */
function sortForBookGrouping(items: QuestionListItem[]): QuestionListItem[] {
  return [...items].sort((a, b) => {
    const aBook = a.book_name?.trim() || '';
    const bBook = b.book_name?.trim() || '';
    const aUnlinked = !a.book_id ? 1 : 0;
    const bUnlinked = !b.book_id ? 1 : 0;
    if (aUnlinked !== bUnlinked) return aUnlinked - bUnlinked;
    const bookCmp = aBook.localeCompare(bBook, undefined, { sensitivity: 'base' });
    if (bookCmp !== 0) return bookCmp;
    const aCh = a.chapter_number?.trim() || '';
    const bCh = b.chapter_number?.trim() || '';
    const chCmp = aCh.localeCompare(bCh, undefined, { sensitivity: 'base', numeric: true });
    if (chCmp !== 0) return chCmp;
    return (b.updated_at || '').localeCompare(a.updated_at || '');
  });
}

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
  const { user, refreshUser, canAccess } = useAuth();
  const canDownloadPdf = canAccess('ANSWER_PDF');
  const [pdfOpen, setPdfOpen] = useState(false);
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectCatalog, setSubjectCatalog] = useState<
    Array<{ id: string; name: string; label: string }>
  >([]);
  const [subjectMatchIds, setSubjectMatchIds] = useState<Set<string> | null>(null);
  const [groupByBooks, setGroupByBooks] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());
  const [loadingMore, setLoadingMore] = useState(false);

  const itemsRef = useRef<QuestionListItem[]>([]);
  const filteredRef = useRef<QuestionListItem[]>([]);
  const userRef = useRef(user);
  const refreshUserRef = useRef(refreshUser);
  userRef.current = user;
  refreshUserRef.current = refreshUser;

  const typeNameMap = useMemo(() => new Map(types.map((t) => [t.code, t.name])), [types]);

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

  const subjectOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of subjectCatalog) {
      map.set(s.id, { id: s.id, name: s.name, count: 0 });
    }
    for (const item of items) {
      for (const subject of item.subjects ?? []) {
        const label = subject.name_bn?.trim() || subject.name;
        const existing = map.get(subject.id);
        if (existing) {
          existing.count += 1;
          if (!existing.name) existing.name = label;
        } else {
          map.set(subject.id, { id: subject.id, name: label, count: 1 });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, subjectCatalog]);

  const selectedBookName = selectedBookId
    ? bookOptions.find((b) => b.id === selectedBookId)?.name
    : null;

  const hasActiveFilter = Boolean(
    appliedQuery.trim() ||
      typeCode ||
      difficulty ||
      selectedBookId ||
      selectedSubjectId ||
      groupByBooks,
  );

  /** Chip/book filters over the local cache (refreshed when you open this module). */
  const chipFilteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedBookId && item.book_id !== selectedBookId) return false;
      if (selectedSubjectId) {
        if (subjectMatchIds) {
          if (!subjectMatchIds.has(item.id)) return false;
        } else {
          const tagged = (item.subjects ?? []).some((s) => s.id === selectedSubjectId);
          if (!tagged) return false;
        }
      }
      if (typeCode && item.question_type_code !== typeCode) return false;
      if (difficulty && item.difficulty !== difficulty) return false;
      return true;
    });
  }, [items, selectedBookId, selectedSubjectId, subjectMatchIds, typeCode, difficulty]);

  /**
   * Search runs against the full filtered cache (not only the first page), so results include
   * questions still syncing/loaded in the background SQLite store.
   */
  const searchResults = useMemo(
    () =>
      searchQuestionsByText(appliedQuery, chipFilteredItems, (item) => ({
        bodyEn: item.body_en,
        bodyBn: item.body_bn,
      })),
    [chipFilteredItems, appliedQuery],
  );

  const isSearching = Boolean(appliedQuery.trim());

  const filteredAll = useMemo(() => {
    const base = isSearching ? searchResults.map((r) => r.item) : chipFilteredItems;
    if (groupByBooks && !isSearching) return sortForBookGrouping(base);
    return base;
  }, [isSearching, searchResults, chipFilteredItems, groupByBooks]);

  const pagedItems = useMemo(
    () => filteredAll.slice(0, visibleCount),
    [filteredAll, visibleCount],
  );

  const matchById = useMemo(() => {
    if (!isSearching) return new Map<string, number>();
    return new Map(searchResults.map((r) => [r.item.id, Math.round(r.score * 100)]));
  }, [isSearching, searchResults]);

  const bankRows = useMemo(() => {
    if (groupByBooks && !isSearching) return buildBankRows(pagedItems);
    return pagedItems.map(
      (item): BankRow => ({
        kind: 'question',
        key: item.id,
        item,
        match: matchById.get(item.id),
      }),
    );
  }, [groupByBooks, isSearching, pagedItems, matchById]);

  const hasMore = visibleCount < filteredAll.length;

  itemsRef.current = items;
  filteredRef.current = filteredAll;
  setQuestionBankSessionOrder(filteredAll.map((row) => row.id));

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [appliedQuery, typeCode, difficulty, selectedBookId, selectedSubjectId, groupByBooks]);

  useEffect(() => {
    const ids = pagedItems.map((i) => i.id);
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
  }, [pagedItems]);

  const refreshFromCache = useCallback(() => {
    setItems(getCachedQuestionListItems());
  }, []);

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
        // Non-fatal — type chips fall back to raw type code.
      });

    return subscribeQuestionsSync(refreshFromCache);
  }, [refreshFromCache]);

  const loadSubjectCatalog = useCallback(async () => {
    try {
      const rows = await fetchQuestionSubjectCatalog();
      setSubjectCatalog(
        rows.map((r) => ({
          id: r.id,
          name: r.name_bn?.trim() || r.name,
          label: r.label,
        })),
      );
      return rows;
    } catch {
      setSubjectCatalog([]);
      return [] as Array<{ id: string }>;
    }
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) {
      setSubjectMatchIds(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const cached = getCachedQuestionListItems();
      const localTagged = cached.some((item) =>
        (item.subjects ?? []).some((s) => s.id === selectedSubjectId),
      );
      if (localTagged) {
        setSubjectMatchIds(null);
        return;
      }
      try {
        const rows = await fetchQuestionsBySubject(selectedSubjectId);
        if (cancelled) return;
        mergeCachedQuestionSubjects(
          rows.map((r) => ({ id: r.id, subjects: r.subjects ?? [] })),
        );
        setSubjectMatchIds(new Set(rows.map((r) => r.id)));
        refreshFromCache();
      } catch {
        if (!cancelled) setSubjectMatchIds(new Set());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSubjectId, refreshFromCache]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const me = await refreshUserRef.current().catch(() => userRef.current);
      await syncQuestions(questionCacheScopeKey(me));
      const catalog = await loadSubjectCatalog();
      setSelectedSubjectId((current) =>
        current && catalog.some((row) => row.id === current) ? current : null,
      );
      refreshFromCache();
    } catch (err) {
      if (itemsRef.current.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to sync questions');
      }
    } finally {
      setSyncing(false);
    }
  }, [loadSubjectCatalog, refreshFromCache]);

  // Sync once when entering Question Bank — do not re-run when refreshUser updates `user`
  // (that would loop sync every second while the screen stays focused).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setSyncing(true);
        try {
          const me = await refreshUserRef.current().catch(() => userRef.current);
          if (cancelled) return;
          await syncQuestions(questionCacheScopeKey(me));
          if (cancelled) return;
          const catalog = await loadSubjectCatalog();
          if (cancelled) return;
          setSelectedSubjectId((current) =>
            current && catalog.some((row) => row.id === current) ? current : null,
          );
          refreshFromCache();
        } catch (err) {
          if (!cancelled && itemsRef.current.length === 0) {
            setError(err instanceof Error ? err.message : 'Failed to sync questions');
          }
        } finally {
          if (!cancelled) setSyncing(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loadSubjectCatalog, refreshFromCache]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runSync();
    } finally {
      setRefreshing(false);
    }
  }, [runSync]);

  function submitSearch() {
    setAppliedQuery(query.trim());
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
    setSelectedSubjectId(null);
    setSubjectMatchIds(null);
    setGroupByBooks(false);
    setBookMenuOpen(false);
  }

  function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    // Defer so FlatList can finish the current frame before growing data.
    requestAnimationFrame(() => {
      setVisibleCount((n) => Math.min(n + PAGE_SIZE, filteredRef.current.length));
      setLoadingMore(false);
    });
  }

  function openQuestion(item: QuestionListItem) {
    const list = filteredRef.current;
    const index = list.findIndex((row) => row.id === item.id);
    const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;
    void saveQuestionBankLastQuestion({
      id: item.id,
      index: index >= 0 ? index : undefined,
      nextId: next?.id,
    });
    router.push(questionDetailHref(item.id));
  }

  return (
    <View style={styles.root}>
      {loading && items.length === 0 ? (
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
        {canDownloadPdf && filteredAll.length > 0 ? (
          <Pressable
            style={styles.pdfIconBtn}
            onPress={() => setPdfOpen(true)}
            hitSlop={8}
            accessibilityLabel="Download answers PDF for current list"
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.moreIconBtn, bookMenuOpen && styles.moreIconBtnActive]}
          onPress={() => setBookMenuOpen((v) => !v)}
          hitSlop={8}
          accessibilityLabel="Books & Tools options"
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
          <Text style={styles.bookMenuSub}>Group or filter from the local question bank</Text>

          <View style={styles.groupRow}>
            <View style={styles.groupCopy}>
              <Text style={styles.groupLabel}>Group by Books &amp; Tools</Text>
              <Text style={styles.groupHint}>Off = newest publish/edit first</Text>
            </View>
            <Switch
              value={groupByBooks}
              onValueChange={(v) => {
                setGroupByBooks(v);
                setVisibleCount(PAGE_SIZE);
              }}
            />
          </View>

          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} contentContainerStyle={styles.bookMenuList}>
            <Pressable
              style={[styles.bookMenuItem, !selectedBookId && styles.bookMenuItemActive]}
              onPress={() => {
                setSelectedBookId(null);
                setBookMenuOpen(false);
                setVisibleCount(PAGE_SIZE);
              }}
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
                    onPress={() => {
                      setSelectedBookId(book.id);
                      setBookMenuOpen(false);
                      setVisibleCount(PAGE_SIZE);
                    }}
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

      {(selectedBookName || groupByBooks) && (
        <View style={styles.filterChipRow}>
          {groupByBooks ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Grouped by books</Text>
              <Pressable
                onPress={() => setGroupByBooks(false)}
                hitSlop={8}
                accessibilityLabel="Turn off grouping"
              >
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
          {selectedBookName ? (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText} numberOfLines={1}>
                {selectedBookName}
              </Text>
              <Pressable
                onPress={() => setSelectedBookId(null)}
                hitSlop={8}
                accessibilityLabel="Clear book filter"
              >
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {`Showing ${Math.min(visibleCount, filteredAll.length)} of ${filteredAll.length}${
            items.length !== filteredAll.length ? ` · ${items.length} in bank` : ''
          }${syncing ? ' · syncing…' : ''}`}
        </Text>
        {hasActiveFilter ? (
          <Pressable onPress={clearAllFilters} hitSlop={8}>
            <Text style={styles.clearFiltersText}>Clear</Text>
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
        {subjectOptions.length > 0 ? (
          <FlatList
            horizontal
            data={[
              { id: '', label: 'All Subjects' },
              ...subjectOptions.map((s) => ({ id: s.id, label: s.name })),
            ]}
            keyExtractor={(item) => `subject-${item.id || 'all'}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.chip,
                  (selectedSubjectId ?? '') === item.id && styles.chipActive,
                ]}
                onPress={() => setSelectedSubjectId(item.id || null)}
              >
                <Text
                  style={[
                    styles.chipText,
                    (selectedSubjectId ?? '') === item.id && styles.chipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        ) : null}
      </View>

      {loading && items.length === 0 ? null : error && items.length === 0 ? (
        <BookError message={error} />
      ) : (
        <FlatList
          data={bankRows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <BookEmpty
              title={hasActiveFilter ? 'No matches in question bank' : 'No questions found'}
              subtitle={
                hasActiveFilter
                  ? 'Clear filters or search to restore the full list.'
                  : 'Try again later or pull after questions are published.'
              }
            />
          }
          ListFooterComponent={
            <View style={styles.footerWrap}>
              {loadingMore || (hasMore && pagedItems.length > 0) ? (
                <View style={styles.footerLoading}>
                  {loadingMore || hasMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                  <Text style={styles.footerHint}>
                    {hasMore
                      ? `Showing ${pagedItems.length} · scroll for more`
                      : `${filteredAll.length} questions`}
                  </Text>
                </View>
              ) : filteredAll.length > 0 ? (
                <Text style={styles.footerHint}>{filteredAll.length} questions</Text>
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
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => openQuestion(item)}
              >
                <View style={styles.cardBody}>
                  <Text style={styles.cardText} numberOfLines={4}>
                    {item.body_en}
                  </Text>
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
      {canDownloadPdf ? (
        <AnswerPdfDownloadSheet
          visible={pdfOpen}
          questionIds={filteredAll.map((q) => q.id)}
          scopeLabel={`${Math.min(filteredAll.length, 40)} of ${filteredAll.length} in current sort/filter`}
          onClose={() => setPdfOpen(false)}
        />
      ) : null}
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
  pdfIconBtn: {
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
    maxHeight: 340,
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
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
  },
  groupCopy: { flex: 1, gap: 2 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  groupHint: { fontSize: 11, color: colors.textMuted },
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 8,
  },
  footerHint: {
    textAlign: 'center',
    paddingVertical: spacing.xs,
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
