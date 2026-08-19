import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { ReadCountBadge, ReadFilterChips, matchesReadFilter, type ReadFilter } from '@/components/questions/ReadCountBadge';
import { AnswerDwellRecorder } from '@/components/questions/AnswerDwellRecorder';
import { useAnswerHistory } from '@/hooks/useAnswerHistory';
import { fetchQuestionEvaluationsBatchChunked, type QuestionEvalBrief } from '@/lib/evaluation-api';
import { cleanBookLabel } from '@/lib/book-display';
import {
  loadMarathonLastQuestion,
  saveMarathonLastQuestion,
  type MarathonLastQuestion,
} from '@/lib/marathon-progress';
import { getCachedMarathonItems, getCachedQuestionSubjectLabel } from '@/lib/questions-db';
import { subscribeQuestionsSync, syncQuestions } from '@/lib/questions-sync';
import { questionCacheScopeKey } from '@/lib/subject-scope';
import { useAuth } from '@/lib/auth-context';
import { questionMatchScore } from '@/lib/question-search';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { SaveButton } from '@/components/ui/SaveButton';
import { BlockingLoader } from '@/components/ui/BlockingLoader';
import { stripHtml } from '@/lib/book-display';
import type { MarathonExplanationSection, MarathonReviewItem } from '@/types/marathon';
import { colors, spacing } from '@/theme';

type ShowMode = 'questions' | 'with_answers';

type ChapterGroup = {
  chapter_id: string;
  chapter_label: string;
  items: MarathonReviewItem[];
};

type BookGroup = {
  book_id: string;
  book_name: string;
  chapters: ChapterGroup[];
};

/** Prefer Bengali stem; fall back to English if BN is empty. */
function marathonQuestionText(bodyEn?: string | null, bodyBn?: string | null) {
  const bn = bodyBn?.trim() ?? '';
  const en = bodyEn?.trim() ?? '';
  return bn || en;
}

function isGenericTitle(title?: string) {
  const t = title?.trim().toLowerCase() ?? '';
  return !t || t === 'explanation' || t === 'explanations' || t === 'answer' || t === 'answers';
}

function groupByBookChapter(items: MarathonReviewItem[]): BookGroup[] {
  const bookMap = new Map<string, BookGroup>();

  for (const item of items) {
    let book = bookMap.get(item.book_id);
    if (!book) {
      book = { book_id: item.book_id, book_name: item.book_name, chapters: [] };
      bookMap.set(item.book_id, book);
    }
    let chapter = book.chapters.find((c) => c.chapter_id === item.chapter_id);
    if (!chapter) {
      const no = cleanBookLabel(item.chapter_number);
      const name = cleanBookLabel(item.chapter_name) || item.chapter_name;
      chapter = {
        chapter_id: item.chapter_id,
        chapter_label: no ? `${no}: ${name}` : name,
        items: [],
      };
      book.chapters.push(chapter);
    }
    chapter.items.push(item);
  }

  return [...bookMap.values()];
}

function AnswerBlocks({
  itemId,
  sections,
}: {
  itemId: string;
  sections: MarathonExplanationSection[];
}) {
  return (
    <View style={styles.answerWrap}>
      {sections.map((sec, idx) => {
        const title = sec.title?.trim();
        const showTitle = title && !isGenericTitle(title);
        return (
          <View key={`${itemId}-ans-${idx}`} style={styles.answerRow}>
            <View style={styles.answerSquare} />
            <View style={styles.answerContent}>
              {showTitle ? <Text style={styles.answerTitle}>{title}</Text> : null}
              {sec.details?.trim() ? (
                <BookRichText html={sec.details} style={styles.answerText} />
              ) : null}
              {sec.note?.trim() ? (
                <BookRichText html={sec.note} style={styles.answerNote} />
              ) : null}
              {(sec.subsections ?? []).map((sub, si) => (
                <View key={`${itemId}-sub-${idx}-${si}`} style={styles.subBlock}>
                  {sub.subtitle?.trim() && !isGenericTitle(sub.subtitle) ? (
                    <Text style={styles.subTitle}>{sub.subtitle.trim()}</Text>
                  ) : null}
                  {sub.details?.trim() ? (
                    <BookRichText html={sub.details} style={styles.answerText} />
                  ) : null}
                  {sub.note?.trim() ? (
                    <BookRichText html={sub.note} style={styles.answerNote} />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function MarathonReviewScreen() {
  const { user, refreshUser } = useAuth();
  const { isSaved, toggle } = useSavedShortcuts();
  const [items, setItems] = useState<MarathonReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [mode, setMode] = useState<ShowMode>('questions');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [resumeTarget, setResumeTarget] = useState<MarathonLastQuestion | null>(null);
  const [resumeReady, setResumeReady] = useState(false);
  const [resuming, setResuming] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const { readCountById } = useAnswerHistory();
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const bookOffsets = useRef<Record<string, number>>({});
  const didResume = useRef(false);
  const itemsRef = useRef<MarathonReviewItem[]>([]);
  const userRef = useRef(user);
  const refreshUserRef = useRef(refreshUser);
  itemsRef.current = items;
  userRef.current = user;
  refreshUserRef.current = refreshUser;

  const refreshFromCache = useCallback(() => {
    setItems(getCachedMarathonItems());
  }, []);

  useEffect(() => {
    void loadMarathonLastQuestion().then((pos) => {
      setResumeTarget(pos);
      if (pos) setHighlightId(pos.id);
      else setResuming(false);
      setResumeReady(true);
    });
  }, []);

  // Local read is instant; the network sync just refreshes what's already on screen.
  useEffect(() => {
    setError('');
    try {
      refreshFromCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marathon review');
    } finally {
      setLoading(false);
    }
    return subscribeQuestionsSync(refreshFromCache);
  }, [refreshFromCache]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const me = await refreshUserRef.current().catch(() => userRef.current);
      await syncQuestions(questionCacheScopeKey(me));
      refreshFromCache();
    } catch (err) {
      if (itemsRef.current.length === 0) {
        setError(err instanceof Error ? err.message : 'Failed to sync marathon review');
      }
    } finally {
      setSyncing(false);
    }
  }, [refreshFromCache]);

  // Sync once on enter — avoid re-running when refreshUser updates `user` while focused.
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
          refreshFromCache();
        } catch (err) {
          if (!cancelled && itemsRef.current.length === 0) {
            setError(err instanceof Error ? err.message : 'Failed to sync marathon review');
          }
        } finally {
          if (!cancelled) setSyncing(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [refreshFromCache]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRevealedIds(new Set());
    didResume.current = false;
    try {
      await runSync();
    } finally {
      setRefreshing(false);
    }
  }, [runSync]);

  /**
   * Client-side smart search — no API reload when query changes. Any query word matching
   * anywhere counts, 50%+ overall match required (same standard as the web admin's link-search).
   * Matched items keep their original book/chapter/number order — Marathon's numbering and
   * answer-reveal flow depend on it, unlike Question Bank's flatter list.
   */
  const filteredItems = useMemo(() => {
    const q = appliedQuery.trim();
    const searched = !q
      ? items
      : items.filter((item) => questionMatchScore(q, item.body_en, item.body_bn) >= 0.5);
    return searched.filter((item) => matchesReadFilter(readCountById.get(item.id), readFilter));
  }, [items, appliedQuery, readFilter, readCountById]);

  const groups = useMemo(() => groupByBookChapter(filteredItems), [filteredItems]);

  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());
  useEffect(() => {
    const ids = filteredItems.map((i) => i.id);
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
  }, [filteredItems]);

  const bookOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const item of items) {
      const existing = map.get(item.book_id);
      if (existing) existing.count += 1;
      else map.set(item.book_id, { id: item.book_id, name: item.book_name, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);
  const visibleGroups = useMemo(
    () => (selectedBookId ? groups.filter((g) => g.book_id === selectedBookId) : groups),
    [groups, selectedBookId],
  );
  const visibleCount = useMemo(
    () => visibleGroups.reduce((n, g) => n + g.chapters.reduce((m, c) => m + c.items.length, 0), 0),
    [visibleGroups],
  );

  const hasActiveFilter = Boolean(appliedQuery.trim() || selectedBookId || readFilter !== 'all');

  function submitSearch() {
    setAppliedQuery(searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft('');
    setAppliedQuery('');
    setSearchOpen(false);
  }

  function toggleBookMenu() {
    setBookMenuOpen((v) => {
      const next = !v;
      if (next) setSearchOpen(false);
      return next;
    });
  }

  function selectBook(bookId: string | null) {
    setSelectedBookId(bookId);
    setBookMenuOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  }

  function rememberQuestion(item: MarathonReviewItem) {
    const pos: MarathonLastQuestion = {
      id: item.id,
      number: item.number,
      scroll_y: scrollYRef.current,
    };
    setHighlightId(item.id);
    void saveMarathonLastQuestion(pos);
    setResumeTarget(pos);
  }

  useEffect(() => {
    if (!resumeReady || didResume.current || !resumeTarget || items.length === 0) {
      return;
    }
    if (loading) return;
    // Only resume on the full list (no book filter / search) so scroll offsets stay valid
    if (hasActiveFilter) {
      didResume.current = true;
      setResuming(false);
      return;
    }

    const match =
      items.find((i) => i.id === resumeTarget.id) ??
      items.find((i) => i.number === resumeTarget.number);

    if (match) setHighlightId(match.id);

    const y = Math.max(0, resumeTarget.scroll_y);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      scrollYRef.current = y;
      didResume.current = true;
      setResuming(false);
    }, 150);

    return () => clearTimeout(t);
  }, [resumeReady, loading, resumeTarget, items, hasActiveFilter]);

  // Safety net: an empty bank (or one where resume never resolves) shouldn't loop the loader forever.
  useEffect(() => {
    if (!loading && resumeReady && items.length === 0) setResuming(false);
  }, [loading, resumeReady, items]);

  function toggleReveal(item: MarathonReviewItem) {
    rememberQuestion(item);
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  /**
   * With hundreds of questions mounted in one non-virtualized ScrollView, toggling reveal
   * re-renders the whole list — on a big loaded set that can take a beat. Show a spinner on the
   * tapped row immediately, then defer the actual (expensive) toggle a tick so the spinner has a
   * chance to paint first — otherwise the tap looks unresponsive and users tap repeatedly.
   */
  function handleQuestionPress(item: MarathonReviewItem) {
    setPendingRevealId(item.id);
    setTimeout(() => {
      toggleReveal(item);
      setPendingRevealId(null);
    }, 0);
  }

  function setShowMode(next: ShowMode) {
    setMode(next);
    if (next === 'with_answers') setRevealedIds(new Set());
  }

  const selectedBookName = selectedBookId
    ? bookOptions.find((b) => b.id === selectedBookId)?.name
    : null;

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, mode === 'questions' && styles.toggleBtnActive]}
            onPress={() => setShowMode('questions')}
          >
            <Text style={[styles.toggleText, mode === 'questions' && styles.toggleTextActive]}>
              Questions
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === 'with_answers' && styles.toggleBtnActive]}
            onPress={() => setShowMode('with_answers')}
          >
            <Text style={[styles.toggleText, mode === 'with_answers' && styles.toggleTextActive]}>
              With answers
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.searchIconBtn, searchOpen && styles.searchIconBtnActive]}
          onPress={() => {
            setSearchOpen((v) => !v);
            setBookMenuOpen(false);
          }}
          hitSlop={8}
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={20} color={searchOpen ? colors.white : colors.primary} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search MCQ text…"
            placeholderTextColor={colors.textMuted}
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            autoFocus
          />
          <Pressable style={styles.searchAction} onPress={submitSearch}>
            <Text style={styles.searchActionText}>Search</Text>
          </Pressable>
          {appliedQuery ? (
            <Pressable style={styles.clearAction} onPress={clearSearch}>
              <Text style={styles.clearActionText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={{ paddingBottom: spacing.sm }}>
        <ReadFilterChips value={readFilter} onChange={setReadFilter} />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoTextCol}>
          {mode === 'questions' ? (
            <Text style={styles.hint}>Tap or press & hold a question to show the answer</Text>
          ) : null}
          <Text style={styles.meta}>
            {hasActiveFilter
              ? `Showing ${visibleCount} of ${items.length} loaded`
              : `${visibleCount} Questions`}
            {syncing ? ' · syncing…' : ''}
            {appliedQuery ? ` · “${appliedQuery}”` : ''}
            {selectedBookName ? ` · ${selectedBookName}` : ''}
            {resumeTarget && !appliedQuery
              ? ` · resume #${resumeTarget.number}`
              : ''}
            {mode === 'with_answers'
              ? ' · answers shown'
              : revealedIds.size > 0
                ? ` · ${revealedIds.size} revealed`
                : ''}
          </Text>
        </View>

        <Pressable
          style={[styles.moreIconBtn, bookMenuOpen && styles.moreIconBtnActive]}
          onPress={toggleBookMenu}
          hitSlop={8}
          accessibilityLabel="Books and tools with MCQ"
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
          <Text style={styles.bookMenuTitle}>Books &amp; Tools with MCQ</Text>
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
              <Text style={styles.bookMenuEmpty}>No books with MCQs loaded yet.</Text>
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

      {error && items.length > 0 ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <BookLoading />
      ) : error && items.length === 0 ? (
        <BookError message={error} />
      ) : items.length === 0 ? (
        <BookEmpty
          title="No MCQ questions found"
          subtitle="Published MCQs linked to books and chapters will appear here."
        />
      ) : visibleGroups.length === 0 ? (
        <BookEmpty
          title={hasActiveFilter ? 'No matches in loaded questions' : 'No questions in this book'}
          subtitle={
            hasActiveFilter
              ? 'Clear search or book filter to see all loaded MCQs.'
              : 'Pick another book from the ⋮ menu.'
          }
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.list}
          scrollEventThrottle={16}
          onScroll={onScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {visibleGroups.map((book) => (
            <View
              key={book.book_id}
              style={styles.bookBlock}
              onLayout={(e) => {
                bookOffsets.current[book.book_id] = e.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.bookTitle}>{book.book_name}</Text>
              {book.chapters.map((chapter) => (
                <View key={chapter.chapter_id} style={styles.chapterBlock}>
                  <Text style={styles.chapterTitle}>{chapter.chapter_label}</Text>
                  {chapter.items.map((item) => {
                    const text = marathonQuestionText(item.body_en, item.body_bn);
                    const sections = item.explanation_sections ?? [];
                    const revealed = revealedIds.has(item.id);
                    const showAnswer = mode === 'with_answers' || revealed;
                    const questionsOnly = mode === 'questions';
                    const isResume = highlightId === item.id;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.questionRowWrap,
                          isResume && styles.questionRowResumeWrap,
                        ]}
                      >
                        <Pressable
                          style={({ pressed }) => [
                            styles.questionRow,
                            pressed && questionsOnly && styles.questionRowPressed,
                            questionsOnly && revealed && styles.questionRowRevealed,
                            isResume && styles.questionRowResume,
                          ]}
                          onPress={() => {
                            if (questionsOnly) {
                              handleQuestionPress(item);
                            } else {
                              rememberQuestion(item);
                            }
                          }}
                          onLongPress={
                            questionsOnly
                              ? () => handleQuestionPress(item)
                              : () => rememberQuestion(item)
                          }
                          delayLongPress={350}
                        >
                          {pendingRevealId === item.id ? (
                            <ActivityIndicator size="small" color={colors.primary} style={styles.numberSpinner} />
                          ) : (
                            <Text style={styles.number}>{item.number}.</Text>
                          )}
                          <View style={styles.questionBody}>
                            <BookRichText html={text} style={styles.questionText} />
                            {showAnswer ? (
                              sections.length > 0 ? (
                                <AnswerBlocks itemId={item.id} sections={sections} />
                              ) : (
                                <View style={styles.answerRow}>
                                  <View style={styles.answerSquare} />
                                  <Text style={styles.answerMissing}>Not set</Text>
                                </View>
                              )
                            ) : null}
                            {questionsOnly && revealed ? (
                              <AnswerDwellRecorder
                                id={item.id}
                                bodyEn={item.body_en}
                                bodyBn={item.body_bn}
                                subtitle={item.book_name}
                                subject={getCachedQuestionSubjectLabel(item.id)}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                        <View style={styles.ratingWrap}>
                          <ReadCountBadge questionId={item.id} count={readCountById.get(item.id)} />
                          <RatingIndicator evaluation={evalMap.get(item.id)} />
                        </View>
                        <SaveButton
                          saved={isSaved(item.id, 'marathon')}
                          onPress={() =>
                            void toggle({
                              id: item.id,
                              kind: 'marathon',
                              title: stripHtml(marathonQuestionText(item.body_en, item.body_bn)).slice(
                                0,
                                120,
                              ),
                              subtitle: `${item.book_name} · ${chapter.chapter_label}`,
                              book_id: item.book_id,
                              chapter_id: item.chapter_id,
                              number: item.number,
                            })
                          }
                          size={20}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
          {items.length > 0 ? (
            <Text style={styles.footerHint}>
              {items.length} questions loaded
            </Text>
          ) : null}
        </ScrollView>
      )}
      {resuming ? <BlockingLoader label="Loading Marathon Review…" /> : null}
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
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  toggleRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.white,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    paddingBottom: spacing.sm,
  },
  infoTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  searchIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    backgroundColor: '#e8f3fa',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filterChipText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  searchAction: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  searchActionText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  clearAction: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  clearActionText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
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
  footerHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  list: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  bookBlock: {
    gap: spacing.md,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  chapterBlock: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  questionRowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  ratingWrap: {
    paddingTop: 12,
    paddingHorizontal: 2,
    alignItems: 'flex-end',
    gap: 4,
  },
  questionRowResumeWrap: {
    backgroundColor: '#eaf7ee',
    borderRadius: 10,
    paddingRight: 4,
  },
  questionRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  questionRowPressed: {
    opacity: 0.85,
  },
  questionRowRevealed: {
    backgroundColor: '#f7fbfe',
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  questionRowResume: {
    backgroundColor: '#eef7fc',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  number: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    paddingTop: 1,
  },
  numberSpinner: {
    width: 28,
    paddingTop: 1,
  },
  questionBody: {
    flex: 1,
    gap: 4,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '500',
  },
  answerWrap: {
    marginTop: 8,
    gap: 8,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  answerSquare: {
    width: 10,
    height: 10,
    marginTop: 5,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  answerContent: {
    flex: 1,
    gap: 4,
  },
  answerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  answerText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  answerNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  answerMissing: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingTop: 2,
  },
  subBlock: {
    marginTop: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});
